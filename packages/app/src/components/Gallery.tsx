// Gallery: a stratified grid of generated worlds, one card per slot. Each card shows the
// world, a system schematic, and -- the point of the whole exercise -- the per-type physics
// CHECKLIST from validateWorld (every item green, because only valid worlds ship). Slots can
// be pinned (kept) or rerolled (resampled within their type until valid).
import { useMemo, useState } from "react";
import {
  generateWorld, validateWorld, WORLD_TYPES, mulberry32,
  type GeneratedWorld, type WorldType,
} from "@vobs/engine";

const TYPE_COLOR: Record<WorldType, string> = {
  habitable: "#5fd08a", tidally_locked: "#ff9a5c", cold_distant: "#6fb6ff",
  high_obliquity: "#c98cff", multi_moon: "#ffd86b", eccentric: "#ff6f91",
};
const DAY = 86400, YEAR = 3.15576e7;

interface Slot { world: GeneratedWorld; pinned: boolean; seed: number }

function makeSlot(type: WorldType, seed: number, idx: number): Slot {
  return { world: generateWorld(type, mulberry32(seed), idx), pinned: false, seed };
}

export function Gallery(props: { onBack: () => void }) {
  const [slots, setSlots] = useState<Slot[]>(() =>
    WORLD_TYPES.concat(WORLD_TYPES.slice(0, 2)).map((t, i) => makeSlot(t, 1000 + i, i + 1)));
  const [seedCounter, setSeedCounter] = useState(5000);

  const reroll = (i: number) => {
    setSlots((s) => s.map((slot, j) =>
      j !== i || slot.pinned ? slot : makeSlot(slot.world.world_type, seedCounter + i, i + 1)));
    setSeedCounter((c) => c + 101);
  };
  const rerollAll = () => {
    let c = seedCounter;
    setSlots((s) => s.map((slot, i) => (slot.pinned ? slot : makeSlot(slot.world.world_type, (c += 101), i + 1))));
    setSeedCounter(c + 1);
  };
  const togglePin = (i: number) => setSlots((s) => s.map((slot, j) => (j === i ? { ...slot, pinned: !slot.pinned } : slot)));

  return (
    <div className="gallery">
      <header className="gbar">
        <button onClick={props.onBack}>← Instrument</button>
        <b>World gallery</b>
        <span className="muted">stratified across {WORLD_TYPES.length} types · every world passes its type's physics</span>
        <span style={{ flex: 1 }} />
        <button onClick={rerollAll}>reroll all (keep pinned)</button>
      </header>
      <div className="grid">
        {slots.map((slot, i) => (
          <WorldCard key={i} world={slot.world} pinned={slot.pinned}
            onPin={() => togglePin(i)} onReroll={() => reroll(i)} />
        ))}
      </div>
    </div>
  );
}

function WorldCard(props: { world: GeneratedWorld; pinned: boolean; onPin: () => void; onReroll: () => void }) {
  const w = props.world;
  const checks = useMemo(() => validateWorld(w).checks, [w]);
  const Porb_d = Math.sqrt(w.planet.orbit.a_au ** 3 / w.host_star.mass_msun) * YEAR / DAY;
  const locked = w.world_type === "tidally_locked";
  return (
    <div className={"card" + (props.pinned ? " pinned" : "")}>
      <div className="chead">
        <span className="badge" style={{ background: TYPE_COLOR[w.world_type] }}>{w.world_type.replace(/_/g, " ")}</span>
        <span className="cbtns">
          <button className={props.pinned ? "active" : ""} onClick={props.onPin} title="pin">📌</button>
          <button onClick={props.onReroll} disabled={props.pinned} title="reroll">🎲</button>
        </span>
      </div>
      <SystemDiagram w={w} />
      <div className="cstats">
        <Row k="host" v={`${w.host_star.mass_msun.toFixed(2)} M☉ · ${Math.round(w.host_star.teff_k)} K · ${w.host_star.luminosity_lsun.toFixed(2)} L☉`} />
        <Row k="orbit" v={`a ${w.planet.orbit.a_au.toFixed(3)} AU · e ${w.planet.orbit.e.toFixed(2)} · P ${fmtP(Porb_d)}`} />
        <Row k="spin/tilt" v={`${locked ? "locked (P=orbit)" : fmtP(w.planet.rotation_period_s / DAY)} · tilt ${w.planet.axial_tilt_deg.toFixed(0)}°`} />
        <Row k="moons / age" v={`${w.moons.length} · ${w.age_gyr.toFixed(1)} Gyr`} />
      </div>
      <div className="checks">
        {checks.map((c, j) => (
          <div key={j} className="check" title={c.detail}><span className="tick">✓</span> {c.name}</div>
        ))}
      </div>
    </div>
  );
}
function Row(props: { k: string; v: string }) {
  return <div className="row"><span className="k">{props.k}</span><span className="v" style={{ textAlign: "right" }}>{props.v}</span></div>;
}
function fmtP(days: number) {
  if (days < 1) return `${(days * 24).toFixed(1)} h`;
  if (days < 365) return `${days.toFixed(1)} d`;
  return `${(days / 365.25).toFixed(2)} yr`;
}

function teffColor(teff: number) {
  if (teff > 7000) return "#cfe0ff";
  if (teff > 5500) return "#fff6e6";
  if (teff > 4000) return "#ffe2a8";
  return "#ff9d6b";
}

/** Top-down system schematic: orbit ellipse with the star at a focus, planet at periastron,
 *  moons ringing it, an obliquity tick, and a faint habitable-zone band. */
function SystemDiagram({ w }: { w: GeneratedWorld }) {
  const W = 260, H = 150, cy = H / 2, starX = W * 0.42;
  const a = w.planet.orbit.a_au, e = w.planet.orbit.e;
  const apo = a * (1 + e);
  const scale = (W * 0.5) / Math.max(apo, 1e-6);
  const b = a * Math.sqrt(1 - e * e);
  const cxEll = starX + a * e * scale;
  const periX = starX - a * (1 - e) * scale;
  const hz = { inner: Math.sqrt(w.host_star.luminosity_lsun / 1.1), outer: Math.sqrt(w.host_star.luminosity_lsun / 0.53) };
  const tilt = w.planet.axial_tilt_deg * (Math.PI / 180);

  return (
    <svg className="diagram" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {/* habitable zone band (drawn only if it fits) */}
      {hz.outer * scale < W && (
        <>
          <circle cx={starX} cy={cy} r={hz.outer * scale} fill="none" stroke="#1f4a32" strokeDasharray="2 3" />
          <circle cx={starX} cy={cy} r={hz.inner * scale} fill="none" stroke="#1f4a32" strokeDasharray="2 3" />
        </>
      )}
      {/* orbit */}
      <ellipse cx={cxEll} cy={cy} rx={a * scale} ry={b * scale} fill="none" stroke="#3a5a86" strokeWidth={1} />
      {/* star at focus */}
      <circle cx={starX} cy={cy} r={Math.max(3, Math.min(9, w.host_star.radius_rsun * 5))} fill={teffColor(w.host_star.teff_k)} />
      {/* planet at periastron, with obliquity tick + moons */}
      <g transform={`translate(${periX}, ${cy})`}>
        <line x1={-9 * Math.sin(tilt)} y1={9 * Math.cos(tilt)} x2={9 * Math.sin(tilt)} y2={-9 * Math.cos(tilt)} stroke="#8aa" strokeWidth={1} />
        <circle r={4} fill="#cde3ff" />
        {w.moons.map((m, i) => <circle key={i} cx={7 + i * 4.5} cy={0} r={1.6} fill="#9fb0c8" />)}
      </g>
    </svg>
  );
}
