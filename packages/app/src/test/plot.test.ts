import { describe, it, expect } from "vitest";
import { magClass, ringedRanks, PLOT_CLASSING } from "../plot";

describe("magClass (the magnitude -> ink-class seam)", () => {
  it("maps brighter magnitudes to higher classes, monotonically", () => {
    expect(magClass(6.2)).toBe(0);
    expect(magClass(4.8)).toBe(1);
    expect(magClass(3.6)).toBe(2);
    expect(magClass(2.4)).toBe(3);
    expect(magClass(0.5)).toBe(4);
    const classes = [6.2, 4.8, 3.6, 2.4, 0.5].map((m) => magClass(m));
    for (let i = 1; i < classes.length; i++) expect(classes[i]).toBeGreaterThan(classes[i - 1]!);
  });
  it("depthStops promotes stars like a deeper plate", () => {
    expect(magClass(5.0)).toBe(1);
    expect(magClass(5.0, 1.5)).toBe(2);
    expect(magClass(5.0, -1.0)).toBe(0);
  });
});

describe("ringedRanks", () => {
  it("assigns rank 1 to the brightest and caps at ringedCount", () => {
    const mags = Array.from({ length: 100 }, (_, i) => 6 - i * 0.05); // index 99 brightest
    const ranks = ringedRanks(mags);
    expect(ranks.size).toBe(PLOT_CLASSING.ringedCount);
    expect(ranks.get(99)).toBe(1);
    expect(ranks.get(99 - PLOT_CLASSING.ringedCount + 1)).toBe(PLOT_CLASSING.ringedCount);
    expect(ranks.has(0)).toBe(false);
  });
  it("is deterministic under ties", () => {
    const mags = [1, 1, 1, 1];
    const a = ringedRanks(mags, 2), b = ringedRanks(mags, 2);
    expect([...a.entries()]).toEqual([...b.entries()]);
    expect(a.get(0)).toBe(1);
  });
});
