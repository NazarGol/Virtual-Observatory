// Catalog types. The catalog is produced by the Python bake (bake/) in a galactic
// Cartesian frame at epoch J2000; the engine only consumes it.

import type { Vec3 } from "./vec.js";

export interface CatalogStar {
  id: string;
  name: string;
  /** Galactic Cartesian position at epoch J2000, in parsecs. */
  pos_pc: Vec3;
  /** Galactic Cartesian space velocity, in km/s. */
  vel_kms: Vec3;
  /**
   * Photometric source term: apparent magnitude `mag_ref` observed at reference distance
   * `d_ref_pc`. For real stars this is the Earth-apparent magnitude at the star's J2000
   * barycentric distance. For a synthetic star it can be the absolute magnitude at 10 pc.
   * The relocated magnitude is recomputed from this via the inverse-square law -- the
   * Earth-apparent magnitude itself is meaningless after relocation (spec section 1.3).
   */
  mag_ref: number;
  d_ref_pc: number;
  /** Color (Gaia BP-RP or B-V proxy), for render tint. */
  bp_rp: number;
  /** False if radial velocity was unknown and propagated as RV=0 (spec section 2.3). */
  has_rv: boolean;
}

export interface Catalog {
  schema_version: string;
  frame: string;
  epoch: string;
  stars: CatalogStar[];
}
