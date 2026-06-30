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

export async function loadSky(): Promise<LoadedSky> {
  const [catalog, worldRaw] = await Promise.all([
    fetch("data/catalog.json").then((r) => r.json() as Promise<Catalog>),
    fetch("data/world.json").then((r) => r.json()),
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

/** A SkySession built for a chosen vantage (the world's host star relocated there). */
export function buildSession(sky: LoadedSky, vantage: Vantage): { session: SkySession; observer: Observer } {
  const observer = observerFor(sky, vantage);
  const world: World = {
    ...sky.world,
    host_star: {
      ...sky.world.host_star,
      galactic_xyz_pc: observer.origin_pc,
      space_velocity_kms: observer.vel_kms ?? [0, 0, 0],
    },
  };
  return { session: new SkySession(sky.catalog, world), observer };
}

/** Inertial direction of any catalog object at time t (for the measurement resolver + events). */
export function directionAt(sky: LoadedSky, observer: Observer, id: string, t: number): Vec3 | null {
  const star = sky.byId.get(id);
  if (!star) return null;
  const r = relocateStar(star, observer, t);
  return r ? galacticToIcrs(r.direction_gal) : null;
}

export function horizontalOf(sky: LoadedSky, dir: Vec3, t: number): HorizontalCoord {
  return inertialToHorizontal(dir, sky.orientation, sky.geoObserver, t);
}

export function riseSetOf(sky: LoadedSky, dir: Vec3, t: number) {
  return findRiseSetTransit(dir, sky.orientation, sky.geoObserver, t);
}

export function bodiesAt(session: SkySession, t: number): ApparentBody[] {
  return session.bodies(t);
}

export const SECONDS_PER_JULIAN_YEAR = 31_557_600;
