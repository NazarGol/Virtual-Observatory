// Spec section 3.2 -- Sol-vs-astropy propagated test.
// Observer at origin, t = J2000 + dt for dt out to 1e5 yr. Engine output must match
// astropy apply_space_motion to < 0.1 arcsec in direction and < 1 mmag. Validates the
// time-propagation math, not just the static transform.

import { test } from "node:test";
import assert from "node:assert/strict";
import { relocateStar } from "../src/relocate.js";
import { loadCatalog, loadFixture, angSepArcsec } from "./helpers.js";

interface PropSample {
  dt_yr: number;
  ra_deg: number;
  dec_deg: number;
  distance_pc: number;
}
interface PropRow {
  id: string;
  d_ref_pc: number;
  mag_ref: number;
  samples: PropSample[];
}

test("3.2 Sol-vs-astropy: propagation matches astropy to < 0.1 arcsec / < 1 mmag", () => {
  const catalog = loadCatalog();
  const fixture = loadFixture<PropRow[]>("sol_astropy_propagated.json");
  const byId = new Map(catalog.stars.map((s) => [s.id, s]));

  let maxArcsec = 0;
  let maxMag = 0;
  let n = 0;

  for (const row of fixture) {
    const star = byId.get(row.id);
    assert.ok(star, `catalog missing ${row.id}`);

    for (const s of row.samples) {
      const r = relocateStar(star!, { origin_pc: [0, 0, 0] }, s.dt_yr);
      assert.ok(r, `${row.id} null at dt=${s.dt_yr}`);

      const sep = angSepArcsec(r!.ra_deg, r!.dec_deg, s.ra_deg, s.dec_deg);
      // Expected magnitude from astropy's propagated distance.
      const expectedMag = row.mag_ref + 5 * Math.log10(s.distance_pc / row.d_ref_pc);
      const dMag = Math.abs(r!.mag - expectedMag);

      maxArcsec = Math.max(maxArcsec, sep);
      maxMag = Math.max(maxMag, dMag);
      n++;

      assert.ok(
        sep < 0.1,
        `${row.id} @dt=${s.dt_yr}yr: direction off by ${sep} arcsec`,
      );
      assert.ok(dMag < 1e-3, `${row.id} @dt=${s.dt_yr}yr: mag off by ${dMag}`);
    }
  }

  console.log(
    `  [3.2] worst direction error ${maxArcsec.toExponential(2)} arcsec, ` +
      `worst mag error ${maxMag.toExponential(2)} mag over ${n} samples`,
  );
});
