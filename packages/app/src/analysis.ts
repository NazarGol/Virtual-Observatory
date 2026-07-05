// Analysis compute (Phase 5R+ Gate B, B3). These functions PROPOSE candidate regularities
// from the real data -- co-moving groups (shared 3D space velocity), anomalies (objects the
// sensors single out), and near-collinear bright triples (alignments). They never assert a
// finished pattern: each returns a ranked list of CANDIDATES for the human to inspect, name,
// or discard. "Compute proposes, the human disposes." Pure + deterministic (unit-testable).
import type { InertialStar, CatalogStar, Vec3 } from "@vobs/engine";

export interface Candidate {
  key: string;
  kind: "co-moving" | "anomaly" | "alignment";
  label: string;
  detail: string;
  objectIds: string[];
}

const d2 = (a: Vec3, b: Vec3): number => {
  const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
  return x * x + y * y + z * z;
};
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v: Vec3): Vec3 => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
const sepDeg = (a: Vec3, b: Vec3): number => Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * (180 / Math.PI);

/**
 * Co-moving group candidates: catalog stars close together in 3D AND sharing a 3D space
 * velocity (real Gaia vel_kms), grouped by a grid-hashed union-find. This is the physical
 * moving-group signature (like the Hyades), vantage-independent. Restricted to currently
 * visible stars. Returns groups of >= minSize, largest first.
 */
export function comovingCandidates(
  catalog: CatalogStar[], visible: Set<string>, dTolPc = 18, vTolKms = 5, minSize = 3,
): Candidate[] {
  const S = catalog.filter((s) => visible.has(s.id));
  const cell = dTolPc;
  const ckey = (p: Vec3) => `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)},${Math.floor(p[2] / cell)}`;
  const grid = new Map<string, number[]>();
  S.forEach((s, i) => { const k = ckey(s.pos_pc); const a = grid.get(k); if (a) a.push(i); else grid.set(k, [i]); });

  const parent = S.map((_, i) => i);
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]!]!; x = parent[x]!; } return x; };
  const uni = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };

  const dTol2 = dTolPc * dTolPc, vTol2 = vTolKms * vTolKms;
  for (let i = 0; i < S.length; i++) {
    const p = S[i]!.pos_pc;
    const cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell), cz = Math.floor(p[2] / cell);
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++) {
      const nb = grid.get(`${cx + ox},${cy + oy},${cz + oz}`);
      if (!nb) continue;
      for (const j of nb) {
        if (j <= i) continue;
        if (d2(p, S[j]!.pos_pc) < dTol2 && d2(S[i]!.vel_kms, S[j]!.vel_kms) < vTol2) uni(i, j);
      }
    }
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < S.length; i++) { const r = find(i); const a = groups.get(r); if (a) a.push(i); else groups.set(r, [i]); }

  const out: Candidate[] = [];
  for (const idx of groups.values()) {
    if (idx.length < minSize) continue;
    const ids = idx.map((k) => S[k]!.id);
    const v = idx.reduce((acc, k) => { const w = S[k]!.vel_kms; return [acc[0] + w[0], acc[1] + w[1], acc[2] + w[2]] as Vec3; }, [0, 0, 0] as Vec3);
    const speed = Math.hypot(v[0], v[1], v[2]) / idx.length;
    out.push({ key: `cm-${ids[0]}`, kind: "co-moving", label: `co-moving group · ${idx.length} stars`,
      detail: `shared space velocity ~${speed.toFixed(0)} km/s, within ${dTolPc} pc`, objectIds: ids });
  }
  out.sort((a, b) => b.objectIds.length - a.objectIds.length);
  return out.slice(0, 6);
}

/** Anomaly candidates: the objects the sensors single out — fastest proper motion, nearest,
 *  and colour extremes. One candidate per standout, deduplicated. */
export function anomalyCandidates(stars: InertialStar[], pm: Map<string, number>): Candidate[] {
  if (stars.length === 0) return [];
  const out: Candidate[] = [], seen = new Set<string>();
  const push = (s: InertialStar, label: string, detail: string) => {
    if (seen.has(s.id)) return; seen.add(s.id);
    out.push({ key: `an-${s.id}`, kind: "anomaly", label, detail, objectIds: [s.id] });
  };
  const name = (s: InertialStar) => s.name || s.id;
  const byPm = [...stars].sort((a, b) => (pm.get(b.id) ?? 0) - (pm.get(a.id) ?? 0));
  for (const s of byPm.slice(0, 2)) if ((pm.get(s.id) ?? 0) > 0) push(s, `fast mover · ${name(s)}`, `${(pm.get(s.id) ?? 0).toFixed(0)} mas/yr at this vantage`);
  const byDist = [...stars].sort((a, b) => a.distance_pc - b.distance_pc);
  for (const s of byDist.slice(0, 2)) push(s, `nearest · ${name(s)}`, `${s.distance_pc.toFixed(2)} pc away`);
  const byColor = [...stars].sort((a, b) => a.bp_rp - b.bp_rp);
  const bluest = byColor[0], reddest = byColor[byColor.length - 1];
  if (bluest) push(bluest, `bluest · ${name(bluest)}`, `BP−RP ${bluest.bp_rp.toFixed(2)} (hot)`);
  if (reddest) push(reddest, `reddest · ${name(reddest)}`, `BP−RP ${reddest.bp_rp.toFixed(2)} (cool)`);
  return out;
}

/** Alignment candidates: near-collinear triples among the bright stars — three directions
 *  sharing one great circle, well separated but locally grouped. Ranked by straightness. */
export function alignmentCandidates(
  stars: InertialStar[], magMax = 2.8, maxDevDeg = 0.7, minSepDeg = 4, maxSpanDeg = 45,
): Candidate[] {
  const B = stars.filter((s) => s.mag <= magMax);
  const found: { dev: number; ids: string[]; names: string[]; span: number }[] = [];
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) for (let k = j + 1; k < B.length; k++) {
    const a = B[i]!.direction_icrs, b = B[j]!.direction_icrs, c = B[k]!.direction_icrs;
    const sab = sepDeg(a, b), sac = sepDeg(a, c), sbc = sepDeg(b, c);
    if (Math.min(sab, sac, sbc) < minSepDeg || Math.max(sab, sac, sbc) > maxSpanDeg) continue;
    // endpoints = the widest pair; the third is the midpoint to test against their great circle
    let e1 = a, e2 = b, mid = c;
    if (sac >= sab && sac >= sbc) { e1 = a; e2 = c; mid = b; }
    else if (sbc >= sab && sbc >= sac) { e1 = b; e2 = c; mid = a; }
    const n = norm(cross(e1, e2));
    const dev = Math.asin(Math.max(0, Math.min(1, Math.abs(dot(mid, n))))) * (180 / Math.PI);
    if (dev > maxDevDeg) continue;
    found.push({ dev, ids: [B[i]!.id, B[j]!.id, B[k]!.id], names: [B[i]!.name || B[i]!.id, B[j]!.name || B[j]!.id, B[k]!.name || B[k]!.id], span: Math.max(sab, sac, sbc) });
  }
  found.sort((x, y) => x.dev - y.dev);
  // greedily drop triples that reuse a star already claimed by a straighter one
  const used = new Set<string>(), out: Candidate[] = [];
  for (const f of found) {
    if (f.ids.some((id) => used.has(id))) continue;
    f.ids.forEach((id) => used.add(id));
    out.push({ key: `al-${f.ids.join("-")}`, kind: "alignment", label: `alignment · ${f.names.join(" – ")}`,
      detail: `≈collinear, deviation ${f.dev.toFixed(2)}° over ${f.span.toFixed(0)}°`, objectIds: f.ids });
    if (out.length >= 4) break;
  }
  return out;
}
