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
