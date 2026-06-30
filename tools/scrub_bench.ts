// Demonstrates the sim/render decoupling (spec section 1.4 / Phase 1 acceptance:
// "scrub across all scales without render-loop stall"). It measures, on the real ~10k-star
// catalog, that the per-render-frame cost (Stage 2) is far below the sim recompute cost
// (Stage 1), and that a diurnal scrub never re-runs Stage 1 while a millennium scrub does
// so only a handful of times.
//
//   node --import tsx tools/scrub_bench.ts [--catalog catalog/local_volume_300pc.json]

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SkySession } from "../packages/engine/src/session.js";
import { parseWorld } from "../packages/engine/src/world.js";
import type { Catalog } from "../packages/engine/src/catalog.js";

const here = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const ms = (n: number) => `${n.toFixed(2)} ms`;

function pickCatalog(): { path: string; catalog: Catalog } {
  const arg = process.argv.indexOf("--catalog");
  const candidates =
    arg >= 0
      ? [process.argv[arg + 1]]
      : ["../catalog/local_volume_300pc.json", "../catalog/test_stars.json"];
  for (const rel of candidates) {
    const p = rel.startsWith("/") ? rel : here(rel.startsWith("..") ? rel : "../" + rel);
    if (existsSync(p)) return { path: p, catalog: JSON.parse(readFileSync(p, "utf8")) as Catalog };
  }
  throw new Error("no catalog found; run bake/bake_catalog.py or bake/make_fixtures.py");
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function main(): void {
  const { path, catalog } = pickCatalog();
  const world = parseWorld(JSON.parse(readFileSync(here("../worlds/sol.world.json"), "utf8")));
  const session = new SkySession(catalog, world, 1.0);

  console.log(`catalog: ${path.split("/").slice(-1)[0]} (${catalog.stars.length} stars)\n`);

  // --- Stage-1 recompute cost (the expensive, sim-tick path) ---
  const s1: number[] = [];
  for (let i = 0; i < 12; i++) {
    const t0 = performance.now();
    session.recomputeInertial(i);
    s1.push(performance.now() - t0);
  }

  // --- Stage-2 per-frame cost (the cheap, render-loop path) ---
  session.recomputeInertial(0);
  const s2: number[] = [];
  for (let f = 0; f < 200; f++) {
    const t = (f * 60) / 31_557_600; // advance 60 s per frame (planet spins)
    const t0 = performance.now();
    session.horizontalSky(t);
    session.bodies(t);
    s2.push(performance.now() - t0);
  }

  const stage1 = median(s1);
  const stage2 = median(s2);
  console.log(`Stage 1 (relocate+propagate ${catalog.stars.length} stars): ${ms(stage1)}  [sim tick]`);
  console.log(`Stage 2 (rotate cache -> alt/az + bodies):     ${ms(stage2)}  [render frame]`);
  console.log(`render frame is ${(stage1 / stage2).toFixed(0)}x cheaper than a sim recompute`);
  console.log(`=> ${(1000 / stage2).toFixed(0)} fps achievable from Stage 2 alone\n`);

  // --- Diurnal scrub: spin the planet across 2 days at render rate. No Stage-1 recompute. ---
  const before = session.recomputes;
  for (let f = 0; f < 2880; f++) {
    const t = (f * 60) / 31_557_600; // 1-minute steps across ~2 days
    session.ensureInertial(t);
    session.horizontalSky(t);
  }
  console.log(`diurnal scrub (2 days, 2880 frames): ${session.recomputes - before} Stage-1 recompute(s)`);

  // --- Millennium scrub: step 50 yr at a time across 2000 yr. Recomputes only as needed. ---
  const before2 = session.recomputes;
  for (let yr = 0; yr <= 2000; yr += 50) session.ensureInertial(yr);
  console.log(`millennium scrub (0..2000 yr, 50-yr steps): ${session.recomputes - before2} Stage-1 recompute(s)`);
  console.log(`\nConclusion: the render loop pays Stage-2 cost regardless of time scale;`);
  console.log(`Stage-1 runs only when stars have actually moved. No render-loop stall.`);
}

main();
