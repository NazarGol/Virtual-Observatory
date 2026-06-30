// Phase 3 -- notebook. Notes anchored to objects + time and timeline markers survive a
// serialize -> reload round-trip with their anchors intact, so the instrument can jump back
// to a note's moment and objects.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyNotebook,
  serializeNotebook,
  parseNotebook,
  type Notebook,
} from "../src/notebook.js";

test("notes and timeline markers persist with their object + time anchors", () => {
  const nb: Notebook = {
    notes: [
      {
        id: "n1",
        title: "Barnard transit",
        text: "fast mover crosses the meridian here",
        objectIds: ["HIP87937"],
        atYears: 12345,
        createdAtYears: 0,
      },
      { id: "n2", text: "free note, no anchors", objectIds: [], atYears: null, createdAtYears: 10 },
    ],
    markers: [
      { id: "m1", label: "J2000", atYears: 0 },
      { id: "m2", label: "+50 kyr", atYears: 50000 },
    ],
  };

  const back = parseNotebook(serializeNotebook(nb));
  assert.equal(back.notes.length, 2);
  assert.deepEqual(back.notes[0]!.objectIds, ["HIP87937"]);
  assert.equal(back.notes[0]!.atYears, 12345);
  assert.equal(back.notes[0]!.title, "Barnard transit");
  assert.equal(back.notes[1]!.atYears, null);
  assert.deepEqual(back.markers.map((m) => m.atYears), [0, 50000]);
});

test("an empty notebook round-trips", () => {
  const back = parseNotebook(serializeNotebook(emptyNotebook()));
  assert.deepEqual(back, { notes: [], markers: [] });
});
