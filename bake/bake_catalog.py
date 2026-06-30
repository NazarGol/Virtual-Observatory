"""
The science bake (spec section 2): Gaia DR3 local volume (default 300 pc) plus a Hipparcos
bright-star supplement, transformed into the galactic Cartesian catalog the engine consumes.

This is the DATA deliverable. It is separate from the validation path: the section 3 tests
run offline from the curated catalog/test_stars.json and never touch this. Running this
hits the Gaia archive (and Vizier) over the network and can return a large table, so it is
parameterised; the default is a runnable bright subset, and `--full` removes the limits.

Output schema matches catalog/test_stars.json exactly, so the engine and renderer consume
either interchangeably.

Examples:
    python bake_catalog.py                       # bright subset (G<6.5, <=5000 rows) + Hipparcos
    python bake_catalog.py --maglim 4 --limit 500
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
    """Coerce a (possibly masked / NaN / None) table value to a plain finite float."""
    try:
        if x is None or np.ma.is_masked(x):
            return default
        f = float(x)
        return f if math.isfinite(f) else default
    except (ValueError, TypeError):
        return default


def galactic_cartesian(sc):
    gal = sc.galactic
    gal.representation_type = CartesianRepresentation
    gal.differential_type = CartesianDifferential
    cart = gal.cartesian
    pos = [float(cart.x.to_value(u.pc)), float(cart.y.to_value(u.pc)), float(cart.z.to_value(u.pc))]
    diff = cart.differentials["s"]
    vel = [
        float(diff.d_x.to_value(u.km / u.s)),
        float(diff.d_y.to_value(u.km / u.s)),
        float(diff.d_z.to_value(u.km / u.s)),
    ]
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
    job = Gaia.launch_job_async(adql)
    tbl = job.get_results()
    print(f"[gaia] {len(tbl)} rows", flush=True)

    stars = []
    for r in tbl:
        plx = float(r["parallax"])
        r_geo = r["r_med_geo"]
        if r_geo is not None and np.isfinite(r_geo):
            dist_pc = float(r_geo)
        elif plx > 0:
            dist_pc = 1000.0 / plx
        else:
            continue
        rv_raw = r["radial_velocity"]
        if rv_raw is None or np.ma.is_masked(rv_raw) or not math.isfinite(float(rv_raw)):
            has_rv, rv = False, 0.0
        else:
            has_rv, rv = True, float(rv_raw)
        sc = SkyCoord(
            ra=float(r["ra"]) * u.deg, dec=float(r["dec"]) * u.deg,
            distance=dist_pc * u.pc,
            pm_ra_cosdec=float(r["pmra"]) * u.mas / u.yr,
            pm_dec=float(r["pmdec"]) * u.mas / u.yr,
            radial_velocity=rv * u.km / u.s, obstime=J2000, frame="icrs",
        )
        pos, vel = galactic_cartesian(sc)
        stars.append({
            "id": f"Gaia DR3 {int(r['source_id'])}",
            "name": "",
            "pos_pc": pos, "vel_kms": vel,
            "mag_ref": jnum(r["phot_g_mean_mag"], 99.0), "d_ref_pc": dist_pc,
            "bp_rp": jnum(r["bp_rp"], 0.8), "has_rv": has_rv,
            "_ra": float(r["ra"]), "_dec": float(r["dec"]),
        })
    return stars


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

    stars = []
    for r in tbl:
        try:
            plx = float(r["Plx"])
            if not np.isfinite(plx) or plx <= 0:
                continue
            dist_pc = 1000.0 / plx
            ra, dec = float(r["_RAJ2000"]), float(r["_DEJ2000"])
            # Hipparcos has no radial velocity here; propagate RV=0 (has_rv=False).
            sc = SkyCoord(
                ra=ra * u.deg, dec=dec * u.deg, distance=dist_pc * u.pc,
                pm_ra_cosdec=float(r["pmRA"]) * u.mas / u.yr,
                pm_dec=float(r["pmDE"]) * u.mas / u.yr,
                radial_velocity=0.0 * u.km / u.s, obstime=J2000, frame="icrs",
            )
            pos, vel = galactic_cartesian(sc)
            bv = jnum(r["B-V"], 0.6) if "B-V" in tbl.colnames else 0.6
            stars.append({
                "id": f"HIP{int(r['HIP'])}", "name": "",
                "pos_pc": pos, "vel_kms": vel,
                "mag_ref": jnum(r["Vmag"], 99.0), "d_ref_pc": dist_pc,
                "bp_rp": bv, "has_rv": False,
                "_ra": ra, "_dec": dec,
            })
        except (ValueError, TypeError):
            continue
    return stars


def merge_prefer_hipparcos(gaia_stars, hip_stars, sep_arcsec=2.0):
    """Append Hipparcos bright stars, dropping any Gaia row within sep_arcsec of one
    (Gaia saturates bright; prefer Hipparcos there). Simple positional dedup (section 2.3)."""
    if not hip_stars:
        return gaia_stars
    hip_dirs = np.array([
        [np.cos(np.radians(s["_dec"])) * np.cos(np.radians(s["_ra"])),
         np.cos(np.radians(s["_dec"])) * np.sin(np.radians(s["_ra"])),
         np.sin(np.radians(s["_dec"]))] for s in hip_stars
    ])
    cos_tol = np.cos(np.radians(sep_arcsec / 3600.0))
    kept = []
    for g in gaia_stars:
        gd = np.array([
            np.cos(np.radians(g["_dec"])) * np.cos(np.radians(g["_ra"])),
            np.cos(np.radians(g["_dec"])) * np.sin(np.radians(g["_ra"])),
            np.sin(np.radians(g["_dec"])),
        ])
        if np.max(hip_dirs @ gd) >= cos_tol:
            continue  # superseded by a Hipparcos entry
        kept.append(g)
    return kept + hip_stars


def main():
    ap = argparse.ArgumentParser(description="Bake the Gaia+Hipparcos science catalog.")
    ap.add_argument("--radius-pc", type=float, default=300.0)
    ap.add_argument("--maglim", type=float, default=6.5, help="Gaia G limit (ignored with --full)")
    ap.add_argument("--limit", type=int, default=5000, help="Gaia row cap (ignored with --full)")
    ap.add_argument("--full", action="store_true", help="entire volume, no mag/row limit (large)")
    ap.add_argument("--no-hipparcos", action="store_true")
    ap.add_argument("--hip-vmaglim", type=float, default=4.0)
    ap.add_argument("--out", default=os.path.join(REPO, "catalog", "local_volume_300pc.json"))
    args = ap.parse_args()

    try:
        gaia = fetch_gaia(args.radius_pc, args.maglim, args.limit, args.full)
        hip = [] if args.no_hipparcos else fetch_hipparcos(args.radius_pc, args.hip_vmaglim)
    except Exception as e:  # network / archive errors are expected in some environments
        print(f"\nERROR contacting the archives: {e}\n"
              "The science bake needs network access to the Gaia archive / Vizier.\n"
              "The section 3 validation suite does NOT need this and runs offline.",
              file=sys.stderr)
        sys.exit(2)

    stars = merge_prefer_hipparcos(gaia, hip)
    for s in stars:  # drop the private cross-match helpers before writing
        s.pop("_ra", None)
        s.pop("_dec", None)

    catalog = {
        "schema_version": "0.1",
        "frame": "galactic_cartesian_pc",
        "epoch": "J2000.0",
        "note": (f"Gaia DR3 (<{args.radius_pc}pc){'' if args.full else f', G<{args.maglim}, <= {args.limit} rows'}"
                 f"{'' if args.no_hipparcos else f' + Hipparcos Vmag<{args.hip_vmaglim}'}. "
                 "Bailer-Jones distances where available."),
        "stars": stars,
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(catalog, f)
    print(f"\nwrote {len(stars)} stars -> {os.path.relpath(args.out, REPO)}")


if __name__ == "__main__":
    main()
