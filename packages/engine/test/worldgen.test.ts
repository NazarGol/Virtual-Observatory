// World-type generator. The project ethos: "weird" is a STRICTER set of physics checks, not
// a skipped one. These tests prove (a) every generated world passes its own type's regime,
// (b) the gallery spans all types, (c) the validators actually REJECT physics violations
// (a moon inside Roche, an unbound orbit, a non-synchronous "locked" world...), and (d) the
// tidal-locking timescale behaves correctly (Earth/Sun never locks; a close-in M-dwarf
// planet does).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateGallery, generateWorld, validateWorld, mulberry32,
  tidalLockTimescaleYears, WORLD_TYPES, type GeneratedWorld,
} from "../src/worldgen.js";

test("every generated world passes its own type's physics regime", () => {
  const gallery = generateGallery(12, 42);
  for (const w of gallery) {
    const v = validateWorld(w);
    assert.ok(v.ok, `${w.world_type} (${w.name}) failed: ${v.checks.filter((c) => !c.ok).map((c) => c.name + " [" + c.detail + "]").join("; ")}`);
  }
});

test("the gallery spans all six world types", () => {
  const gallery = generateGallery(6, 7);
  const types = new Set(gallery.map((w) => w.world_type));
  for (const t of WORLD_TYPES) assert.ok(types.has(t), `gallery missing type ${t}`);
  console.log(`  [worldgen] gallery types: ${[...types].join(", ")}`);
});

test("generation is deterministic for a given seed", () => {
  const a = generateGallery(6, 99).map((w) => `${w.world_type}:${w.planet.orbit.a_au.toFixed(4)}`);
  const b = generateGallery(6, 99).map((w) => `${w.world_type}:${w.planet.orbit.a_au.toFixed(4)}`);
  assert.deepEqual(a, b);
});

test("a tidally-locked world has rotation period == orbital period", () => {
  const w = generateWorld("tidally_locked", mulberry32(3), 1);
  const Porb_yr = Math.sqrt(w.planet.orbit.a_au ** 3 / w.host_star.mass_msun);
  const Porb_s = Porb_yr * 3.15576e7;
  assert.ok(Math.abs(w.planet.rotation_period_s - Porb_s) / Porb_s < 1e-9, "Prot != Porb");
  console.log(`  [worldgen] locked world: a=${w.planet.orbit.a_au.toFixed(3)} AU, P=${(Porb_s / 86400).toFixed(1)} d (spin=orbit)`);
});

test("validators REJECT physics violations (weird != unvalidated)", () => {
  // start from a valid multi-moon world, then push a moon inside the Roche limit
  const good = generateWorld("multi_moon", mulberry32(5), 1);
  const bad: GeneratedWorld = structuredClone(good);
  bad.moons[0]!.orbit.a_au = 1e-6; // well inside Roche
  const v = validateWorld(bad);
  assert.equal(v.ok, false);
  assert.ok(v.checks.some((c) => c.name.includes("Roche") && !c.ok), "Roche violation not caught");

  // unbound eccentric orbit
  const ecc = generateWorld("eccentric", mulberry32(6), 1);
  const unbound: GeneratedWorld = structuredClone(ecc);
  unbound.planet.orbit.e = 1.4;
  assert.equal(validateWorld(unbound).ok, false);

  // a "tidally locked" world whose spin isn't synchronized
  const locked = generateWorld("tidally_locked", mulberry32(8), 1);
  const desync: GeneratedWorld = structuredClone(locked);
  desync.planet.rotation_period_s *= 2;
  const dv = validateWorld(desync);
  assert.ok(dv.checks.some((c) => c.name.includes("synchronized") && !c.ok), "desync not caught");

  // a "habitable" world shoved out of the HZ
  const hab = generateWorld("habitable", mulberry32(9), 1);
  const cold: GeneratedWorld = structuredClone(hab);
  cold.planet.orbit.a_au *= 10;
  assert.equal(validateWorld(cold).ok, false);
});

test("tidal-locking timescale: Earth/Sun never locks, a close-in M-dwarf planet does", () => {
  const earth = tidalLockTimescaleYears(1.0, 1.0, 6371, 1.0);
  assert.ok(earth > 1e11, `Earth should not lock (tau=${earth.toExponential(2)} yr)`);
  const mdwarf = tidalLockTimescaleYears(0.05, 0.3, 6371, 1.0);
  assert.ok(mdwarf < 1e9, `close-in M-dwarf planet should lock fast (tau=${mdwarf.toExponential(2)} yr)`);
  console.log(`  [worldgen] tau_lock: Earth/Sun ${(earth / 1e9).toExponential(1)} Gyr; 0.05AU/0.3Msun ${(mdwarf / 1e6).toFixed(0)} Myr`);
});
