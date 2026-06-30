// Run the pure engine and dump the relocated inertial sky to JSON for the throwaway
// renderer. This is the ONLY bridge between engine and renderer: the renderer consumes
// engine *output*, never the engine itself, and the engine never imports the renderer.
//
// Usage:
//   npm run emit-sky                      # observer at origin (Sol world), t = J2000
//   node --import tsx tools/emit_sky.ts --alpha-cen --t 0
//   node --import tsx tools/emit_sky.ts --observer 1.5,-0.3,0.8 --t 10000

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { relocateSky, type Observer } from "../packages/engine/src/relocate.js";
import type { Catalog } from "../packages/engine/src/catalog.js";
import type { Vec3 } from "../packages/engine/src/vec.js";

const here = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));

function parseArgs(argv: string[]): { observer: Observer; t: number; label: string } {
  let observer: Observer = { origin_pc: [0, 0, 0] };
  let t = 0;
  let label = "Sol vantage (origin), J2000";

  const catalog = loadCatalog();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--t") t = Number(argv[++i]);
    else if (a === "--alpha-cen") {
      const ac = catalog.stars.find((s) => s.name === "Alpha Centauri A");
      if (!ac) throw new Error("Alpha Centauri A not in catalog");
      observer = { origin_pc: ac.pos_pc };
      label = "Alpha Centauri vantage";
    } else if (a === "--observer") {
      const parts = argv[++i].split(",").map(Number);
      if (parts.length !== 3 || parts.some(Number.isNaN))
        throw new Error("--observer expects x,y,z in pc");
      observer = { origin_pc: parts as unknown as Vec3 };
      label = `observer ${argv[i]}`;
    }
  }
  return { observer, t, label };
}

function loadCatalog(): Catalog {
  return JSON.parse(readFileSync(here("../catalog/test_stars.json"), "utf8")) as Catalog;
}

function main(): void {
  const catalog = loadCatalog();
  const { observer, t, label } = parseArgs(process.argv.slice(2));

  const sky = relocateSky(catalog, observer, t).map((s) => ({
    id: s.id,
    name: s.name,
    ra_deg: s.ra_deg,
    dec_deg: s.dec_deg,
    mag: s.mag,
    bp_rp: s.bp_rp,
    distance_pc: s.distance_pc,
  }));

  const out = {
    generated_by: "tools/emit_sky.ts",
    observer_pos_pc: observer.origin_pc,
    t_years_since_j2000: t,
    label,
    star_count: sky.length,
    stars: sky,
  };

  const dir = here("../renderer/data");
  mkdirSync(dir, { recursive: true });
  const path = here("../renderer/data/inertial_sky.json");
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`wrote ${sky.length} stars (${label}, t=${t}) -> renderer/data/inertial_sky.json`);
}

main();
