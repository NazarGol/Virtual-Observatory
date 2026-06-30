// Emit the relocated sky for the throwaway inertial-sphere renderer. We export each star's
// inertial (ICRS) position vector and velocity at J2000, so the renderer can propagate it
// over years itself (rectilinear -- exactly the engine's Stage-1 model) and watch proper
// motion crawl. Magnitude is recomputed in-browser from the changing distance.
//
//   npm run emit-sky                                          # Sol origin (our own sky)
//   node --import tsx tools/emit_sky.ts --alpha-cen --catalog catalog/local_volume_300pc.json
//   node --import tsx tools/emit_sky.ts --observer 1.5,-0.3,0.8

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { galacticToIcrs } from "../packages/engine/src/frames.js";
import { KM_S_TO_PC_PER_YR, type Observer } from "../packages/engine/src/relocate.js";
import { norm, scale, sub, type Vec3 } from "../packages/engine/src/vec.js";
import type { Catalog } from "../packages/engine/src/catalog.js";

const here = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));

function loadCatalog(relPath: string): Catalog {
  return JSON.parse(readFileSync(here(relPath), "utf8")) as Catalog;
}

function parseArgs(argv: string[]): { catalog: Catalog; observer: Observer; label: string } {
  let catalogPath = "../catalog/test_stars.json";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--catalog") {
      const p = argv[++i];
      catalogPath = p.startsWith("/") ? p : "../" + p;
    }
  }
  const catalog = loadCatalog(catalogPath);

  let observer: Observer = { origin_pc: [0, 0, 0] };
  let label = "Sol vantage (origin) — our own sky";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--catalog") i++;
    else if (a === "--alpha-cen") {
      const ac = catalog.stars.find((s) => s.id === "HIP71683" || s.name === "Alpha Centauri A");
      if (!ac) throw new Error("Alpha Centauri A (HIP71683) not in catalog");
      observer = { origin_pc: ac.pos_pc };
      label = "Alpha Centauri vantage — the relocated sky";
    } else if (a === "--observer") {
      const parts = argv[++i].split(",").map(Number);
      if (parts.length !== 3 || parts.some(Number.isNaN)) throw new Error("--observer expects x,y,z pc");
      observer = { origin_pc: parts as unknown as Vec3 };
      label = `observer ${argv[i]} pc`;
    }
  }
  return { catalog, observer, label };
}

function main(): void {
  const { catalog, observer, label } = parseArgs(process.argv.slice(2));
  const obs = observer.origin_pc;

  const stars: unknown[] = [];
  for (const s of catalog.stars) {
    const d0gal = sub(s.pos_pc, obs); // galactic position relative to the observer at J2000
    if (norm(d0gal) === 0) continue; // the vantage star itself
    const vgal = scale(s.vel_kms, KM_S_TO_PC_PER_YR); // pc/yr
    const d0 = galacticToIcrs(d0gal);
    const v = galacticToIcrs(vgal);
    stars.push({
      id: s.id,
      name: s.name,
      d0, // ICRS position relative to observer, pc, at J2000
      v, //  ICRS velocity, pc/yr
      mag_ref: s.mag_ref,
      d_ref_pc: s.d_ref_pc,
      bp_rp: s.bp_rp,
    });
  }

  const out = {
    generated_by: "tools/emit_sky.ts",
    label,
    observer_pos_pc: obs,
    star_count: stars.length,
    stars,
  };

  mkdirSync(here("../renderer/data"), { recursive: true });
  writeFileSync(here("../renderer/data/inertial_sky.json"), JSON.stringify(out));
  console.log(`wrote ${stars.length} stars (${label}) -> renderer/data/inertial_sky.json`);
}

main();
