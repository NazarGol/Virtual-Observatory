# Virtual Observatory — working agreement

A human observer, stationed on a generated but physically-real alien world, equipped with
the analytical instruments a real expedition would carry. The tools determine what the
observer can know — that is the cosmotechnic core. Correctness is sacred; immersion is
mandatory.

## Standing rules

> **Acceptance means demonstrated live in the running browser.** Any narrowed scope (e.g.
> "works in gnomonic only") must be declared explicitly as a limitation in the report. Never
> ship a compromise inside a green checkmark.

> **Compute proposes, the human disposes.** Instruments surface *candidate* regularities
> (co-moving groups, periods, alignments, anomalies). The user decides what is meaningful,
> names it, and builds cosmology on it. Never auto-generate finished constellations,
> calendars, or interpretations.

> **The engine stays pure.** Zero rendering imports in `packages/engine/`; the no-`three`
> guard stays green. All presentation/instrument work lives in `packages/app/`.

> **Real vs generated is always explicit.** Real catalog data where science has it; generated
> only where it can't. Provenance labels which is which (see ADR 0002).

> **Weird gets *more* validation, not less.** A generated artifact claiming a strong property
> proves it under stricter checks (see `worldgen.ts`).

## Note on browser acceptance

Claude Code cannot drive a browser. When a gate's acceptance is "demonstrated live in the
browser," Claude verifies everything it can headlessly (typecheck, engine + app tests, build,
and logic cross-checks) and states plainly that the final visual/interaction gate is the
user's to confirm. Limitations are declared, never hidden.

## Layout / commands

- `packages/engine` — pure TS physics (Node-tested, in CI). `npm test`, `npm run guard:no-three`.
- `packages/app` — React + Vite + Three instrument. `npm run dev -w @vobs/app` (prepares data).
- `bake/` — Python/astropy catalog + fixtures + oracles. `tools/` — offline emit CLIs.
- Decisions of record in `docs/adr/`.
