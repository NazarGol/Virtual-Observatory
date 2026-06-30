"""
Galactic-orbit propagation bake (the Myr-scale upgrade).

Rectilinear motion is valid to ~1e5 yr; past that the Milky Way potential curves real
stellar orbits. This script produces what the TS engine needs to integrate orbits in a
galactocentric frame, and the oracle to validate that integration:

  packages/engine/src/galactic_frame.ts   (generated constants)
      - G2GC: rotation, heliocentric-galactic axes -> galactocentric axes
      - GC_TO_ICRS: rotation, galactocentric axes -> ICRS axes (for apparent directions)
      - SUN_GALACTOCENTRIC: the Sun's galactocentric position (kpc) + velocity (km/s)
      - MW_POTENTIAL: the bulge+disk+halo parameters (shared with this script)
    All frame quantities come from astropy.coordinates.Galactocentric (the oracle), so the
    engine's frame convention matches it by construction (same discipline as section 3).

  packages/engine/test/fixtures/galactic_orbits.json   (oracle)
      - per star: astropy galactocentric (pos, vel), so the TS helio->galcen transform is
        checked against astropy
      - per star: a scipy RK45 orbit in the SAME potential (the integrator oracle)
      - energy at t0 (conservation reference)

Units throughout the dynamics: kpc, Myr, Msun. Velocity inputs are km/s.
"""
import json
import os

import numpy as np
import astropy.units as u
from astropy.coordinates import (
    Galactic, Galactocentric, ICRS, CartesianRepresentation, CartesianDifferential,
)
from scipy.integrate import solve_ivp

from star_data import ANCHOR_STARS

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENGINE_SRC = os.path.join(REPO, "packages", "engine", "src")
FIXTURES = os.path.join(REPO, "packages", "engine", "test", "fixtures")

KM_S_TO_KPC_MYR = 1.0227121650537077e-3
G = 4.498502151469552e-12  # kpc^3 / (Msun Myr^2)

# A simple but MW-like axisymmetric potential: Hernquist bulge + Miyamoto-Nagai disk + NFW
# halo. (Realism matters less than the engine matching this exactly; we sanity-check that the
# circular speed at R0 is ~220 km/s.)
POT = {
    "bulge": {"M": 5.0e9, "a": 0.5},
    "disk": {"M": 7.0e10, "a": 3.0, "b": 0.28},
    "halo": {"M": 7.0e11, "rs": 16.0},
}


def accel(p):
    """Acceleration (kpc/Myr^2) at galactocentric position p (kpc)."""
    x, y, z = p
    r = np.sqrt(x * x + y * y + z * z) + 1e-12
    R2 = x * x + y * y
    a = np.zeros(3)
    # Hernquist bulge
    Mb, ab = POT["bulge"]["M"], POT["bulge"]["a"]
    a += -G * Mb / (r + ab) ** 2 * (p / r)
    # Miyamoto-Nagai disk
    Md, ad, bd = POT["disk"]["M"], POT["disk"]["a"], POT["disk"]["b"]
    zeta = np.sqrt(z * z + bd * bd)
    denom = (R2 + (ad + zeta) ** 2) ** 1.5
    a[0] += -G * Md * x / denom
    a[1] += -G * Md * y / denom
    a[2] += -G * Md * z * (ad + zeta) / (zeta * denom)
    # NFW halo: Phi = -G M / r * ln(1 + r/rs)
    Mh, rs = POT["halo"]["M"], POT["halo"]["rs"]
    ar = -G * Mh / (r * r) * (np.log(1 + r / rs) - (r / rs) / (1 + r / rs))
    a += ar * (p / r)
    return a


def potential(p):
    x, y, z = p
    r = np.sqrt(x * x + y * y + z * z) + 1e-12
    Mb, ab = POT["bulge"]["M"], POT["bulge"]["a"]
    Md, ad, bd = POT["disk"]["M"], POT["disk"]["a"], POT["disk"]["b"]
    Mh, rs = POT["halo"]["M"], POT["halo"]["rs"]
    phi = -G * Mb / (r + ab)
    phi += -G * Md / np.sqrt(x * x + y * y + (ad + np.sqrt(z * z + bd * bd)) ** 2)
    phi += -G * Mh / r * np.log(1 + r / rs)
    return phi


def circular_speed(R):
    """Circular speed (km/s) in the plane at radius R (kpc), for sanity-checking the model."""
    a = accel(np.array([R, 0.0, 0.0]))
    v_kpc_myr = np.sqrt(R * (-a[0]))
    return v_kpc_myr / KM_S_TO_KPC_MYR


def rot_via_offsets(src_frame_factory):
    """Rotation matrix R (R @ v_src = v_dst) recovered from position offsets, so the frame
    origin offset cancels and only the axis rotation remains."""
    base, cols = None, []
    origin = np.array([8.0, 0.0, 0.0])
    base = src_frame_factory(origin)
    for i in range(3):
        v = np.zeros(3); v[i] = 1.0
        cols.append(src_frame_factory(origin + v) - base)
    return np.array(cols).T


def galactic_to_galactocentric_matrix():
    def f(p_kpc):
        g = Galactic(CartesianRepresentation(*(p_kpc * u.kpc)), representation_type="cartesian")
        c = g.transform_to(Galactocentric()).cartesian
        return np.array([c.x.to_value(u.kpc), c.y.to_value(u.kpc), c.z.to_value(u.kpc)])
    return rot_via_offsets(f)


def galactocentric_to_icrs_matrix():
    def f(p_kpc):
        gc = Galactocentric(CartesianRepresentation(*(p_kpc * u.kpc)))
        c = gc.transform_to(ICRS()).cartesian
        return np.array([c.x.to_value(u.kpc), c.y.to_value(u.kpc), c.z.to_value(u.kpc)])
    return rot_via_offsets(f)


def sun_galactocentric():
    rep = CartesianRepresentation([0, 0, 0] * u.kpc,
                                  differentials=CartesianDifferential([0, 0, 0] * u.km / u.s))
    g = Galactic(rep, representation_type="cartesian", differential_type="cartesian")
    s = g.transform_to(Galactocentric())
    s.representation_type = "cartesian"
    pos = [float(s.x.to_value(u.kpc)), float(s.y.to_value(u.kpc)), float(s.z.to_value(u.kpc))]
    vel = [float(s.v_x.to_value(u.km / u.s)), float(s.v_y.to_value(u.km / u.s)), float(s.v_z.to_value(u.km / u.s))]
    return pos, vel


def star_galactocentric(star):
    sc = ICRS(
        ra=star["ra_deg"] * u.deg, dec=star["dec_deg"] * u.deg,
        distance=(1000.0 / star["parallax_mas"]) * u.pc,
        pm_ra_cosdec=star["pm_ra_cosdec"] * u.mas / u.yr, pm_dec=star["pm_dec"] * u.mas / u.yr,
        radial_velocity=star["rv_kms"] * u.km / u.s,
    )
    gc = sc.transform_to(Galactocentric())
    gc.representation_type = "cartesian"
    gc.differential_type = "cartesian"
    pos = [float(gc.x.to_value(u.kpc)), float(gc.y.to_value(u.kpc)), float(gc.z.to_value(u.kpc))]
    vel = [float(gc.v_x.to_value(u.km / u.s)), float(gc.v_y.to_value(u.km / u.s)), float(gc.v_z.to_value(u.km / u.s))]
    return pos, vel


def integrate_orbit(pos_kpc, vel_kms, times_myr):
    v0 = np.array(vel_kms) * KM_S_TO_KPC_MYR
    y0 = np.concatenate([pos_kpc, v0])

    def rhs(_t, y):
        return np.concatenate([y[3:], accel(y[:3])])

    sol = solve_ivp(rhs, [0, max(times_myr)], y0, t_eval=times_myr,
                    rtol=1e-10, atol=1e-12, method="DOP853")
    return [list(sol.y[:3, i]) for i in range(len(times_myr))]


def fmt_mat(M):
    return "[\n  " + ",\n  ".join("[" + ", ".join(repr(float(v)) for v in row) + "]" for row in M) + ",\n]"


def main():
    os.makedirs(ENGINE_SRC, exist_ok=True)
    os.makedirs(FIXTURES, exist_ok=True)

    G2GC = galactic_to_galactocentric_matrix()
    GC2ICRS = galactocentric_to_icrs_matrix()
    sun_pos, sun_vel = sun_galactocentric()
    vc = circular_speed(8.122)
    print(f"[galactic] circular speed at R0=8.122 kpc: {vc:.1f} km/s")
    print(f"[galactic] Sun galactocentric pos {np.round(sun_pos,4)} kpc, vel {np.round(sun_vel,2)} km/s")

    # generated engine constants
    ts = (
        "// AUTO-GENERATED by bake/make_galactic_fixtures.py -- do not edit by hand.\n"
        "// Galactocentric frame (from astropy) + the Milky Way potential, for galactic-orbit\n"
        "// propagation. Lengths kpc, velocities km/s, masses Msun, time Myr.\n\n"
        f"export const KM_S_TO_KPC_MYR = {KM_S_TO_KPC_MYR!r};\n"
        f"export const G_KPC_MSUN_MYR = {G!r};\n\n"
        "// rotation: heliocentric-galactic axes -> galactocentric axes\n"
        f"export const GALACTIC_TO_GALACTOCENTRIC: readonly (readonly number[])[] = {fmt_mat(G2GC)};\n\n"
        "// rotation: galactocentric axes -> ICRS axes (apparent direction)\n"
        f"export const GALACTOCENTRIC_TO_ICRS: readonly (readonly number[])[] = {fmt_mat(GC2ICRS)};\n\n"
        f"export const SUN_GALACTOCENTRIC = {{ pos_kpc: {sun_pos!r}, vel_kms: {sun_vel!r} }} as const;\n\n"
        f"export const MW_POTENTIAL = {json.dumps(POT)} as const;\n"
    )
    with open(os.path.join(ENGINE_SRC, "galactic_frame.ts"), "w") as f:
        f.write(ts)
    print("wrote packages/engine/src/galactic_frame.ts")

    # oracle fixtures
    times = [0.0, 0.1, 0.3, 0.6, 1.0]
    stars = []
    for s in ANCHOR_STARS:
        pos, vel = star_galactocentric(s)
        orbit = integrate_orbit(np.array(pos), vel, times)
        e0 = float(0.5 * np.dot((np.array(vel) * KM_S_TO_KPC_MYR), (np.array(vel) * KM_S_TO_KPC_MYR)) + potential(np.array(pos)))
        stars.append({
            "id": s["id"], "galcen_pos_kpc": pos, "galcen_vel_kms": vel,
            "orbit_times_myr": times, "orbit_pos_kpc": orbit, "energy0": e0,
        })

    out = {
        "note": "astropy galactocentric states + scipy DOP853 orbits in MW_POTENTIAL; oracle for galactic.ts.",
        "km_s_to_kpc_myr": KM_S_TO_KPC_MYR, "G": G, "potential": POT,
        "circular_speed_R0_kms": vc,
        "sun": {"pos_kpc": sun_pos, "vel_kms": sun_vel},
        "stars": stars,
    }
    with open(os.path.join(FIXTURES, "galactic_orbits.json"), "w") as f:
        json.dump(out, f)
    print(f"wrote {len(stars)} oracle orbits -> packages/engine/test/fixtures/galactic_orbits.json")


if __name__ == "__main__":
    main()
