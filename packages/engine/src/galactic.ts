// Galactic-orbit propagation (the Myr-scale upgrade to rectilinear motion). Each star (and
// the observer) is transformed into the galactocentric frame, integrated in a Milky Way
// potential, and its apparent direction recomputed from the moving observer. This curves
// orbits the way real galactic gravity does, extending the honest cap from ~1e5 yr to ~1e6.
//
// Frame quantities (rotations, Sun state) and the potential parameters are baked from
// astropy (galactic_frame.ts), so the convention matches the oracle by construction; the TS
// reimplements only the integration, validated against a scipy orbit oracle + conservation.
//
// Dynamics units: kpc, Myr, Msun. Returns the same shape as the rectilinear relocate.

import {
  GALACTIC_TO_GALACTOCENTRIC, GALACTOCENTRIC_TO_ICRS, SUN_GALACTOCENTRIC,
  MW_POTENTIAL, G_KPC_MSUN_MYR, KM_S_TO_KPC_MYR,
} from "./galactic_frame.js";
import { add, matVecMul, norm, scale, sub, type Vec3 } from "./vec.js";
import { icrsVecToRaDec } from "./frames.js";
import type { CatalogStar } from "./catalog.js";

/** Galactic-mode relocate result. Unlike rectilinear, the direction is already ICRS (the
 *  integration happens in the galactocentric frame, rotated straight to ICRS). */
export interface GalacticRelocatedStar {
  id: string;
  name: string;
  direction_icrs: Vec3;
  distance_pc: number;
  mag: number;
  ra_deg: number;
  dec_deg: number;
  bp_rp: number;
}

const G2GC = GALACTIC_TO_GALACTOCENTRIC;
const GC2ICRS = GALACTOCENTRIC_TO_ICRS;

export { KM_S_TO_KPC_MYR, G_KPC_MSUN_MYR, MW_POTENTIAL, SUN_GALACTOCENTRIC } from "./galactic_frame.js";

/** Acceleration (kpc/Myr^2) at galactocentric position p (kpc) in the MW potential. */
export function galacticAccel(p: Vec3): Vec3 {
  const [x, y, z] = p;
  const r = Math.hypot(x, y, z) + 1e-12;
  const G = G_KPC_MSUN_MYR;
  let ax = 0, ay = 0, az = 0;

  const { M: Mb, a: ab } = MW_POTENTIAL.bulge;
  const fb = (-G * Mb) / ((r + ab) * (r + ab) * r);
  ax += fb * x; ay += fb * y; az += fb * z;

  const { M: Md, a: ad, b: bd } = MW_POTENTIAL.disk;
  const zeta = Math.sqrt(z * z + bd * bd);
  const denom = Math.pow(x * x + y * y + (ad + zeta) * (ad + zeta), 1.5);
  ax += (-G * Md * x) / denom;
  ay += (-G * Md * y) / denom;
  az += (-G * Md * z * (ad + zeta)) / (zeta * denom);

  const { M: Mh, rs } = MW_POTENTIAL.halo;
  const fh = (-G * Mh) / (r * r) * (Math.log(1 + r / rs) - (r / rs) / (1 + r / rs)) / r;
  ax += fh * x; ay += fh * y; az += fh * z;

  return [ax, ay, az];
}

/** Specific orbital energy (kpc^2/Myr^2): 1/2 v^2 + Phi. Used to check conservation. */
export function galacticEnergy(p: Vec3, vKpcMyr: Vec3): number {
  const [x, y, z] = p;
  const r = Math.hypot(x, y, z) + 1e-12;
  const { M: Mb, a: ab } = MW_POTENTIAL.bulge;
  const { M: Md, a: ad, b: bd } = MW_POTENTIAL.disk;
  const { M: Mh, rs } = MW_POTENTIAL.halo;
  const G = G_KPC_MSUN_MYR;
  const phi = -G * Mb / (r + ab)
    - G * Md / Math.sqrt(x * x + y * y + (ad + Math.sqrt(z * z + bd * bd)) ** 2)
    - G * Mh / r * Math.log(1 + r / rs);
  return 0.5 * (vKpcMyr[0] ** 2 + vKpcMyr[1] ** 2 + vKpcMyr[2] ** 2) + phi;
}

export interface GalcenState { pos: Vec3; vel: Vec3 } // pos kpc, vel kpc/Myr

/** Velocity-Verlet integration of a galactocentric orbit over tMyr (may be negative). */
export function integrateOrbit(state: GalcenState, tMyr: number, stepMyr = 0.002): GalcenState {
  if (tMyr === 0) return { pos: [...state.pos], vel: [...state.vel] };
  const steps = Math.max(1, Math.ceil(Math.abs(tMyr) / stepMyr));
  const h = tMyr / steps;
  let p: Vec3 = [...state.pos];
  let v: Vec3 = [...state.vel];
  let a = galacticAccel(p);
  for (let i = 0; i < steps; i++) {
    p = [p[0] + v[0] * h + 0.5 * a[0] * h * h, p[1] + v[1] * h + 0.5 * a[1] * h * h, p[2] + v[2] * h + 0.5 * a[2] * h * h];
    const a1 = galacticAccel(p);
    v = [v[0] + 0.5 * (a[0] + a1[0]) * h, v[1] + 0.5 * (a[1] + a1[1]) * h, v[2] + 0.5 * (a[2] + a1[2]) * h];
    a = a1;
  }
  return { pos: p, vel: v };
}

/** Heliocentric galactic (pos pc, vel km/s) -> galactocentric state (pos kpc, vel kpc/Myr). */
export function helioToGalcen(posPc: Vec3, velKms: Vec3): GalcenState {
  const posKpc: Vec3 = [posPc[0] / 1000, posPc[1] / 1000, posPc[2] / 1000];
  const pos = add(SUN_GALACTOCENTRIC.pos_kpc as unknown as Vec3, matVecMul(G2GC, posKpc));
  const velGalcenKms = add(SUN_GALACTOCENTRIC.vel_kms as unknown as Vec3, matVecMul(G2GC, velKms));
  return { pos, vel: scale(velGalcenKms, KM_S_TO_KPC_MYR) };
}

/** The Sun's galactocentric state (the observer for the Sol vantage). */
export const SUN_GALCEN_STATE: GalcenState = helioToGalcen([0, 0, 0], [0, 0, 0]);

/**
 * Relocate + propagate one star by galactic-orbit integration.
 * @param observer galactocentric state of the observer at J2000 (use helioToGalcen for a
 *   relocated vantage, or SUN_GALCEN_STATE for Sol). Pass it pre-integrated? No -- this
 *   integrates both star and observer to t so their relative geometry is consistent.
 */
export function relocateStarGalactic(
  star: CatalogStar,
  observerAtEpoch: GalcenState,
  tYears: number,
): GalacticRelocatedStar | null {
  const tMyr = tYears / 1e6;
  const s = integrateOrbit(helioToGalcen(star.pos_pc, star.vel_kms), tMyr);
  const o = integrateOrbit(observerAtEpoch, tMyr);

  const relKpc = sub(s.pos, o.pos);
  const distKpc = norm(relKpc);
  if (distKpc === 0) return null;
  const direction_icrs = matVecMul(GC2ICRS, scale(relKpc, 1 / distKpc));
  const distance_pc = distKpc * 1000;
  const { ra_deg, dec_deg } = icrsVecToRaDec(direction_icrs);

  return {
    id: star.id,
    name: star.name,
    direction_icrs,
    distance_pc,
    mag: star.mag_ref + 5 * Math.log10(distance_pc / star.d_ref_pc),
    ra_deg,
    dec_deg,
    bp_rp: star.bp_rp,
  };
}
