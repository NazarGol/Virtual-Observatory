// Sim/render decoupling (spec section 1.4): "Changing time recomputes star state
// (potentially slow); moving the camera does not. Scrubbing centuries must not run the
// render loop at sim cost."
//
// The split that makes this work is Stage 1 vs Stage 2:
//   - Stage 1 (relocate + propagate the whole catalog -> inertial directions) is the
//     expensive part, but stellar positions change only on proper-motion (millennia)
//     timescales. So it is CACHED and recomputed only when sim-time moves far enough to
//     matter (recomputeThresholdYears).
//   - Stage 2 (rotate the cached inertial sky into alt/az) is cheap and runs every frame:
//     it is what spins the planet, so the diurnal sky (and camera) stay smooth without
//     ever re-running Stage 1.
//
// A century scrub recomputes Stage 1 a handful of times; an all-night diurnal scrub
// recomputes it zero times. Either way the per-frame cost is just Stage 2.

import type { Catalog } from "./catalog.js";
import { galacticToIcrs } from "./frames.js";
import {
  makeHorizontalProjector,
  type GeoObserver,
  type PlanetOrientation,
} from "./horizontal.js";
import { relocateStar, type Observer } from "./relocate.js";
import type { Vec3 } from "./vec.js";
import type { World } from "./world.js";
import { planetOrientation, worldObserver } from "./world.js";
import { worldBodies, type ApparentBody } from "./bodies.js";

/** A star after Stage 1: a fixed inertial direction + recomputed magnitude. */
export interface InertialStar {
  id: string;
  name: string;
  direction_icrs: Vec3;
  mag: number;
  distance_pc: number;
  bp_rp: number;
}

/** A star after Stage 2: where it is in the local sky right now. */
export interface HorizontalStar {
  id: string;
  name: string;
  altDeg: number;
  azDeg: number;
  mag: number;
  bp_rp: number;
}

export class SkySession {
  private readonly catalog: Catalog;
  private readonly world: World;
  private readonly stage1Observer: Observer;
  private readonly orientation: PlanetOrientation;
  private readonly geoObserver: GeoObserver;
  private readonly recomputeThresholdYears: number;

  private inertialCache: InertialStar[] = [];
  private cachedAtYears = Number.NaN;
  private recomputeCount = 0;

  /**
   * @param recomputeThresholdYears how far sim-time may move before Stage 1 is recomputed.
   *   Default 1 yr: even the fastest star (Barnard, ~10"/yr) shifts < ~10" within it, far
   *   below a wide-field pixel, so diurnal/annual scrubbing reuses the cache; century jumps
   *   trigger a recompute.
   */
  constructor(catalog: Catalog, world: World, recomputeThresholdYears = 1.0) {
    this.catalog = catalog;
    this.world = world;
    this.stage1Observer = {
      origin_pc: world.host_star.galactic_xyz_pc,
      vel_kms: world.host_star.space_velocity_kms,
    };
    this.orientation = planetOrientation(world);
    this.geoObserver = worldObserver(world);
    this.recomputeThresholdYears = recomputeThresholdYears;
  }

  /** Force a Stage-1 recompute (the expensive path) at time t. */
  recomputeInertial(tYears: number): void {
    const out: InertialStar[] = [];
    for (const star of this.catalog.stars) {
      const r = relocateStar(star, this.stage1Observer, tYears);
      if (r === null) continue; // star coincident with the observer (e.g. the host)
      out.push({
        id: r.id,
        name: r.name,
        direction_icrs: galacticToIcrs(r.direction_gal),
        mag: r.mag,
        distance_pc: r.distance_pc,
        bp_rp: r.bp_rp,
      });
    }
    this.inertialCache = out;
    this.cachedAtYears = tYears;
    this.recomputeCount++;
  }

  /** Recompute Stage 1 only if the cache is missing or too stale. Returns true if it ran. */
  ensureInertial(tYears: number): boolean {
    if (
      this.inertialCache.length === 0 ||
      Number.isNaN(this.cachedAtYears) ||
      Math.abs(tYears - this.cachedAtYears) > this.recomputeThresholdYears
    ) {
      this.recomputeInertial(tYears);
      return true;
    }
    return false;
  }

  /**
   * The local horizontal sky at time t (Stage 2 only, on the cached inertial sky). Cheap;
   * safe to call every render frame. Call ensureInertial(t) yourself when you want the
   * cache refreshed for large time jumps -- this method never recomputes Stage 1.
   */
  horizontalSky(tYears: number): HorizontalStar[] {
    // Build the projector once (basis + sidereal angle + observer frame), then project each
    // cached star with a few dot products -- this is the cheap per-frame path.
    const project = makeHorizontalProjector(this.orientation, this.geoObserver, tYears);
    const out: HorizontalStar[] = new Array(this.inertialCache.length);
    for (let i = 0; i < this.inertialCache.length; i++) {
      const s = this.inertialCache[i];
      const h = project.project(s.direction_icrs);
      out[i] = {
        id: s.id,
        name: s.name,
        altDeg: h.altDeg,
        azDeg: h.azDeg,
        mag: s.mag,
        bp_rp: s.bp_rp,
      };
    }
    return out;
  }

  /** Moving bodies (host star, moons, siblings) at time t. Cheap (a handful of bodies). */
  bodies(tYears: number): ApparentBody[] {
    return worldBodies(this.world, tYears);
  }

  get inertial(): readonly InertialStar[] {
    return this.inertialCache;
  }
  get lastRecomputeYears(): number {
    return this.cachedAtYears;
  }
  get recomputes(): number {
    return this.recomputeCount;
  }
}
