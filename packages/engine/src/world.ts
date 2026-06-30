// World schema (spec section 5). The observatory CONSUMES a hand-authored world.json; it
// never generates it. This module is pure: it parses an already-decoded object (no fs, no
// fetch), so the engine stays Node- and browser-agnostic. File reading lives in tools/tests.

import type { Vec3 } from "./vec.js";
import type { GeoObserver, PlanetOrientation } from "./horizontal.js";

export interface KeplerElements {
  a_au: number;
  e: number;
  i_deg: number;
  Omega_deg: number;
  omega_deg: number;
  M0_deg: number;
  epoch_jd: number;
}

export interface HostStar {
  catalog_id: string | null;
  galactic_xyz_pc: Vec3;
  space_velocity_kms: Vec3;
  mass_msun: number;
  luminosity_lsun: number;
  teff_k: number;
  radius_rsun: number;
}

export interface Planet {
  radius_km: number;
  mass_mearth: number;
  rotation_period_s: number;
  axial_tilt_deg: number;
  north_pole_inertial: { ra_deg: number; dec_deg: number };
  orbit: KeplerElements;
}

export interface Moon {
  name: string;
  radius_km: number;
  albedo: number;
  orbit: KeplerElements;
}

export interface World {
  schema_version: string;
  name: string;
  host_star: HostStar;
  planet: Planet;
  moons: Moon[];
  observer: { lat_deg: number; lon_deg: number; elevation_m: number };
  epoch_jd: number;
  catalog_ref: string;
}

function req(obj: Record<string, unknown>, key: string): unknown {
  if (!(key in obj)) throw new Error(`world.json: missing required field "${key}"`);
  return obj[key];
}

/** Validate + narrow a decoded world.json object. Throws on missing required fields. */
export function parseWorld(raw: unknown): World {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("world.json: expected an object");
  }
  const o = raw as Record<string, unknown>;
  // Touch the load-bearing fields so a malformed world fails loudly at load, not mid-sim.
  req(o, "planet");
  req(o, "observer");
  const planet = o["planet"] as Record<string, unknown>;
  req(planet, "rotation_period_s");
  req(planet, "north_pole_inertial");
  return raw as World;
}

/** Planet spin-axis + rotation period for Stage 2. */
export function planetOrientation(world: World): PlanetOrientation {
  return {
    northPoleRaDeg: world.planet.north_pole_inertial.ra_deg,
    northPoleDecDeg: world.planet.north_pole_inertial.dec_deg,
    rotationPeriodSeconds: world.planet.rotation_period_s,
  };
}

/** Observer geographic position for Stage 2. */
export function worldObserver(world: World): GeoObserver {
  return { latDeg: world.observer.lat_deg, lonDeg: world.observer.lon_deg };
}
