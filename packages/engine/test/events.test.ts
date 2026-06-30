// Phase 2 -- event timing. Rise/transit/set validated against the hand geometry from the
// Phase-1 rise/set test (hour angle at the horizon: cos H0 = -tan phi tan d; transit
// altitude = 90 - |phi - d|), plus circumpolar / never-rises cases and a conjunction
// (closest-approach) search for two moving objects.

import { test } from "node:test";
import assert from "node:assert/strict";
import { findRiseSetTransit, findMinSeparation, altitudeDeg } from "../src/events.js";
import { raDecToVec, SECONDS_PER_JULIAN_YEAR, type PlanetOrientation } from "../src/horizontal.js";
import { normalize, type Vec3 } from "../src/vec.js";

const SOL: PlanetOrientation = { northPoleRaDeg: 0, northPoleDecDeg: 90, rotationPeriodSeconds: 86164 };
const periodYears = SOL.rotationPeriodSeconds / SECONDS_PER_JULIAN_YEAR;

test("rise / transit / set match the hand-computed hour angle and altitude", () => {
  const decDeg = 20, latDeg = 40;
  const star = raDecToVec(0, decDeg); // RA=0, observer lon=0 -> hour angle H = spin angle
  const obs = { latDeg, lonDeg: 0 };

  // Hand values: transit at H=0 (t=0); horizon crossings at H = +/- H0.
  const d = decDeg * (Math.PI / 180), phi = latDeg * (Math.PI / 180);
  const H0 = Math.acos(-Math.tan(phi) * Math.tan(d));
  const tRise = (-H0 / (2 * Math.PI)) * periodYears;
  const tSet = (H0 / (2 * Math.PI)) * periodYears;
  const transitAltHand = 90 - Math.abs(latDeg - decDeg); // 70 for dec<lat

  const r = findRiseSetTransit(star, SOL, obs, -periodYears / 2);
  assert.ok(!r.circumpolar && !r.neverRises, "star should rise and set");
  assert.ok(Math.abs(r.riseYears! - tRise) < 1e-6 * periodYears, `rise ${r.riseYears} != ${tRise}`);
  assert.ok(Math.abs(r.setYears! - tSet) < 1e-6 * periodYears, `set ${r.setYears} != ${tSet}`);
  assert.ok(Math.abs(r.transitYears!) < 1e-4 * periodYears, `transit ${r.transitYears} != 0`);
  assert.ok(Math.abs(r.transitAltitudeDeg - transitAltHand) < 1e-3, `transit alt ${r.transitAltitudeDeg} != ${transitAltHand}`);
  assert.ok(Math.abs(altitudeDeg(star, SOL, obs, r.riseYears!)) < 1e-6, "altitude at rise should be ~0");
  console.log(
    `  [events] dec ${decDeg} from lat ${latDeg}: transit alt ${r.transitAltitudeDeg.toFixed(2)} deg, ` +
      `up for ${((r.setYears! - r.riseYears!) / periodYears * 24).toFixed(2)} h`,
  );
});

test("circumpolar and never-rises cases are detected", () => {
  const obs = { latDeg: 70, lonDeg: 0 };
  const circ = findRiseSetTransit(raDecToVec(80, 80), SOL, obs, 0); // dec 80 > 90-lat=20
  assert.ok(circ.circumpolar && circ.riseYears === null && circ.setYears === null, "should be circumpolar");
  const never = findRiseSetTransit(raDecToVec(80, -80), SOL, obs, 0); // dec -80 < -(90-lat)
  assert.ok(never.neverRises && never.transitYears === null, "should never rise");
});

test("conjunction: finds the closest approach time and separation of two moving objects", () => {
  // A fixed at [1,0,0]; B sweeps past it, nearest at t=5 with a 0.05 rad z-offset.
  const offset = 0.05;
  const dirA = (): Vec3 => [1, 0, 0];
  const dirB = (t: number): Vec3 => {
    const theta = -0.5 + 0.1 * t; // crosses 0 at t=5
    return normalize([Math.cos(theta), Math.sin(theta), offset]);
  };
  const c = findMinSeparation(dirA, dirB, 0, 10);
  assert.ok(c, "expected a conjunction");
  assert.ok(Math.abs(c!.timeYears - 5) < 1e-3, `closest at t=${c!.timeYears}, expected 5`);
  const expectedSep = Math.asin(offset / Math.hypot(1, offset)) * (180 / Math.PI);
  assert.ok(Math.abs(c!.separationDeg - expectedSep) < 1e-3, `min sep ${c!.separationDeg} != ${expectedSep}`);
  console.log(`  [events] closest approach at t=${c!.timeYears.toFixed(3)}, separation ${c!.separationDeg.toFixed(3)} deg`);
});
