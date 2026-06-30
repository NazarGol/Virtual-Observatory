"""
Generate the test catalog and astropy oracle fixtures for the validation suite (spec
section 3). astropy is the single source of truth for frame conventions and space-motion
propagation; the TS engine is validated *against* the artifacts this script emits.

Outputs (paths relative to repo root):
  catalog/test_stars.json
      The deterministic, network-free catalog the engine tests load. Galactic Cartesian
      positions (pc) at epoch J2000, space velocities (km/s), and the photometric source
      term (mag_ref at d_ref_pc). Includes the synthetic Sun-as-a-star at the origin.

  packages/engine/src/galactic_icrs_matrix.ts
      The exact astropy Galactic->ICRS rotation matrix, baked into the engine as a
      constant. This is the frame *definition*; using astropy's own matrix is the correct
      way to guarantee the engine's frame convention matches the bake (it is not the part
      of the math under test -- the propagation and geometry are what the engine computes
      independently).

  packages/engine/test/fixtures/*.json
      sol_identity.json          -> section 3.1 (observer at origin, t=J2000)
      sol_astropy_propagated.json-> section 3.2 (rectilinear propagation, several dt to 1e5 yr)
      barnard_drift.json         -> section 3.3 (high-pm rectilinear drift track over 1e4 yr)
      alphacen_sun.json          -> section 3.4 (Sun seen from Alpha Cen's vantage)
      galactic_icrs_matrix.json  -> lets the test assert the engine's baked matrix == astropy
"""
import json
import os

import numpy as np
import astropy.units as u
from astropy.coordinates import (
    SkyCoord, ICRS, Galactic, CartesianRepresentation, CartesianDifferential,
)
from astropy.time import Time

from star_data import ANCHOR_STARS, SUN_ABS_V

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG_DIR = os.path.join(REPO, "catalog")
ENGINE_SRC = os.path.join(REPO, "packages", "engine", "src")
FIXTURES = os.path.join(REPO, "packages", "engine", "test", "fixtures")

J2000 = Time("J2000.0")


def skycoord_for(star):
    """Build an ICRS SkyCoord with full space motion at epoch J2000."""
    return SkyCoord(
        ra=star["ra_deg"] * u.deg,
        dec=star["dec_deg"] * u.deg,
        distance=(1000.0 / star["parallax_mas"]) * u.pc,
        pm_ra_cosdec=star["pm_ra_cosdec"] * u.mas / u.yr,
        pm_dec=star["pm_dec"] * u.mas / u.yr,
        radial_velocity=star["rv_kms"] * u.km / u.s,
        obstime=J2000,
        frame="icrs",
    )


def galactic_cartesian(sc):
    """Return (pos_pc[3], vel_kms[3]) in the galactic Cartesian frame at epoch J2000."""
    gal = sc.galactic
    gal.representation_type = CartesianRepresentation
    gal.differential_type = CartesianDifferential
    cart = gal.cartesian
    pos = [cart.x.to_value(u.pc), cart.y.to_value(u.pc), cart.z.to_value(u.pc)]
    diff = cart.differentials["s"]
    vel = [
        diff.d_x.to_value(u.km / u.s),
        diff.d_y.to_value(u.km / u.s),
        diff.d_z.to_value(u.km / u.s),
    ]
    return pos, vel


def rectilinear_icrs(sc, dt_yr):
    """
    Rectilinear (constant-velocity, NO light-time) propagation in the ICRS Cartesian
    frame -- the oracle for the engine's Stage-1 model (spec section 4). Returns
    (ra_deg, dec_deg, distance_pc).

    This is deliberately NOT astropy.apply_space_motion. apply_space_motion uses the
    rigorous ERFA starpm model, which adds a light-time / retarded-position correction
    computed for an observer at the solar system barycenter -- a term that does not
    generalize to a relocated observer and is therefore dropped from this project's model
    (see docs/adr/0001-propagation-model.md). What this oracle DOES cross-check, at
    machine precision and via a code path independent of the engine (ICRS cartesian here
    vs. galactic cartesian + rotation in the engine), is every other part: the frame
    rotation, axis conventions, velocity reprojection, and the km/s->pc/yr conversion
    (done here with astropy units, so the engine's hardcoded constant is validated too).
    """
    c = sc.cartesian
    p = u.Quantity([c.x, c.y, c.z]).to(u.pc)
    diff = c.differentials["s"]
    v = u.Quantity([diff.d_x, diff.d_y, diff.d_z]).to(u.km / u.s)
    pt = p + (v * (dt_yr * u.yr)).to(u.pc)
    x, y, z = pt.to_value(u.pc)
    r = float(np.sqrt(x * x + y * y + z * z))
    ra = float(np.degrees(np.arctan2(y, x))) % 360.0
    dec = float(np.degrees(np.arcsin(z / r)))
    return ra, dec, r


def galactic_to_icrs_matrix():
    """
    The exact astropy Galactic->ICRS rotation matrix (3x3), obtained by transforming the
    galactic Cartesian basis vectors into ICRS. Column i is the ICRS image of galactic
    e_i, so M @ v_gal = v_icrs.
    """
    cols = []
    for i in range(3):
        v = np.zeros(3)
        v[i] = 1.0
        g = Galactic(CartesianRepresentation(*(v * u.pc)))
        c = g.transform_to(ICRS()).cartesian
        cols.append([c.x.to_value(u.pc), c.y.to_value(u.pc), c.z.to_value(u.pc)])
    return np.array(cols).T


def radec_from_unit_icrs(vec):
    """ICRS unit vector -> (ra_deg, dec_deg), ra in [0, 360)."""
    x, y, z = vec
    ra = np.degrees(np.arctan2(y, x)) % 360.0
    dec = np.degrees(np.arcsin(np.clip(z, -1.0, 1.0)))
    return float(ra), float(dec)


def build_catalog(M):
    """
    Build the test catalog (galactic Cartesian). Each entry carries a photometric source
    term (mag_ref, d_ref_pc): the apparent magnitude `mag_ref` is the brightness at
    reference distance `d_ref_pc`. For real stars that is the Earth-apparent magnitude at
    the star's J2000 barycentric distance. For the synthetic Sun it is the absolute V
    magnitude at the 10 pc reference -- so the engine's distance-modulus formula
    (mag = mag_ref + 5*log10(d / d_ref_pc)) reduces to m = M_V + 5*log10(d/10).
    """
    stars = []
    for s in ANCHOR_STARS:
        sc = skycoord_for(s)
        pos, vel = galactic_cartesian(sc)
        d_ref = float(np.linalg.norm(pos))  # J2000 barycentric distance == Earth distance
        stars.append({
            "id": s["id"],
            "name": s["name"],
            "pos_pc": pos,
            "vel_kms": vel,
            "mag_ref": s["mag"],
            "d_ref_pc": d_ref,
            "bp_rp": s["bp_rp"],
            "has_rv": s["has_rv"],
        })

    # Synthetic Sun-as-a-star at the galactic origin, zero velocity.
    stars.append({
        "id": "SOL",
        "name": "Sun",
        "pos_pc": [0.0, 0.0, 0.0],
        "vel_kms": [0.0, 0.0, 0.0],
        "mag_ref": SUN_ABS_V,
        "d_ref_pc": 10.0,   # absolute magnitude reference distance
        "bp_rp": 0.82,
        "has_rv": True,
    })

    return {
        "schema_version": "0.1",
        "frame": "galactic_cartesian_pc",
        "epoch": "J2000.0",
        "note": "Curated validation catalog (not the science bake). See bake/star_data.py.",
        "stars": stars,
    }


def fixture_sol_identity(catalog):
    """Section 3.1: observer at origin, t=J2000. Expected ICRS ra/dec + mag per star."""
    out = []
    for st in catalog["stars"]:
        p = np.array(st["pos_pc"])
        dist = float(np.linalg.norm(p))
        if dist == 0.0:
            continue  # the Sun-at-origin has no direction from the origin
        # Re-derive the catalog ICRS ra/dec straight from astropy as the oracle,
        # going galactic cartesian -> ICRS directly.
        gal = Galactic(CartesianRepresentation(*(p * u.pc)))
        icrs = gal.transform_to(ICRS())
        ra = float(icrs.ra.to_value(u.deg)) % 360.0
        dec = float(icrs.dec.to_value(u.deg))
        out.append({
            "id": st["id"],
            "ra_deg": ra,
            "dec_deg": dec,
            "mag": st["mag_ref"] + 5.0 * np.log10(dist / st["d_ref_pc"]),
        })
    return out


def fixture_sol_propagated(catalog):
    """
    Section 3.2: observer at origin, propagate each real star to J2000+dt for several dt
    out to 1e5 yr using the RECTILINEAR oracle (see rectilinear_icrs). Records ICRS ra/dec
    and barycentric distance (which drives the recomputed magnitude).
    """
    dts = [0.0, 10.0, 100.0, 1000.0, 1e4, 5e4, 1e5]
    out = []
    by_id = {s["id"]: s for s in ANCHOR_STARS}
    for st in catalog["stars"]:
        if st["id"] not in by_id:
            continue  # skip synthetic Sun
        sc = skycoord_for(by_id[st["id"]])
        samples = []
        for dt in dts:
            ra, dec, dist = rectilinear_icrs(sc, dt)
            samples.append({
                "dt_yr": dt, "ra_deg": ra, "dec_deg": dec, "distance_pc": dist,
            })
        out.append({"id": st["id"], "d_ref_pc": st["d_ref_pc"],
                    "mag_ref": st["mag_ref"], "samples": samples})
    return out


def fixture_barnard_drift():
    """Section 3.3: Barnard's Star drift track from the Sol vantage over 1e4 yr (rectilinear)."""
    barnard = next(s for s in ANCHOR_STARS if s["name"] == "Barnard's Star")
    sc = skycoord_for(barnard)
    track = []
    for dt in [0, 1000, 2000, 4000, 6000, 8000, 10000]:
        ra, dec, dist = rectilinear_icrs(sc, dt)
        track.append({"dt_yr": float(dt), "ra_deg": ra, "dec_deg": dec,
                      "distance_pc": dist})
    return {"id": barnard["id"], "name": barnard["name"], "track": track}


def fixture_alphacen_sun(catalog, M):
    """
    Section 3.4: place the observer at Alpha Cen's galactic XYZ and look at the Sun (at the
    galactic origin). The Sun must land in Cassiopeia (antipodal to Alpha Cen's direction
    from Earth) at V ~= 0.5.
    """
    alphacen = next(s for s in catalog["stars"] if s["name"] == "Alpha Centauri A")
    obs = np.array(alphacen["pos_pc"])
    sun = next(s for s in catalog["stars"] if s["id"] == "SOL")

    d_vec = np.array(sun["pos_pc"]) - obs       # origin - observer
    dist = float(np.linalg.norm(d_vec))
    dir_gal = d_vec / dist
    dir_icrs = M @ dir_gal
    ra, dec = radec_from_unit_icrs(dir_icrs)
    mag = sun["mag_ref"] + 5.0 * np.log10(dist / sun["d_ref_pc"])

    return {
        "observer_pos_pc": alphacen["pos_pc"],
        "sun_id": "SOL",
        "expected_ra_deg": ra,
        "expected_dec_deg": dec,
        "expected_distance_pc": dist,
        "expected_mag": mag,
        "constellation": "Cassiopeia",
        "note": "Antipodal to Alpha Cen's Earth direction; published result places the Sun in Cassiopeia.",
    }


def write_engine_matrix_ts(M):
    rows = ",\n  ".join(
        "[" + ", ".join(repr(float(v)) for v in M[i]) + "]" for i in range(3)
    )
    ts = (
        "// AUTO-GENERATED by bake/make_fixtures.py -- do not edit by hand.\n"
        "// Exact astropy Galactic->ICRS rotation matrix (3x3). M @ v_gal = v_icrs.\n"
        "// This is the frame DEFINITION, sourced from astropy so the engine's convention\n"
        "// matches the bake. See spec section 3.\n"
        "export const GALACTIC_TO_ICRS: readonly (readonly number[])[] = [\n"
        f"  {rows},\n"
        "];\n"
    )
    with open(os.path.join(ENGINE_SRC, "galactic_icrs_matrix.ts"), "w") as f:
        f.write(ts)


def main():
    os.makedirs(CATALOG_DIR, exist_ok=True)
    os.makedirs(ENGINE_SRC, exist_ok=True)
    os.makedirs(FIXTURES, exist_ok=True)

    M = galactic_to_icrs_matrix()
    catalog = build_catalog(M)

    def dump(path, obj):
        with open(path, "w") as f:
            json.dump(obj, f, indent=2)
        print("wrote", os.path.relpath(path, REPO))

    dump(os.path.join(CATALOG_DIR, "test_stars.json"), catalog)
    dump(os.path.join(FIXTURES, "galactic_icrs_matrix.json"),
         {"galactic_to_icrs": M.tolist()})
    dump(os.path.join(FIXTURES, "sol_identity.json"), fixture_sol_identity(catalog))
    dump(os.path.join(FIXTURES, "sol_astropy_propagated.json"), fixture_sol_propagated(catalog))
    dump(os.path.join(FIXTURES, "barnard_drift.json"), fixture_barnard_drift())
    dump(os.path.join(FIXTURES, "alphacen_sun.json"), fixture_alphacen_sun(catalog, M))

    write_engine_matrix_ts(M)
    print("wrote", os.path.relpath(os.path.join(ENGINE_SRC, "galactic_icrs_matrix.ts"), REPO))


if __name__ == "__main__":
    main()
