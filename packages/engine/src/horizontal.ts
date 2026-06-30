// Stage 2 of the transform (spec section 4): the LOCAL HORIZONTAL SKY -- the "apparatus".
//
// Stage 1 gave each star a direction in the host system's inertial (ICRS-equatorial)
// frame. Stage 2 applies the planet's orientation -- spin-axis (RA/Dec of the north pole),
// rotation phase as a function of time, and observer latitude/longitude -- to rotate those
// inertial directions into the topocentric horizontal frame (altitude, azimuth). This is
// where the apparatus makes the field rise, set, and acquire a pole.
//
// It is pure geometry of a rotating sphere (no atmosphere, no refraction -- deferred,
// section 7). For the Sol world (pole at the ICRS pole, sidereal rotation period) it
// reduces exactly to textbook equatorial->horizontal astronomy, which is how the section-3
// inertial directions stay meaningful here. Conventions used:
//   - azimuth measured from North (0 deg), increasing toward East (90 deg).
//   - altitude in [-90, 90]; latitude/longitude in degrees, longitude positive East.
//   - time is Julian years since J2000.0 (same clock as Stage 1); the planet's prime
//     meridian is aligned with the inertial RA=0 direction at t=0 (epoch convention).

import { cross, dot, normalize, type Vec3 } from "./vec.js";

export const SECONDS_PER_JULIAN_YEAR = 31_557_600;
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export interface PlanetOrientation {
  /** RA of the planet's north pole in the inertial (ICRS) frame, degrees. */
  northPoleRaDeg: number;
  /** Dec of the planet's north pole in the inertial (ICRS) frame, degrees. */
  northPoleDecDeg: number;
  /** Sidereal rotation period in seconds (one rotation relative to the inertial frame). */
  rotationPeriodSeconds: number;
}

export interface GeoObserver {
  latDeg: number;
  /** East-positive longitude in degrees. */
  lonDeg: number;
}

export interface HorizontalCoord {
  altDeg: number;
  /** Azimuth from North toward East, [0, 360). */
  azDeg: number;
}

/** Unit vector from ICRS (RA, Dec) in degrees. +x at (0,0), +z at the pole. */
export function raDecToVec(raDeg: number, decDeg: number): Vec3 {
  const ra = raDeg * D2R;
  const dec = decDeg * D2R;
  const cd = Math.cos(dec);
  return [cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec)];
}

/**
 * Orthonormal basis of the planet's equatorial (inertial, non-rotating) frame, expressed
 * in ICRS: z = spin axis (north pole), x = ascending node of the planet equator on the
 * ICRS equator, y = z x x. When the pole coincides with the ICRS pole (the Sol world) the
 * node is undefined, so we fall back to the ICRS x-axis -- giving the identity frame.
 */
export function planetEquatorialBasis(o: PlanetOrientation): {
  x: Vec3;
  y: Vec3;
  z: Vec3;
} {
  const z = raDecToVec(o.northPoleRaDeg, o.northPoleDecDeg);
  const node = cross([0, 0, 1], z);
  const nlen = Math.hypot(node[0], node[1], node[2]);
  const x: Vec3 = nlen < 1e-9 ? [1, 0, 0] : normalize(node);
  const y = cross(z, x);
  return { x, y, z };
}

/** Sidereal rotation angle of the planet at time t (Julian years since J2000), radians. */
export function siderealAngleRad(o: PlanetOrientation, tYears: number): number {
  const periodYears = o.rotationPeriodSeconds / SECONDS_PER_JULIAN_YEAR;
  const ang = (2 * Math.PI * tYears) / periodYears;
  return ang;
}

/**
 * Rotate an inertial (ICRS) unit direction into the observer's local horizontal frame.
 *
 * @param dirIcrs unit direction in the inertial frame (from Stage 1)
 * @param o       planet spin-axis + rotation period
 * @param obs     observer latitude/longitude
 * @param tYears  Julian years since J2000.0
 */
export function inertialToHorizontal(
  dirIcrs: Vec3,
  o: PlanetOrientation,
  obs: GeoObserver,
  tYears: number,
): HorizontalCoord {
  const { x: ex, y: ey, z: ez } = planetEquatorialBasis(o);

  // Direction in the planet's inertial-equatorial frame (pole = z).
  const dEq: Vec3 = [dot(dirIcrs, ex), dot(dirIcrs, ey), dot(dirIcrs, ez)];

  // Local sidereal angle on the observer's meridian: spin phase + east longitude.
  // Rotating dEq by -(theta+lon) about the pole puts the observer's meridian at RA=0,
  // i.e. the hour-angle frame.
  const ang = siderealAngleRad(o, tYears) + obs.lonDeg * D2R;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const dB: Vec3 = [c * dEq[0] + s * dEq[1], -s * dEq[0] + c * dEq[1], dEq[2]];

  // Observer at latitude phi on the prime meridian (lon already folded in): local
  // Up/North/East basis in this rotated frame.
  const phi = obs.latDeg * D2R;
  const cphi = Math.cos(phi);
  const sphi = Math.sin(phi);
  const up: Vec3 = [cphi, 0, sphi];
  const north: Vec3 = [-sphi, 0, cphi];
  const east: Vec3 = [0, 1, 0];

  const u = dot(dB, up);
  const n = dot(dB, north);
  const e = dot(dB, east);

  const altDeg = Math.asin(Math.max(-1, Math.min(1, u))) * R2D;
  let azDeg = Math.atan2(e, n) * R2D;
  if (azDeg < 0) azDeg += 360;
  return { altDeg, azDeg };
}
