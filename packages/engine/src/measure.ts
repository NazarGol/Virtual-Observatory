// Measurement engine (spec Phase 2). Pure geometry over inertial directions, plus a
// persistence model. The load-bearing rule (spec section 1.5): a measurement anchors to
// OBJECT IDs + simulation time, never to screen coordinates -- so it reconnects the same
// objects at their propagated positions after a reload or a time-scrub. The instrument UI
// supplies a resolver (id, t) -> inertial direction; this module does the geometry and the
// engine validates it (the renderer never computes a measurement itself).

import { angularSepUnit, cross, dot, normalize, type Vec3 } from "./vec.js";

const R2D = 180 / Math.PI;

/** Great-circle (angular) separation between two inertial unit directions, in degrees. */
export function greatCircleDeg(a: Vec3, b: Vec3): number {
  return angularSepUnit(a, b) * R2D;
}

/**
 * Position angle of b about a, measured at a from celestial North (+z) toward East, in
 * [0, 360). Returns NaN when a is at a celestial pole (North/East undefined there).
 */
export function positionAngleDeg(a: Vec3, b: Vec3): number {
  const east = cross([0, 0, 1], a); // toward increasing RA
  const elen = Math.hypot(east[0], east[1], east[2]);
  if (elen < 1e-9) return Number.NaN;
  const e = normalize(east);
  const n = cross(a, e); // toward celestial north in the tangent plane at a
  let pa = Math.atan2(dot(b, e), dot(b, n)) * R2D;
  if (pa < 0) pa += 360;
  return pa;
}

/**
 * How non-collinear a set of directions is on the sky: the max angular deviation (deg) of
 * any interior point from the great circle through the first and last points. 0 for < 3
 * points (any two points lie on a great circle). Small value == well aligned.
 */
export function alignmentDeviationDeg(dirs: Vec3[]): number {
  if (dirs.length < 3) return 0;
  const n = normalize(cross(dirs[0]!, dirs[dirs.length - 1]!));
  let maxDev = 0;
  for (let i = 1; i < dirs.length - 1; i++) {
    const dev = Math.asin(Math.min(1, Math.abs(dot(dirs[i]!, n)))) * R2D;
    maxDev = Math.max(maxDev, dev);
  }
  return maxDev;
}

export type MeasurementKind =
  | "angular_distance"
  | "separation_position_angle"
  | "alignment";

/** A persisted measurement DEFINITION: which objects, what kind, when it was made. */
export interface MeasurementDef {
  id: string;
  kind: MeasurementKind;
  /** Object IDs (catalog star ids or body names) the measurement connects. */
  objectIds: string[];
  /** Sim time (Julian years since J2000) at which the observer created it. */
  createdAtYears: number;
  label?: string;
}

/** A measurement resolved against engine state at a given time. */
export interface MeasurementResult {
  id: string;
  kind: MeasurementKind;
  objectIds: string[];
  ok: boolean;
  /** Object IDs that could not be resolved (e.g. dropped below the catalog, or unknown). */
  missing: string[];
  /** Resolved inertial directions, in objectIds order, for rendering the overlay. */
  endpoints: Vec3[];
  angularDistanceDeg?: number;
  positionAngleDeg?: number;
  alignmentDeviationDeg?: number;
}

/** Maps an object id to its inertial (ICRS) unit direction at time t, or null if unknown. */
export type ObjectResolver = (id: string, tYears: number) => Vec3 | null;

/**
 * Resolve a measurement against the current sim state. The VALUE is recomputed at tYears
 * (so it updates as you scrub time and the objects drift); the DEFINITION is what persists.
 */
export function resolveMeasurement(
  def: MeasurementDef,
  resolve: ObjectResolver,
  tYears: number,
): MeasurementResult {
  const endpoints: Vec3[] = [];
  const missing: string[] = [];
  for (const id of def.objectIds) {
    const d = resolve(id, tYears);
    if (d) endpoints.push(d);
    else missing.push(id);
  }
  const base: MeasurementResult = {
    id: def.id,
    kind: def.kind,
    objectIds: def.objectIds,
    ok: missing.length === 0,
    missing,
    endpoints,
  };
  if (!base.ok) return base;

  switch (def.kind) {
    case "angular_distance":
      return { ...base, angularDistanceDeg: greatCircleDeg(endpoints[0]!, endpoints[1]!) };
    case "separation_position_angle":
      return {
        ...base,
        angularDistanceDeg: greatCircleDeg(endpoints[0]!, endpoints[1]!),
        positionAngleDeg: positionAngleDeg(endpoints[0]!, endpoints[1]!),
      };
    case "alignment":
      return { ...base, alignmentDeviationDeg: alignmentDeviationDeg(endpoints) };
  }
}

// --- persistence (anchored to IDs + time; no screen coordinates) ---

const SCHEMA = 1;

export function serializeMeasurements(defs: MeasurementDef[]): string {
  return JSON.stringify({ schema: SCHEMA, measurements: defs });
}

/** Parse + validate persisted measurements. Throws on a malformed payload. */
export function parseMeasurements(json: string): MeasurementDef[] {
  const obj = JSON.parse(json) as { schema?: number; measurements?: unknown };
  if (!Array.isArray(obj.measurements)) throw new Error("measurements: expected an array");
  return obj.measurements.map((m, i) => {
    const d = m as Partial<MeasurementDef>;
    if (typeof d.id !== "string") throw new Error(`measurement ${i}: missing id`);
    if (!Array.isArray(d.objectIds) || d.objectIds.length < 2) {
      throw new Error(`measurement ${d.id}: needs >= 2 objectIds`);
    }
    if (typeof d.createdAtYears !== "number") throw new Error(`measurement ${d.id}: missing createdAtYears`);
    return {
      id: d.id,
      kind: (d.kind ?? "angular_distance") as MeasurementKind,
      objectIds: d.objectIds as string[],
      createdAtYears: d.createdAtYears,
      label: d.label,
    };
  });
}
