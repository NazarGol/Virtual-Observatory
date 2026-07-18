// Phase 5 item 3 acceptance (at the render helper layer, since the engine stays pure): the
// Milky Way band's orientation is computed from the observer's real 3D vantage, so it MOVES
// when the observer relocates -- it is not a static skybox. Bonus: from Sol the band's bright
// side must point at the real galactic center (Sagittarius), which validates the frame.
import { describe, it, expect } from "vitest";
import { milkyWayGeometry, milkyWayStipple, stippleDensity } from "../milkyway";
import type { Vec3 } from "@vobs/engine";

const sepDeg = (a: Vec3, b: Vec3) =>
  (Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180) / Math.PI;

describe("Milky Way band is vantage-dependent, not a skybox", () => {
  it("the galactic-center direction shifts when the observer relocates perpendicular to it", () => {
    const sol = milkyWayGeometry([0, 0, 0]);
    const relocated = milkyWayGeometry([0, 500, 0]); // 500 pc off the Sun-GC line
    expect(sepDeg(sol.galacticCenterIcrs, relocated.galacticCenterIcrs)).toBeGreaterThan(2);
    expect(Math.hypot(...sol.diskNormalIcrs)).toBeCloseTo(1, 6);
    expect(Math.hypot(...sol.galacticCenterIcrs)).toBeCloseTo(1, 6);
  });

  it("from Sol the bright side points at the real galactic center (Sagittarius, RA~266.4, Dec~-28.9)", () => {
    const g = milkyWayGeometry([0, 0, 0]).galacticCenterIcrs;
    const ra = ((Math.atan2(g[1], g[0]) * 180) / Math.PI + 360) % 360;
    const dec = (Math.asin(g[2]) * 180) / Math.PI;
    expect(Math.abs(ra - 266.4)).toBeLessThan(3);
    expect(Math.abs(dec + 28.9)).toBeLessThan(3);
  });
});

describe("Milky Way stipple field (Phase 6R: structure is density)", () => {
  it("is dense in the plane, thin at high latitude, and the dust lane is a sparser channel", () => {
    // off the lane in the plane vs high latitude, at the same longitude
    expect(stippleDensity(0.8, 0.06)).toBeGreaterThan(3 * stippleDensity(0.8, 0.4));
    // toward the centre, the lane (beta ~ 0.012) is sparser than just off it
    expect(stippleDensity(0, 0.012)).toBeLessThan(0.6 * stippleDensity(0, 0.08));
    // bulge: centre denser than anticentre at the same off-lane latitude
    expect(stippleDensity(0, 0.08)).toBeGreaterThan(2 * stippleDensity(Math.PI, 0.08));
  });
  it("emits deterministic unit directions and honours the requested count", () => {
    const geo = milkyWayGeometry([0, 0, 0]);
    const a = milkyWayStipple(geo, 500), b = milkyWayStipple(geo, 500);
    expect(a.length).toBe(500);
    expect(a[0]!.dir).toEqual(b[0]!.dir);
    for (const p of a.slice(0, 20)) expect(Math.hypot(...p.dir)).toBeCloseTo(1, 6);
  });
});
