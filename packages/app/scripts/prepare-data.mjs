// Copy the world + a catalog into public/ so the app can fetch them at runtime. Prefers the
// real 10k bake if present, else the committed curated catalog (so the app always runs).
import { copyFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
mkdirSync(here("../public/data"), { recursive: true });

copyFileSync(here("../../../worlds/sol.world.json"), here("../public/data/world.json"));

const big = here("../../../catalog/local_volume_300pc.json");
const small = here("../../../catalog/test_stars.json");
const src = existsSync(big) ? big : small;
copyFileSync(src, here("../public/data/catalog.json"));

// generated world pool (Phase 4-FIX): the app loads these, it does not generate.
const genDir = here("../../../worlds/generated");
let worldCount = 0;
if (existsSync(genDir)) {
  const outWorlds = here("../public/data/worlds");
  mkdirSync(outWorlds, { recursive: true });
  for (const f of readdirSync(genDir)) { copyFileSync(`${genDir}/${f}`, `${outWorlds}/${f}`); worldCount++; }
}

console.log(`prepared public/data: catalog (${src.split("/").slice(-1)[0]}) + sol.world + ${worldCount} generated world files`);
