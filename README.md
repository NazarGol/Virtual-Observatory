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
  src/horizontal.ts       Stage 2: inertial -> alt/az (Phase 1)
  src/bodies.ts           Keplerian host star / moons / siblings (Phase 1)
  src/session.ts          SkySession: sim/render decoupling (Phase 1)
catalog/                  static catalog artifacts (test_stars.json committed; bake output gitignored)
worlds/                   hand-authored world.json (Sol, §3) + generated/ (world gallery pool)
packages/app/             the instrument: React + Vite + Three, consumes @vobs/engine
  public/data/            GITIGNORED, GENERATED — see tools/emit_app_data.ts below; the app
                           fetches catalog.json / world.json / worlds/manifest.json from here
renderer/                 throwaway renderers (0d/Phase 1) — eyeballing only, not a deliverable
  main.js                 inertial dot sphere; horizon.js — alt/az dome + time scrubbing
tools/                    emit_sky.ts, emit_horizontal.ts, scrub_bench.ts (engine -> JSON / demos)
  emit_worlds.ts          builds worlds/generated/ (the world-gallery pool) from a real catalog
  emit_app_data.ts        builds packages/app/public/data/ (catalog+world+world-pool) for the
                           instrument to fetch at runtime -- runs automatically via predev/
                           prebuild in packages/app, but `npm run emit-app-data` also works
                           standalone; falls back to the small committed test catalog if the
                           real bake isn't present, with a console warning explaining why
  emit_dossier.ts         computes a world's full observational truth (calendar, moons,
                           eclipses, stars, deep time) as a markdown doc -> dossiers/*.md
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

# 3. (optional) Bake the real science catalog — naked-eye sky, ~10.5k stars within 300 pc:
python bake/bake_catalog.py      # Gaia G<6.5 + Hipparcos V<6.5 -> catalog/local_volume_300pc.json

# 4. Eyeball it (throwaway renderers):
npm run emit-sky                                 # inertial sphere (renderer/index.html)
npm run emit-horizon                             # alt/az dome with time slider (renderer/horizon.html)
npm run scrub-bench                              # prove the sim/render decoupling on 10k stars
node --import tsx tools/emit_sky.ts \
  --catalog catalog/local_volume_300pc.json --alpha-cen   # the real sky from Alpha Cen
# then serve renderer/ (e.g. `python3 -m http.server` in renderer/) and open index.html / horizon.html
```

> Notes
> - The real bake (`bake_catalog.py`) hits the Gaia archive + Vizier over the network. The
>   validation suite does **not** depend on it and runs fully offline from the curated
>   `test_stars.json`. Default is naked-eye complete (G<6.5, ~10.5k stars in 300 pc);
>   `--maglim 8` goes deeper, `--full` takes the entire volume (millions, slow).
> - Relocating to Alpha Cen A, its binary companion Alpha Cen B (HIP71681) correctly blazes
>   at V≈−19 right next to the observer — a quick sanity check that the magnitude recompute
>   is doing real inverse-square work.

## Run the instrument app

```bash
npm install
npm run dev -w @vobs/app     # predev runs tools/emit_app_data.ts automatically -- no setup needed
```

That's the whole fresh-clone path: `predev`/`prebuild` always call `tools/emit_app_data.ts`
first, which builds `packages/app/public/data/` (catalog, default world, world-gallery pool)
from what's committed or already baked. On a bare clone (no real catalog baked yet) it falls
back to the small committed `catalog/test_stars.json` and prints a warning -- the app still
runs, just with a near-empty sky. For the real ~10.5k-star sky:

```bash
python bake/bake_catalog.py         # -> catalog/local_volume_300pc.json (gitignored, real bake)
npm run emit-worlds                 # -> worlds/generated/ (the world-gallery pool; needs the real catalog)
npm run emit-app-data               # refresh packages/app/public/data/ from the above
```

If the app ever shows "App data didn't load" (or the World Gallery shows "No world pool"),
that's exactly this step needing to be (re-)run -- the on-screen message names the missing
file and the command to fix it.

`npm run typecheck` covers both `@vobs/engine` and `@vobs/app` (also enforced separately in
CI); `npm run emit-dossier -- --world <path> --site "lat,lon:Label"` computes a world's full
observational truth as a markdown doc, independent of the running app.

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

**Phase 1 (apparatus + time)** — Stage-2 local horizontal frame, Keplerian bodies, and
sim/render decoupling, all green (19 tests total):

| Test | What it pins | Result |
|------|--------------|--------|
| Stage-2 grid | alt/az matches an independent trig oracle over 1500 (ra,dec,lat,lon,t) cases | ≤6e-12° |
| rise/set azimuth | §6 acceptance: matches the hand value `acos(sin d / cos φ)` | exact |
| drift through Stage 2 | §6 acceptance: Barnard's ~53°/10⁴yr Phase-0 drift carried unchanged | <1e-9° |
| pole / equator / periodicity | pole-star alt=latitude (any pole), equatorial star rises due E, sidereal periodicity | exact |
| Keplerian bodies | Kepler residual, periapsis/apoapsis, circular uniformity, periodicity; Luna swings 154°/day | ≤1e-12 |
| decoupling | §6 acceptance: cached Stage-2 == direct path; diurnal scrub = 0 Stage-1 recomputes | bit-exact |

Stage-1 (relocate, ~10k stars) costs ~3.3 ms; Stage-2 (rotate cache → alt/az) ~0.6 ms
(1660 fps). `npm run scrub-bench` shows the render loop pays only Stage-2 cost at any time
scale — no render-loop stall.

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
