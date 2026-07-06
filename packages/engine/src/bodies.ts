// Solar-system bodies (spec sections 4-5): the host star, moons, and sibling planets as
// MOVING bodies. Each comes from Keplerian elements in world.json, propagated to time t by
// two-body motion, turned into an inertial (ICRS) direction, then through the same Stage-2
// rotation as the stars so it rises, sets, and acquires a pole alongside the relocated sky.
//
// Two-body Kepler only (no perturbations, no n-body -- the apparatus, not an ephemeris).
// Orbital elements are taken relative to the inertial ICRS frame: inclination and node are
// measured from the ICRS equator/x-axis. Units: AU, Julian years, solar masses, so the
// mean motion follows directly from Kepler's third law P_years = sqrt(a^3 / M).

import { norm, scale, sub, type Vec3 } from "./vec.js";
import {
  inertialToHorizontal,
  type GeoObserver,
  type HorizontalCoord,
  type PlanetOrientation,
} from "./horizontal.js";
import type { KeplerElements, Moon, World } from "./world.js";
import { planetOrientation, worldObserver } from "./world.js";

export const MEARTH_PER_MSUN = 332946.0; // Earth masses in one solar mass
const J2000_JD = 2451545.0;
const DAYS_PER_JULIAN_YEAR = 365.25;
const D2R = Math.PI / 180;
const RSUN_AU = 0.00465047; // solar radius in AU
const KM_PER_AU = 1.495978707e8;
const angDiamDeg = (radiusAu: number, distAu: number) => 2 * Math.atan(radiusAu / distAu) * (180 / Math.PI);

/** Solve Kepler's equation M = E - e*sin(E) for the eccentric anomaly E (radians). */
export function solveKepler(M: number, e: number): number {
  // Normalize M to [-pi, pi] for fast, robust Newton convergence.
  let m = M % (2 * Math.PI);
  if (m > Math.PI) m -= 2 * Math.PI;
  if (m < -Math.PI) m += 2 * Math.PI;
  let E = e < 0.8 ? m : Math.PI * Math.sign(m || 1);
  for (let k = 0; k < 80; k++) {
    const dE = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-15) break;
  }
  return E;
}

/**
 * Position of an orbiting body relative to its central body at time t, in AU, in the
 * inertial ICRS frame.
 *
 * @param el              Keplerian elements
 * @param centralMassMsun mass of the central body in solar masses (sets the period)
 * @param tYears          Julian years since J2000.0
 */
export function keplerPosition(
  el: KeplerElements,
  centralMassMsun: number,
  tYears: number,
): Vec3 {
  const dtYears = tYears - (el.epoch_jd - J2000_JD) / DAYS_PER_JULIAN_YEAR;
  const periodYears = Math.sqrt((el.a_au * el.a_au * el.a_au) / centralMassMsun);
  const n = (2 * Math.PI) / periodYears; // rad / year
  const M = el.M0_deg * D2R + n * dtYears;
  const e = el.e;
  const E = solveKepler(M, e);

  // Perifocal (orbital-plane) coordinates.
  const xp = el.a_au * (Math.cos(E) - e);
  const yp = el.a_au * Math.sqrt(1 - e * e) * Math.sin(E);

  // Perifocal -> inertial via the classic 3-1-3 (omega, i, Omega) rotation.
  const w = el.omega_deg * D2R;
  const i = el.i_deg * D2R;
  const O = el.Omega_deg * D2R;
  const cw = Math.cos(w), sw = Math.sin(w);
  const ci = Math.cos(i), si = Math.sin(i);
  const cO = Math.cos(O), sO = Math.sin(O);
  return [
    (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp,
    (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp,
    si * sw * xp + si * cw * yp,
  ];
}

export interface ApparentBody {
  name: string;
  kind: "host_star" | "moon" | "sibling_planet";
  /** Unit direction in the inertial (ICRS) frame. */
  direction_icrs: Vec3;
  /** Distance from the observing planet, in AU. */
  distance_au: number;
  /** Apparent angular diameter (degrees), from the body's physical radius and its distance. */
  angularDiameterDeg: number;
  /** Sunlit fraction of the disc seen by the observer, 0 (new) .. 1 (full) — moon phase. */
  illuminatedFraction: number;
  /** Sun–body–observer phase angle in degrees (0 = full, 180 = new). */
  phaseAngleDeg: number;
  horizontal: HorizontalCoord;
}

function unit(v: Vec3): { dir: Vec3; dist: number } {
  const d = norm(v);
  return { dir: scale(v, 1 / d), dist: d };
}

/** Sunlit fraction + phase angle of a body, from its position and the host star's position,
 *  both relative to the observer. Phase angle is the Sun–body–observer angle. */
function illumination(bodyRelObs: Vec3, sunRelObs: Vec3): { frac: number; phaseDeg: number } {
  const toObs = scale(bodyRelObs, -1);
  const toSun = sub(sunRelObs, bodyRelObs);
  const a = norm(toObs), b = norm(toSun);
  if (a < 1e-12 || b < 1e-12) return { frac: 1, phaseDeg: 0 };
  const c = Math.max(-1, Math.min(1, (toObs[0] * toSun[0] + toObs[1] * toSun[1] + toObs[2] * toSun[2]) / (a * b)));
  return { frac: (1 + c) / 2, phaseDeg: (Math.acos(c) * 180) / Math.PI };
}

/**
 * All world bodies (host star, moons, optional sibling planets) as apparent moving bodies
 * for the observer, at time t. Geometry:
 *   - host star: the planet orbits the host, so from the planet the host lies opposite the
 *     planet's heliocentric position (-planet_pos).
 *   - moon: orbits the planet; direction is the moon's planet-relative position.
 *   - sibling planet: orbits the host; direction is (sibling_pos - planet_pos).
 */
export function worldBodies(world: World, tYears: number): ApparentBody[] {
  const o: PlanetOrientation = planetOrientation(world);
  const obs: GeoObserver = worldObserver(world);
  const toHorizon = (dir: Vec3) => inertialToHorizontal(dir, o, obs, tYears);

  const hostMass = world.host_star.mass_msun;
  const planetMassMsun = world.planet.mass_mearth / MEARTH_PER_MSUN;
  const planetPos = keplerPosition(world.planet.orbit, hostMass, tYears); // rel host
  const sunRelObs = scale(planetPos, -1); // host star relative to the observer (planet)

  const bodies: ApparentBody[] = [];

  // Host star, seen from the planet.
  {
    const { dir, dist } = unit(sunRelObs);
    bodies.push({
      name: world.host_star.catalog_id ?? "host star",
      kind: "host_star",
      direction_icrs: dir,
      distance_au: dist,
      angularDiameterDeg: angDiamDeg(world.host_star.radius_rsun * RSUN_AU, dist),
      illuminatedFraction: 1, phaseAngleDeg: 0,
      horizontal: toHorizon(dir),
    });
  }

  // Moons, orbiting the planet — lit by the host star (phase from the geometry).
  for (const moon of world.moons ?? []) {
    const m = keplerPosition(moon.orbit, planetMassMsun, tYears);
    const { dir, dist } = unit(m);
    const ill = illumination(m, sunRelObs);
    bodies.push({
      name: moon.name,
      kind: "moon",
      direction_icrs: dir,
      distance_au: dist,
      angularDiameterDeg: angDiamDeg(moon.radius_km / KM_PER_AU, dist),
      illuminatedFraction: ill.frac, phaseAngleDeg: ill.phaseDeg,
      horizontal: toHorizon(dir),
    });
  }

  // Sibling planets (optional; absent from the Sol world). They orbit the host, so their
  // direction from our planet is their heliocentric position minus the planet's.
  const siblings = (world as World & { siblings?: { name: string; orbit: KeplerElements; radius_km?: number }[] })
    .siblings;
  for (const sib of siblings ?? []) {
    const s = keplerPosition(sib.orbit, hostMass, tYears);
    const sRel = sub(s, planetPos);
    const { dir, dist } = unit(sRel);
    const ill = illumination(sRel, sunRelObs);
    bodies.push({
      name: sib.name,
      kind: "sibling_planet",
      direction_icrs: dir,
      distance_au: dist,
      angularDiameterDeg: angDiamDeg((sib.radius_km ?? 6371) / KM_PER_AU, dist),
      illuminatedFraction: ill.frac, phaseAngleDeg: ill.phaseDeg,
      horizontal: toHorizon(dir),
    });
  }

  return bodies;
}

/** Convenience: a single moon's planet-relative position (AU) at t. */
export function moonPosition(world: World, moon: Moon, tYears: number): Vec3 {
  return keplerPosition(moon.orbit, world.planet.mass_mearth / MEARTH_PER_MSUN, tYears);
}
