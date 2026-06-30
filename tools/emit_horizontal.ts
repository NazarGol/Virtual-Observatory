// Emit data for the throwaway horizon (alt/az dome) renderer. We export the INERTIAL sky
// (Stage-1 output, fixed for a given epoch) plus the planet orientation + observer, so the
// browser can do the cheap Stage-2 rotation itself as the time slider moves -- exactly the
// sim/render decoupling (spec 1.4): scrubbing the diurnal clock never re-runs Stage 1.
//
//   npm run emit-horizon
//   node --import tsx tools/emit_horizontal.ts --catalog catalog/local_volume_300pc.json --epoch 0

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SkySession } from "../packages/engine/src/session.js";
import { parseWorld } from "../packages/engine/src/world.js";
import type { Catalog } from "../packages/engine/src/catalog.js";

const here = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));

function main(): void {
  const argv = process.argv.slice(2);
  let catalogRel = "../catalog/test_stars.json";
  let epoch = 0;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--catalog") {
      const p = argv[++i];
      catalogRel = p.startsWith("/") ? p : "../" + p;
    } else if (argv[i] === "--epoch") epoch = Number(argv[++i]);
  }

  const catalog = JSON.parse(readFileSync(here(catalogRel), "utf8")) as Catalog;
  const world = parseWorld(JSON.parse(readFileSync(here("../worlds/sol.world.json"), "utf8")));
  const session = new SkySession(catalog, world);
  session.recomputeInertial(epoch);

  const inertial = session.inertial.map((s) => ({
    id: s.id,
    name: s.name,
    dir: s.direction_icrs,
    mag: s.mag,
    bp_rp: s.bp_rp,
  }));
  const bodies = session.bodies(epoch).map((b) => ({
    name: b.name,
    kind: b.kind,
    dir: b.direction_icrs,
  }));

  const out = {
    generated_by: "tools/emit_horizontal.ts",
    world: world.name,
    epoch_years_since_j2000: epoch,
    orientation: {
      // Same field names as the engine's PlanetOrientation, so the renderer consumes the
      // engine's own type shape (avoids a name-divergence bug between the two).
      northPoleRaDeg: world.planet.north_pole_inertial.ra_deg,
      northPoleDecDeg: world.planet.north_pole_inertial.dec_deg,
      rotationPeriodSeconds: world.planet.rotation_period_s,
    },
    observer: { latDeg: world.observer.lat_deg, lonDeg: world.observer.lon_deg },
    star_count: inertial.length,
    inertial,
    bodies,
  };

  mkdirSync(here("../renderer/data"), { recursive: true });
  writeFileSync(here("../renderer/data/horizontal_sky.json"), JSON.stringify(out, null, 2));
  console.log(
    `wrote ${inertial.length} inertial stars + ${bodies.length} bodies ` +
      `(lat ${world.observer.lat_deg}, epoch ${epoch} yr) -> renderer/data/horizontal_sky.json`,
  );
}

main();
