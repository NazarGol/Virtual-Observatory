"""
Stage-2 (local horizontal frame) oracle fixtures for Phase 1 validation.

Stage 2 is the generated APPARATUS, not Earth, so astropy's Earth-specific AltAz (with
precession/nutation/Earth-rotation-angle) is not the right oracle here. Instead we anchor
to textbook spherical astronomy: this script computes alt/az with the closed-form trig
formulae, a code path independent of the engine's ENU-vector projection. For the Sol world
(pole at the ICRS pole) the planet-equatorial coords are just (RA, Dec), so the formulae
are the standard ones any almanac uses -- the hand-computable anchor the spec asks for.

The engine must match this grid; additional pole-agnostic invariants (pole-star altitude =
latitude, rise/set azimuth, periodicity, Phase-0 drift carried through Stage 2) are checked
directly in the TS tests.

Output: packages/engine/test/fixtures/stage2_horizontal.json
"""
import json
import os

import numpy as np

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURES = os.path.join(REPO, "packages", "engine", "test", "fixtures")
SECONDS_PER_JULIAN_YEAR = 31_557_600

# Sol world: pole at the ICRS pole, sidereal rotation period.
ORIENTATION = {
    "northPoleRaDeg": 0.0,
    "northPoleDecDeg": 90.0,
    "rotationPeriodSeconds": 86164.0,
}


def altaz_trig(ra_deg, dec_deg, lat_deg, lon_deg, t_years):
    """Closed-form equatorial->horizontal for the Sol world (alpha'=RA, delta'=Dec).
    Azimuth from North toward East, [0,360)."""
    period_years = ORIENTATION["rotationPeriodSeconds"] / SECONDS_PER_JULIAN_YEAR
    theta = 2 * np.pi * t_years / period_years
    H = (theta + np.radians(lon_deg)) - np.radians(ra_deg)  # hour angle
    phi = np.radians(lat_deg)
    dec = np.radians(dec_deg)
    sin_alt = np.sin(phi) * np.sin(dec) + np.cos(phi) * np.cos(dec) * np.cos(H)
    alt = np.degrees(np.arcsin(np.clip(sin_alt, -1, 1)))
    az = np.degrees(np.arctan2(
        -np.cos(dec) * np.sin(H),
        np.sin(dec) * np.cos(phi) - np.cos(dec) * np.sin(phi) * np.cos(H),
    )) % 360.0
    return float(alt), float(az)


def main():
    os.makedirs(FIXTURES, exist_ok=True)
    period_years = ORIENTATION["rotationPeriodSeconds"] / SECONDS_PER_JULIAN_YEAR

    ras = [0, 60, 123, 250, 330]
    decs = [-60, -20, 0, 35, 75]
    lats = [-30, 0, 40, 70]
    lons = [0, 90, 200]
    ts = [0.0, 0.3 * period_years, 1.2 * period_years, 1e-3, 0.5]

    cases = []
    for ra in ras:
        for dec in decs:
            for lat in lats:
                for lon in lons:
                    for t in ts:
                        alt, az = altaz_trig(ra, dec, lat, lon, t)
                        cases.append({
                            "ra_deg": ra, "dec_deg": dec, "lat_deg": lat,
                            "lon_deg": lon, "t_years": t,
                            "alt_deg": alt, "az_deg": az,
                        })

    out = {
        "orientation": ORIENTATION,
        "note": "Sol world; alt/az from closed-form trig (independent of the engine's ENU method).",
        "cases": cases,
    }
    path = os.path.join(FIXTURES, "stage2_horizontal.json")
    with open(path, "w") as f:
        json.dump(out, f)
    print(f"wrote {len(cases)} cases -> {os.path.relpath(path, REPO)}")


if __name__ == "__main__":
    main()
