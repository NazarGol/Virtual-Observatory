// Phase 3 -- annotations. Section-6 acceptance: an annotation persists across reload AND a
// time-scrub -- a figure drawn at t0 reconnects the SAME star IDs at t1, redrawn at their
// propagated positions (never frozen to screen coordinates, spec 1.5).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  serializeAnnotations,
  parseAnnotations,
  resolveFigure,
  resolveLabel,
  type FigureDef,
  type LabelDef,
  type GroupDef,
} from "../src/annotate.js";
import { relocateStar } from "../src/relocate.js";
import { galacticToIcrs } from "../src/frames.js";
import { angularSepUnit, type Vec3 } from "../src/vec.js";
import type { ObjectResolver } from "../src/measure.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const observer = { origin_pc: [0, 0, 0] as Vec3 };
const resolve: ObjectResolver = (id, t) => {
  const s = catalog.stars.find((x) => x.id === id);
  if (!s) return null;
  const r = relocateStar(s, observer, t);
  return r ? galacticToIcrs(r.direction_gal) : null;
};

test("section 6: a figure reconnects the same star IDs at propagated positions across reload + time-scrub", () => {
  const def: FigureDef = {
    id: "f1",
    kind: "figure",
    name: "Test asterism",
    nodeIds: ["HIP87937", "HIP32349", "HIP91262"], // Barnard, Sirius, Vega
    edges: [[0, 1], [1, 2]],
    constellation: true,
    createdAtYears: 0,
  };

  // survive a serialize -> reload round-trip
  const reloaded = parseAnnotations(serializeAnnotations([def]))[0] as FigureDef;
  assert.equal(reloaded.kind, "figure");
  assert.deepEqual(reloaded.nodeIds, def.nodeIds);
  assert.deepEqual(reloaded.edges, def.edges);
  assert.equal(reloaded.constellation, true);

  // resolve at two different (scrubbed) times
  const r0 = resolveFigure(reloaded, resolve, 0);
  const r1 = resolveFigure(reloaded, resolve, 50000);

  // same IDs, same topology, both fully resolved
  assert.deepEqual(r0.nodes.map((n) => n.id), r1.nodes.map((n) => n.id));
  assert.deepEqual(r0.edges, r1.edges);
  assert.ok(r0.ok && r1.ok, "all nodes should resolve");

  // every node sits at its PROPAGATED position (== the engine's direction at that time)
  for (const n of r1.nodes) {
    const direct = resolve(n.id, 50000)!;
    assert.ok(angularSepUnit(n.dir!, direct) < 1e-12, `${n.id} not at propagated position`);
  }

  // and the high-pm node actually moved, proving it reconnected at a NEW position
  const movedDeg = (angularSepUnit(r0.nodes[0]!.dir!, r1.nodes[0]!.dir!) * 180) / Math.PI;
  assert.ok(movedDeg > 1, `Barnard node should move over 5e4 yr (got ${movedDeg} deg)`);
  console.log(`  [annotate] figure node 'Barnard' reconnected ${movedDeg.toFixed(1)} deg away after a 5e4 yr scrub`);
});

test("a label stays pinned to its object across a time-scrub", () => {
  const def: LabelDef = { id: "l1", kind: "label", text: "the runaway", anchorId: "HIP87937", createdAtYears: 0 };
  const reloaded = parseAnnotations(serializeAnnotations([def]))[0] as LabelDef;
  const at0 = resolveLabel(reloaded, resolve, 0);
  const at1 = resolveLabel(reloaded, resolve, 50000);
  assert.equal(at0.text, "the runaway");
  assert.equal(at0.anchorId, "HIP87937");
  assert.ok(at0.ok && at1.ok);
  assert.ok(angularSepUnit(at1.dir!, resolve("HIP87937", 50000)!) < 1e-12, "label not pinned to its object");
});

test("a group survives a round-trip; an unknown node marks the figure not-ok without throwing", () => {
  const group: GroupDef = { id: "g1", kind: "group", name: "neighbors", objectIds: ["HIP87937", "HIP71683"], createdAtYears: 0 };
  const back = parseAnnotations(serializeAnnotations([group]))[0] as GroupDef;
  assert.deepEqual(back.objectIds, group.objectIds);
  assert.equal(back.name, "neighbors");

  const broken: FigureDef = { id: "f2", kind: "figure", name: "x", nodeIds: ["HIP32349", "NOPE"], edges: [[0, 1]], createdAtYears: 0 };
  const r = resolveFigure(broken, resolve, 0);
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ["NOPE"]);
  assert.equal(r.nodes[1]!.dir, null);
});
