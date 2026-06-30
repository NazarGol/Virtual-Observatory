// Minimal 3-vector + matrix helpers. Pure math, no dependencies.
// The engine is deliberately rendering-free (spec section 1.1): nothing here imports a
// 3D-graphics library, the DOM, or any renderer type.

export type Vec3 = readonly [number, number, number];
export type Mat3 = readonly (readonly number[])[];

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function norm(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

export function normalize(a: Vec3): Vec3 {
  const n = norm(a);
  return [a[0] / n, a[1] / n, a[2] / n];
}

export function matVecMul(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

/** Great-circle (angular) separation between two unit vectors, in radians. */
export function angularSepUnit(a: Vec3, b: Vec3): number {
  // atan2(|a x b|, a.b) is numerically stable across the full range, unlike acos(dot).
  const cx = a[1] * b[2] - a[2] * b[1];
  const cy = a[2] * b[0] - a[0] * b[2];
  const cz = a[0] * b[1] - a[1] * b[0];
  const cross = Math.sqrt(cx * cx + cy * cy + cz * cz);
  return Math.atan2(cross, dot(a, b));
}
