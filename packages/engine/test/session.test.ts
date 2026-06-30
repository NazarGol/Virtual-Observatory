// Phase 1 -- sim/render decoupling. The cached Stage-2 path must equal the direct
// Stage-1+Stage-2 computation (decoupling changes performance, never results), and the
// cache must be reused across diurnal scrubbing but refreshed across large time jumps.

import { test } from "node:test";
import assert from "node:assert/strict";
import { SkySession } from "../src/session.js";
import { relocateStar } from "../src/relocate.js";
import { galacticToIcrs } from "../src/frames.js";
import { inertialToHorizontal } from "../src/horizontal.js";
import { planetOrientation, worldObserver } from "../src/world.js";
import { loadCatalog, loadSolWorld } from "./helpers.js";

test("cached horizontal sky equals the direct Stage-1+Stage-2 computation", () => {
  const catalog = loadCatalog();
  const world = loadSolWorld();
  const session = new SkySession(catalog, world);

  const t = 0.01; // ~3.65 days after J2000
  session.recomputeInertial(t);
  const cached = session.horizontalSky(t);

  const orientation = planetOrientation(world);
  const obs = worldObserver(world);
  const observer = {
    origin_pc: world.host_star.galactic_xyz_pc,
    vel_kms: world.host_star.space_velocity_kms,
  };
  const byId = new Map(cached.map((s) => [s.id, s]));

  let checked = 0;
  for (const star of catalog.stars) {
    const r = relocateStar(star, observer, t);
    if (r === null) continue;
    const h = inertialToHorizontal(galacticToIcrs(r.direction_gal), orientation, obs, t);
    const c = byId.get(star.id);
    assert.ok(c, `missing ${star.id}`);
    assert.ok(Math.abs(c!.altDeg - h.altDeg) < 1e-12, `${star.id} alt mismatch`);
    assert.ok(Math.abs(c!.azDeg - h.azDeg) < 1e-12, `${star.id} az mismatch`);
    assert.ok(Math.abs(c!.mag - r.mag) < 1e-12, `${star.id} mag mismatch`);
    checked++;
  }
  assert.ok(checked > 0, "checked no stars");
});

test("Stage 1 is cached across diurnal scrubbing and refreshed across century jumps", () => {
  const session = new SkySession(loadCatalog(), loadSolWorld(), 1.0);

  assert.equal(session.ensureInertial(0), true, "first call should recompute");
  assert.equal(session.recomputes, 1);

  // Spin the planet across a whole day many times: no Stage-1 recompute.
  for (let h = 0; h <= 48; h++) {
    const tYears = (h * 3600) / 31_557_600;
    const ran = session.ensureInertial(tYears);
    assert.equal(ran, false, `diurnal scrub at h=${h} should not recompute`);
  }
  assert.equal(session.recomputes, 1, "diurnal scrubbing must not recompute Stage 1");

  // A century jump exceeds the threshold -> exactly one recompute.
  assert.equal(session.ensureInertial(100), true, "century jump should recompute");
  assert.equal(session.recomputes, 2);

  // horizontalSky never recomputes Stage 1, even at a wildly different time.
  session.horizontalSky(5000);
  assert.equal(session.recomputes, 2, "horizontalSky must not recompute Stage 1");
});
