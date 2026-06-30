// Spec section 3.1 -- Sol identity test (non-negotiable).
// Observer at the galactic origin, t = J2000. The engine must reproduce the catalog
// RA/Dec and magnitude for every star to near machine precision. This is the USD->USD
// 1:1 test: if it isn't exactly identity, the engine is broken.

import { test } from "node:test";
import assert from "node:assert/strict";
import { relocateStar } from "../src/relocate.js";
import { loadCatalog, loadFixture, angSepArcsec } from "./helpers.js";

interface IdentityRow {
  id: string;
  ra_deg: number;
  dec_deg: number;
  mag: number;
}

test("3.1 Sol identity: RA/Dec/mag reproduce the catalog at the origin", () => {
  const catalog = loadCatalog();
  const fixture = loadFixture<IdentityRow[]>("sol_identity.json");
  const byId = new Map(catalog.stars.map((s) => [s.id, s]));

  let maxArcsec = 0;
  let maxMag = 0;

  for (const row of fixture) {
    const star = byId.get(row.id);
    assert.ok(star, `catalog missing ${row.id}`);

    const r = relocateStar(star!, { origin_pc: [0, 0, 0] }, 0);
    assert.ok(r, `${row.id} returned null at origin`);

    const sep = angSepArcsec(r!.ra_deg, r!.dec_deg, row.ra_deg, row.dec_deg);
    const dMag = Math.abs(r!.mag - row.mag);
    maxArcsec = Math.max(maxArcsec, sep);
    maxMag = Math.max(maxMag, dMag);

    assert.ok(sep < 1e-4, `${row.id} direction off by ${sep} arcsec`);
    assert.ok(dMag < 1e-6, `${row.id} mag off by ${dMag}`);
  }

  console.log(
    `  [3.1] worst direction error ${maxArcsec.toExponential(2)} arcsec, ` +
      `worst mag error ${maxMag.toExponential(2)} mag over ${fixture.length} stars`,
  );
});
