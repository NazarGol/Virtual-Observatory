// Engine-facing data layer for the instrument. Everything astronomical comes from
// @vobs/engine; this module only loads the catalog/world and adapts the engine to the UI.
import {
  SkySession,
  parseWorld,
  galacticToIcrs,
  relocateStar,
  inertialToHorizontal,
  planetOrientation,
  worldObserver,
  findRiseSetTransit,
  horizontalBasisIcrs,
  type Catalog,
  type CatalogStar,
  type World,
  type Vec3,
  type Observer,
  type PlanetOrientation,
  type GeoObserver,
  type ApparentBody,
  type HorizontalCoord,
} from "@vobs/engine";

export type Vantage = "sol" | "alpha-cen";

export interface LoadedSky {
  catalog: Catalog;
  world: World;
  byId: Map<string, CatalogStar>;
  orientation: PlanetOrientation;
  geoObserver: GeoObserver;
}

/** Thrown when a required data/*.json file is missing or malformed, naming exactly which
 *  file and how to fix it -- the app never shows a raw fetch/JSON error for this (Gate B
 *  data-pipeline fix: see tools/emit_app_data.ts). */
export class AppDataError extends Error {
  constructor(public readonly file: string, cause: string) {
    super(`missing or invalid ${file} (${cause})`);
    this.name = "AppDataError";
  }
}

async function fetchJson(path: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(path);
  } catch {
    throw new AppDataError(path, "network error fetching it");
  }
  if (!res.ok) throw new AppDataError(path, `HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new AppDataError(path, "not valid JSON");
  }
}

export async function loadSky(): Promise<LoadedSky> {
  const [catalog, worldRaw] = await Promise.all([
    fetchJson("data/catalog.json") as Promise<Catalog>,
    fetchJson("data/world.json"),
  ]);
  const world = parseWorld(worldRaw);
  return {
    catalog,
    world,
    byId: new Map(catalog.stars.map((s) => [s.id, s])),
    orientation: planetOrientation(world),
    geoObserver: worldObserver(world),
  };
}

export function observerFor(sky: LoadedSky, vantage: Vantage): Observer {
  if (vantage === "alpha-cen") {
    const ac = sky.byId.get("HIP71683");
    if (ac) return { origin_pc: ac.pos_pc, vel_kms: [0, 0, 0] };
  }
  return { origin_pc: [0, 0, 0], vel_kms: [0, 0, 0] };
}

/** A SkySession observing from an arbitrary galactic position (pc). */
export function buildSessionAt(sky: LoadedSky, origin_pc: Vec3, vel_kms: Vec3 = [0, 0, 0]): { session: SkySession; observer: Observer } {
  const world: World = {
    ...sky.world,
    host_star: { ...sky.world.host_star, galactic_xyz_pc: origin_pc, space_velocity_kms: vel_kms },
  };
  return { session: new SkySession(sky.catalog, world), observer: { origin_pc, vel_kms } };
}

/** A SkySession built for a named vantage (Sol / Alpha Cen). */
export function buildSession(sky: LoadedSky, vantage: Vantage): { session: SkySession; observer: Observer } {
  const observer = observerFor(sky, vantage);
  return buildSessionAt(sky, observer.origin_pc, observer.vel_kms ?? [0, 0, 0]);
}

/** Inertial direction of any catalog object at time t (for the measurement resolver + events). */
export function directionAt(sky: LoadedSky, observer: Observer, id: string, t: number): Vec3 | null {
  const star = sky.byId.get(id);
  if (!star) return null;
  const r = relocateStar(star, observer, t);
  return r ? galacticToIcrs(r.direction_gal) : null;
}

export function horizontalOf(o: PlanetOrientation, obs: GeoObserver, dir: Vec3, t: number): HorizontalCoord {
  return inertialToHorizontal(dir, o, obs, t);
}

export function riseSetOf(o: PlanetOrientation, obs: GeoObserver, dir: Vec3, t: number) {
  return findRiseSetTransit(dir, o, obs, t);
}

/** East/North/Up (ICRS) for the horizon-dome projection at time t. */
export function horizonBasisFor(o: PlanetOrientation, obs: GeoObserver, t: number) {
  return horizontalBasisIcrs(o, obs, t);
}

export function bodiesAt(session: SkySession, t: number): ApparentBody[] {
  return session.bodies(t);
}

export const SECONDS_PER_JULIAN_YEAR = 31_557_600;
