import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  resolveMeasurement, serializeMeasurements, parseMeasurements,
  serializeAnnotations, parseAnnotations, resolveFigure, resolveLabel,
  serializeNotebook, parseNotebook, emptyNotebook,
  type MeasurementDef, type MeasurementKind, type MeasurementResult,
  type Annotation, type FigureDef, type LabelDef, type GroupDef, type ResolvedFigure,
  type Notebook, type Note,
  type InertialStar, type Vec3, type ObjectResolver,
} from "@vobs/engine";
import {
  loadSky, buildSession, directionAt, horizontalOf, riseSetOf,
  SECONDS_PER_JULIAN_YEAR, type LoadedSky, type Vantage,
} from "./sky";
import { SkyView } from "./components/SkyView";
import { geodesicArc, type StarPoint } from "./three/StarField";

const KEY = { meas: "vobs.measurements.v1", annot: "vobs.annotations.v1", note: "vobs.notebook.v1" };
const R2D = 180 / Math.PI;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
const raOf = (d: Vec3) => ((Math.atan2(d[1], d[0]) * R2D) + 360) % 360;
const decOf = (d: Vec3) => Math.asin(Math.max(-1, Math.min(1, d[2]))) * R2D;
const fmtT = (y: number) => `${y.toLocaleString(undefined, { maximumFractionDigits: 0 })} yr`;
const hoursFromNow = (e: number, now: number) => ((e - now) * SECONDS_PER_JULIAN_YEAR) / 3600;

type Tool = "select" | "angular_distance" | "separation_position_angle" | "alignment" | "figure" | "label";
const TOOL_LABEL: Record<Tool, string> = {
  select: "Select", angular_distance: "Distance", separation_position_angle: "Sep+PA",
  alignment: "Align", figure: "Draw figure", label: "Label",
};
const MEASURE_TOOLS: Tool[] = ["angular_distance", "separation_position_angle", "alignment"];

function loadJSON<T>(key: string, parse: (s: string) => T, fallback: T): T {
  try { const s = localStorage.getItem(key); return s ? parse(s) : fallback; } catch { return fallback; }
}

export function App() {
  const [sky, setSky] = useState<LoadedSky | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vantage, setVantage] = useState<Vantage>("alpha-cen");
  const [tYears, setTYears] = useState(0);
  const [scale, setScale] = useState(100000);
  const [inertial, setInertial] = useState<InertialStar[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>([]); // figure-in-progress node ids
  const [tool, setTool] = useState<Tool>("select");
  const [fov, setFov] = useState(60);
  const [measurements, setMeasurements] = useState<MeasurementDef[]>(() => loadJSON(KEY.meas, parseMeasurements, []));
  const [annotations, setAnnotations] = useState<Annotation[]>(() => loadJSON(KEY.annot, parseAnnotations, []));
  const [notebook, setNotebook] = useState<Notebook>(() => loadJSON(KEY.note, parseNotebook, emptyNotebook()));
  const setFovRef = useRef<(f: number) => void>(() => {});

  useEffect(() => { loadSky().then(setSky).catch((e) => setError(String(e))); }, []);

  const sessionInfo = useMemo(() => (sky ? buildSession(sky, vantage) : null), [sky, vantage]);
  useEffect(() => {
    if (!sessionInfo) return;
    sessionInfo.session.recomputeInertial(tYears);
    setInertial([...sessionInfo.session.inertial]);
  }, [sessionInfo, tYears]);

  useEffect(() => { localStorage.setItem(KEY.meas, serializeMeasurements(measurements)); }, [measurements]);
  useEffect(() => { localStorage.setItem(KEY.annot, serializeAnnotations(annotations)); }, [annotations]);
  useEffect(() => { localStorage.setItem(KEY.note, serializeNotebook(notebook)); }, [notebook]);

  const dirById = useMemo(() => new Map(inertial.map((s) => [s.id, s.direction_icrs])), [inertial]);
  const metaById = useMemo(() => new Map(inertial.map((s) => [s.id, s])), [inertial]);
  const starPoints: StarPoint[] = useMemo(
    () => inertial.map((s) => ({ dir: s.direction_icrs, mag: s.mag, bp_rp: s.bp_rp })), [inertial]);

  const resolver: ObjectResolver = useCallback(
    (id, t) => (sky && sessionInfo ? directionAt(sky, sessionInfo.observer, id, t) : null), [sky, sessionInfo]);

  const results: MeasurementResult[] = useMemo(
    () => measurements.map((d) => resolveMeasurement(d, resolver, tYears)), [measurements, resolver, tYears]);
  const figures = useMemo(
    () => annotations.filter((a): a is FigureDef => a.kind === "figure").map((f) => resolveFigure(f, resolver, tYears)),
    [annotations, resolver, tYears]);
  const labels = useMemo(
    () => annotations.filter((a): a is LabelDef => a.kind === "label").map((l) => resolveLabel(l, resolver, tYears)),
    [annotations, resolver, tYears]);

  const selectionDirs = useMemo(
    () => [...selection, ...draft].map((id) => dirById.get(id)).filter((d): d is Vec3 => !!d), [selection, draft, dirById]);

  const measureArcs = useMemo(() => {
    const arcs: Vec3[][] = [];
    for (const r of results) if (r.ok) for (let i = 0; i + 1 < r.endpoints.length; i++) arcs.push(geodesicArc(r.endpoints[i]!, r.endpoints[i + 1]!));
    // live preview of the in-progress measurement / figure path
    const draftDirs = [...selection, ...draft].map((id) => dirById.get(id)).filter((d): d is Vec3 => !!d);
    for (let i = 0; i + 1 < draftDirs.length; i++) arcs.push(geodesicArc(draftDirs[i]!, draftDirs[i + 1]!));
    return arcs;
  }, [results, selection, draft, dirById]);

  const figureArcs = useMemo(() => {
    const arcs: Vec3[][] = [];
    for (const f of figures) for (const [i, j] of f.edges) {
      const a = f.nodes[i]?.dir, b = f.nodes[j]?.dir;
      if (a && b) arcs.push(geodesicArc(a, b));
    }
    return arcs;
  }, [figures]);

  const labelSprites = useMemo(() => {
    const out: { dir: Vec3; text: string }[] = [];
    for (const l of labels) if (l.ok && l.dir) out.push({ dir: l.dir, text: l.text });
    for (const f of figures) if (f.ok && f.nodes[0]?.dir) out.push({ dir: f.nodes[0].dir, text: f.name });
    return out;
  }, [labels, figures]);

  // --- interactions ---
  const pick = useCallback((index: number | null) => {
    const id = index == null ? null : inertial[index]?.id ?? null;
    if (id == null) { if (tool === "select") setSelection([]); return; }
    if (tool === "select") { setSelection([id]); return; }
    if (tool === "label") {
      const text = window.prompt("Label text:", metaById.get(id)?.name || id);
      if (text) setAnnotations((a) => [...a, { id: uid(), kind: "label", text, anchorId: id, createdAtYears: tYears } as LabelDef]);
      return;
    }
    if (tool === "figure") { setDraft((d) => [...d, id]); return; }
    if (tool === "alignment") { setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); return; }
    // distance / sep+pa: two clicks -> a measurement
    setSelection((sel) => {
      const next = [...sel, id];
      if (next.length >= 2) {
        setMeasurements((m) => [...m, { id: uid(), kind: tool as MeasurementKind, objectIds: next.slice(0, 2), createdAtYears: tYears }]);
        return [];
      }
      return next;
    });
  }, [tool, inertial, metaById, tYears]);

  const finishFigure = useCallback(() => {
    if (draft.length < 2) return;
    const name = window.prompt("Figure / constellation name:", "New figure");
    if (name == null) return;
    const edges: [number, number][] = draft.slice(0, -1).map((_, i) => [i, i + 1]);
    setAnnotations((a) => [...a, { id: uid(), kind: "figure", name, nodeIds: [...draft], edges, constellation: true, createdAtYears: tYears } as FigureDef]);
    setDraft([]);
  }, [draft, tYears]);

  const makeGroup = useCallback(() => {
    if (selection.length < 2) return;
    const name = window.prompt("Group name:", "New group");
    if (name == null) return;
    setAnnotations((a) => [...a, { id: uid(), kind: "group", name, objectIds: [...selection], createdAtYears: tYears } as GroupDef]);
    setSelection([]);
  }, [selection, tYears]);

  const onTool = (t: Tool) => { setTool(t); setSelection([]); setDraft([]); };
  const nudgeFov = (factor: number) => setFovRef.current(Math.max(0.5, Math.min(120, fov * factor)));

  const addNote = () => {
    const text = window.prompt("Observation / note:");
    if (!text) return;
    const note: Note = { id: uid(), text, objectIds: [...selection], atYears: tYears, createdAtYears: tYears };
    setNotebook((nb) => ({ ...nb, notes: [...nb.notes, note] }));
  };
  const addMarker = () => {
    const label = window.prompt("Timeline marker label:", fmtT(tYears));
    if (label == null) return;
    setNotebook((nb) => ({ ...nb, markers: [...nb.markers, { id: uid(), label, atYears: tYears }] }));
  };

  if (error) return <div style={{ padding: 24, color: "#ff9" }}>Failed to load: {error}</div>;
  if (!sky) return <div style={{ padding: 24 }}>loading catalog…</div>;

  const focusId = hoverId ?? selection[0] ?? draft[draft.length - 1] ?? null;
  const focusDir = focusId ? dirById.get(focusId) : undefined;
  const focusMeta = focusId ? metaById.get(focusId) : undefined;

  return (
    <div className="app">
      <SkyView
        stars={starPoints} selectionDirs={selectionDirs} overlays={measureArcs}
        figures={figureArcs} labels={labelSprites}
        onHoverIndex={(i) => setHoverId(i == null ? null : inertial[i]?.id ?? null)}
        onPickIndex={pick} onFov={setFov} fovRef={(fn) => (setFovRef.current = fn)}
      />

      <aside className="side">
        <Toolbar tool={tool} onTool={onTool} vantage={vantage} setVantage={setVantage}
          fov={fov} nudgeFov={nudgeFov} selection={selection} draft={draft}
          onFinishFigure={finishFigure} onMakeGroup={makeGroup}
          onFinishAlignment={() => { if (selection.length >= 3) { setMeasurements((m) => [...m, { id: uid(), kind: "alignment", objectIds: [...selection], createdAtYears: tYears }]); setSelection([]); } }} />
        <Readout sky={sky} t={tYears} dir={focusDir} meta={focusMeta} />
        <Measurements results={results} metaById={metaById}
          onDelete={(id) => setMeasurements((m) => m.filter((x) => x.id !== id))} onClear={() => setMeasurements([])} />
        <Annotations annotations={annotations} figures={figures}
          onRename={(id, name) => setAnnotations((a) => a.map((x) => (x.id === id && x.kind !== "label" ? { ...x, name } : x)))}
          onDelete={(id) => setAnnotations((a) => a.filter((x) => x.id !== id))} />
        <NotebookPanel notebook={notebook} metaById={metaById} onAddNote={addNote} onAddMarker={addMarker}
          onJump={(t, ids) => { setTYears(t); if (ids?.length) { setSelection(ids); setTool("select"); } }}
          onDeleteNote={(id) => setNotebook((nb) => ({ ...nb, notes: nb.notes.filter((n) => n.id !== id) }))}
          onDeleteMarker={(id) => setNotebook((nb) => ({ ...nb, markers: nb.markers.filter((m) => m.id !== id) }))} />
      </aside>

      <TimeBar t={tYears} scale={scale} setScale={setScale} setT={setTYears} starCount={inertial.length} />
    </div>
  );
}

function Toolbar(props: {
  tool: Tool; onTool: (t: Tool) => void; vantage: Vantage; setVantage: (v: Vantage) => void;
  fov: number; nudgeFov: (f: number) => void; selection: string[]; draft: string[];
  onFinishFigure: () => void; onMakeGroup: () => void; onFinishAlignment: () => void;
}) {
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
        <span className="btns"><button onClick={() => props.nudgeFov(1 / 1.4)}>zoom +</button><button onClick={() => props.nudgeFov(1.4)}>zoom −</button></span>
      </div>
      <div className="muted" style={{ marginTop: 8 }}>tools</div>
      <div className="btns" style={{ marginTop: 4 }}>
        {(["select", ...MEASURE_TOOLS, "figure", "label"] as Tool[]).map((t) =>
          <button key={t} className={props.tool === t ? "active" : ""} onClick={() => props.onTool(t)}>{TOOL_LABEL[t]}</button>)}
      </div>
      {props.tool === "alignment" && <div style={{ marginTop: 6 }}><button disabled={props.selection.length < 3} onClick={props.onFinishAlignment}>finish alignment ({props.selection.length})</button></div>}
      {props.tool === "figure" && <div style={{ marginTop: 6 }}><button disabled={props.draft.length < 2} onClick={props.onFinishFigure}>finish figure ({props.draft.length} stars)</button></div>}
      {props.tool === "select" && props.selection.length >= 2 && <div style={{ marginTop: 6 }}><button onClick={props.onMakeGroup}>group {props.selection.length} stars</button></div>}
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
function fmtH(e: number, now: number) { const h = hoursFromNow(e, now); return `${h >= 0 ? "+" : ""}${h.toFixed(1)} h`; }

function Measurements(props: { results: MeasurementResult[]; metaById: Map<string, InertialStar>; onDelete: (id: string) => void; onClear: () => void }) {
  const name = (id: string) => props.metaById.get(id)?.name || id;
  return (
    <div className="panel">
      <h2>Measurements {props.results.length > 0 && <button className="x" onClick={props.onClear}>clear</button>}</h2>
      {props.results.length === 0 && <div className="muted">pick a measure tool, click two stars</div>}
      <div className="mlist">
        {props.results.map((r) => (
          <div key={r.id} className={"mitem" + (r.ok ? "" : " broken")}>
            <div className="top"><span className="val">{measureValue(r)}</span><button className="x" onClick={() => props.onDelete(r.id)}>✕</button></div>
            <div className="ids">{r.kind.replace(/_/g, " ")} · {r.objectIds.map(name).join(" — ")}{!r.ok && ` (missing ${r.missing.join(", ")})`}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function measureValue(r: MeasurementResult): string {
  if (!r.ok) return "—";
  if (r.kind === "angular_distance") return `${r.angularDistanceDeg!.toFixed(3)}°`;
  if (r.kind === "separation_position_angle") return `${r.angularDistanceDeg!.toFixed(3)}° @ PA ${r.positionAngleDeg!.toFixed(1)}°`;
  return `dev ${r.alignmentDeviationDeg!.toFixed(3)}°`;
}

function Annotations(props: { annotations: Annotation[]; figures: ResolvedFigure[]; onRename: (id: string, name: string) => void; onDelete: (id: string) => void }) {
  const figState = new Map(props.figures.map((f) => [f.id, f]));
  if (props.annotations.length === 0) return <div className="panel"><h2>Annotations</h2><div className="muted">draw figures, pin labels, group stars</div></div>;
  return (
    <div className="panel">
      <h2>Annotations</h2>
      <div className="mlist">
        {props.annotations.map((a) => {
          const broken = a.kind === "figure" && figState.get(a.id)?.ok === false;
          const title = a.kind === "label" ? `“${a.text}”` : a.name;
          const sub = a.kind === "figure" ? `${a.constellation ? "constellation" : "figure"} · ${a.nodeIds.length} stars`
            : a.kind === "group" ? `group · ${a.objectIds.length} stars` : `label · ${a.anchorId}`;
          return (
            <div key={a.id} className={"mitem" + (broken ? " broken" : "")}>
              <div className="top">
                <span className="val" style={{ fontSize: 13 }}>{title}</span>
                <span>
                  {a.kind !== "label" && <button className="x" title="rename" onClick={() => { const n = window.prompt("Rename:", a.name); if (n != null) props.onRename(a.id, n); }}>✎</button>}
                  <button className="x" onClick={() => props.onDelete(a.id)}>✕</button>
                </span>
              </div>
              <div className="ids">{sub}{broken && " (some stars missing)"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NotebookPanel(props: {
  notebook: Notebook; metaById: Map<string, InertialStar>;
  onAddNote: () => void; onAddMarker: () => void;
  onJump: (t: number, ids?: string[]) => void; onDeleteNote: (id: string) => void; onDeleteMarker: (id: string) => void;
}) {
  const name = (id: string) => props.metaById.get(id)?.name || id;
  return (
    <div className="panel">
      <h2>Notebook</h2>
      <div className="btns"><button onClick={props.onAddNote}>+ note</button><button onClick={props.onAddMarker}>+ time marker</button></div>
      {props.notebook.markers.length > 0 && <div className="muted" style={{ marginTop: 8 }}>timeline</div>}
      <div className="mlist">
        {props.notebook.markers.map((m) => (
          <div key={m.id} className="mitem">
            <div className="top"><button className="link" onClick={() => props.onJump(m.atYears)}>⏱ {m.label}</button><button className="x" onClick={() => props.onDeleteMarker(m.id)}>✕</button></div>
            <div className="ids">{fmtT(m.atYears)}</div>
          </div>
        ))}
      </div>
      {props.notebook.notes.length > 0 && <div className="muted" style={{ marginTop: 8 }}>notes</div>}
      <div className="mlist">
        {props.notebook.notes.map((n) => (
          <div key={n.id} className="mitem">
            <div className="top">
              <button className="link" onClick={() => props.onJump(n.atYears ?? 0, n.objectIds)}>{n.text.slice(0, 60)}</button>
              <button className="x" onClick={() => props.onDeleteNote(n.id)}>✕</button>
            </div>
            <div className="ids">{n.atYears != null ? fmtT(n.atYears) : "no time"}{n.objectIds.length > 0 && ` · ${n.objectIds.map(name).join(", ")}`}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeBar(props: { t: number; scale: number; setScale: (s: number) => void; setT: (t: number) => void; starCount: number }) {
  return (
    <div className="timebar">
      <span className="clock">t = {fmtT(props.t)}</span>
      <input type="range" min={-1000} max={1000} step={1} value={(props.t / props.scale) * 1000}
        onChange={(e) => props.setT((Number(e.target.value) / 1000) * props.scale)} />
      <select value={props.scale} onChange={(e) => props.setScale(Number(e.target.value))}>
        <option value={100}>±100 yr</option><option value={10000}>±10 kyr</option><option value={100000}>±100 kyr</option>
      </select>
      <button onClick={() => props.setT(0)}>now</button>
      <span className="muted">{props.starCount} stars</span>
    </div>
  );
}
