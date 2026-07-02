// Phase 4-FIX acceptance, written as REQUIREMENTS (not just invariants): generated worlds
// must be anchored to REAL catalog hosts, so relocating to one produces a genuinely different
// sky than another -- the thing the audit found silently missing (every world was at the Sol
// origin with a synthetic sun). These tests would have failed on the old code.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  selectHosts, generateWorldForHost, validateWorld, mulberry32, WORLD_TYPES,
} from "../src/worldgen.js";
import { relocateStar } from "../src/relocate.js";
import { galacticToIcrs } from "../src/frames.js";
import { angularSepUnit, type Vec3 } from "../src/vec.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const byId = new Map(catalog.stars.map((s) => [s.id, s]));

test("selectHosts returns real F/G/K main-sequence catalog stars (not SOL, not giants)", () => {
  const hosts = selectHosts(catalog.stars);
  assert.ok(hosts.length >= 2, `expected >= 2 FGK hosts in the catalog, got ${hosts.length}`);
  for (const h of hosts) {
    assert.notEqual(h.catalog_id, "SOL");
    assert.ok(byId.has(h.catalog_id), `${h.catalog_id} must be a real catalog star`);
    assert.ok(h.bp_rp >= 0.4 && h.bp_rp <= 1.5, `${h.catalog_id} outside F/G/K color`);
    assert.deepEqual(h.galactic_xyz_pc, byId.get(h.catalog_id)!.pos_pc, "host uses the real catalog position");
  }
  console.log(`  [4-fix] hosts: ${hosts.map((h) => `${h.catalog_id}(${h.mass_msun.toFixed(2)}M)`).join(", ")}`);
});

test("every generated world is anchored to a real host: catalog_id resolves, vantage != origin", () => {
  const host = selectHosts(catalog.stars)[0]!;
  for (const type of WORLD_TYPES) {
    const w = generateWorldForHost(type, host, mulberry32(11), 1, 11);
    assert.ok(w.host_star.catalog_id && byId.has(w.host_star.catalog_id), `${type}: catalog_id must resolve to a real star`);
    assert.deepEqual(w.host_star.galactic_xyz_pc, host.galactic_xyz_pc, `${type}: must sit at its host's position`);
    assert.ok(Math.hypot(...w.host_star.galactic_xyz_pc) > 0, `${type}: host must not be at the origin`);
    assert.ok(validateWorld(w).ok, `${type}: must still pass its physics regime`);
  }
});

test("DISTINCT SKY: two worlds with different hosts relocate a probe star to a different direction AND magnitude", () => {
  const hosts = selectHosts(catalog.stars);
  // high_obliquity has no locking constraint, so it generates around any F/G/K host (habitable
  // is marginal around late-K hosts whose HZ nearly locks -- that would make the test flaky).
  const wA = generateWorldForHost("high_obliquity", hosts[0]!, mulberry32(1), 1, 1);
  const wB = generateWorldForHost("high_obliquity", hosts[1]!, mulberry32(2), 2, 2);
  assert.notEqual(wA.host_star.catalog_id, wB.host_star.catalog_id);

  const probe = catalog.stars
    .filter((s) => s.id !== "SOL" && s.id !== wA.host_star.catalog_id && s.id !== wB.host_star.catalog_id)
    .sort((a, b) => a.mag_ref - b.mag_ref)[0]!;

  const seen = (xyz: Vec3) => {
    const r = relocateStar(probe, { origin_pc: xyz }, 0)!;
    return { dir: galacticToIcrs(r.direction_gal), mag: r.mag };
  };
  const a = seen(wA.host_star.galactic_xyz_pc);
  const b = seen(wB.host_star.galactic_xyz_pc);
  const sepDeg = (angularSepUnit(a.dir, b.dir) * 180) / Math.PI;

  assert.ok(sepDeg > 0.01, `probe direction must differ between vantages (got ${sepDeg} deg)`);
  assert.ok(Math.abs(a.mag - b.mag) > 1e-3, `probe magnitude must differ (${a.mag} vs ${b.mag})`);
  console.log(`  [4-fix] probe ${probe.id} from ${wA.host_star.catalog_id} vs ${wB.host_star.catalog_id}: ${sepDeg.toFixed(1)} deg apart, ${(a.mag - b.mag).toFixed(2)} mag different`);
});

test("every generated parameter carries provenance (real vs derived vs sampled)", () => {
  const w = generateWorldForHost("multi_moon", selectHosts(catalog.stars)[0]!, mulberry32(3), 1, 3);
  const p = w.provenance!;
  assert.equal(p["host"]!.real, true, "host must be marked real");
  assert.equal(p["host_star.luminosity_lsun"]!.real, true, "luminosity is real-derived from the observed magnitude");
  assert.ok(!p["host_star.mass_msun"]!.real, "mass is derived, not claimed real");
  for (const key of ["planet.orbit.a_au", "planet.orbit.e", "planet.axial_tilt_deg", "planet.rotation_period_s", "moons"]) {
    assert.ok(p[key]?.note, `missing provenance note for ${key}`);
  }
});
