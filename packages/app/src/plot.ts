// The plotted sky's magnitude -> class seam (Phase 6R). Engraved-atlas logic: star ink is
// DISCRETE classes, not a continuous brightness ramp. This module is the single swappable
// mapping — the renderer consumes it on the CPU, so replacing the classing scheme (or
// feeding it a different quantity than apparent magnitude) touches only this file.
//
//   class 0        faintest — a single 1px dot
//   class 1..3     stepped dot sizes
//   class 4        bright — larger dot with one fine dotted ring
//   ringed 1..20   the ~20 brightest at this vantage — concentric dotted-ring glyphs,
//                  sized by rank (1 = brightest). Rank is assigned per vantage, not by a
//                  fixed magnitude cut, so every sky gets its ringed nodes.

export const PLOT_CLASSING = {
  /** upper apparent-magnitude bounds for classes 4,3,2,1 (fainter than last = class 0) */
  thresholds: [2.0, 3.2, 4.3, 5.3] as const,
  /** how many of the brightest stars become concentric-ring glyphs */
  ringedCount: 20,
};

/** Discrete ink class for an apparent magnitude. `depthStops` shifts the effective plate
 *  depth (like a deeper exposure promoting stars a class up). */
export function magClass(mag: number, depthStops = 0): 0 | 1 | 2 | 3 | 4 {
  const m = mag - depthStops;
  const t = PLOT_CLASSING.thresholds;
  if (m < t[0]) return 4;
  if (m < t[1]) return 3;
  if (m < t[2]) return 2;
  if (m < t[3]) return 1;
  return 0;
}

/** Rank the brightest `count` stars: returns index -> rank (1 = brightest). Ties broken by
 *  index so the assignment is deterministic. */
export function ringedRanks(mags: number[], count = PLOT_CLASSING.ringedCount): Map<number, number> {
  const order = mags.map((m, i) => ({ m, i })).sort((a, b) => a.m - b.m || a.i - b.i);
  const out = new Map<number, number>();
  for (let r = 0; r < Math.min(count, order.length); r++) out.set(order[r]!.i, r + 1);
  return out;
}
