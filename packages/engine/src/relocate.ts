// Stage 1 of the transform (spec section 4): the INERTIAL RELOCATED SKY.
//
// Given the catalog (galactic Cartesian + velocity, J2000), relocate the observer to a
// point in the galaxy, propagate every star to time t by linear space motion, and
// recompute its apparent magnitude at the new distance via the inverse-square law.
//
// Output is per-star: a unit direction in the host system's inertial (galactic) frame,
// a new distance, an apparent magnitude, and the equivalent ICRS (RA, Dec). This stage is
// independent of planet spin -- it is what section 3 validates. Stage 2 (alt/az) is later.
//
// PROPAGATION MODEL (read this before "fixing" the high-pm tests):
// Motion is RECTILINEAR -- each star moves at constant velocity in the inertial frame, and
// the angular rate changes only through the projection to direction (perspective
// acceleration is therefore already captured). Exactly ONE term is deliberately dropped:
// the light-time / retarded-position correction. A star is shown at its INSTANTANEOUS
// inertial position at sim time t, not at its retarded position t - d/c ago.
//
// This is intentional and is the *more* correct choice for a relocated observer:
// astropy.apply_space_motion bakes a light-time correction computed for an observer at the
// solar system barycenter, which is wrong once you move the observer to another star. The
// fully-correct relocated model is retarded-time (Roemer) propagation -- deferred, see
// docs/adr/0001-propagation-model.md. The dropped term is negligible for constellations,
// the pole, the calendar, and navigation; it only matters for telescopic-zoom historical
// accuracy on extreme nearby high-velocity stars.

import type { Catalog, CatalogStar } from "./catalog.js";
import { galacticVecToRaDec, type RaDec } from "./frames.js";
import { add, norm, scale, sub, type Vec3 } from "./vec.js";

/**
 * km/s -> pc/yr, using the IAU 2015 parsec and the Julian year (365.25 d = 31_557_600 s).
 * This matches astropy's unit definitions, so propagation agrees with the astropy oracle.
 * 1 pc = 3.0856775814913673e13 km.
 */
export const KM_S_TO_PC_PER_YR = 31_557_600 / 3.0856775814913673e13;

export interface Observer {
  /** Observer origin in galactic Cartesian parsecs (e.g. [0,0,0] for the Sol world). */
  origin_pc: Vec3;
  /** Observer space velocity in galactic Cartesian km/s. Defaults to zero (MVP). */
  vel_kms?: Vec3;
}

export interface RelocatedStar {
  id: string;
  name: string;
  /** Unit direction to the star in the inertial galactic frame. */
  direction_gal: Vec3;
  /** Distance from the observer to the star at time t, in parsecs. */
  distance_pc: number;
  /** Apparent magnitude recomputed at the new vantage. */
  mag: number;
  /** Equivalent ICRS direction. */
  ra_deg: number;
  dec_deg: number;
  /** Carried through for rendering. */
  bp_rp: number;
}

/**
 * Relocate and propagate a single star.
 *
 * @param star catalog star (galactic Cartesian, J2000)
 * @param observer observer position/velocity in the galactic frame
 * @param tYears Julian years since J2000.0 (may be negative)
 *
 * Returns null when the star coincides with the observer (no defined direction), e.g. the
 * host star observed from its own system in this inertial-only stage.
 */
export function relocateStar(
  star: CatalogStar,
  observer: Observer,
  tYears: number,
): RelocatedStar | null {
  const starVelPcYr = scale(star.vel_kms, KM_S_TO_PC_PER_YR);
  const pStar = add(star.pos_pc, scale(starVelPcYr, tYears));

  const obsVelKms = observer.vel_kms ?? [0, 0, 0];
  const obsVelPcYr = scale(obsVelKms, KM_S_TO_PC_PER_YR);
  const pObs = add(observer.origin_pc, scale(obsVelPcYr, tYears));

  const d = sub(pStar, pObs);
  const distance_pc = norm(d);
  if (distance_pc === 0) return null;

  const direction_gal = scale(d, 1 / distance_pc);
  const mag = star.mag_ref + 5 * Math.log10(distance_pc / star.d_ref_pc);
  const { ra_deg, dec_deg }: RaDec = galacticVecToRaDec(direction_gal);

  return {
    id: star.id,
    name: star.name,
    direction_gal,
    distance_pc,
    mag,
    ra_deg,
    dec_deg,
    bp_rp: star.bp_rp,
  };
}

/** Relocate the whole catalog. Stars coincident with the observer are dropped. */
export function relocateSky(
  catalog: Catalog,
  observer: Observer,
  tYears: number,
): RelocatedStar[] {
  const out: RelocatedStar[] = [];
  for (const star of catalog.stars) {
    const r = relocateStar(star, observer, tYears);
    if (r !== null) out.push(r);
  }
  return out;
}
