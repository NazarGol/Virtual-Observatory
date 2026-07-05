import { describe, it, expect } from "vitest";
import type { CatalogStar, InertialStar, Vec3 } from "@vobs/engine";
import { comovingCandidates, anomalyCandidates, alignmentCandidates, candidatesFromStar } from "../analysis";

const cat = (id: string, pos: Vec3, vel: Vec3): CatalogStar =>
  ({ id, name: id, pos_pc: pos, vel_kms: vel, mag_ref: 5, d_ref_pc: 10, bp_rp: 0.6 } as CatalogStar);
const star = (id: string, dir: Vec3, mag = 2, dist = 10, bp_rp = 0.6): InertialStar =>
  ({ id, name: id, direction_icrs: dir, mag, distance_pc: dist, bp_rp });

describe("comovingCandidates", () => {
  it("groups nearby stars that share a space velocity, excludes outliers", () => {
    const v: Vec3 = [10, 0, 0];
    const c = [
      cat("A", [0, 0, 0], v), cat("B", [3, 1, 0], [10.5, 0.2, 0]), cat("C", [1, 2, 1], [9.7, -0.3, 0.1]),
      cat("FAR", [500, 0, 0], v),            // same velocity but far away -> not grouped
      cat("DRIFT", [2, 0, 0], [-40, 0, 0]),  // nearby but very different velocity -> not grouped
    ];
    const vis = new Set(c.map((s) => s.id));
    const groups = comovingCandidates(c, vis);
    expect(groups.length).toBe(1);
    expect(groups[0]!.objectIds.sort()).toEqual(["A", "B", "C"]);
    expect(groups[0]!.kind).toBe("co-moving");
  });
});

describe("anomalyCandidates", () => {
  it("surfaces the fastest movers, nearest, and colour extremes as distinct standouts", () => {
    const stars = [
      star("m1", [1, 0, 0], 3, 20, 0.6),   // fastest pm
      star("m2", [0, 1, 0], 3, 25, 0.6),   // 2nd pm
      star("near", [0, 0, 1], 4, 1.0, 0.6),// nearest
      star("blue", [1, 1, 0], 2, 30, -0.4),// bluest
      star("red", [0, 1, 1], 2, 30, 2.5),  // reddest
      star("fill", [1, 0, 1], 3, 40, 0.6),
    ];
    const pm = new Map([["m1", 900], ["m2", 300], ["near", 5], ["blue", 4], ["red", 6], ["fill", 3]]);
    const out = anomalyCandidates(stars, pm);
    const labels = out.map((c) => c.label).join(" | ");
    expect(labels).toContain("fast mover · m1");
    expect(labels).toContain("nearest · near");
    expect(labels).toContain("bluest · blue");
    expect(labels).toContain("reddest · red");
    out.forEach((c) => expect(c.objectIds.length).toBe(1));
  });
});

describe("candidatesFromStar", () => {
  it("proposes co-moving companions and sky neighbours for the selected star", () => {
    const v: Vec3 = [12, 0, 0];
    const catalog = [
      cat("SELF", [0, 0, 0], v), cat("MOVE1", [4, 1, 0], [12.4, 0.2, 0]), cat("MOVE2", [2, 3, 1], [11.6, -0.3, 0]),
      cat("DRIFT", [3, 0, 0], [-30, 0, 0]),   // near but wrong velocity
    ];
    const d = (deg: number): Vec3 => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180), 0];
    const stars = [
      star("SELF", d(0), 3), star("MOVE1", d(40), 3), star("MOVE2", d(80), 3),
      star("DRIFT", d(120), 3), star("NB", d(2.5), 3), // NB is 2.5deg from SELF on the sky
    ];
    const out = candidatesFromStar(catalog, stars, new Map(), "SELF");
    const cm = out.find((c) => c.kind === "co-moving");
    expect(cm).toBeTruthy();
    expect(cm!.objectIds).toContain("SELF");
    expect(cm!.objectIds.sort()).toEqual(["MOVE1", "MOVE2", "SELF"]);
    const nb = out.find((c) => c.kind === "neighbour" && c.objectIds.includes("NB"));
    expect(nb).toBeTruthy();
  });
});

describe("alignmentCandidates", () => {
  it("finds a near-collinear bright triple on a common great circle", () => {
    // three directions on the equator (great circle z=0), well separated within span
    const d = (deg: number): Vec3 => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180), 0];
    const stars = [
      star("p1", d(0), 2), star("p2", d(15), 2), star("p3", d(32), 2),
      star("off", [0.2, 0.1, 0.97], 2), // off the great circle
    ];
    const out = alignmentCandidates(stars);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0]!.objectIds.sort()).toEqual(["p1", "p2", "p3"]);
    expect(out[0]!.kind).toBe("alignment");
  });
});
