import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  resolveMeasurement, serializeMeasurements, parseMeasurements,
  serializeAnnotations, parseAnnotations, resolveFigure, resolveLabel,
  serializeNotebook, parseNotebook, emptyNotebook,
  PROPAGATION_MODELS,
  parseWorld, planetOrientation, worldObserver, worldBodies,
  type World, type PlanetOrientation, type GeoObserver,
  type MeasurementDef, type MeasurementKind, type MeasurementResult,
  type Annotation, type FigureDef, type LabelDef, type GroupDef, type ResolvedFigure,
  type Notebook, type Note,
  type InertialStar, type Vec3, type ObjectResolver,
} from "@vobs/engine";
import {
  loadSky, buildSession, buildSessionAt, directionAt, horizontalOf, riseSetOf, horizonBasisFor,
  SECONDS_PER_JULIAN_YEAR, type LoadedSky, type Vantage,
} from "./sky";

type Projection = "gnomonic" | "fisheye" | "dome";
import { SkyView } from "./components/SkyView";
import { Gallery } from "./components/Gallery";
import { milkyWayGeometry } from "./milkyway";
import { geodesicArc, type StarPoint } from "./three/StarField";

const KEY = { meas: "vobs.measurements.v1", annot: "vobs.annotations.v1", note: "vobs.notebook.v1" };
const R2D = 180 / Math.PI;
const uid = () => crypto.randomUUID();
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

/** Small in-app text editor used everywhere a native prompt used to be (prompts are
 *  suppressed in embedded browsers like VS Code's Simple Browser). */
function InlineForm(props: { placeholder: string; initial?: string; multiline?: boolean; onSubmit: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(props.initial ?? "");
  const submit = () => { const t = v.trim(); if (t) props.onSubmit(t); };
  const common = {
    autoFocus: true, value: v, placeholder: props.placeholder,
    onChange: (e: { target: { value: string } }) => setV(e.target.value),
  };
  return (
    <div className="inline-form">
      {props.multiline
        ? <textarea {...common} rows={2} onKeyDown={(e) => { if (e.key === "Escape") props.onCancel(); }} />
        : <input {...common} onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") props.onCancel(); }} />}
      <div className="btns"><button onClick={submit}>save</button><button onClick={props.onCancel}>cancel</button></div>
    </div>
  );
}

export function App() {
  const [sky, setSky] = useState<LoadedSky | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vantage, setVantage] = useState<Vantage>("alpha-cen");
  const [worldVantage, setWorldVantage] = useState<{ pos: Vec3; label: string; world: World } | null>(null);
  const [tYears, setTYears] = useState(0);
  const [scale, setScale] = useState(100000);
  const [inertial, setInertial] = useState<InertialStar[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [pendingLabel, setPendingLabel] = useState<string | null>(null); // anchor id awaiting text
  const [fov, setFov] = useState(60);
  const [exposure, setExposure] = useState(0);
  const [showMilkyWay, setShowMilkyWay] = useState(true);
  const [projection, setProjection] = useState<Projection>("gnomonic");
  const [view, setView] = useState<"instrument" | "gallery">("instrument");
  const [measurements, setMeasurements] = useState<MeasurementDef[]>(() => loadJSON(KEY.meas, parseMeasurements, []));
  const [annotations, setAnnotations] = useState<Annotation[]>(() => loadJSON(KEY.annot, parseAnnotations, []));
  const [notebook, setNotebook] = useState<Notebook>(() => loadJSON(KEY.note, parseNotebook, emptyNotebook()));
  const setFovRef = useRef<(f: number) => void>(() => {});
  const setExposureRef = useRef<(v: number) => void>(() => {});

  useEffect(() => { loadSky().then(setSky).catch((e) => setError(String(e))); }, []);

  const sessionInfo = useMemo(
    () => (!sky ? null : worldVantage ? buildSessionAt(sky, worldVantage.pos) : buildSession(sky, vantage)),
    [sky, vantage, worldVantage],
  );
  const mw = useMemo(() => milkyWayGeometry(sessionInfo ? sessionInfo.observer.origin_pc : [0, 0, 0]), [sessionInfo]);
  // active apparatus: the observed world's planet when standing on one, else the Sol world.
  const apparatus = useMemo(
    () => (worldVantage ? { o: planetOrientation(worldVantage.world), obs: worldObserver(worldVantage.world) }
      : sky ? { o: sky.orientation, obs: sky.geoObserver } : null),
    [worldVantage, sky],
  );
  const horizonBasis = useMemo(
    () => (apparatus ? horizonBasisFor(apparatus.o, apparatus.obs, tYears)
      : { east: [0, 1, 0] as Vec3, north: [0, 0, 1] as Vec3, up: [1, 0, 0] as Vec3 }),
    [apparatus, tYears],
  );
  // host-star glare: when observing from a world, the sun washes out nearby stars if it is up.
  const sun = useMemo(() => {
    if (!worldVantage) return null;
    const host = worldBodies(worldVantage.world, tYears).find((b) => b.kind === "host_star");
    if (!host) return null;
    const d = host.direction_icrs;
    const altDeg = Math.asin(Math.max(-1, Math.min(1, d[0] * horizonBasis.up[0] + d[1] * horizonBasis.up[1] + d[2] * horizonBasis.up[2]))) * R2D;
    return { dir: d as Vec3, altDeg };
  }, [worldVantage, tYears, horizonBasis]);
  const GLARE_DEG = 14;
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
    if (tool === "label") { setPendingLabel(id); return; }
    if (tool === "figure") { setDraft((d) => [...d, id]); return; }
    if (tool === "alignment") { setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); return; }
    setSelection((sel) => {
      const next = [...sel, id];
      if (next.length >= 2) {
        setMeasurements((m) => [...m, { id: uid(), kind: tool as MeasurementKind, objectIds: next.slice(0, 2), createdAtYears: tYears }]);
        return [];
      }
      return next;
    });
  }, [tool, inertial, tYears]);

  const finishFigure = (name: string) => {
    if (draft.length < 2) return;
    const edges: [number, number][] = draft.slice(0, -1).map((_, i) => [i, i + 1]);
    setAnnotations((a) => [...a, { id: uid(), kind: "figure", name, nodeIds: [...draft], edges, constellation: true, createdAtYears: tYears } as FigureDef]);
    setDraft([]);
  };
  const makeGroup = (name: string) => {
    if (selection.length < 2) return;
    setAnnotations((a) => [...a, { id: uid(), kind: "group", name, objectIds: [...selection], createdAtYears: tYears } as GroupDef]);
    setSelection([]);
  };
  const submitLabel = (text: string) => {
    if (!pendingLabel) return;
    setAnnotations((a) => [...a, { id: uid(), kind: "label", text, anchorId: pendingLabel, createdAtYears: tYears } as LabelDef]);
    setPendingLabel(null);
  };
  const finishAlignment = () => {
    if (selection.length < 3) return;
    setMeasurements((m) => [...m, { id: uid(), kind: "alignment", objectIds: [...selection], createdAtYears: tYears }]);
    setSelection([]);
  };
  const addNote = (text: string) =>
    setNotebook((nb) => ({ ...nb, notes: [...nb.notes, { id: uid(), text, objectIds: [...selection], atYears: tYears, createdAtYears: tYears } as Note] }));
  const addMarker = (label: string) =>
    setNotebook((nb) => ({ ...nb, markers: [...nb.markers, { id: uid(), label, atYears: tYears }] }));

  const onTool = (t: Tool) => { setTool(t); setSelection([]); setDraft([]); setPendingLabel(null); };
  const nudgeFov = (factor: number) => setFovRef.current(Math.max(0.5, Math.min(120, fov * factor)));

  if (view === "gallery") return <Gallery onBack={() => setView("instrument")}
    onObserve={(w) => { setWorldVantage({ pos: w.host_star.galactic_xyz_pc, label: w.host_star.catalog_id, world: parseWorld(w) }); setView("instrument"); }} />;
  if (error) return <div style={{ padding: 24, color: "#ff9" }}>Failed to load: {error}</div>;
  if (!sky) return <div style={{ padding: 24 }}>loading catalog…</div>;

  const focusId = hoverId ?? selection[0] ?? draft[draft.length - 1] ?? null;
  const focusDir = focusId ? dirById.get(focusId) : undefined;
  const focusMeta = focusId ? metaById.get(focusId) : undefined;
  const pendingLabelName = pendingLabel ? metaById.get(pendingLabel)?.name || pendingLabel : null;

  const cap = PROPAGATION_MODELS.rectilinear.honestCapYears;
  const speculative = Math.abs(tYears) > cap;

  return (
    <div className="app">
      <button className="viewtoggle" onClick={() => setView("gallery")}>⊞ World gallery</button>
      {speculative && (
        <div className="speculative">
          ⚠ SPECULATIVE — |t| &gt; {fmtT(cap)}. Beyond the rectilinear model's validated range; these
          positions are extrapolation, not data. (Galactic-orbit propagation extends this to ~1 Myr.)
        </div>
      )}
      <SkyView
        stars={starPoints} selectionDirs={selectionDirs} overlays={measureArcs}
        figures={figureArcs} labels={labelSprites}
        onHoverIndex={(i) => setHoverId(i == null ? null : inertial[i]?.id ?? null)}
        onPickIndex={pick} onFov={setFov} fovRef={(fn) => (setFovRef.current = fn)}
        exposureRef={(fn) => (setExposureRef.current = fn)}
        milkyWay={{ normalIcrs: mw.diskNormalIcrs, centerIcrs: mw.galacticCenterIcrs, gain: showMilkyWay ? 1 : 0 }}
        projection={projection} horizonBasis={horizonBasis}
        sun={{ dirIcrs: sun && sun.altDeg > -2 ? sun.dir : null, radiusDeg: GLARE_DEG }}
      />

      <aside className="side">
        <Toolbar tool={tool} onTool={onTool} vantage={vantage}
          setVantage={(v) => { setVantage(v); setWorldVantage(null); }}
          worldVantageLabel={worldVantage?.label ?? null} onClearWorldVantage={() => setWorldVantage(null)}
          fov={fov} nudgeFov={nudgeFov} exposure={exposure} onExposure={(v) => { setExposure(v); setExposureRef.current(v); }}
          showMilkyWay={showMilkyWay} onMilkyWay={() => setShowMilkyWay((v) => !v)}
          projection={projection} onProjection={setProjection}
          selection={selection} draft={draft}
          onFinishFigure={finishFigure} onMakeGroup={makeGroup} onFinishAlignment={finishAlignment}
          pendingLabelName={pendingLabelName} onSubmitLabel={submitLabel} onCancelLabel={() => setPendingLabel(null)} />
        <Readout o={apparatus?.o} obs={apparatus?.obs} t={tYears} dir={focusDir} meta={focusMeta} sun={sun} glareDeg={GLARE_DEG} />
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

      <TimeBar t={tYears} scale={scale} setScale={setScale} setT={setTYears} starCount={inertial.length} speculative={speculative} />
    </div>
  );
}

function Toolbar(props: {
  tool: Tool; onTool: (t: Tool) => void; vantage: Vantage; setVantage: (v: Vantage) => void;
  worldVantageLabel: string | null; onClearWorldVantage: () => void;
  fov: number; nudgeFov: (f: number) => void; exposure: number; onExposure: (v: number) => void;
  showMilkyWay: boolean; onMilkyWay: () => void;
  projection: Projection; onProjection: (p: Projection) => void;
  selection: string[]; draft: string[];
  onFinishFigure: (name: string) => void; onMakeGroup: (name: string) => void; onFinishAlignment: () => void;
  pendingLabelName: string | null; onSubmitLabel: (t: string) => void; onCancelLabel: () => void;
}) {
  const [naming, setNaming] = useState<null | "figure" | "group">(null);
  return (
    <div className="panel">
      <h2>Instrument</h2>
      <div className="row"><span className="k">vantage</span>
        <span className="btns">
          <button className={!props.worldVantageLabel && props.vantage === "alpha-cen" ? "active" : ""} onClick={() => props.setVantage("alpha-cen")}>Alpha Cen</button>
          <button className={!props.worldVantageLabel && props.vantage === "sol" ? "active" : ""} onClick={() => props.setVantage("sol")}>Sol</button>
        </span>
      </div>
      {props.worldVantageLabel && (
        <div className="row" style={{ marginTop: 4 }}><span className="k">observing ✦</span>
          <span className="v">{props.worldVantageLabel} <button className="x" onClick={props.onClearWorldVantage} title="back to Sol/Alpha Cen">×</button></span>
        </div>
      )}
      <div className="row" style={{ marginTop: 6 }}><span className="k">FOV {props.fov.toFixed(1)}°</span>
        <span className="btns"><button onClick={() => props.nudgeFov(1 / 1.4)}>zoom +</button><button onClick={() => props.nudgeFov(1.4)}>zoom −</button></span>
      </div>
      <div className="row" style={{ marginTop: 6 }}><span className="k">exposure {props.exposure >= 0 ? "+" : ""}{props.exposure.toFixed(1)}</span>
        <input type="range" min={-3} max={4} step={0.1} value={props.exposure} onChange={(e) => props.onExposure(Number(e.target.value))} style={{ width: 130 }} />
      </div>
      <div className="row" style={{ marginTop: 6 }}><span className="k">background</span>
        <button className={props.showMilkyWay ? "active" : ""} onClick={props.onMilkyWay}>Milky Way</button>
      </div>
      <div className="row" style={{ marginTop: 6 }}><span className="k">projection</span>
        <span className="btns">
          {(["gnomonic", "fisheye", "dome"] as Projection[]).map((p) =>
            <button key={p} className={props.projection === p ? "active" : ""} onClick={() => props.onProjection(p)}>{p === "gnomonic" ? "flat" : p}</button>)}
        </span>
      </div>
      <div className="muted" style={{ marginTop: 8 }}>tools</div>
      <div className="btns" style={{ marginTop: 4 }}>
        {(["select", ...MEASURE_TOOLS, "figure", "label"] as Tool[]).map((t) =>
          <button key={t} className={props.tool === t ? "active" : ""} onClick={() => props.onTool(t)}>{TOOL_LABEL[t]}</button>)}
      </div>
      {props.tool === "alignment" && <div style={{ marginTop: 6 }}><button disabled={props.selection.length < 3} onClick={props.onFinishAlignment}>finish alignment ({props.selection.length})</button></div>}
      {props.tool === "figure" && (naming === "figure"
        ? <InlineForm placeholder="figure / constellation name" onSubmit={(n) => { props.onFinishFigure(n); setNaming(null); }} onCancel={() => setNaming(null)} />
        : <div style={{ marginTop: 6 }}><button disabled={props.draft.length < 2} onClick={() => setNaming("figure")}>finish figure ({props.draft.length} stars)</button></div>)}
      {props.tool === "select" && props.selection.length >= 2 && (naming === "group"
        ? <InlineForm placeholder="group name" onSubmit={(n) => { props.onMakeGroup(n); setNaming(null); }} onCancel={() => setNaming(null)} />
        : <div style={{ marginTop: 6 }}><button onClick={() => setNaming("group")}>group {props.selection.length} stars</button></div>)}
      {props.pendingLabelName && (
        <div style={{ marginTop: 6 }}>
          <div className="muted">label “{props.pendingLabelName}”</div>
          <InlineForm placeholder="label text" initial={props.pendingLabelName} onSubmit={props.onSubmitLabel} onCancel={props.onCancelLabel} />
        </div>
      )}
    </div>
  );
}

function Readout(props: { o?: PlanetOrientation; obs?: GeoObserver; t: number; dir?: Vec3; meta?: InertialStar; sun: { dir: Vec3; altDeg: number } | null; glareDeg: number }) {
  if (!props.dir || !props.meta || !props.o || !props.obs) return <div className="panel"><h2>Readout</h2><div className="muted">hover or select a star</div></div>;
  const d = props.dir, m = props.meta;
  const h = horizontalOf(props.o, props.obs, d, props.t);
  const rst = riseSetOf(props.o, props.obs, d, props.t);
  const ev = rst.circumpolar ? "circumpolar" : rst.neverRises ? "never rises"
    : `rise ${fmtH(rst.riseYears!, props.t)}, set ${fmtH(rst.setYears!, props.t)}`;
  let heliacal: { elong: number; washed: boolean; sunUp: boolean } | null = null;
  if (props.sun) {
    const s = props.sun.dir;
    const elong = Math.acos(Math.max(-1, Math.min(1, d[0] * s[0] + d[1] * s[1] + d[2] * s[2]))) * R2D;
    heliacal = { elong, sunUp: props.sun.altDeg > 0, washed: props.sun.altDeg > -2 && elong < props.glareDeg };
  }
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
      {heliacal && (
        <div className="row"><span className="k">sun elong.</span>
          <span className="v">{heliacal.elong.toFixed(1)}°{heliacal.washed ? " · lost in glare" : heliacal.sunUp ? " · clear of the sun" : ""}</span>
        </div>
      )}
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
  const [editing, setEditing] = useState<string | null>(null);
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
              {editing === a.id && a.kind !== "label"
                ? <InlineForm placeholder="name" initial={a.name} onSubmit={(n) => { props.onRename(a.id, n); setEditing(null); }} onCancel={() => setEditing(null)} />
                : <>
                  <div className="top">
                    <span className="val" style={{ fontSize: 13 }}>{title}</span>
                    <span>
                      {a.kind !== "label" && <button className="x" title="rename" onClick={() => setEditing(a.id)}>✎</button>}
                      <button className="x" onClick={() => props.onDelete(a.id)}>✕</button>
                    </span>
                  </div>
                  <div className="ids">{sub}{broken && " (some stars missing)"}</div>
                </>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NotebookPanel(props: {
  notebook: Notebook; metaById: Map<string, InertialStar>;
  onAddNote: (t: string) => void; onAddMarker: (l: string) => void;
  onJump: (t: number, ids?: string[]) => void; onDeleteNote: (id: string) => void; onDeleteMarker: (id: string) => void;
}) {
  const name = (id: string) => props.metaById.get(id)?.name || id;
  const [adding, setAdding] = useState<null | "note" | "marker">(null);
  return (
    <div className="panel">
      <h2>Notebook</h2>
      <div className="btns"><button onClick={() => setAdding("note")}>+ note</button><button onClick={() => setAdding("marker")}>+ time marker</button></div>
      {adding === "note" && <InlineForm placeholder="observation / note" multiline onSubmit={(t) => { props.onAddNote(t); setAdding(null); }} onCancel={() => setAdding(null)} />}
      {adding === "marker" && <InlineForm placeholder="marker label" onSubmit={(l) => { props.onAddMarker(l); setAdding(null); }} onCancel={() => setAdding(null)} />}
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
              <button className="link" onClick={() => props.onJump(n.atYears ?? 0, n.objectIds)}>{n.text.slice(0, 80)}</button>
              <button className="x" onClick={() => props.onDeleteNote(n.id)}>✕</button>
            </div>
            <div className="ids">{n.atYears != null ? fmtT(n.atYears) : "no time"}{n.objectIds.length > 0 && ` · ${n.objectIds.map(name).join(", ")}`}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeBar(props: { t: number; scale: number; setScale: (s: number) => void; setT: (t: number) => void; starCount: number; speculative: boolean }) {
  return (
    <div className="timebar">
      <span className={"clock" + (props.speculative ? " spec" : "")}>t = {fmtT(props.t)}{props.speculative && " ⚠"}</span>
      <input type="range" min={-1000} max={1000} step={1} value={(props.t / props.scale) * 1000}
        onChange={(e) => props.setT((Number(e.target.value) / 1000) * props.scale)} />
      <select value={props.scale} onChange={(e) => props.setScale(Number(e.target.value))}>
        <option value={100}>±100 yr</option><option value={10000}>±10 kyr</option><option value={100000}>±100 kyr</option>
        <option value={1000000}>±1 Myr</option><option value={10000000}>±10 Myr</option>
      </select>
      <button onClick={() => props.setT(0)}>now</button>
      <span className="muted">{props.starCount} stars</span>
    </div>
  );
}
