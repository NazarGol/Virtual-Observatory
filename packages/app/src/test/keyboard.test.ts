import { describe, it, expect } from "vitest";
import { shortcutFor } from "../keyboard";

describe("shortcutFor", () => {
  it("maps 1-5 to the five sensors in order", () => {
    expect(shortcutFor("1")).toEqual({ kind: "sensor", sensor: "visible" });
    expect(shortcutFor("3")).toEqual({ kind: "sensor", sensor: "proper_motion" });
    expect(shortcutFor("5")).toEqual({ kind: "sensor", sensor: "photometric" });
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
