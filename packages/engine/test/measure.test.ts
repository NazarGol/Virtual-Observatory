// Phase 2 -- measurement engine. The section-6 acceptance: angular distance between two
// selected stars matches the engine's great-circle value (here cross-checked against an
// independent haversine), and a measurement survives serialize -> reload -> re-resolve at a
// scrubbed time, reconnecting the same object IDs at their propagated positions.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  greatCircleDeg,
  positionAngleDeg,
  alignmentDeviationDeg,
  resolveMeasurement,
  serializeMeasurements,
  parseMeasurements,
  type MeasurementDef,
  type ObjectResolver,
} from "../src/measure.js";
import { raDecToVec } from "../src/horizontal.js";
import { relocateStar } from "../src/relocate.js";
import { galacticToIcrs } from "../src/frames.js";
import type { Vec3 } from "../src/vec.js";
import { loadCatalog } from "./helpers.js";

const D2R = Math.PI / 180;

// Independent great-circle distance (haversine on RA/Dec) to validate greatCircleDeg.
function haversineDeg(ra1: number, d1: number, ra2: number, d2: number): number {
  const dl = (ra2 - ra1) * D2R, dd = (d2 - d1) * D2R;
  const h = Math.sin(dd / 2) ** 2 + Math.cos(d1 * D2R) * Math.cos(d2 * D2R) * Math.sin(dl / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h))) / D2R;
}

test("great-circle distance matches an independent haversine", () => {
  const cases: [number, number, number, number][] = [
    [0, 0, 90, 0], [10, 20, 250, -40], [359, 89, 1, 89], [123, -33, 124, -33],
  ];
  let maxErr = 0;
  for (const [ra1, d1, ra2, d2] of cases) {
    const e = greatCircleDeg(raDecToVec(ra1, d1), raDecToVec(ra2, d2));
    maxErr = Math.max(maxErr, Math.abs(e - haversineDeg(ra1, d1, ra2, d2)));
  }
  assert.ok(maxErr < 1e-10, `great-circle vs haversine off by ${maxErr}`);
});

test("position angle: due North = 0, due East = 90", () => {
  const a = raDecToVec(0, 0);
  const north = raDecToVec(0, 10); // higher dec, same RA
  const east = raDecToVec(10, 0); // higher RA, same dec
  assert.ok(Math.abs(positionAngleDeg(a, north)) < 1e-9, "north should be PA 0");
  assert.ok(Math.abs(positionAngleDeg(a, east) - 90) < 1e-9, "east should be PA 90");
});

test("alignment deviation is ~0 for collinear points and grows off the great circle", () => {
  const onCircle = [raDecToVec(0, 0), raDecToVec(20, 0), raDecToVec(40, 0)]; // the equator
  assert.ok(alignmentDeviationDeg(onCircle) < 1e-9, "equatorial points should be aligned");
  const off = [raDecToVec(0, 0), raDecToVec(20, 15), raDecToVec(40, 0)];
  assert.ok(alignmentDeviationDeg(off) > 10, "bent triple should be far from aligned");
});

test("section 6: angular-distance measurement == engine great-circle, and persists across reload + time-scrub", () => {
  const catalog = loadCatalog();
  const observer = { origin_pc: [0, 0, 0] as Vec3 };

  // Resolver: id -> inertial ICRS direction at time t (Stage 1 + frame rotation).
  const resolve: ObjectResolver = (id, t) => {
    const star = catalog.stars.find((s) => s.id === id);
    if (!star) return null;
    const r = relocateStar(star, observer, t);
    return r ? galacticToIcrs(r.direction_gal) : null;
  };

  const def: MeasurementDef = {
    id: "m1",
    kind: "angular_distance",
    objectIds: ["HIP87937", "HIP32349"], // Barnard, Sirius
    createdAtYears: 0,
  };

  // Survives a serialize -> reload round-trip with the same IDs.
  const reloaded = parseMeasurements(serializeMeasurements([def]))[0]!;
  assert.deepEqual(reloaded.objectIds, def.objectIds);
  assert.equal(reloaded.kind, "angular_distance");

  // Re-resolves correctly at two different (scrubbed) times, matching the direct value, and
  // the value actually changes as the high-pm star drifts -- proving it tracks the objects.
  for (const t of [0, 50000]) {
    const res = resolveMeasurement(reloaded, resolve, t);
    assert.ok(res.ok, `unresolved at t=${t}: ${res.missing}`);
    const direct = greatCircleDeg(resolve("HIP87937", t)!, resolve("HIP32349", t)!);
    assert.ok(Math.abs(res.angularDistanceDeg! - direct) < 1e-12, `t=${t}: measurement != engine value`);
  }
  const at0 = resolveMeasurement(reloaded, resolve, 0).angularDistanceDeg!;
  const at50k = resolveMeasurement(reloaded, resolve, 50000).angularDistanceDeg!;
  assert.ok(Math.abs(at0 - at50k) > 1, "Barnard drift should change the separation over 5e4 yr");
  console.log(
    `  [measure] Barnard-Sirius separation: ${at0.toFixed(3)} deg at J2000 -> ${at50k.toFixed(3)} deg at +5e4 yr`,
  );
});

test("a measurement with a missing object resolves as not-ok rather than throwing", () => {
  const def: MeasurementDef = {
    id: "m2", kind: "angular_distance", objectIds: ["HIP87937", "NOPE"], createdAtYears: 0,
  };
  const res = resolveMeasurement(def, (id) => (id === "HIP87937" ? [1, 0, 0] : null), 0);
  assert.equal(res.ok, false);
  assert.deepEqual(res.missing, ["NOPE"]);
});
