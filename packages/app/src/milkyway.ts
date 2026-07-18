// Milky Way band geometry, derived from the observer's real 3D vantage (Phase 5 item 3).
// The band is the galactic disk seen edge-on: it lies along the plane perpendicular to the
// galactocentric z-axis, brightest toward the galactic center. Both directions are computed
// from the observer's galactocentric position, so RELOCATING moves the band (it is not a
// static skybox). Pure render-side math over engine frame helpers; the engine stays pure.
import { helioToGalcen, galactocentricToIcrs, type Vec3 } from "@vobs/engine";

const normalize = (v: Vec3): Vec3 => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};

export interface MilkyWayGeometry {
  /** Galactic-disk normal in ICRS (the band lies perpendicular to it). */
  diskNormalIcrs: Vec3;
  /** Direction to the galactic center in ICRS (the band's bright side). */
  galacticCenterIcrs: Vec3;
  /** Observer's galactocentric position (kpc), for reference. */
  observerGalcenKpc: Vec3;
}

/** @param observerHelioPc observer position in heliocentric galactic Cartesian (pc). */
export function milkyWayGeometry(observerHelioPc: Vec3): MilkyWayGeometry {
  const gc = helioToGalcen(observerHelioPc, [0, 0, 0]).pos; // galactocentric kpc
  const diskNormalIcrs = normalize(galactocentricToIcrs([0, 0, 1]));
  // toward the galactic center = toward the galactocentric origin, i.e. -observer position
  const galacticCenterIcrs = normalize(galactocentricToIcrs(normalize([-gc[0], -gc[1], -gc[2]])));
  return { diskNormalIcrs, galacticCenterIcrs, observerGalcenKpc: gc };
}

export interface StipplePoint { dir: Vec3 }
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * The band's surface-density model (Phase 6R): in a stipple chart STRUCTURE IS DENSITY —
 * every dot is the same ink; brightness is encoded by how many dots land there. Dense in the
 * galactic plane thinning with latitude, a denser bulge toward the centre, the dust lane as
 * a SPARSER channel along the mid-plane near the centre, low-frequency longitudinal
 * patchiness. phi = longitude from the galactic centre, beta = latitude (radians).
 * Deterministic (fixed patch phases). Exported for tests.
 */
export function stippleDensity(phi: number, beta: number): number {
  const centerness = 0.5 * (1 + Math.cos(phi));                 // 1 toward centre, 0 anticentre
  const width = 0.055 + 0.15 * centerness;                       // band half-width narrows outward
  const base = Math.exp(-((beta / width) ** 2));
  const bulge = 1.7 * Math.exp(-((phi / 0.5) ** 2) - ((beta / 0.15) ** 2));
  const dust = 1 - 0.8 * centerness * Math.exp(-(((beta - 0.012) / 0.03) ** 2)); // sparse channel
  const patch = Math.max(0.15, 0.62 + 0.38 * Math.sin(3 * phi + 1.1) + 0.24 * Math.sin(7 * phi + 4.2));
  return (base * (0.25 + 0.75 * centerness) + bulge) * dust * patch;
}

// R2 low-discrepancy sequence increments (plastic constant) — evenly spread, blue-noise-like.
const R2A1 = 0.7548776662466927, R2A2 = 0.5698402909980532;

/**
 * Sample the band as a stipple field: candidates from a low-discrepancy sequence over
 * (longitude, latitude), kept by rejection against stippleDensity — dots stay evenly spaced
 * (no clumping) and their DENSITY draws the structure. Directions are built on the vantage
 * basis, so the band still moves with relocation. Deterministic for a given seed.
 */
export function milkyWayStipple(geo: MilkyWayGeometry, n = 9000, seed = 20260702): StipplePoint[] {
  const C = geo.galacticCenterIcrs, N = geo.diskNormalIcrs, T = normalize(cross(N, C));
  const out: StipplePoint[] = [];
  const DMAX = 2.2; // just above the density model's max, for rejection
  let u = (seed % 100000) / 100000, v = ((seed / 7) % 100000) / 100000;
  for (let i = 0; out.length < n && i < n * 40; i++) {
    u = (u + R2A1) % 1; v = (v + R2A2) % 1;
    const phi = (u * 2 - 1) * Math.PI;
    const beta = (v - 0.5) * 0.9;                                // +/- 0.45 rad ~ +/- 26 deg
    const gate = (((i + 1) * 2654435761) >>> 9) % 8388608 / 8388608; // deterministic per-candidate
    if (gate * DMAX > stippleDensity(phi, beta)) continue;
    const cb = Math.cos(beta), sb = Math.sin(beta), cp = Math.cos(phi), sp = Math.sin(phi);
    out.push({
      dir: normalize([
        cb * (cp * C[0] + sp * T[0]) + sb * N[0],
        cb * (cp * C[1] + sp * T[1]) + sb * N[1],
        cb * (cp * C[2] + sp * T[2]) + sb * N[2],
      ]),
    });
  }
  return out;
}
