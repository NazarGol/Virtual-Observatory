// Public surface of the pure-TS simulation engine.
// Stage 1 (relocated inertial sky) only, for Phase 0. No rendering imports anywhere in
// this package (enforced in CI by the rendering-free guard, spec section 6).

export * from "./vec.js";
export * from "./frames.js";
export * from "./catalog.js";
export * from "./relocate.js";
export * from "./horizontal.js";
export * from "./world.js";
export * from "./bodies.js";
export * from "./session.js";
export { GALACTIC_TO_ICRS } from "./galactic_icrs_matrix.js";
