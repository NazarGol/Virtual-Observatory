# ADR 0002 — Generated worlds anchor to real catalog hosts; generation is offline

Status: **Accepted** (Phase 4-FIX)
Date: 2026-07-02

## Context

The Phase-4 audit found a silent violation of standing principle §1 (real vs. generated is
always explicit). Every generated world was built with `host_star.galactic_xyz_pc = [0,0,0]`,
`catalog_id = null`, and a synthetic sun. The generator never read the catalog, so the
observer never moved: every gallery world showed the **same Sol star field** with a different
fictional sun/moons in front of it. The alien skies weren't alien — the fiction was wearing
the data's clothes. Worse, this passed CI because the tests validated what the code did
(planet physics) rather than what the spec required (real hosts).

## Decision

1. **Every generated world anchors to a real catalog star.** An offline step selects real
   F/G/K main-sequence hosts from the baked local-volume catalog (an HR-diagram cut:
   absolute magnitude vs. BP-RP color, excluding giants and M dwarfs), and each world adopts
   that host's real galactic position, space velocity, and `catalog_id`. Stellar physical
   parameters follow the §2.3 discipline — **real where the data gives it** (luminosity from
   the observed absolute magnitude), **derived where it can't** (mass from mass-luminosity,
   radius/Teff consistent), each labeled in a per-parameter `provenance` block.

2. **Deliberate override of the original §5.** The original spec put the generator in Python
   `bake/`. The load-bearing requirement was *offline emission + real hosts*, not the
   language. The validated physics (Gladman tidal-lock timescale, fluid Roche, Hill, mutual-
   Hill Δ>3.5, reject-resample, stratification) already exists correctly in TS; porting it to
   Python would risk exactly the subtle bugs this project fights. So the physics stays in TS,
   but generation runs as an **offline Node CLI** (`tools/emit_worlds.ts`) that writes one
   `world.json` per slot + a `manifest.json` into `worlds/generated/`. Offline-vs-runtime is
   what §1 actually cares about.

3. **The instrument loads, never generates.** `Gallery.tsx` fetches the manifest + world
   files; it imports no generator. Pin/reroll operate over the pre-emitted pool. Guarded:
   `grep -rE 'generateWorld|worldgen' packages/app/src` is empty.

The validated samplers/validators were **reused verbatim**; only the host source changed
(a real host threads through them instead of a synthesized one), plus the tidally-locked
sampler now targets the host's real locking radius rather than assuming an M dwarf.

## Consequences / acceptance (as tests)

`test/worldgen-hosts.test.ts` encodes the requirements, not just invariants:
- every emitted world's `catalog_id` resolves to a real catalog star, and its
  `galactic_xyz_pc` equals that host's position (≠ origin);
- **distinct-sky test:** two worlds with different hosts relocate a probe star to a
  measurably different direction *and* magnitude (Sirius: 47.7° / 1.49 mag between Alpha Cen A
  and 61 Cyg A) — the exact thing that was silently missing;
- every generated parameter carries a provenance note (host marked `real`, mass marked
  derived);
- all per-type physics validators still pass on every world.

This is the first gate; everything downstream (Phase 5+) assumes the worlds are real.
