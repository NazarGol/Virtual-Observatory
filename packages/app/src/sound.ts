// Instrument sound (Gate C). Tiny WebAudio synth — no assets, no network. OFF by default;
// the AudioContext is only created on the first enable, which is a user gesture (the toggle
// click), satisfying the browser autoplay policy. Restraint: short, quiet, few distinct
// timbres — a forensic instrument's soft feedback, not a soundtrack.
let ctx: AudioContext | null = null;
let enabled = false;
let master = 0.5;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  if (on && !ctx) {
    try { ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); }
    catch { ctx = null; enabled = false; }
  }
  if (on && ctx && ctx.state === "suspended") void ctx.resume();
}
export function isSoundEnabled(): boolean { return enabled; }

function blip(freq: number, dur: number, type: OscillatorType, gain: number): void {
  if (!enabled || !ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.00001, t);
  g.gain.linearRampToValueAtTime(gain * master, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.00001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

/** soft high tick — toggles, tool/scale changes */
export const uiTick = (): void => blip(1180, 0.045, "triangle", 0.05);
/** brighter select — sensor / selection change */
export const uiSelect = (): void => blip(1560, 0.06, "sine", 0.06);
/** low clack — play/pause */
export const uiClack = (): void => blip(200, 0.05, "square", 0.04);
/** two-note chime — an event reached, a record made, candidates found */
export const chime = (): void => { blip(659.25, 0.16, "sine", 0.06); window.setTimeout(() => blip(987.77, 0.2, "sine", 0.05), 70); };
