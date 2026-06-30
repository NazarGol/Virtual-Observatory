// Spec section 3.3 -- High-proper-motion drift test.
// Barnard's Star from the Sol vantage over 1e4 yr: the drift track must match astropy.
// This is where space-velocity reprojection bugs surface (Barnard has the largest known
// proper motion and a strong perspective acceleration from its -110 km/s approach).

import { test } from "node:test";
import assert from "node:assert/strict";
import { relocateStar } from "../src/relocate.js";
import { loadCatalog, loadFixture, angSepArcsec } from "./helpers.js";

interface DriftPoint {
  dt_yr: number;
  ra_deg: number;
  dec_deg: number;
  distance_pc: number;
}
interface DriftFixture {
  id: string;
  name: string;
  track: DriftPoint[];
}

test("3.3 Barnard drift track matches astropy over 1e4 yr", () => {
  const catalog = loadCatalog();
  const fixture = loadFixture<DriftFixture>("barnard_drift.json");
  const star = catalog.stars.find((s) => s.id === fixture.id);
  assert.ok(star, `catalog missing ${fixture.id}`);

  let maxArcsec = 0;
  for (const p of fixture.track) {
    const r = relocateStar(star!, { origin_pc: [0, 0, 0] }, p.dt_yr);
    assert.ok(r, `null at dt=${p.dt_yr}`);
    const sep = angSepArcsec(r!.ra_deg, r!.dec_deg, p.ra_deg, p.dec_deg);
    maxArcsec = Math.max(maxArcsec, sep);
    assert.ok(sep < 0.1, `dt=${p.dt_yr}yr: drift off by ${sep} arcsec`);
  }

  // Sanity: the star really does move (this test is meaningless if it doesn't).
  const a = fixture.track[0]!;
  const b = fixture.track[fixture.track.length - 1]!;
  const totalDeg =
    angSepArcsec(a.ra_deg, a.dec_deg, b.ra_deg, b.dec_deg) / 3600;
  assert.ok(totalDeg > 1, `expected large drift, got ${totalDeg} deg`);

  console.log(
    `  [3.3] Barnard drifts ${totalDeg.toFixed(1)} deg over 1e4 yr; ` +
      `worst track error ${maxArcsec.toExponential(2)} arcsec`,
  );
});
