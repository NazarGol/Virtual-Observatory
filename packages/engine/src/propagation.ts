// Propagation-model metadata: each model's HONEST CAP -- the sim-time magnitude beyond
// which its output is extrapolation, not validated physics. The instrument uses this to
// draw a hard, visible "speculative" boundary so reach is never silently presented as data
// (spec ethos: a plausible-looking sky is not the same as a correct one).

export type PropagationId = "rectilinear" | "galactic";

export interface PropagationModelInfo {
  id: PropagationId;
  label: string;
  /** |t - J2000| (years) beyond which this model is extrapolation, not validated. */
  honestCapYears: number;
  note: string;
}

export const PROPAGATION_MODELS: Record<PropagationId, PropagationModelInfo> = {
  rectilinear: {
    id: "rectilinear",
    label: "Rectilinear",
    // Validated against astropy to <0.1" out to here (spec section 3.2). Beyond it the
    // galactic potential curves real stellar orbits away from straight lines.
    honestCapYears: 1e5,
    note: "constant-velocity inertial motion; validated to 1e5 yr. Past it, galactic gravity bends real orbits.",
  },
  galactic: {
    id: "galactic",
    label: "Galactic orbit",
    // Orbits integrated in a Milky Way potential stay faithful to ~Myr before phase mixing
    // and unmodelled substructure dominate.
    honestCapYears: 1e6,
    note: "orbits integrated in a Milky Way potential; faithful to ~1e6 yr.",
  },
};
