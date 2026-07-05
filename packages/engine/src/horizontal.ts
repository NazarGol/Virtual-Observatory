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
 * A reusable projector that turns inertial directions into the local horizontal frame for a
 * FIXED orientation/observer/time. The planet's equatorial basis, the sidereal angle, and
 * the observer Up/North/East basis depend only on (orientation, observer, t) -- not on the
 * star -- so they are computed once here. Projecting N stars is then N cheap dot products,
 * which is what keeps Stage 2 far below Stage-1 cost (spec section 1.4).
 */
export interface HorizontalProjector {
  project(dirIcrs: Vec3): HorizontalCoord;
}

export function makeHorizontalProjector(
  o: PlanetOrientation,
  obs: GeoObserver,
  tYears: number,
): HorizontalProjector {
  const { x: ex, y: ey, z: ez } = planetEquatorialBasis(o);

  // Local sidereal angle on the observer's meridian: spin phase + east longitude. Rotating
  // the equatorial vector by -(theta+lon) about the pole gives the hour-angle frame.
  const ang = siderealAngleRad(o, tYears) + obs.lonDeg * D2R;
  const c = Math.cos(ang);
  const s = Math.sin(ang);

  const phi = obs.latDeg * D2R;
  const cphi = Math.cos(phi);
  const sphi = Math.sin(phi);

  return {
    project(dirIcrs: Vec3): HorizontalCoord {
      // Direction in the planet's inertial-equatorial frame (pole = z).
      const eqx = dot(dirIcrs, ex);
      const eqy = dot(dirIcrs, ey);
      const eqz = dot(dirIcrs, ez);
      // dB = Rz(-ang) * dEq.
      const bx = c * eqx + s * eqy;
      const by = -s * eqx + c * eqy;
      const bz = eqz;
      // Project onto Up=[cphi,0,sphi], North=[-sphi,0,cphi], East=[0,1,0].
      const u = bx * cphi + bz * sphi;
      const n = -bx * sphi + bz * cphi;
      const e = by;
      const altDeg = Math.asin(Math.max(-1, Math.min(1, u))) * R2D;
      let azDeg = Math.atan2(e, n) * R2D;
      if (azDeg < 0) azDeg += 360;
      return { altDeg, azDeg };
    },
  };
}

/**
 * The observer's local East/North/Up basis expressed in ICRS, at time t. A star's horizontal
 * coords follow directly: alt = asin(dir . up), az = atan2(dir . east, dir . north). Used by
 * the renderer's horizon-dome projection so it needs no per-star engine call.
 */
export function horizontalBasisIcrs(
  o: PlanetOrientation,
  obs: GeoObserver,
  tYears: number,
): { east: Vec3; north: Vec3; up: Vec3 } {
  const { x: ex, y: ey, z: ez } = planetEquatorialBasis(o);
  const ang = siderealAngleRad(o, tYears) + obs.lonDeg * D2R;
  const c = Math.cos(ang), s = Math.sin(ang);
  const phi = obs.latDeg * D2R, cphi = Math.cos(phi), sphi = Math.sin(phi);
  // ENU in the planet-equatorial frame at (RA = ang, Dec = phi), then rotated to ICRS.
  const toIcrs = (v: Vec3): Vec3 => [
    ex[0] * v[0] + ey[0] * v[1] + ez[0] * v[2],
    ex[1] * v[0] + ey[1] * v[1] + ez[1] * v[2],
    ex[2] * v[0] + ey[2] * v[1] + ez[2] * v[2],
  ];
  return {
    east: toIcrs([-s, c, 0]),
    north: toIcrs([-sphi * c, -sphi * s, cphi]),
    up: toIcrs([cphi * c, cphi * s, sphi]),
  };
}

/**
 * Rotate a single inertial (ICRS) unit direction into the observer's local horizontal
 * frame. Convenience wrapper around {@link makeHorizontalProjector}; for many stars at one
 * time, build the projector once and reuse it.
 */
export function inertialToHorizontal(
  dirIcrs: Vec3,
  o: PlanetOrientation,
  obs: GeoObserver,
  tYears: number,
): HorizontalCoord {
  return makeHorizontalProjector(o, obs, tYears).project(dirIcrs);
}
