"""
The science bake (spec section 2): Gaia DR3 local volume (default 300 pc) plus a Hipparcos
bright-star supplement, transformed into the galactic Cartesian catalog the engine consumes.

This is the DATA deliverable. It is separate from the validation path: the section 3 tests
run offline from the curated catalog/test_stars.json and never touch this. Running this
hits the Gaia archive (and Vizier) over the network and can return a large table, so it is
parameterised; the default is a naked-eye-complete bright sky, and `--full` removes the
magnitude limit entirely (millions of rows -- slow).

Output schema matches catalog/test_stars.json exactly, so the engine and renderer consume
either interchangeably. Star construction is vectorised (one SkyCoord per source set, one
frame transform) so it scales from a few hundred to the full volume without a Python loop
over astropy objects.

Examples:
    python bake_catalog.py                       # naked-eye sky: Gaia G<6.5 + Hipparcos V<6.5
    python bake_catalog.py --maglim 8            # deeper (binoculars)
    python bake_catalog.py --full                # entire 300 pc volume (large, slow)
    python bake_catalog.py --no-hipparcos --out catalog/gaia_only.json

Known simplifications carried here (also see README / spec section 2.3):
    - Distances: Bailer-Jones (2021) r_med_geo where available, else 1/parallax for
      parallax_over_error > 5. Stars failing both are dropped.
    - Missing RV -> propagated as RV=0, flagged via has_rv=false.
    - Differential extinction ignored (pure inverse-square magnitude shift only).
    - Single passband (Gaia G; Hipparcos-sourced bright stars carry their V there).
    - Hipparcos cross-match is a simple positional dedup (<2 arcsec), preferring Hipparcos
      for the bright end where Gaia saturates.
"""
import argparse
import json
import math
import os
import sys

import numpy as np
import astropy.units as u
from astropy.coordinates import (
    SkyCoord, CartesianRepresentation, CartesianDifferential,
)
from astropy.time import Time

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J2000 = Time("J2000.0")


def jnum(x, default):
    """Coerce a single (possibly masked / NaN / None) value to a plain finite float."""
    try:
        if x is None or np.ma.is_masked(x):
            return default
        f = float(x)
        return f if math.isfinite(f) else default
    except (ValueError, TypeError):
        return default


def fcol(tbl, name, fill=np.nan):
    """Extract a table column as a plain float ndarray, masked entries -> fill."""
    c = tbl[name]
    arr = np.asarray(np.ma.getdata(c), dtype=float)
    return np.where(np.ma.getmaskarray(c), fill, arr)


def galactic_cartesian_arrays(sc):
    """Vectorised: SkyCoord (N sources) -> (pos[N,3] pc, vel[N,3] km/s) in galactic Cartesian."""
    gal = sc.galactic
    gal.representation_type = CartesianRepresentation
    gal.differential_type = CartesianDifferential
    cart = gal.cartesian
    pos = np.stack(
        [cart.x.to_value(u.pc), cart.y.to_value(u.pc), cart.z.to_value(u.pc)], axis=-1
    )
    d = cart.differentials["s"]
    vel = np.stack(
        [d.d_x.to_value(u.km / u.s), d.d_y.to_value(u.km / u.s), d.d_z.to_value(u.km / u.s)],
        axis=-1,
    )
    return pos, vel


def fetch_gaia(radius_pc, maglim, limit, full):
    from astroquery.gaia import Gaia

    min_parallax = 1000.0 / radius_pc  # mas
    top = "" if full else f"TOP {limit}"
    mag_clause = "" if full else f"AND g.phot_g_mean_mag < {maglim}"
    adql = f"""
        SELECT {top}
          g.source_id, g.ra, g.dec, g.parallax, g.parallax_over_error,
          g.pmra, g.pmdec, g.radial_velocity, g.phot_g_mean_mag, g.bp_rp,
          d.r_med_geo
        FROM gaiadr3.gaia_source AS g
        LEFT JOIN external.gaiaedr3_distance AS d ON g.source_id = d.source_id
        WHERE g.parallax > {min_parallax}
          AND g.parallax_over_error > 5
          AND g.pmra IS NOT NULL AND g.pmdec IS NOT NULL
          {mag_clause}
        ORDER BY g.phot_g_mean_mag ASC
    """
    print(f"[gaia] querying DR3: r<{radius_pc}pc (plx>{min_parallax:.3f}mas)"
          f"{'' if full else f', G<{maglim}, TOP {limit}'} ...", flush=True)
    tbl = Gaia.launch_job_async(adql).get_results()
    print(f"[gaia] {len(tbl)} rows returned", flush=True)
    if len(tbl) == 0:
        return [], 0

    ra, dec = fcol(tbl, "ra"), fcol(tbl, "dec")
    plx = fcol(tbl, "parallax")
    pmra, pmdec = fcol(tbl, "pmra"), fcol(tbl, "pmdec")
    rv = fcol(tbl, "radial_velocity")
    gmag, bprp = fcol(tbl, "phot_g_mean_mag"), fcol(tbl, "bp_rp")
    r_geo = fcol(tbl, "r_med_geo")
    sid = np.asarray(tbl["source_id"], dtype="int64")

    dist = np.where(np.isfinite(r_geo), r_geo, np.where(plx > 0, 1000.0 / plx, np.nan))
    has_rv = np.isfinite(rv)
    rv_f = np.where(has_rv, rv, 0.0)
    ok = np.isfinite(dist) & (dist > 0) & np.isfinite(pmra) & np.isfinite(pmdec) & np.isfinite(gmag)
    idx = np.where(ok)[0]

    sc = SkyCoord(
        ra=ra[idx] * u.deg, dec=dec[idx] * u.deg, distance=dist[idx] * u.pc,
        pm_ra_cosdec=pmra[idx] * u.mas / u.yr, pm_dec=pmdec[idx] * u.mas / u.yr,
        radial_velocity=rv_f[idx] * u.km / u.s, obstime=J2000, frame="icrs",
    )
    pos, vel = galactic_cartesian_arrays(sc)

    stars = []
    for k, i in enumerate(idx):
        stars.append({
            "id": f"Gaia DR3 {int(sid[i])}", "name": "",
            "pos_pc": [float(pos[k, 0]), float(pos[k, 1]), float(pos[k, 2])],
            "vel_kms": [float(vel[k, 0]), float(vel[k, 1]), float(vel[k, 2])],
            "mag_ref": float(gmag[i]), "d_ref_pc": float(dist[i]),
            "bp_rp": float(bprp[i]) if np.isfinite(bprp[i]) else 0.8,
            "has_rv": bool(has_rv[i]),
            "_ra": float(ra[i]), "_dec": float(dec[i]),
        })
    return stars, len(tbl)


def fetch_hipparcos(radius_pc, vmaglim):
    """
    Bright-star supplement from the original Hipparcos catalogue (I/239/hip_main), which
    carries Johnson Vmag and B-V directly. Best-effort: Vizier quirks must not sink the
    (network-validated) Gaia bake, so on any failure we warn and return []. Positions use
    Vizier's computed J2000 degree columns (_RAJ2000/_DEJ2000) for cross-catalogue safety.
    """
    try:
        from astroquery.vizier import Vizier

        v = Vizier(
            columns=["HIP", "_RAJ2000", "_DEJ2000", "Plx", "pmRA", "pmDE", "Vmag", "B-V"],
            column_filters={"Vmag": f"<{vmaglim}", "Plx": f">{1000.0 / radius_pc}"},
            row_limit=-1,
        )
        print(f"[hip] querying Hipparcos (I/239/hip_main) Vmag<{vmaglim}, r<{radius_pc}pc ...",
              flush=True)
        res = v.get_catalogs("I/239/hip_main")
        if not res:
            print("[hip] no rows", flush=True)
            return []
        tbl = res[0]
        print(f"[hip] {len(tbl)} rows", flush=True)
    except Exception as e:
        print(f"[hip] supplement skipped ({e}); continuing with Gaia only.", file=sys.stderr)
        return []

    ra, dec = fcol(tbl, "_RAJ2000"), fcol(tbl, "_DEJ2000")
    plx = fcol(tbl, "Plx")
    pmra, pmdec = fcol(tbl, "pmRA"), fcol(tbl, "pmDE")
    vmag = fcol(tbl, "Vmag")
    bv = fcol(tbl, "B-V") if "B-V" in tbl.colnames else np.full(len(tbl), np.nan)
    hip = np.asarray(tbl["HIP"], dtype="int64")

    ok = (np.isfinite(plx) & (plx > 0) & np.isfinite(ra) & np.isfinite(dec)
          & np.isfinite(pmra) & np.isfinite(pmdec) & np.isfinite(vmag))
    idx = np.where(ok)[0]
    if len(idx) == 0:
        return []
    dist = 1000.0 / plx

    # Hipparcos hip_main has no radial velocity; propagate RV=0 (has_rv=False).
    sc = SkyCoord(
        ra=ra[idx] * u.deg, dec=dec[idx] * u.deg, distance=dist[idx] * u.pc,
        pm_ra_cosdec=pmra[idx] * u.mas / u.yr, pm_dec=pmdec[idx] * u.mas / u.yr,
        radial_velocity=np.zeros(len(idx)) * u.km / u.s, obstime=J2000, frame="icrs",
    )
    pos, vel = galactic_cartesian_arrays(sc)

    stars = []
    for k, i in enumerate(idx):
        stars.append({
            "id": f"HIP{int(hip[i])}", "name": "",
            "pos_pc": [float(pos[k, 0]), float(pos[k, 1]), float(pos[k, 2])],
            "vel_kms": [float(vel[k, 0]), float(vel[k, 1]), float(vel[k, 2])],
            "mag_ref": float(vmag[i]), "d_ref_pc": float(dist[i]),
            "bp_rp": float(bv[i]) if np.isfinite(bv[i]) else 0.6,
            "has_rv": False,
            "_ra": float(ra[i]), "_dec": float(dec[i]),
        })
    return stars


def merge_prefer_hipparcos(gaia_stars, hip_stars, sep_arcsec=2.0):
    """Append Hipparcos bright stars, dropping any Gaia row within sep_arcsec of one
    (Gaia saturates bright; prefer Hipparcos there). Simple positional dedup (section 2.3)."""
    if not hip_stars:
        return gaia_stars, 0
    def unit(s):
        ra, dec = math.radians(s["_ra"]), math.radians(s["_dec"])
        return [math.cos(dec) * math.cos(ra), math.cos(dec) * math.sin(ra), math.sin(dec)]
    hip_dirs = np.array([unit(s) for s in hip_stars])
    cos_tol = math.cos(math.radians(sep_arcsec / 3600.0))
    kept, dropped = [], 0
    for g in gaia_stars:
        if np.max(hip_dirs @ np.array(unit(g))) >= cos_tol:
            dropped += 1  # superseded by a Hipparcos entry
        else:
            kept.append(g)
    return kept + hip_stars, dropped


def main():
    ap = argparse.ArgumentParser(description="Bake the Gaia+Hipparcos science catalog.")
    ap.add_argument("--radius-pc", type=float, default=300.0)
    ap.add_argument("--maglim", type=float, default=6.5,
                    help="Gaia G limit (default 6.5 = naked eye; ignored with --full)")
    ap.add_argument("--limit", type=int, default=200000,
                    help="Gaia row cap (safety; ignored with --full)")
    ap.add_argument("--full", action="store_true", help="entire volume, no mag limit (large)")
    ap.add_argument("--no-hipparcos", action="store_true")
    ap.add_argument("--hip-vmaglim", type=float, default=6.5)
    ap.add_argument("--out", default=os.path.join(REPO, "catalog", "local_volume_300pc.json"))
    args = ap.parse_args()

    try:
        gaia, gaia_raw = fetch_gaia(args.radius_pc, args.maglim, args.limit, args.full)
        hip = [] if args.no_hipparcos else fetch_hipparcos(args.radius_pc, args.hip_vmaglim)
    except Exception as e:  # network / archive errors are expected in some environments
        print(f"\nERROR contacting the archives: {e}\n"
              "The science bake needs network access to the Gaia archive / Vizier.\n"
              "The section 3 validation suite does NOT need this and runs offline.",
              file=sys.stderr)
        sys.exit(2)

    stars, dropped = merge_prefer_hipparcos(gaia, hip)
    for s in stars:  # drop the private cross-match helpers before writing
        s.pop("_ra", None)
        s.pop("_dec", None)

    capped = (not args.full) and gaia_raw >= args.limit
    catalog = {
        "schema_version": "0.1",
        "frame": "galactic_cartesian_pc",
        "epoch": "J2000.0",
        "note": (f"Gaia DR3 (<{args.radius_pc}pc){'' if args.full else f', G<{args.maglim}'}"
                 f"{'' if args.no_hipparcos else f' + Hipparcos Vmag<{args.hip_vmaglim}'}. "
                 "Bailer-Jones distances where available."),
        "stars": stars,
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(catalog, f)

    print(f"\n[merge] gaia kept {len(gaia) - dropped} (+{dropped} superseded by Hipparcos), "
          f"hipparcos {len(hip)}")
    if capped:
        print(f"WARNING: Gaia hit the TOP {args.limit} cap -- the volume is not complete to "
              f"G<{args.maglim}. Raise --limit (or use --full) for completeness.", file=sys.stderr)
    print(f"wrote {len(stars)} stars -> {os.path.relpath(args.out, REPO)}")


if __name__ == "__main__":
    main()
