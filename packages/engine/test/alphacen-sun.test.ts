// Spec section 3.4 -- Alpha Centauri cross-check (the relocated-vantage check).
// Place the Sun as a star (M_V = 4.83) and put the observer at Alpha Cen's galactic XYZ.
// The Sun must appear in Cassiopeia (antipodal to Alpha Cen's Earth direction -- pure
// geometry, independently published) at V ~= 0.5. Sol stays the calibration anchor; this
// is a real correctness check at a vantage that is not Earth.

import { test } from "node:test";
import assert from "node:assert/strict";
import { relocateStar } from "../src/relocate.js";
import { loadCatalog, loadFixture, angSepArcsec } from "./helpers.js";
import type { Vec3 } from "../src/vec.js";

interface AlphaCenFixture {
  observer_pos_pc: [number, number, number];
  sun_id: string;
  expected_ra_deg: number;
  expected_dec_deg: number;
  expected_mag: number;
}

test("3.4 Alpha Cen vantage: the Sun lands in Cassiopeia at V ~= 0.5", () => {
  const catalog = loadCatalog();
  const fx = loadFixture<AlphaCenFixture>("alphacen_sun.json");
  const sun = catalog.stars.find((s) => s.id === fx.sun_id);
  assert.ok(sun, "catalog missing the synthetic Sun");

  const observer = { origin_pc: fx.observer_pos_pc as Vec3 };
  const r = relocateStar(sun!, observer, 0);
  assert.ok(r, "Sun returned null from the Alpha Cen vantage");

  // (a) Engine geometry matches the astropy-derived antipodal direction.
  const sep = angSepArcsec(
    r!.ra_deg,
    r!.dec_deg,
    fx.expected_ra_deg,
    fx.expected_dec_deg,
  );
  assert.ok(sep < 0.1, `direction off by ${sep} arcsec`);

  // (b) Human-meaningful: that direction sits in Cassiopeia (RA ~ 39.9, Dec ~ +60.8).
  const sepFromCas = angSepArcsec(r!.ra_deg, r!.dec_deg, 39.9, 60.8) / 3600;
  assert.ok(
    sepFromCas < 2,
    `expected near Cassiopeia (39.9, +60.8), got (${r!.ra_deg.toFixed(2)}, ${r!.dec_deg.toFixed(2)}), ${sepFromCas.toFixed(2)} deg away`,
  );

  // (c) Magnitude ~ V 0.5 (5*log10(1.34/10) + 4.83 ~= 0.47).
  assert.ok(
    r!.mag > 0.4 && r!.mag < 0.55,
    `expected V in [0.40, 0.55], got ${r!.mag.toFixed(3)}`,
  );
  assert.ok(Math.abs(r!.mag - fx.expected_mag) < 1e-3, "mag disagrees with fixture");

  console.log(
    `  [3.4] Sun from Alpha Cen: RA ${r!.ra_deg.toFixed(2)}, Dec ${r!.dec_deg.toFixed(2)} ` +
      `(Cassiopeia), V ${r!.mag.toFixed(2)}; geometry error ${sep.toExponential(2)} arcsec`,
  );
});
