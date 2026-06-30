"""
Curated anchor stars for the Virtual Observatory validation suite (spec section 3).

These are NOT the science catalog (that comes from the Gaia/Hipparcos bake in
bake_catalog.py). This is a small, hand-curated set of well-known stars with full
ICRS astrometry, used to:

  1. Build a deterministic, network-free test catalog (catalog/test_stars.json), and
  2. Generate astropy oracle fixtures for the four validation tests.

Why a curated set instead of the live Gaia query:
  - The four correctness tests (section 3.1-3.4) need *self-consistent* inputs, not the
    full sky. What matters is that the TS engine and astropy agree given identical
    inputs -- so the absolute accuracy of these literature values is irrelevant; their
    internal consistency (engine vs. astropy) is everything.
  - CI must run offline. astroquery hitting the Gaia archive in CI would be flaky.

All values are ICRS, referenced to epoch J2000.0 (we set obstime=J2000 and let astropy
propagate). Proper motions are pm_ra_cosdec (mu_alpha*) and pm_dec, in mas/yr.
Parallax in mas; radial_velocity in km/s; `mag` is V-band apparent magnitude as seen
from Earth. Sources: Hipparcos (van Leeuwen 2007) / SIMBAD literature values.

The synthetic "Sun" entry is special: it has no Earth-apparent magnitude (you cannot
see the Sun as a distant star from Earth), so its photometric source term is encoded as
the *absolute* V magnitude at the 10 pc reference distance -- see `mag_ref`/`d_ref_pc`
handling in make_fixtures.py. This drives the Alpha Centauri cross-check (section 3.4).
"""

# Each star: ra/dec in deg (ICRS), parallax in mas, pm_ra_cosdec & pm_dec in mas/yr,
# radial_velocity in km/s, mag in V, bp_rp approximate (B-V proxy) for render tint.
ANCHOR_STARS = [
    {
        "id": "HIP87937", "name": "Barnard's Star",
        "ra_deg": 269.452075, "dec_deg": 4.693391,
        "parallax_mas": 548.310,
        "pm_ra_cosdec": -802.803, "pm_dec": 10362.542,
        "rv_kms": -110.6, "mag": 9.53, "bp_rp": 1.74, "has_rv": True,
    },
    {
        "id": "HIP91262", "name": "Vega",
        "ra_deg": 279.234735, "dec_deg": 38.783689,
        "parallax_mas": 130.23,
        "pm_ra_cosdec": 200.94, "pm_dec": 286.23,
        "rv_kms": -13.9, "mag": 0.03, "bp_rp": 0.00, "has_rv": True,
    },
    {
        "id": "HIP32349", "name": "Sirius",
        "ra_deg": 101.287155, "dec_deg": -16.716116,
        "parallax_mas": 379.21,
        "pm_ra_cosdec": -546.01, "pm_dec": -1223.07,
        "rv_kms": -5.50, "mag": -1.46, "bp_rp": 0.00, "has_rv": True,
    },
    {
        "id": "HIP71683", "name": "Alpha Centauri A",
        "ra_deg": 219.902066, "dec_deg": -60.833975,
        "parallax_mas": 754.81,
        "pm_ra_cosdec": -3608.0, "pm_dec": 686.0,
        "rv_kms": -22.4, "mag": -0.01, "bp_rp": 0.71, "has_rv": True,
    },
    {
        "id": "HIP70890", "name": "Proxima Centauri",
        "ra_deg": 217.428953, "dec_deg": -62.679485,
        "parallax_mas": 768.07,
        "pm_ra_cosdec": -3781.74, "pm_dec": 769.47,
        "rv_kms": -22.4, "mag": 11.13, "bp_rp": 1.82, "has_rv": True,
    },
    {
        "id": "HIP104214", "name": "61 Cygni A",
        "ra_deg": 316.724876, "dec_deg": 38.749720,
        "parallax_mas": 287.18,
        "pm_ra_cosdec": 4133.05, "pm_dec": 3201.78,
        "rv_kms": -65.74, "mag": 5.21, "bp_rp": 1.07, "has_rv": True,
    },
    {
        "id": "HIP54035", "name": "Lalande 21185",
        "ra_deg": 165.834136, "dec_deg": 35.969879,
        "parallax_mas": 392.64,
        "pm_ra_cosdec": -580.06, "pm_dec": -4769.04,
        "rv_kms": -85.0, "mag": 7.52, "bp_rp": 1.50, "has_rv": True,
    },
]

# Synthetic "Sun as a star" placed at the galactic origin (the Sol world's host star),
# used for the Alpha Centauri cross-check. M_V(Sun) = 4.83.
SUN_ABS_V = 4.83

# Alpha Centauri's published mean distance, for the section 3.4 magnitude check.
# 5*log10(1.34/10) + 4.83 ~= 0.47.
ALPHA_CEN_NAME = "Alpha Centauri A"
