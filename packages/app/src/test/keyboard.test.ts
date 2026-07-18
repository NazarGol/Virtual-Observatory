import { describe, it, expect } from "vitest";
import { shortcutFor } from "../keyboard";

describe("shortcutFor", () => {
  it("leaves number keys unbound (reserved for Phase 6R instrument modes)", () => {
    expect(shortcutFor("1")).toBeNull();
    expect(shortcutFor("5")).toBeNull();
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
