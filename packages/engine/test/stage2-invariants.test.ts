// Phase 1 -- Stage-2 invariants that hold for ANY planet orientation, hand-derived from
// spherical astronomy. These validate the general pole/rotation machinery (the oracle grid
// only covers the Sol pole) and include the section-6 acceptance criteria: a chosen star's
// rise/set azimuth matches a hand-computed value, and a high-pm star's Phase-0 drift is
// carried faithfully through Stage 2.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inertialToHorizontal,
  raDecToVec,
  SECONDS_PER_JULIAN_YEAR,
  type PlanetOrientation,
} from "../src/horizontal.js";
import { relocateStar } from "../src/relocate.js";
import { galacticToIcrs } from "../src/frames.js";
import { angularSepUnit, type Vec3 } from "../src/vec.js";
import { loadCatalog } from "./helpers.js";

const SOL: PlanetOrientation = {
  northPoleRaDeg: 0,
  northPoleDecDeg: 90,
  rotationPeriodSeconds: 86164,
};
const D2R = Math.PI / 180;
const periodYears = (o: PlanetOrientation) => o.rotationPeriodSeconds / SECONDS_PER_JULIAN_YEAR;

function altazToVec(altDeg: number, azDeg: number): Vec3 {
  const a = altDeg * D2R;
  const z = azDeg * D2R;
  return [Math.cos(a) * Math.cos(z), Math.cos(a) * Math.sin(z), Math.sin(a)];
}

test("a star at the planet's north pole sits at altitude = latitude, due north, for all t and any pole", () => {
  const orientations: PlanetOrientation[] = [
    SOL,
    { northPoleRaDeg: 45, northPoleDecDeg: 60, rotationPeriodSeconds: 50000 },
  ];
  for (const o of orientations) {
    const poleDir = raDecToVec(o.northPoleRaDeg, o.northPoleDecDeg);
    for (const lat of [-30, 0, 40, 70]) {
      for (const t of [0, 0.123, 7.7 * periodYears(o)]) {
        const h = inertialToHorizontal(poleDir, o, { latDeg: lat, lonDeg: 33 }, t);
        assert.ok(Math.abs(h.altDeg - lat) < 1e-9, `pole-star alt ${h.altDeg} != lat ${lat}`);
        const azFromNorth = Math.min(h.azDeg, 360 - h.azDeg); // 0 and 360 both == north
        assert.ok(azFromNorth < 1e-6, `pole-star az ${h.azDeg} != 0/360 (north)`);
      }
    }
  }
});

test("an equatorial star rises due East and sets due West", () => {
  // Sol world, star at RA=0/Dec=0, observer lon=0: hour angle H = spin angle theta.
  // Rising at H=-90deg (theta=-pi/2), setting at H=+90deg.
  const star = raDecToVec(0, 0);
  const obs = { latDeg: 40, lonDeg: 0 };
  const tRise = -0.25 * periodYears(SOL);
  const tSet = 0.25 * periodYears(SOL);
  const rise = inertialToHorizontal(star, SOL, obs, tRise);
  const set = inertialToHorizontal(star, SOL, obs, tSet);
  assert.ok(Math.abs(rise.altDeg) < 1e-9 && Math.abs(rise.azDeg - 90) < 1e-9, JSON.stringify(rise));
  assert.ok(Math.abs(set.altDeg) < 1e-9 && Math.abs(set.azDeg - 270) < 1e-9, JSON.stringify(set));
});

test("section 6 acceptance: rise/set azimuth matches the hand-computed value for the latitude", () => {
  // For declination d and latitude phi, the rising azimuth (measured from North) is
  // A = acos(sin d / cos phi): a +20 deg-dec star rises in the NE at A, sets in the NW at
  // 360-A. (Equatorial star d=0 -> A=90, due East -- consistent with the test above.)
  const decDeg = 20;
  const latDeg = 40;
  const d = decDeg * D2R;
  const phi = latDeg * D2R;
  const A = Math.acos(Math.sin(d) / Math.cos(phi)) / D2R; // hand formula -> 63.482...

  // Hour angle at the horizon: cos H0 = -tan(phi) tan(d). Rising = -H0 (eastern).
  const H0 = Math.acos(-Math.tan(phi) * Math.tan(d)); // radians
  const star = raDecToVec(0, decDeg); // RA=0, lon=0 -> H = theta
  const tRise = (-H0 / (2 * Math.PI)) * periodYears(SOL); // theta = -H0
  const tSet = (H0 / (2 * Math.PI)) * periodYears(SOL);

  const rise = inertialToHorizontal(star, SOL, { latDeg, lonDeg: 0 }, tRise);
  const set = inertialToHorizontal(star, SOL, { latDeg, lonDeg: 0 }, tSet);

  assert.ok(Math.abs(rise.altDeg) < 1e-9, `rise not on horizon: alt ${rise.altDeg}`);
  assert.ok(Math.abs(rise.azDeg - A) < 1e-7, `rise az ${rise.azDeg} != hand value ${A}`);
  assert.ok(Math.abs(set.azDeg - (360 - A)) < 1e-7, `set az ${set.azDeg} != ${360 - A}`);
  console.log(`  [stage2] rise/set azimuth dec=${decDeg} lat=${latDeg}: A=${A.toFixed(4)} deg (matched)`);
});

test("the horizontal sky is periodic in one sidereal rotation", () => {
  const star = raDecToVec(123, 33);
  const obs = { latDeg: 31, lonDeg: 17 };
  for (const t of [0, 0.001, 0.5]) {
    const a = inertialToHorizontal(star, SOL, obs, t);
    const b = inertialToHorizontal(star, SOL, obs, t + periodYears(SOL));
    assert.ok(Math.abs(a.altDeg - b.altDeg) < 1e-9 && Math.abs(a.azDeg - b.azDeg) < 1e-7);
  }
});

test("section 6 acceptance: a high-pm star's Phase-0 drift is carried through Stage 2", () => {
  // Stage 2 is a rigid rotation, so it must preserve the angular drift Barnard accrues in
  // Stage 1 between two epochs (the ~53 deg over 1e4 yr from Phase 0).
  const cat = loadCatalog();
  const barnard = cat.stars.find((s) => s.id === "HIP87937");
  assert.ok(barnard, "Barnard missing from catalog");

  const inertial = (t: number): Vec3 =>
    galacticToIcrs(relocateStar(barnard!, { origin_pc: [0, 0, 0] }, t)!.direction_gal);
  const d0 = inertial(0);
  const d1 = inertial(10000);
  const inertialDriftDeg = (angularSepUnit(d0, d1) * 180) / Math.PI;

  const obs = { latDeg: 28, lonDeg: 12 };
  const h0 = inertialToHorizontal(d0, SOL, obs, 0);
  const h1 = inertialToHorizontal(d1, SOL, obs, 0);
  const horizDriftDeg =
    (angularSepUnit(altazToVec(h0.altDeg, h0.azDeg), altazToVec(h1.altDeg, h1.azDeg)) * 180) /
    Math.PI;

  assert.ok(inertialDriftDeg > 1, `expected visible drift, got ${inertialDriftDeg} deg`);
  assert.ok(
    Math.abs(horizDriftDeg - inertialDriftDeg) < 1e-9,
    `Stage 2 changed the drift: inertial ${inertialDriftDeg} vs horizontal ${horizDriftDeg}`,
  );
  console.log(
    `  [stage2] Barnard drift carried through Stage 2: ${horizDriftDeg.toFixed(2)} deg (matches Stage 1)`,
  );
});
