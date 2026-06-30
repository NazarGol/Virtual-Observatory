// Frame conversions: galactic Cartesian <-> ICRS spherical (RA/Dec).
//
// The galactic->ICRS rotation is the frame DEFINITION, baked from astropy by the bake job
// (see galactic_icrs_matrix.ts). The engine reimplements only the runtime application of
// it, validated against astropy fixtures (spec section 3).

import { GALACTIC_TO_ICRS } from "./galactic_icrs_matrix.js";
import { matVecMul, type Vec3 } from "./vec.js";

const RAD2DEG = 180 / Math.PI;

/** Rotate a vector from the galactic Cartesian frame into the ICRS Cartesian frame. */
export function galacticToIcrs(v: Vec3): Vec3 {
  return matVecMul(GALACTIC_TO_ICRS, v);
}

export interface RaDec {
  /** Right ascension in degrees, in [0, 360). */
  ra_deg: number;
  /** Declination in degrees, in [-90, 90]. */
  dec_deg: number;
}

/**
 * Convert an ICRS Cartesian vector to (RA, Dec). The vector need not be unit length;
 * only its direction is used. ICRS axes: +x toward (RA=0, Dec=0), +z toward Dec=+90.
 */
export function icrsVecToRaDec(v: Vec3): RaDec {
  const [x, y, z] = v;
  const r = Math.sqrt(x * x + y * y + z * z);
  let ra = Math.atan2(y, x) * RAD2DEG;
  if (ra < 0) ra += 360;
  const dec = Math.asin(Math.max(-1, Math.min(1, z / r))) * RAD2DEG;
  return { ra_deg: ra, dec_deg: dec };
}

/** Convenience: galactic Cartesian direction straight to ICRS (RA, Dec). */
export function galacticVecToRaDec(v: Vec3): RaDec {
  return icrsVecToRaDec(galacticToIcrs(v));
}
