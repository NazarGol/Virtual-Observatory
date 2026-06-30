// Copy the world + a catalog into public/ so the app can fetch them at runtime. Prefers the
// real 10k bake if present, else the committed curated catalog (so the app always runs).
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
mkdirSync(here("../public/data"), { recursive: true });

copyFileSync(here("../../../worlds/sol.world.json"), here("../public/data/world.json"));

const big = here("../../../catalog/local_volume_300pc.json");
const small = here("../../../catalog/test_stars.json");
const src = existsSync(big) ? big : small;
copyFileSync(src, here("../public/data/catalog.json"));

console.log(`prepared public/data/world.json + catalog.json (from ${src.split("/").slice(-1)[0]})`);
