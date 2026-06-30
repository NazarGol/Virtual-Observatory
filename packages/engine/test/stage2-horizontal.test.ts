// Phase 1 -- Stage-2 local horizontal frame matches the independent trig oracle.
// The oracle (bake/make_stage2_fixtures.py) computes alt/az with closed-form spherical
// trig; the engine uses ENU-vector projection. Agreement across a 1500-case grid of
// (ra, dec, lat, lon, t) validates the rotation chain by a genuinely different formulation.

import { test } from "node:test";
import assert from "node:assert/strict";
import { inertialToHorizontal, raDecToVec, type PlanetOrientation } from "../src/horizontal.js";
import { loadFixture } from "./helpers.js";

interface Stage2Case {
  ra_deg: number;
  dec_deg: number;
  lat_deg: number;
  lon_deg: number;
  t_years: number;
  alt_deg: number;
  az_deg: number;
}
interface Stage2Fixture {
  orientation: PlanetOrientation;
  cases: Stage2Case[];
}

/** Smallest absolute difference between two azimuths, accounting for 0/360 wrap. */
function azDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

test("Stage-2 alt/az matches the closed-form trig oracle over a 1500-case grid", () => {
  const fx = loadFixture<Stage2Fixture>("stage2_horizontal.json");
  let maxAlt = 0;
  let maxAz = 0;

  for (const c of fx.cases) {
    const h = inertialToHorizontal(
      raDecToVec(c.ra_deg, c.dec_deg),
      fx.orientation,
      { latDeg: c.lat_deg, lonDeg: c.lon_deg },
      c.t_years,
    );
    const dAlt = Math.abs(h.altDeg - c.alt_deg);
    maxAlt = Math.max(maxAlt, dAlt);
    assert.ok(dAlt < 1e-9, `alt off by ${dAlt} at ${JSON.stringify(c)}`);

    // Azimuth is degenerate at the zenith/nadir; only compare it away from the poles.
    if (Math.abs(h.altDeg) < 89.9) {
      const dAz = azDiff(h.azDeg, c.az_deg);
      maxAz = Math.max(maxAz, dAz);
      assert.ok(dAz < 1e-7, `az off by ${dAz} at ${JSON.stringify(c)}`);
    }
  }

  console.log(
    `  [stage2] worst alt error ${maxAlt.toExponential(2)} deg, ` +
      `worst az error ${maxAz.toExponential(2)} deg over ${fx.cases.length} cases`,
  );
});
