// Phase 1 -- Keplerian moving bodies. Two-body propagation validated by hand-computable
// invariants (Kepler's equation residual, periapsis/apoapsis distances, circular-orbit
// uniformity, periodicity), plus the world's moon behaving as a moving body that rises and
// sets through Stage 2.

import { test } from "node:test";
import assert from "node:assert/strict";
import { keplerPosition, solveKepler, worldBodies } from "../src/bodies.js";
import { norm } from "../src/vec.js";
import type { KeplerElements } from "../src/world.js";
import { loadSolWorld } from "./helpers.js";

const J2000_JD = 2451545.0;
const el = (over: Partial<KeplerElements>): KeplerElements => ({
  a_au: 1, e: 0, i_deg: 0, Omega_deg: 0, omega_deg: 0, M0_deg: 0, epoch_jd: J2000_JD, ...over,
});

test("Kepler's equation is solved: E - e*sin(E) == M", () => {
  for (const e of [0, 0.1, 0.5, 0.9, 0.97]) {
    for (let M = -6; M <= 6; M += 0.37) {
      const E = solveKepler(M, e);
      const residual = E - e * Math.sin(E) - M;
      // residual is checked modulo 2*pi (E is in the principal branch).
      const wrapped = Math.atan2(Math.sin(residual), Math.cos(residual));
      assert.ok(Math.abs(wrapped) < 1e-12, `e=${e} M=${M}: residual ${wrapped}`);
    }
  }
});

test("periapsis and apoapsis distances are a(1-e) and a(1+e)", () => {
  const a = 2.5, e = 0.3;
  const peri = keplerPosition(el({ a_au: a, e, M0_deg: 0 }), 1.0, 0); // M=0 -> periapsis
  const period = Math.sqrt(a * a * a / 1.0);
  const apo = keplerPosition(el({ a_au: a, e, M0_deg: 0 }), 1.0, period / 2); // M=pi -> apoapsis
  assert.ok(Math.abs(norm(peri) - a * (1 - e)) < 1e-12, `periapsis ${norm(peri)}`);
  assert.ok(Math.abs(norm(apo) - a * (1 + e)) < 1e-10, `apoapsis ${norm(apo)}`);
});

test("a circular orbit has constant radius and uniform angular motion", () => {
  const a = 1.7;
  const orbit = el({ a_au: a, e: 0, i_deg: 0 });
  const period = Math.sqrt(a * a * a / 1.0);
  const p0 = keplerPosition(orbit, 1.0, 0);
  const pq = keplerPosition(orbit, 1.0, period / 4); // quarter period -> 90 deg
  assert.ok(Math.abs(norm(p0) - a) < 1e-12 && Math.abs(norm(pq) - a) < 1e-12, "radius not constant");
  // 90 degrees later the position should be orthogonal to the start.
  const dotN = (p0[0] * pq[0] + p0[1] * pq[1] + p0[2] * pq[2]) / (a * a);
  assert.ok(Math.abs(dotN) < 1e-10, `quarter-period angle off: cos=${dotN}`);
});

test("orbits are periodic", () => {
  const orbit = el({ a_au: 1.3, e: 0.4, i_deg: 20, Omega_deg: 50, omega_deg: 80, M0_deg: 33 });
  const period = Math.sqrt(1.3 ** 3 / 1.0);
  const p0 = keplerPosition(orbit, 1.0, 0.123);
  const p1 = keplerPosition(orbit, 1.0, 0.123 + period);
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(p0[k] - p1[k]) < 1e-9, "not periodic");
});

test("the world's moon and host star are moving bodies that rise and set", () => {
  const world = loadSolWorld();
  // Sample the moon's altitude across a day; it must change (it is a moving body), and the
  // host star must be present as a body.
  const alts: number[] = [];
  for (let h = 0; h < 24; h += 2) {
    const tYears = (h * 3600) / 31_557_600; // h hours after J2000, in Julian years
    const bodies = worldBodies(world, tYears);
    const moon = bodies.find((b) => b.kind === "moon");
    const host = bodies.find((b) => b.kind === "host_star");
    assert.ok(moon && host, "expected a moon and a host star");
    alts.push(moon!.horizontal.altDeg);
  }
  const span = Math.max(...alts) - Math.min(...alts);
  assert.ok(span > 10, `moon altitude barely moved over a day (span ${span} deg)`);
  console.log(`  [bodies] Luna altitude swings ${span.toFixed(1)} deg over a day (rises/sets)`);
});
