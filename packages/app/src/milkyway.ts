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

export interface BandPoint { dir: Vec3; brightness: number }
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Sample the Milky Way band as a point cloud oriented by the observer's vantage (so it moves
 * with relocation). Structure: a bulge toward the galactic center, a dust lane darkening the
 * mid-plane near the center, band width narrowing toward the anticenter, low-frequency
 * longitudinal patchiness. Each point is an ICRS direction + a brightness in ~[0, 1.5]; the
 * renderer projects them like stars, so the band works in every projection.
 */
export function milkyWayBand(geo: MilkyWayGeometry, n = 4000, seed = 20260702): BandPoint[] {
  const C = geo.galacticCenterIcrs, N = geo.diskNormalIcrs, T = normalize(cross(N, C));
  const r = mulberry32(seed);
  const p1 = r() * 6.28, p2 = r() * 6.28;
  const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(6.2831853 * r());
  const out: BandPoint[] = [];
  for (let i = 0; i < n; i++) {
    const phi = (r() * 2 - 1) * Math.PI;                         // galactic longitude from center
    const centerness = 0.5 * (1 + Math.cos(phi));                // 1 toward centre, 0 anticentre
    const width = 0.03 + 0.11 * centerness;                       // band half-width narrows outward
    const beta = gauss() * width;                                // latitude off the plane
    const dust = 1 - 0.55 * centerness * Math.exp(-((beta / 0.022) ** 2)); // dust lane near centre plane
    const patch = Math.max(0.12, 0.55 + 0.4 * Math.sin(3 * phi + p1) + 0.28 * Math.sin(6 * phi + p2) + 0.2 * (r() - 0.5));
    const brightness = (0.22 + 0.95 * centerness) * dust * patch;
    const cb = Math.cos(beta), sb = Math.sin(beta), cp = Math.cos(phi), sp = Math.sin(phi);
    const dir = normalize([
      cb * (cp * C[0] + sp * T[0]) + sb * N[0],
      cb * (cp * C[1] + sp * T[1]) + sb * N[1],
      cb * (cp * C[2] + sp * T[2]) + sb * N[2],
    ]);
    out.push({ dir, brightness });
  }
  return out;
}
