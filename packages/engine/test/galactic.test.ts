// Galactic-orbit propagation. Validated three ways, all against astropy/scipy oracles, so
// a frame sign-flip or a unit slip can't hide (the section-3 discipline, extended to the
// Myr upgrade): (1) the helio->galactocentric transform matches astropy; (2) the TS
// velocity-Verlet orbit matches a scipy DOP853 orbit in the same potential; (3) energy is
// conserved; and (4) at t=0 the galactic path reproduces the catalog direction exactly,
// proving the galactocentric->ICRS frame round-trips.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  helioToGalcen, integrateOrbit, galacticEnergy, relocateStarGalactic,
  SUN_GALCEN_STATE, KM_S_TO_KPC_MYR, type GalcenState,
} from "../src/galactic.js";
import { relocateStar } from "../src/relocate.js";
import { galacticVecToRaDec } from "../src/frames.js";
import { type Vec3 } from "../src/vec.js";
import { loadCatalog, loadFixture, angSepArcsec } from "./helpers.js";

interface OracleStar {
  id: string;
  galcen_pos_kpc: [number, number, number];
  galcen_vel_kms: [number, number, number];
  orbit_times_myr: number[];
  orbit_pos_kpc: [number, number, number][];
  energy0: number;
}
const oracle = loadFixture<{ stars: OracleStar[] }>("galactic_orbits.json");
const catalog = loadCatalog();
const byId = new Map(catalog.stars.map((s) => [s.id, s]));

test("helio->galactocentric transform matches astropy", () => {
  let maxPos = 0, maxVel = 0;
  for (const o of oracle.stars) {
    const star = byId.get(o.id)!;
    const g = helioToGalcen(star.pos_pc, star.vel_kms);
    for (let k = 0; k < 3; k++) {
      maxPos = Math.max(maxPos, Math.abs(g.pos[k] - o.galcen_pos_kpc[k]));
      maxVel = Math.max(maxVel, Math.abs(g.vel[k] / KM_S_TO_KPC_MYR - o.galcen_vel_kms[k]));
    }
  }
  assert.ok(maxPos < 1e-6, `galactocentric position off by ${maxPos} kpc`);
  assert.ok(maxVel < 1e-4, `galactocentric velocity off by ${maxVel} km/s`);
  console.log(`  [galactic] helio->galcen vs astropy: pos ${maxPos.toExponential(1)} kpc, vel ${maxVel.toExponential(1)} km/s`);
});

test("velocity-Verlet orbit matches the scipy DOP853 oracle over 1 Myr", () => {
  let maxErr = 0;
  for (const o of oracle.stars) {
    const state: GalcenState = { pos: o.galcen_pos_kpc, vel: o.galcen_vel_kms.map((v) => v * KM_S_TO_KPC_MYR) as unknown as Vec3 };
    for (let i = 0; i < o.orbit_times_myr.length; i++) {
      const r = integrateOrbit(state, o.orbit_times_myr[i]!);
      const exp = o.orbit_pos_kpc[i]!;
      const err = Math.hypot(r.pos[0] - exp[0], r.pos[1] - exp[1], r.pos[2] - exp[2]);
      maxErr = Math.max(maxErr, err);
    }
  }
  // ~milliparsec agreement between two independent integrators over 1 Myr.
  assert.ok(maxErr < 1e-5, `orbit position off from scipy by ${maxErr} kpc`);
  console.log(`  [galactic] TS Verlet vs scipy DOP853 over 1 Myr: max ${maxErr.toExponential(1)} kpc (${(maxErr * 1000).toExponential(1)} pc)`);
});

test("orbital energy is conserved over 1 Myr", () => {
  let maxDrift = 0;
  for (const o of oracle.stars) {
    const v0: Vec3 = o.galcen_vel_kms.map((v) => v * KM_S_TO_KPC_MYR) as unknown as Vec3;
    const e0 = galacticEnergy(o.galcen_pos_kpc, v0);
    const end = integrateOrbit({ pos: o.galcen_pos_kpc, vel: v0 }, 1.0);
    const e1 = galacticEnergy(end.pos, end.vel);
    maxDrift = Math.max(maxDrift, Math.abs((e1 - e0) / e0));
  }
  assert.ok(maxDrift < 1e-6, `energy drift ${maxDrift}`);
  console.log(`  [galactic] energy conservation over 1 Myr: ${maxDrift.toExponential(1)} relative`);
});

test("at t=0 the galactic path reproduces the catalog direction (galactocentric<->ICRS round-trips)", () => {
  let maxSep = 0, maxMag = 0;
  for (const star of catalog.stars) {
    if (star.id === "SOL") continue; // origin star has no direction from the Sun
    const g = relocateStarGalactic(star, SUN_GALCEN_STATE, 0);
    const rect = relocateStar(star, { origin_pc: [0, 0, 0] }, 0)!;
    const rd = galacticVecToRaDec(rect.direction_gal); // rectilinear -> ICRS
    maxSep = Math.max(maxSep, angSepArcsec(g!.ra_deg, g!.dec_deg, rd.ra_deg, rd.dec_deg));
    maxMag = Math.max(maxMag, Math.abs(g!.mag - rect.mag));
  }
  assert.ok(maxSep < 0.5, `galactic t=0 direction off from catalog by ${maxSep} arcsec`);
  assert.ok(maxMag < 1e-6, `galactic t=0 magnitude off by ${maxMag}`);
  console.log(`  [galactic] t=0 vs rectilinear/catalog: ${maxSep.toExponential(1)} arcsec, ${maxMag.toExponential(1)} mag`);
});
