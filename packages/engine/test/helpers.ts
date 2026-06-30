import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Catalog } from "../src/catalog.js";

const here = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));

export function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(here(`./fixtures/${name}`), "utf8")) as T;
}

export function loadCatalog(): Catalog {
  return JSON.parse(
    readFileSync(here("../../../catalog/test_stars.json"), "utf8"),
  ) as Catalog;
}

/** Great-circle separation between two (ra, dec) pairs in degrees, returned in arcsec. */
export function angSepArcsec(
  ra1: number,
  dec1: number,
  ra2: number,
  dec2: number,
): number {
  const d2r = Math.PI / 180;
  const toVec = (ra: number, dec: number): [number, number, number] => {
    const cd = Math.cos(dec * d2r);
    return [cd * Math.cos(ra * d2r), cd * Math.sin(ra * d2r), Math.sin(dec * d2r)];
  };
  const a = toVec(ra1, dec1);
  const b = toVec(ra2, dec2);
  const cx = a[1] * b[2] - a[2] * b[1];
  const cy = a[2] * b[0] - a[0] * b[2];
  const cz = a[0] * b[1] - a[1] * b[0];
  const cross = Math.sqrt(cx * cx + cy * cy + cz * cz);
  const dotp = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return (Math.atan2(cross, dotp) / d2r) * 3600;
}
