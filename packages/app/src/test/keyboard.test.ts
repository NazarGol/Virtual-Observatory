import { describe, it, expect } from "vitest";
import { shortcutFor } from "../keyboard";

describe("shortcutFor", () => {
  it("maps 1-5 to the five instrument modes in order", () => {
    expect(shortcutFor("1")).toEqual({ kind: "mode", mode: "observe" });
    expect(shortcutFor("2")).toEqual({ kind: "mode", mode: "target" });
    expect(shortcutFor("5")).toEqual({ kind: "mode", mode: "log" });
    expect(shortcutFor("6")).toBeNull();
  });
  it("arrow keys nudge the local clock", () => {
    expect(shortcutFor("ArrowLeft")).toEqual({ kind: "stepLocal", dir: -1 });
    expect(shortcutFor("ArrowRight")).toEqual({ kind: "stepLocal", dir: 1 });
  });
  it("maps view + time controls", () => {
    expect(shortcutFor("f")).toEqual({ kind: "projection" });
    expect(shortcutFor("+")).toEqual({ kind: "zoom", dir: 1 });
    expect(shortcutFor("-")).toEqual({ kind: "zoom", dir: -1 });
    expect(shortcutFor(" ")).toEqual({ kind: "playLocal" });
    expect(shortcutFor("e")).toEqual({ kind: "playEpoch" });
    expect(shortcutFor(".")).toEqual({ kind: "stepLocal", dir: 1 });
    expect(shortcutFor(",")).toEqual({ kind: "stepLocal", dir: -1 });
  });
  it("is case-insensitive for letters and returns null when unbound", () => {
    expect(shortcutFor("M")).toEqual({ kind: "milkyway" });
    expect(shortcutFor("Escape")).toEqual({ kind: "escape" });
    expect(shortcutFor("z")).toBeNull();
    expect(shortcutFor("F1")).toBeNull();
  });
});
