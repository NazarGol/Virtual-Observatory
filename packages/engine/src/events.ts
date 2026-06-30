// Event timing (spec Phase 2 measurement: "event timing"). Pure root-finding over the
// engine's own Stage-2 altitude and measurement geometry -- so the instrument can answer
// "when does this rise / transit / set?" and "when is the next conjunction?" without the
// renderer doing any astronomy itself.

import {
  inertialToHorizontal,
  SECONDS_PER_JULIAN_YEAR,
  type GeoObserver,
  type PlanetOrientation,
} from "./horizontal.js";
import { greatCircleDeg } from "./measure.js";
import type { Vec3 } from "./vec.js";

/** Altitude (deg) of an inertial direction at time t, for this world's apparatus. */
export function altitudeDeg(
  dir: Vec3,
  o: PlanetOrientation,
  obs: GeoObserver,
  tYears: number,
): number {
  return inertialToHorizontal(dir, o, obs, tYears).altDeg;
}

export interface RiseSetTransit {
  riseYears: number | null;
  setYears: number | null;
  transitYears: number | null;
  transitAltitudeDeg: number;
  /** Always above the horizon over the rotation period (no rise/set). */
  circumpolar: boolean;
  /** Never reaches the horizon (no rise/set/visible transit). */
  neverRises: boolean;
}

function bisectZero(f: (t: number) => number, t0: number, t1: number, iters = 60): number {
  let a = t0, b = t1, fa = f(a);
  for (let k = 0; k < iters; k++) {
    const m = 0.5 * (a + b);
    const fm = f(m);
    if (fa < 0 !== fm < 0) b = m;
    else { a = m; fa = fm; }
  }
  return 0.5 * (a + b);
}

/** Golden-section maximisation of f on [t0, t1]. */
function goldenMax(f: (t: number) => number, t0: number, t1: number, iters = 60): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let a = t0, b = t1;
  let c = b - g * (b - a), d = a + g * (b - a);
  let fc = f(c), fd = f(d);
  for (let k = 0; k < iters; k++) {
    if (fc > fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = f(c); }
    else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = f(d); }
  }
  return 0.5 * (a + b);
}

/**
 * Rise, transit (upper culmination), and set of an object over the rotation period starting
 * at fromYears. Handles circumpolar and never-rises cases.
 */
export function findRiseSetTransit(
  dir: Vec3,
  o: PlanetOrientation,
  obs: GeoObserver,
  fromYears: number,
): RiseSetTransit {
  const period = o.rotationPeriodSeconds / SECONDS_PER_JULIAN_YEAR;
  const samples = 720; // ~2-minute resolution over a 24h day
  const alt = (t: number) => altitudeDeg(dir, o, obs, t);

  let rise: number | null = null;
  let set: number | null = null;
  let transitT = fromYears;
  let maxAlt = -Infinity, minAlt = Infinity;
  let prevT = fromYears, prevA = alt(fromYears);
  maxAlt = prevA; minAlt = prevA;

  for (let i = 1; i <= samples; i++) {
    const t = fromYears + (i / samples) * period;
    const a = alt(t);
    if (a > maxAlt) { maxAlt = a; transitT = t; }
    if (a < minAlt) minAlt = a;
    if (rise === null && prevA < 0 && a >= 0) rise = bisectZero(alt, prevT, t);
    if (set === null && prevA >= 0 && a < 0) set = bisectZero(alt, prevT, t);
    prevT = t; prevA = a;
  }

  const dt = period / samples;
  const transit = goldenMax(alt, Math.max(fromYears, transitT - dt), Math.min(fromYears + period, transitT + dt));
  const circumpolar = minAlt >= 0;
  const neverRises = maxAlt < 0;
  return {
    riseYears: circumpolar || neverRises ? null : rise,
    setYears: circumpolar || neverRises ? null : set,
    transitYears: neverRises ? null : transit,
    transitAltitudeDeg: alt(transit),
    circumpolar,
    neverRises,
  };
}

export interface Conjunction {
  timeYears: number;
  separationDeg: number;
}

/**
 * Minimum angular separation (closest approach / conjunction) between two moving objects
 * over [fromYears, fromYears+spanYears]. Coarse scan to bracket the minimum, then golden
 * section to refine. Returns null if either object is unresolved across the window.
 */
export function findMinSeparation(
  dirA: (t: number) => Vec3 | null,
  dirB: (t: number) => Vec3 | null,
  fromYears: number,
  spanYears: number,
  samples = 512,
): Conjunction | null {
  const sep = (t: number): number => {
    const a = dirA(t), b = dirB(t);
    return a && b ? greatCircleDeg(a, b) : Number.POSITIVE_INFINITY;
  };
  let bestT = fromYears, bestS = Infinity, bracketLo = fromYears;
  let prevT = fromYears;
  for (let i = 0; i <= samples; i++) {
    const t = fromYears + (i / samples) * spanYears;
    const s = sep(t);
    if (s < bestS) { bestS = s; bestT = t; bracketLo = prevT; }
    prevT = t;
  }
  if (!Number.isFinite(bestS)) return null;
  // Golden-section minimisation of sep in the bracket around the best sample.
  const step = spanYears / samples;
  const lo = Math.max(fromYears, bracketLo);
  const hi = Math.min(fromYears + spanYears, bestT + step);
  const tMin = goldenMax((t) => -sep(t), lo, hi);
  const sMin = sep(tMin);
  return sMin <= bestS ? { timeYears: tMin, separationDeg: sMin } : { timeYears: bestT, separationDeg: bestS };
}
