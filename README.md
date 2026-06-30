# Virtual Observatory

Take real stars from a real catalog, move the observer to a different point in the galaxy,
and recompute what the sky looks like from there — direction and brightness — including how
it evolves as stars drift. The relocated star field is the **content**; a generated local
planetary system (rotation, tilt, latitude, moons) is the **apparatus** that makes that
field rise, set, and acquire a pole.

There is no observed sky from any star but ours, so **every correctness guarantee flows
from anchoring to the one known case: Earth.** See [the validation suite](#validation).

This repository implements the engineering spec (v0.1). Status below.

## Layout

```
bake/                     Python (astropy) — the data + oracle layer
  star_data.py            curated anchor stars (literature astrometry)
  make_fixtures.py        builds the test catalog + astropy validation fixtures
  bake_catalog.py         real Gaia DR3 (300 pc) + Hipparcos bright supplement -> catalog
packages/engine/          pure TypeScript engine (NO rendering imports, enforced in CI)
  src/relocate.ts         Stage 1: relocated inertial sky (§4)
  src/frames.ts           galactic <-> ICRS
  src/galactic_icrs_matrix.ts   AUTO-GENERATED frame definition (from astropy)
  test/                   the §3 validation suite
catalog/                  static catalog artifacts (test_stars.json committed; bake output gitignored)
worlds/                   hand-authored world.json (the Sol world for §3)
renderer/                 throwaway dot renderer (0d) — eyeballing only, not a deliverable
tools/emit_sky.ts         run the engine -> JSON for the renderer
docs/adr/                 architecture decision records
```

## Quick start

```bash
# 1. Data + fixtures (Python). One-time venv:
cd bake
python3 -m venv .venv && . .venv/bin/activate
pip install astropy astroquery scipy
python make_fixtures.py          # -> catalog/test_stars.json + engine fixtures + matrix

# 2. Engine + validation (Node >= 20):
npm install
npm test                         # runs the §3 suite
npm run typecheck
npm run guard:no-three           # asserts the engine has zero rendering imports

# 3. Eyeball it (throwaway renderer):
npm run emit-sky                 # engine -> renderer/data/inertial_sky.json
# then serve renderer/ (e.g. `python3 -m http.server` in renderer/) and open it
```

> Note: the real Gaia bake (`bake_catalog.py`) hits the Gaia archive over the network and
> can be large; the validation suite does **not** depend on it and runs fully offline from
> the curated `test_stars.json`.

## Validation

The four anchor tests (spec §3), all passing at machine precision (≈1e-10″):

| Test | What it pins | Result |
|------|--------------|--------|
| §3.1 Sol identity | observer at origin, t=J2000 reproduces the catalog exactly | 1.8e-10″, 0 mmag |
| §3.2 Sol-vs-astropy | time propagation matches an independent astropy oracle to 10⁵ yr | 3.7e-10″, 3e-15 mag |
| §3.3 Barnard drift | velocity reprojection correct on the highest-pm star over 10⁴ yr | 1.1e-10″ |
| §3.4 Alpha Cen → Sun | Sun appears in Cassiopeia at V≈0.5 from a *relocated* vantage | (39.9°, +60.8°), V 0.44 |

The galactic→ICRS rotation is the astropy-authoritative matrix, baked into the engine; the
engine reimplements only the runtime hot path and is validated against the fixtures.

## Known simplifications (documented, not silently absorbed)

- **No light-time / retarded-position correction.** Stars are shown at their *instantaneous*
  inertial position at sim time t, not at the retarded time t − d/c. This is the only term
  dropped from an otherwise-exact rectilinear model, and it is the deliberate, *more
  correct* choice for a relocated observer — see [ADR 0001](docs/adr/0001-propagation-model.md).
- **Missing radial velocity.** Stars without measured RV are propagated with RV=0 (flagged
  per-star via `has_rv`). Tangential-only velocity drifts over long timescales (§2.3).
- **Differential extinction ignored.** The relocated sightline passes through different dust
  than the Earth sightline; MVP shifts magnitude by pure inverse-square only (§2.3).
- **Single passband.** One fixed band (G, or V for Hipparcos-sourced).

## Deferred (spec §7 — do not add to MVP)

System generator; **retarded-time (Roemer) propagation** (the fully-correct relocated
light-time model, see ADR 0001); atmospheric refraction; telescope optics; weather;
terrain/horizon; day-sky; photorealism; VR. The engine/render/data split exists precisely
so these can be added later without touching the validated core.

## Environment note

This machine's global `npm` shim (`~/bin/npm`) is broken (points at a nonexistent
`../lib/cli.js`); npm still works when invoked via its real CLI at
`~/node_lib/node_modules/npm/bin/npm-cli.js`. CI uses its own Node toolchain and is
unaffected. Fixing the shim is a one-line change — ask if you want it done.
