import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  resolveMeasurement,
  serializeMeasurements,
  parseMeasurements,
  type MeasurementDef,
  type MeasurementKind,
  type MeasurementResult,
  type InertialStar,
  type Vec3,
  type ObjectResolver,
} from "@vobs/engine";
import {
  loadSky,
  buildSession,
  directionAt,
  horizontalOf,
  riseSetOf,
  SECONDS_PER_JULIAN_YEAR,
  type LoadedSky,
  type Vantage,
} from "./sky";
import { SkyView } from "./components/SkyView";
import { geodesicArc, type StarPoint } from "./three/StarField";

const STORAGE_KEY = "vobs.measurements.v1";
const R2D = 180 / Math.PI;
const raOf = (d: Vec3) => ((Math.atan2(d[1], d[0]) * R2D) + 360) % 360;
const decOf = (d: Vec3) => Math.asin(Math.max(-1, Math.min(1, d[2]))) * R2D;
const fmtT = (y: number) => `${y.toLocaleString(undefined, { maximumFractionDigits: 0 })} yr`;
const hoursFromNow = (eventYears: number, now: number) =>
  ((eventYears - now) * SECONDS_PER_JULIAN_YEAR) / 3600;

type Tool = "select" | "angular_distance" | "separation_position_angle" | "alignment";
const TOOL_LABEL: Record<Tool, string> = {
  select: "Select",
  angular_distance: "Distance",
  separation_position_angle: "Sep + PA",
  alignment: "Alignment",
};

export function App() {
  const [sky, setSky] = useState<LoadedSky | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vantage, setVantage] = useState<Vantage>("alpha-cen");
  const [tYears, setTYears] = useState(0);
  const [scale, setScale] = useState(100000);
  const [inertial, setInertial] = useState<InertialStar[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [fov, setFov] = useState(60);
  const [measurements, setMeasurements] = useState<MeasurementDef[]>(() => {
    try { return parseMeasurements(localStorage.getItem(STORAGE_KEY) ?? '{"measurements":[]}'); }
    catch { return []; }
  });
  const setFovRef = useRef<(f: number) => void>(() => {});

  // load catalog + world once
  useEffect(() => { loadSky().then(setSky).catch((e) => setError(String(e))); }, []);

  // (re)build the session for the current vantage
  const sessionInfo = useMemo(() => (sky ? buildSession(sky, vantage) : null), [sky, vantage]);

  // recompute the inertial sky (Stage 1) when vantage or time changes
  useEffect(() => {
    if (!sessionInfo) return;
    sessionInfo.session.recomputeInertial(tYears);
    setInertial([...sessionInfo.session.inertial]);
  }, [sessionInfo, tYears]);

  // persist measurements
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, serializeMeasurements(measurements));
  }, [measurements]);

  // index maps for the current frame
  const dirById = useMemo(() => {
    const m = new Map<string, Vec3>();
    for (const s of inertial) m.set(s.id, s.direction_icrs);
    return m;
  }, [inertial]);
  const metaById = useMemo(() => {
    const m = new Map<string, InertialStar>();
    for (const s of inertial) m.set(s.id, s);
    return m;
  }, [inertial]);

  const starPoints: StarPoint[] = useMemo(
    () => inertial.map((s) => ({ dir: s.direction_icrs, mag: s.mag, bp_rp: s.bp_rp })),
    [inertial],
  );

  // measurement resolver: direction of any object at any time (engine, single-star cheap path)
  const resolver: ObjectResolver = useCallback(
    (id, t) => (sky && sessionInfo ? directionAt(sky, sessionInfo.observer, id, t) : null),
    [sky, sessionInfo],
  );

  const results: MeasurementResult[] = useMemo(
    () => measurements.map((d) => resolveMeasurement(d, resolver, tYears)),
    [measurements, resolver, tYears],
  );

  const selectionDirs = useMemo(
    () => selection.map((id) => dirById.get(id)).filter((d): d is Vec3 => !!d),
    [selection, dirById],
  );
  const overlays = useMemo(() => {
    const arcs: Vec3[][] = [];
    for (const r of results) {
      if (!r.ok) continue;
      for (let i = 0; i + 1 < r.endpoints.length; i++) arcs.push(geodesicArc(r.endpoints[i]!, r.endpoints[i + 1]!));
    }
    // live preview of the in-progress selection
    for (let i = 0; i + 1 < selectionDirs.length; i++) arcs.push(geodesicArc(selectionDirs[i]!, selectionDirs[i + 1]!));
    return arcs;
  }, [results, selectionDirs]);

  // selection / measurement interactions
  const pick = useCallback((index: number | null) => {
    if (index == null) { if (tool === "select") setSelection([]); return; }
    const id = inertial[index]?.id;
    if (!id) return;
    if (tool === "select") { setSelection([id]); return; }
    setSelection((sel) => {
      if (tool === "alignment") return sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
      const next = [...sel, id];
      if (next.length >= 2) {
        const def: MeasurementDef = {
          id: crypto.randomUUID(), kind: tool as MeasurementKind, objectIds: next.slice(0, 2), createdAtYears: tYears,
        };
        setMeasurements((m) => [...m, def]);
        return [];
      }
      return next;
    });
  }, [tool, inertial, tYears]);

  const finishAlignment = useCallback(() => {
    if (selection.length < 3) return;
    setMeasurements((m) => [...m, { id: crypto.randomUUID(), kind: "alignment", objectIds: [...selection], createdAtYears: tYears }]);
    setSelection([]);
  }, [selection, tYears]);

  const onTool = (t: Tool) => { setTool(t); setSelection([]); };
  const nudgeFov = (factor: number) => { const f = Math.max(0.5, Math.min(120, fov * factor)); setFovRef.current(f); };

  if (error) return <div style={{ padding: 24, color: "#ff9" }}>Failed to load: {error}<br />Run <code>npm run dev</code> from packages/app (prepares data automatically).</div>;
  if (!sky) return <div style={{ padding: 24 }}>loading catalog…</div>;

  // readout target: hovered, else first selected
  const focusId = hoverId ?? selection[0] ?? null;
  const focusDir = focusId ? dirById.get(focusId) : undefined;
  const focusMeta = focusId ? metaById.get(focusId) : undefined;

  return (
    <div className="app">
      <div className="sky-wrap" style={{ display: "contents" }}>
        <SkyView
          stars={starPoints}
          selectionDirs={selectionDirs}
          overlays={overlays}
          onHoverIndex={(i) => setHoverId(i == null ? null : inertial[i]?.id ?? null)}
          onPickIndex={pick}
          onFov={setFov}
          fovRef={(fn) => (setFovRef.current = fn)}
        />
      </div>

      <aside className="side">
        <Toolbar tool={tool} onTool={onTool} vantage={vantage} setVantage={setVantage}
          fov={fov} nudgeFov={nudgeFov} selectionCount={selection.length} onFinishAlignment={finishAlignment} />
        <Readout sky={sky} t={tYears} dir={focusDir} meta={focusMeta} />
        <Measurements results={results} metaById={metaById}
          onDelete={(id) => setMeasurements((m) => m.filter((x) => x.id !== id))}
          onClear={() => setMeasurements([])} />
      </aside>

      <TimeBar t={tYears} scale={scale} setScale={setScale} setT={setTYears} starCount={inertial.length} />
    </div>
  );
}

function Toolbar(props: {
  tool: Tool; onTool: (t: Tool) => void; vantage: Vantage; setVantage: (v: Vantage) => void;
  fov: number; nudgeFov: (f: number) => void; selectionCount: number; onFinishAlignment: () => void;
}) {
  const tools: Tool[] = ["select", "angular_distance", "separation_position_angle", "alignment"];
  return (
    <div className="panel">
      <h2>Instrument</h2>
      <div className="row"><span className="k">vantage</span>
        <span className="btns">
          <button className={props.vantage === "alpha-cen" ? "active" : ""} onClick={() => props.setVantage("alpha-cen")}>Alpha Cen</button>
          <button className={props.vantage === "sol" ? "active" : ""} onClick={() => props.setVantage("sol")}>Sol</button>
        </span>
      </div>
      <div className="row" style={{ marginTop: 6 }}><span className="k">FOV {props.fov.toFixed(1)}°</span>
        <span className="btns">
          <button onClick={() => props.nudgeFov(1 / 1.4)}>zoom +</button>
          <button onClick={() => props.nudgeFov(1.4)}>zoom −</button>
        </span>
      </div>
      <div style={{ marginTop: 8 }} className="muted">tool — click stars to {props.tool === "select" ? "inspect" : "measure"}</div>
      <div className="btns" style={{ marginTop: 4 }}>
        {tools.map((t) => <button key={t} className={props.tool === t ? "active" : ""} onClick={() => props.onTool(t)}>{TOOL_LABEL[t]}</button>)}
      </div>
      {props.tool === "alignment" && (
        <div style={{ marginTop: 6 }}>
          <button disabled={props.selectionCount < 3} onClick={props.onFinishAlignment}>finish alignment ({props.selectionCount})</button>
        </div>
      )}
    </div>
  );
}

function Readout(props: { sky: LoadedSky; t: number; dir?: Vec3; meta?: InertialStar }) {
  if (!props.dir || !props.meta) return <div className="panel"><h2>Readout</h2><div className="muted">hover or select a star</div></div>;
  const d = props.dir, m = props.meta;
  const h = horizontalOf(props.sky, d, props.t);
  const rst = riseSetOf(props.sky, d, props.t);
  const ev = rst.circumpolar ? "circumpolar" : rst.neverRises ? "never rises"
    : `rise ${fmtH(rst.riseYears!, props.t)}, set ${fmtH(rst.setYears!, props.t)}`;
  return (
    <div className="panel">
      <h2>Readout</h2>
      <div className="row"><span className="k">object</span><span className="v">{m.name || m.id}</span></div>
      <div className="row"><span className="k">RA / Dec</span><span className="v">{raOf(d).toFixed(2)}° / {decOf(d).toFixed(2)}°</span></div>
      <div className="row"><span className="k">alt / az</span><span className="v">{h.altDeg.toFixed(2)}° / {h.azDeg.toFixed(2)}°</span></div>
      <div className="row"><span className="k">magnitude</span><span className="v">{m.mag.toFixed(2)}</span></div>
      <div className="row"><span className="k">distance</span><span className="v">{m.distance_pc.toFixed(2)} pc</span></div>
      <div className="row"><span className="k">transit alt</span><span className="v">{rst.transitAltitudeDeg.toFixed(1)}°</span></div>
      <div className="row"><span className="k">events</span><span className="v">{ev}</span></div>
    </div>
  );
}
function fmtH(eventYears: number, now: number) {
  const h = hoursFromNow(eventYears, now);
  return `${h >= 0 ? "+" : ""}${h.toFixed(1)} h`;
}

function Measurements(props: {
  results: MeasurementResult[]; metaById: Map<string, InertialStar>;
  onDelete: (id: string) => void; onClear: () => void;
}) {
  const name = (id: string) => props.metaById.get(id)?.name || id;
  return (
    <div className="panel">
      <h2>Measurements {props.results.length > 0 && <button className="x" onClick={props.onClear}>clear all</button>}</h2>
      {props.results.length === 0 && <div className="muted">pick a tool, then click two (or more) stars</div>}
      <div className="mlist">
        {props.results.map((r) => (
          <div key={r.id} className={"mitem" + (r.ok ? "" : " broken")}>
            <div className="top">
              <span className="val">{valueOf(r)}</span>
              <button className="x" onClick={() => props.onDelete(r.id)}>✕</button>
            </div>
            <div className="ids">{r.kind.replace(/_/g, " ")} · {r.objectIds.map(name).join(" — ")}
              {!r.ok && ` (missing: ${r.missing.join(", ")})`}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function valueOf(r: MeasurementResult): string {
  if (!r.ok) return "—";
  if (r.kind === "angular_distance") return `${r.angularDistanceDeg!.toFixed(3)}°`;
  if (r.kind === "separation_position_angle") return `${r.angularDistanceDeg!.toFixed(3)}° @ PA ${r.positionAngleDeg!.toFixed(1)}°`;
  return `dev ${r.alignmentDeviationDeg!.toFixed(3)}°`;
}

function TimeBar(props: { t: number; scale: number; setScale: (s: number) => void; setT: (t: number) => void; starCount: number }) {
  const sliderVal = (props.t / props.scale) * 1000;
  return (
    <div className="timebar">
      <span className="clock">t = {fmtT(props.t)}</span>
      <input type="range" min={-1000} max={1000} step={1} value={sliderVal}
        onChange={(e) => props.setT((Number(e.target.value) / 1000) * props.scale)} />
      <select value={props.scale} onChange={(e) => props.setScale(Number(e.target.value))}>
        <option value={100}>±100 yr</option>
        <option value={10000}>±10 kyr</option>
        <option value={100000}>±100 kyr</option>
      </select>
      <button onClick={() => props.setT(0)}>now</button>
      <span className="muted">{props.starCount} stars</span>
    </div>
  );
}
