// Build packages/app/public/data/ end-to-end (Phase 8 fix). The app fetches its data at
// runtime from that directory; it is gitignored (correctly -- it's generated), so nothing
// commits it, and NOTHING generated it as a first-class, discoverable tool until now (the
// app package had a private, ad-hoc packages/app/scripts/prepare-data.mjs that emit_sky.ts
// and emit_worlds.ts -- the tools/ a fresh contributor actually finds -- don't touch: emit_sky
// targets renderer/data, emit_worlds targets worlds/generated. Neither reaches the app.).
// This is the ONE tool that reaches it, named and placed like every other tools/emit_*.ts.
//
//   node --import tsx tools/emit_app_data.ts          # from repo root
//   npm run emit-app-data                             # equivalent, via package.json
//
// Wired as predev/prebuild in packages/app/package.json, so `npm run dev -w @vobs/app` and
// `npm run build -w @vobs/app` always have data -- including on a fresh clone, where
// catalog/local_volume_300pc.json (the real ~10.5k-star bake) is gitignored and absent; this
// tool falls back to the committed catalog/test_stars.json (8 stars) so the app still runs,
// and prints a loud warning so "why are there only 8 stars" has an immediate answer.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));

function main(): void {
  const outDir = here("../packages/app/public/data");
  mkdirSync(outDir, { recursive: true });

  // --- world.json: the default/calibration world (Sol) ---
  const solPath = here("../worlds/sol.world.json");
  if (!existsSync(solPath)) {
    console.error(`emit_app_data: missing ${solPath} -- this file is committed and should always be present.`);
    process.exit(1);
  }
  writeFileSync(`${outDir}/world.json`, readFileSync(solPath));

  // --- catalog.json: the real bake if present, else the committed 8-star test set ---
  const bigCatalog = here("../catalog/local_volume_300pc.json");
  const smallCatalog = here("../catalog/test_stars.json");
  const catalogSrc = existsSync(bigCatalog) ? bigCatalog : smallCatalog;
  if (catalogSrc === smallCatalog) {
    console.warn(
      "emit_app_data: catalog/local_volume_300pc.json not found (gitignored, not baked on this " +
      "machine) -- falling back to the committed 8-star catalog/test_stars.json. The app will " +
      "run, but the sky will look nearly empty. To bake the real ~10.5k-star catalog: " +
      "`python bake/bake_catalog.py` (see README).",
    );
  }
  writeFileSync(`${outDir}/catalog.json`, readFileSync(catalogSrc));

  // --- worlds/: the generated world-gallery pool (Phase 4-FIX), including its manifest ---
  const genDir = here("../worlds/generated");
  const outWorlds = `${outDir}/worlds`;
  if (existsSync(outWorlds)) rmSync(outWorlds, { recursive: true }); // no stale leftovers
  let worldCount = 0;
  if (!existsSync(genDir) || !existsSync(`${genDir}/manifest.json`)) {
    console.warn(
      `emit_app_data: ${genDir} or its manifest.json is missing -- the World Gallery will show ` +
      "no worlds until you run `npm run emit-worlds` (needs the real catalog baked first; see README).",
    );
  } else {
    mkdirSync(outWorlds, { recursive: true });
    for (const f of readdirSync(genDir)) { writeFileSync(`${outWorlds}/${f}`, readFileSync(`${genDir}/${f}`)); worldCount++; }
  }

  const catalogLabel = catalogSrc.split("/").slice(-1)[0];
  console.log(`emit_app_data: wrote ${outDir}/ -- catalog (${catalogLabel}), world.json (Sol), ${worldCount} world-gallery file(s).`);
}

main();
