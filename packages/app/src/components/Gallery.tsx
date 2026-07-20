// Gallery (Phase 4-FIX): LOADS pre-emitted worlds, it does not build them. Each world.json is
// anchored to a REAL catalog host (see tools/emit_worlds), carries per-parameter provenance,
// and an embedded validation checklist. Pin/reroll operate over the loaded pool. No physics
// and no world construction runs here -- the app only reads.
import { useEffect, useState } from "react";

interface Check { name: string; ok: boolean; detail: string }
interface Prov { value?: number | string; note: string; real?: boolean }
interface LoadedWorld {
  world_type: string; name: string; seed?: number; age_gyr: number;
  host_star: { catalog_id: string; galactic_xyz_pc: [number, number, number]; luminosity_lsun: number; mass_msun: number; teff_k: number; radius_rsun: number };
  planet: { radius_km: number; mass_mearth: number; rotation_period_s: number; axial_tilt_deg: number; orbit: { a_au: number; e: number } };
  moons: { name: string; radius_km: number }[];
  provenance?: Record<string, Prov>;
  validation?: { checks: Check[] };
}
interface Manifest { catalog: string; host_count: number; worlds: { type: string; file: string; host_id: string; name: string }[] }

const TYPE_COLOR: Record<string, string> = {
  habitable: "#5fd08a", tidally_locked: "#ff9a5c", cold_distant: "#6fb6ff",
  high_obliquity: "#c98cff", multi_moon: "#ffd86b", eccentric: "#ff6f91",
};
const DAY = 86400, YEAR = 3.15576e7;

export function Gallery(props: { onBack: () => void; onObserve: (world: LoadedWorld) => void }) {
  const [byType, setByType] = useState<Map<string, LoadedWorld[]> | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [slots, setSlots] = useState<{ type: string; index: number; pinned: boolean }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const man = (await (await fetch("data/worlds/manifest.json")).json()) as Manifest;
      const files = await Promise.all(man.worlds.map(async (w) => ({
        w, world: (await (await fetch(`data/worlds/${w.file}`)).json()) as LoadedWorld,
      })));
      const m = new Map<string, LoadedWorld[]>();
      for (const { world } of files) {
        const arr = m.get(world.world_type) ?? [];
        arr.push(world);
        m.set(world.world_type, arr);
      }
      const types = [...m.keys()];
      setByType(m); setOrder(types);
      setSlots(types.map((type) => ({ type, index: 0, pinned: false })));
    })().catch((e) => setErr(String(e)));
  }, []);

  const reroll = (i: number) => setSlots((s) => s.map((slot, j) =>
    j !== i || slot.pinned ? slot : { ...slot, index: (slot.index + 1) % (byType!.get(slot.type)!.length || 1) }));
  const rerollAll = () => setSlots((s) => s.map((slot) =>
    slot.pinned ? slot : { ...slot, index: (slot.index + 1) % (byType!.get(slot.type)!.length || 1) }));
  const togglePin = (i: number) => setSlots((s) => s.map((slot, j) => (j === i ? { ...slot, pinned: !slot.pinned } : slot)));

  if (err) return <div className="gallery"><header className="gbar"><button onClick={props.onBack}>← Instrument</button></header>
    <div style={{ padding: 24, color: "#ff9", fontFamily: "monospace", lineHeight: 1.6 }}>
      <p>No world pool (<code>data/worlds/manifest.json</code> didn't load).</p>
      <p>Run <code>npm run emit-app-data</code> from the repo root, then reload. (That copies the
        already-committed <code>worlds/generated/</code> pool into place; only run
        <code> npm run emit-worlds</code> first if you actually want to regenerate the worlds
        themselves, which needs the real catalog baked.)</p>
      <p style={{ opacity: 0.7 }}>{err}</p>
    </div></div>;
  if (!byType) return <div className="gallery"><header className="gbar"><button onClick={props.onBack}>← Instrument</button><b>World gallery</b></header><div style={{ padding: 24 }}>loading worlds…</div></div>;

  return (
    <div className="gallery">
      <header className="gbar">
        <button onClick={props.onBack}>← Instrument</button>
        <b>World gallery</b>
        <span className="muted">{order.length} types · every world anchored to a real catalog host · loaded, not generated</span>
        <span style={{ flex: 1 }} />
        <button onClick={rerollAll}>reroll all (keep pinned)</button>
      </header>
      <div className="grid">
        {slots.map((slot, i) => {
          const pool = byType.get(slot.type)!;
          return <WorldCard key={slot.type} world={pool[slot.index % pool.length]!} poolSize={pool.length}
            pinned={slot.pinned} onPin={() => togglePin(i)} onReroll={() => reroll(i)} onObserve={props.onObserve} />;
        })}
      </div>
    </div>
  );
}

function WorldCard(props: { world: LoadedWorld; poolSize: number; pinned: boolean; onPin: () => void; onReroll: () => void; onObserve: (world: LoadedWorld) => void }) {
  const w = props.world;
  const [showProv, setShowProv] = useState(false);
  const checks = w.validation?.checks ?? [];
  const Porb_d = Math.sqrt(w.planet.orbit.a_au ** 3 / w.host_star.mass_msun) * YEAR / DAY;
  const locked = w.world_type === "tidally_locked";
  return (
    <div className={"card" + (props.pinned ? " pinned" : "")}>
      <div className="chead">
        <span className="badge" style={{ background: TYPE_COLOR[w.world_type] ?? "#889" }}>{w.world_type.replace(/_/g, " ")}</span>
        <span className="cbtns">
          <button onClick={() => props.onObserve(w)} title="observe the sky from this world's vantage">🔭</button>
          <button className={props.pinned ? "active" : ""} onClick={props.onPin} title="pin">📌</button>
          <button onClick={props.onReroll} disabled={props.pinned} title={`reroll (1 of ${props.poolSize})`}>🎲</button>
        </span>
      </div>
      <SystemDiagram w={w} />
      <div className="cstats">
        <Row k="host ✦" v={`${w.host_star.catalog_id}`} title="real catalog star (the observer's vantage)" />
        <Row k="star" v={`${w.host_star.mass_msun.toFixed(2)} M☉ · ${Math.round(w.host_star.teff_k)} K · ${w.host_star.luminosity_lsun.toFixed(2)} L☉`} />
        <Row k="orbit" v={`a ${w.planet.orbit.a_au.toFixed(3)} AU · e ${w.planet.orbit.e.toFixed(2)} · P ${fmtP(Porb_d)}`} />
        <Row k="spin/tilt" v={`${locked ? "locked (P=orbit)" : fmtP(w.planet.rotation_period_s / DAY)} · tilt ${w.planet.axial_tilt_deg.toFixed(0)}°`} />
        <Row k="moons / age" v={`${w.moons.length} · ${w.age_gyr.toFixed(1)} Gyr`} />
      </div>
      <div className="checks">
        {checks.map((c, j) => <div key={j} className="check" title={c.detail}><span className="tick">✓</span> {c.name}</div>)}
      </div>
      {w.provenance && (
        <div className="prov">
          <button className="link" onClick={() => setShowProv((v) => !v)}>{showProv ? "▾" : "▸"} provenance (real vs generated)</button>
          {showProv && (
            <div className="provlist">
              {Object.entries(w.provenance).map(([k, p]) => (
                <div key={k} className="provrow"><span className={p.real ? "preal" : "pgen"}>{p.real ? "real" : "gen"}</span> <b>{k}</b>: {p.note}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function Row(props: { k: string; v: string; title?: string }) {
  return <div className="row" title={props.title}><span className="k">{props.k}</span><span className="v" style={{ textAlign: "right" }}>{props.v}</span></div>;
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

function SystemDiagram({ w }: { w: LoadedWorld }) {
  const W = 260, H = 150, cy = H / 2, starX = W * 0.42;
  const a = w.planet.orbit.a_au, e = w.planet.orbit.e;
  const scale = (W * 0.5) / Math.max(a * (1 + e), 1e-6);
  const b = a * Math.sqrt(1 - e * e);
  const cxEll = starX + a * e * scale;
  const periX = starX - a * (1 - e) * scale;
  const hz = { inner: Math.sqrt(w.host_star.luminosity_lsun / 1.1), outer: Math.sqrt(w.host_star.luminosity_lsun / 0.53) };
  const tilt = w.planet.axial_tilt_deg * (Math.PI / 180);
  return (
    <svg className="diagram" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {hz.outer * scale < W && <>
        <circle cx={starX} cy={cy} r={hz.outer * scale} fill="none" stroke="#1f4a32" strokeDasharray="2 3" />
        <circle cx={starX} cy={cy} r={hz.inner * scale} fill="none" stroke="#1f4a32" strokeDasharray="2 3" />
      </>}
      <ellipse cx={cxEll} cy={cy} rx={a * scale} ry={b * scale} fill="none" stroke="#3a5a86" strokeWidth={1} />
      <circle cx={starX} cy={cy} r={Math.max(3, Math.min(9, w.host_star.radius_rsun * 5))} fill={teffColor(w.host_star.teff_k)} />
      <g transform={`translate(${periX}, ${cy})`}>
        <line x1={-9 * Math.sin(tilt)} y1={9 * Math.cos(tilt)} x2={9 * Math.sin(tilt)} y2={-9 * Math.cos(tilt)} stroke="#8aa" strokeWidth={1} />
        <circle r={4} fill="#cde3ff" />
        {w.moons.map((_, i) => <circle key={i} cx={7 + i * 4.5} cy={0} r={1.6} fill="#9fb0c8" />)}
      </g>
    </svg>
  );
}
