// Dossier exporter (Phase 8 Gate B). Given a world.json and one or more observer sites,
// computes the complete observational truth of that place -- the interface between the
// machine and the artist. No LLM calls, no interpretation, no invented facts: every line is
// computed from the engine. Deterministic: the same world + site + tool version always
// produces the same file.
//
//   node --import tsx tools/emit_dossier.ts --world worlds/generated/multi_moon-1.json \
//     --site 30.0444,31.2357:Cairo
//
//   node --import tsx tools/emit_dossier.ts --world worlds/sol.world.json \
//     --site 30.0444,31.2357:Cairo --site 0,0:Origin
//
// Writes dossiers/<world-basename>-<site-slug>.md (one file per --site).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseWorld } from "../packages/engine/src/world.js";
import type { Catalog } from "../packages/engine/src/catalog.js";
import { buildDossier, type SiteMeta } from "./dossier/sections.js";
import { renderMarkdown } from "./dossier/render.js";

const here = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));

function parseSite(spec: string): SiteMeta {
  const [coords, label] = spec.split(":");
  const [latS, lonS] = (coords ?? "").split(",");
  const latDeg = Number(latS), lonDeg = Number(lonS);
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg)) {
    throw new Error(`--site expects "lat,lon[:Label]", got "${spec}"`);
  }
  return { latDeg, lonDeg, label: label && label.length ? label : `${latDeg.toFixed(2)},${lonDeg.toFixed(2)}` };
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "site";
}

function main(): void {
  const argv = process.argv.slice(2);
  const worldArgIdx = argv.indexOf("--world");
  if (worldArgIdx === -1 || !argv[worldArgIdx + 1]) {
    console.error('usage: emit_dossier --world <path/to/world.json> --site "lat,lon[:Label]" [--site ...] [--out dossiers] [--catalog path]');
    process.exit(1);
  }
  const worldPath = argv[worldArgIdx + 1]!;
  const sites: SiteMeta[] = [];
  for (let i = 0; i < argv.length; i++) if (argv[i] === "--site") sites.push(parseSite(argv[i + 1]!));
  if (sites.length === 0) sites.push({ latDeg: 0, lonDeg: 0, label: "Equator/PM" });

  const outIdx = argv.indexOf("--out");
  const outDir = outIdx !== -1 ? argv[outIdx + 1]! : here("../dossiers");
  const catIdx = argv.indexOf("--catalog");
  const catalogPath = catIdx !== -1 ? argv[catIdx + 1]! : here("../catalog/local_volume_300pc.json");

  const raw = JSON.parse(readFileSync(worldPath, "utf8")) as Record<string, unknown>;
  const world = parseWorld(raw);
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as Catalog;
  const catalogRel = catalogPath.replace(here("../") + "/", "").replace(/^.*\/(catalog\/[^/]+)$/, "$1");

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const worldBase = worldPath.split("/").pop()!.replace(/\.json$/, "");

  for (const site of sites) {
    const dossier = buildDossier(world, raw, catalog.stars, catalogRel, site);
    const md = renderMarkdown(dossier);
    const file = `${outDir}/${worldBase}-${slugify(site.label)}.md`;
    writeFileSync(file, md);
    console.log(`wrote ${file} (${md.length.toLocaleString()} bytes)`);
  }
}

main();
