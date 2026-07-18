// Keyboard control map (Phase 6R). Pure key -> action mapping so the shortcut scheme is
// unit-testable and the App just dispatches on the returned action id. Plain keys only
// (no modifiers) — the instrument is single-handed on the keyboard while panning with the
// mouse. The App ignores these while a text field is focused.

/** The five instrument modes (Phase 6R modal chrome). */
export type Mode = "observe" | "target" | "measure" | "events" | "log";
export const MODES: Mode[] = ["observe", "target", "measure", "events", "log"];

export type KbAction =
  | { kind: "mode"; mode: Mode }  // 1..5 — the UI reconfigures per active instrument
  | { kind: "projection" }        // cycle flat -> fisheye -> dome
  | { kind: "zoom"; dir: 1 | -1 }
  | { kind: "playLocal" } | { kind: "playEpoch" }
  | { kind: "stepLocal"; dir: 1 | -1 }
  | { kind: "milkyway" } | { kind: "trails" }
  | { kind: "gallery" } | { kind: "escape" }
  | { kind: "record" } | { kind: "propose" }
  | { kind: "controls" } | { kind: "help" };

/** Map a KeyboardEvent.key to an action, or null if unbound. */
export function shortcutFor(key: string): KbAction | null {
  const n = Number(key);
  if (n >= 1 && n <= MODES.length) return { kind: "mode", mode: MODES[n - 1]! };
  switch (key) {
    case "f": case "F": return { kind: "projection" };
    case "+": case "=": return { kind: "zoom", dir: 1 };
    case "-": case "_": return { kind: "zoom", dir: -1 };
    case " ": return { kind: "playLocal" };
    case "e": case "E": return { kind: "playEpoch" };
    case ",": case "<": case "ArrowLeft": return { kind: "stepLocal", dir: -1 };
    case ".": case ">": case "ArrowRight": return { kind: "stepLocal", dir: 1 };
    case "m": case "M": return { kind: "milkyway" };
    case "t": case "T": return { kind: "trails" };
    case "g": case "G": return { kind: "gallery" };
    case "Escape": return { kind: "escape" };
    case "r": case "R": return { kind: "record" };
    case "c": case "C": return { kind: "propose" };
    case "h": case "H": return { kind: "controls" };
    case "?": return { kind: "help" };
    default: return null;
  }
}

/** Human-readable shortcut list for the help overlay. */
export const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "1–5", label: "mode: observe · target · measure · events · log" },
  { keys: "F", label: "cycle projection (flat / fisheye / dome)" },
  { keys: "+ −", label: "zoom in / out" },
  { keys: "Space", label: "play / pause the local clock" },
  { keys: "E", label: "play / pause the epoch clock" },
  { keys: "← →", label: "nudge the local clock back / forward" },
  { keys: "M / T", label: "toggle Milky Way / orbit tracks" },
  { keys: "C", label: "propose candidates from the selected star" },
  { keys: "R", label: "record the focused object to the survey log" },
  { keys: "G / Esc", label: "world gallery / back to observe" },
  { keys: "H", label: "instrument config" },
  { keys: "?", label: "toggle this help" },
];
