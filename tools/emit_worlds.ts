// Offline world emission (Phase 4-FIX). Reads the baked catalog, selects real F/G/K
// main-sequence HOSTS, generates a validated planet+moon system of each world type around
// DISTINCT real hosts, and writes one world.json per slot + a manifest.json into
// worlds/generated/. The instrument LOADS these; it never generates (spec section 1).
//
//   npm run emit-worlds                 # uses the 10k catalog if present, else test_stars
//   node --import tsx tools/emit_worlds.ts --pool 5

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  selectHosts, generateWorldForHost, validateWorld, mulberry32, WORLD_TYPES,
} from "../packages/engine/src/worldgen.js";
import type { Catalog } from "../packages/engine/src/catalog.js";

const here = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));

function seedFor(type: string, n: number): number {
  let h = 2166136261;
  const s = `${type}#${n}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function main(): void {
  const argv = process.argv.slice(2);
  const pool = Number(argv[argv.indexOf("--pool") + 1]) || 4;

  const catPath = existsSync(here("../catalog/local_volume_300pc.json"))
    ? here("../catalog/local_volume_300pc.json")
    : here("../catalog/test_stars.json");
  const catalog = JSON.parse(readFileSync(catPath, "utf8")) as Catalog;

  const hosts = selectHosts(catalog.stars, 120);
  if (hosts.length < 2) throw new Error(`only ${hosts.length} F/G/K hosts in the catalog; need >= 2`);
  console.log(`catalog ${catPath.split("/").slice(-1)[0]}: ${hosts.length} F/G/K main-sequence hosts`);

  const outDir = here("../worlds/generated");
  if (existsSync(outDir)) for (const f of readdirSync(outDir)) rmSync(`${outDir}/${f}`);
  mkdirSync(outDir, { recursive: true });

  const manifest: { type: string; file: string; host_id: string; name: string; seed: number }[] = [];
  let cursor = 0;
  for (const type of WORLD_TYPES) {
    let made = 0, tries = 0;
    while (made < pool && tries < hosts.length * 3) {
      const host = hosts[cursor % hosts.length]!;
      cursor++; tries++;
      const seed = seedFor(type, made);
      try {
        const world = generateWorldForHost(type, host, mulberry32(seed), made + 1, seed);
        // embed the (passing) validation checklist so the app can show it without running
        // any physics itself -- the app loads, it does not generate or validate.
        const validation = validateWorld(world);
        const file = `${type}-${made + 1}.json`;
        writeFileSync(`${outDir}/${file}`, JSON.stringify({ ...world, validation }, null, 2));
        manifest.push({ type, file, host_id: host.catalog_id, name: world.name, seed });
        made++;
      } catch {
        // this type can't be realized around this host (e.g. habitable around a late-K
        // whose HZ locks) -- try the next host. Physics rejecting is expected, not an error.
      }
    }
    if (made < pool) console.warn(`  (${type}: only ${made}/${pool} — ran short of suitable hosts)`);
  }

  writeFileSync(`${outDir}/manifest.json`, JSON.stringify({
    generated_by: "tools/emit_worlds.ts",
    catalog: catPath.split("/").slice(-1)[0],
    host_count: hosts.length,
    count: manifest.length,
    worlds: manifest,
  }, null, 2));

  const byType = WORLD_TYPES.map((t) => `${t} ${manifest.filter((m) => m.type === t).length}`).join(", ");
  console.log(`wrote ${manifest.length} worlds (${byType}) -> worlds/generated/`);
}

main();
