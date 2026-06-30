// Guards the frame DEFINITION itself: the baked galactic->ICRS matrix must equal the
// astropy fixture and be a proper rotation (orthonormal, det +1). Cheap insurance against
// a stale or hand-edited generated constant drifting away from the astropy oracle.

import { test } from "node:test";
import assert from "node:assert/strict";
import { GALACTIC_TO_ICRS } from "../src/galactic_icrs_matrix.js";
import { loadFixture } from "./helpers.js";

test("baked galactic->ICRS matrix equals the astropy fixture", () => {
  const fx = loadFixture<{ galactic_to_icrs: number[][] }>("galactic_icrs_matrix.json");
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      assert.ok(
        Math.abs(GALACTIC_TO_ICRS[i]![j]! - fx.galactic_to_icrs[i]![j]!) < 1e-15,
        `matrix[${i}][${j}] drifted from astropy`,
      );
    }
  }
});

test("baked matrix is a proper rotation (orthonormal, det +1)", () => {
  const M = GALACTIC_TO_ICRS;
  // Columns orthonormal: M^T M == I.
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += M[k]![a]! * M[k]![b]!;
      assert.ok(Math.abs(s - (a === b ? 1 : 0)) < 1e-12, `not orthonormal at ${a},${b}`);
    }
  }
  const det =
    M[0]![0]! * (M[1]![1]! * M[2]![2]! - M[1]![2]! * M[2]![1]!) -
    M[0]![1]! * (M[1]![0]! * M[2]![2]! - M[1]![2]! * M[2]![0]!) +
    M[0]![2]! * (M[1]![0]! * M[2]![1]! - M[1]![1]! * M[2]![0]!);
  assert.ok(Math.abs(det - 1) < 1e-12, `det ${det} != 1`);
});
