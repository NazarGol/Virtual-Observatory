# ADR 0001 — Star propagation model: rectilinear, no light-time

Status: **Accepted** (Phase 0)
Date: 2026-06-30

## Context

Spec §4 defines the engine's Stage-1 propagation as rectilinear constant-velocity motion
in the inertial frame:

    p_star(t) = pos_pc + vel_pc_per_yr · (t − J2000)

Spec §3.2 / §3.3 require the engine's propagation to match astropy's
`apply_space_motion` to < 0.1″ in direction and < 1 mmag, out to 10⁵ yr (§3.2) and over
10⁴ yr for Barnard's Star specifically (§3.3).

During Phase 0 these two requirements were found to be **mutually inconsistent for extreme
nearby high-velocity stars.** `apply_space_motion` is not rectilinear — it is the rigorous
ERFA `starpm` model, which includes a light-time / retarded-position correction. Measured
divergence (rectilinear vs. `apply_space_motion`), Barnard's Star:

| Δt        | direction error | distance error |
|-----------|-----------------|----------------|
| 100 yr    | 0.001″          | negligible     |
| 1,000 yr  | 0.129″          | 0.4 mmag       |
| 10,000 yr | 10.6″           | 0.4 mmag       |

A rectilinear engine therefore can never pass §3.3 (Barnard over 10⁴ yr) against an
`apply_space_motion` oracle: the models genuinely differ by 10.6″ there.

## Decision

**The engine stays rectilinear (spec §4). The §3.2 / §3.3 fixtures are generated with a
rectilinear oracle in astropy, not with `apply_space_motion`.**

The physics: a star's true motion is rectilinear in 3D to excellent approximation over
10⁴–10⁵ yr (constant velocity, no forces). Propagating in Cartesian and then projecting to
angles already captures *perspective acceleration* (the angular rate changing as distance
changes). The **only** term rectilinear-in-Cartesian omits is **light-time**: you see a
star where it was when its light left, at the retarded time t − d/c.

`apply_space_motion` computes that light-time correction **for an observer at the solar
system barycenter.** This project's entire purpose is to relocate the observer to another
point in the galaxy, where the distances — and therefore the light-time term — are
completely different. So `apply_space_motion`'s correction is not merely unnecessary here;
it is *wrong* for a relocated vantage. The oracle bakes in Earth's position, which is the
one thing this project removes.

Option 1 is thus not a pragmatic compromise — it is the **more correct** model for
relocation, minus a term that does not generalize anyway.

### Why the tests stay honest

The rectilinear oracle (`bake/make_fixtures.py:rectilinear_icrs`) still runs through
astropy's frame / representation / projection machinery, in the **ICRS** Cartesian frame —
a code path independent of the engine, which works in the **galactic** frame and rotates.
A galactic-rotation sign flip, a pc/ly unit error, an axis swap, or a bad km/s→pc/yr
constant all still produce a mismatch, caught at machine precision (observed agreement:
~1e-10″). We decline to cross-check only the light-time term, which we have deliberately
dropped. §3.3's stated intent — "confirm velocity reprojection is wired correctly" —
survives intact.

### Rejected alternatives

- **Port ERFA `starpm` into the engine to match `apply_space_motion`.** Adds real
  complexity to become *more wrong at the core use case*: `starpm`'s light-time assumes the
  solar barycenter. More accurate on the Sol tests, which are not the product; worse at
  Alpha Cen, which is.
- **Keep `apply_space_motion` oracle, relax the tolerance** (e.g. ~10″ for high-pm stars).
  Blinds the test exactly where high-proper-motion stars are supposed to stress it — a
  genuine multi-arcsecond frame bug would pass silently — while still matching an oracle
  that is wrong for relocation. A fudge factor hiding a physics divergence. Never do this.

## Consequences

- The dropped term is named explicitly in the engine math (`packages/engine/src/relocate.ts`
  header) so rectilinear is never mistaken for complete.
- §3.4 (Alpha Cen) is untouched by this decision: it is a static geometric check with no
  propagation, so light-time never enters.
- The model is exact for everything the cosmotechnics actually runs on — constellations,
  the pole, the calendar, navigation. The error is non-zero only under telescopic zoom on
  extreme nearby high-velocity stars over millennia.

## Deferred upgrade path (spec §7) — retarded-time (Roemer) propagation

The fully-correct relocated model is **retarded-time** propagation. The apparent direction
to a star is toward its position at the retarded time t_ret that solves the implicit
equation:

    t − t_ret = | p_star(t_ret) − O(t) | / c

(observer at O(t), star position p_star propagated rectilinearly). This is the correct
generalization of light-time to an arbitrary observer location, and it replaces — not
augments — `apply_space_motion`'s Earth-specific term. It is negligible for naked-eye
cosmotechnics and is the upgrade to make only if telescopic-zoom historical accuracy on
extreme stars is ever required. It does not touch the validated frame/velocity core.
