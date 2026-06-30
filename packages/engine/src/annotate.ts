// Annotation engine (spec Phase 3). Constellations / figures, labels, and named groups.
// The load-bearing rule (spec section 1.5): every annotation anchors to OBJECT IDs +
// simulation time, NEVER to screen coordinates. A figure drawn at t0 therefore reconnects
// the same star IDs at t1, redrawn at their propagated positions. The instrument renders
// what these resolve to; the engine owns the model + persistence and is validated in CI.

import type { Vec3 } from "./vec.js";
import type { ObjectResolver } from "./measure.js";

export interface FigureDef {
  id: string;
  kind: "figure";
  name: string;
  /** Object ids that are the figure's nodes (stars/bodies). */
  nodeIds: string[];
  /** Edges as index pairs into nodeIds (the lines of the figure). */
  edges: [number, number][];
  /** Marks a figure as a named constellation rather than a loose sketch. */
  constellation?: boolean;
  color?: string;
  createdAtYears: number;
}

export interface LabelDef {
  id: string;
  kind: "label";
  text: string;
  /** Object id this label is pinned to. */
  anchorId: string;
  createdAtYears: number;
}

export interface GroupDef {
  id: string;
  kind: "group";
  name: string;
  objectIds: string[];
  createdAtYears: number;
}

export type Annotation = FigureDef | LabelDef | GroupDef;

export interface ResolvedFigure {
  id: string;
  name: string;
  constellation: boolean;
  color?: string;
  ok: boolean;
  missing: string[];
  /** Node directions in nodeIds order (null if that object is currently unresolved). */
  nodes: { id: string; dir: Vec3 | null }[];
  /** Same topology as the definition. */
  edges: [number, number][];
}

export function resolveFigure(def: FigureDef, resolve: ObjectResolver, tYears: number): ResolvedFigure {
  const missing: string[] = [];
  const nodes = def.nodeIds.map((id) => {
    const dir = resolve(id, tYears);
    if (!dir) missing.push(id);
    return { id, dir };
  });
  return {
    id: def.id,
    name: def.name,
    constellation: def.constellation ?? false,
    color: def.color,
    ok: missing.length === 0,
    missing,
    nodes,
    edges: def.edges,
  };
}

export interface ResolvedLabel {
  id: string;
  text: string;
  anchorId: string;
  dir: Vec3 | null;
  ok: boolean;
}

export function resolveLabel(def: LabelDef, resolve: ObjectResolver, tYears: number): ResolvedLabel {
  const dir = resolve(def.anchorId, tYears);
  return { id: def.id, text: def.text, anchorId: def.anchorId, dir, ok: dir !== null };
}

// --- persistence (anchored to IDs + time; no screen coordinates) ---

const SCHEMA = 1;

export function serializeAnnotations(annotations: Annotation[]): string {
  return JSON.stringify({ schema: SCHEMA, annotations });
}

export function parseAnnotations(json: string): Annotation[] {
  const obj = JSON.parse(json) as { annotations?: unknown };
  if (!Array.isArray(obj.annotations)) throw new Error("annotations: expected an array");
  return obj.annotations.map((a, i) => {
    const d = a as Partial<Annotation> & { kind?: string };
    if (typeof d.id !== "string") throw new Error(`annotation ${i}: missing id`);
    switch (d.kind) {
      case "figure": {
        const f = d as Partial<FigureDef>;
        if (!Array.isArray(f.nodeIds) || !Array.isArray(f.edges)) throw new Error(`figure ${d.id}: nodeIds/edges required`);
        return {
          id: f.id!, kind: "figure", name: f.name ?? "figure",
          nodeIds: f.nodeIds as string[], edges: f.edges as [number, number][],
          constellation: f.constellation ?? false, color: f.color,
          createdAtYears: typeof f.createdAtYears === "number" ? f.createdAtYears : 0,
        } satisfies FigureDef;
      }
      case "label": {
        const l = d as Partial<LabelDef>;
        if (typeof l.anchorId !== "string") throw new Error(`label ${d.id}: anchorId required`);
        return {
          id: l.id!, kind: "label", text: l.text ?? "", anchorId: l.anchorId,
          createdAtYears: typeof l.createdAtYears === "number" ? l.createdAtYears : 0,
        } satisfies LabelDef;
      }
      case "group": {
        const g = d as Partial<GroupDef>;
        if (!Array.isArray(g.objectIds)) throw new Error(`group ${d.id}: objectIds required`);
        return {
          id: g.id!, kind: "group", name: g.name ?? "group", objectIds: g.objectIds as string[],
          createdAtYears: typeof g.createdAtYears === "number" ? g.createdAtYears : 0,
        } satisfies GroupDef;
      }
      default:
        throw new Error(`annotation ${d.id}: unknown kind "${d.kind}"`);
    }
  });
}
