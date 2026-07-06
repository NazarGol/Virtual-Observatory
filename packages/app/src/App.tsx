import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  resolveMeasurement, serializeMeasurements, parseMeasurements,
  serializeAnnotations, parseAnnotations, resolveFigure, resolveLabel,
  serializeNotebook, parseNotebook, emptyNotebook,
  PROPAGATION_MODELS, findMinSeparation,
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
import { milkyWayGeometry, milkyWayBand } from "./milkyway";
import { comovingCandidates, anomalyCandidates, alignmentCandidates, candidatesFromStar, type Candidate } from "./analysis";
import { geodesicArc, SENSORS, type StarPoint, type Sensor } from "./three/StarField";

const KEY = { meas: "vobs.measurements.v1", annot: "vobs.annotations.v1", note: "vobs.notebook.v1", survey: "vobs.survey.v1" };

// Survey log (Gate B, B6): the human records candidate objects; unnamed ones get a running
// VOEC-### designation. Compute proposes (the sky, the sensors); the human disposes (records).
interface SurveyEntry {
  id: string; designation: string; objectId: string;
  raDeg: number; decDeg: number; mag: number; sensor: Sensor;
  atYears: number; note: string; createdAtYears: number;
}
const serializeSurvey = (e: SurveyEntry[]) => JSON.stringify(e);
const parseSurvey = (s: string): SurveyEntry[] => { const a = JSON.parse(s); return Array.isArray(a) ? (a as SurveyEntry[]) : []; };
const R2D = 180 / Math.PI;
const uid = () => crypto.randomUUID();
const raOf = (d: Vec3) => ((Math.atan2(d[1], d[0]) * R2D) + 360) % 360;
const decOf = (d: Vec3) => Math.asin(Math.max(-1, Math.min(1, d[2]))) * R2D;
const SPY = SECONDS_PER_JULIAN_YEAR;
const fmtT = (y: number) => {
  const ay = Math.abs(y);
  if (ay < 86400 / SPY) { const h = (y * SPY) / 3600; return Math.abs(h) < 1 ? `${(h * 60).toFixed(1)} min` : `${h.toFixed(2)} h`; }
  if (ay < (60 * 86400) / SPY) return `${(y * 365.25).toFixed(2)} d`;
  return `${y.toLocaleString(undefined, { maximumFractionDigits: ay < 100 ? 2 : 0 })} yr`;
};
const hoursFromNow = (e: number, now: number) => ((e - now) * SPY) / 3600;

// Time scales (years) sec -> millennia, and play rates (years per real second).
const TIME_SCALES: { label: string; years: number }[] = [
  { label: "±1 min", years: 60 / SPY }, { label: "±1 hr", years: 3600 / SPY },
  { label: "±1 day", years: 86400 / SPY }, { label: "±30 days", years: (30 * 86400) / SPY },
  { label: "±1 yr", years: 1 }, { label: "±100 yr", years: 100 }, { label: "±10 kyr", years: 1e4 },
  { label: "±100 kyr", years: 1e5 }, { label: "±1 Myr", years: 1e6 }, { label: "±10 Myr", years: 1e7 },
];
const PLAY_RATES: { label: string; yps: number }[] = [
  { label: "1 hr/s", yps: 3600 / SPY }, { label: "1 day/s", yps: 86400 / SPY },
  { label: "1 mo/s", yps: (30 * 86400) / SPY }, { label: "1 yr/s", yps: 1 }, { label: "100 yr/s", yps: 100 },
];

type WorldClock = { orbitYears: number; rotDays: number; locked: boolean; type: string; name: string };
type SkyEvent = { t: number; label: string; kind: "day" | "conj" | "eclipse" };
type Scan = { from: number; span: number; events: SkyEvent[] };

type Tool = "select" | "angular_distance" | "separation_position_angle" | "alignment" | "figure" | "label";
const TOOL_LABEL: Record<Tool, string> = {
  select: "Select", angular_distance: "Distance", separation_position_angle: "Sep+PA",
  alignment: "Align", figure: "Draw figure", label: "Label",
};
const MEASURE_TOOLS: Tool[] = ["angular_distance", "separation_position_angle", "alignment"];

// Instrument sensors (Gate B, B2). Same real catalog fields, different response curve.
const SENSOR_LABEL: Record<Sensor, string> = {
  visible: "Visible", thermal: "Thermal", proper_motion: "Motion", distance: "Distance", photometric: "Photom.",
};
// Epoch comparator spans (B5): ghost drift tracks of the fastest movers over the span.
const EPOCHS: { label: string; y: number }[] = [
  { label: "off", y: 0 }, { label: "10 kyr", y: 1e4 }, { label: "100 kyr", y: 1e5 }, { label: "1 Myr", y: 1e6 },
];
const SENSOR_LEGEND: Record<Sensor, { cap: string; ramp?: string; ticks?: [string, string] }> = {
  visible: { cap: "Perceptual channel — true star colour (Gaia BP−RP), Reinhard tone-mapped brightness." },
  thermal: { cap: "Thermal / IR — brightness = blackbody K-band (2.2 µm) flux from each star's Teff; cool stars outshine hot ones. Colour by temperature.",
    ramp: "linear-gradient(90deg,#bcd8ff,#fff1bd,#ff6a38)", ticks: ["hot", "cool"] },
  proper_motion: { cap: "Proper motion — angular drift rate (mas/yr), which changes with the vantage; recomputed for this relocation.",
    ramp: "linear-gradient(90deg,#273149,#ff6bec)", ticks: ["slow", "fast"] },
  distance: { cap: "Distance — observer-relative parallax distance after relocation (real Gaia distances).",
    ramp: "linear-gradient(90deg,#ff8c57,#6199ff)", ticks: ["near", "far"] },
  photometric: { cap: "Photometric — linear detector: response ∝ true flux, no perceptual compression. Bright stars saturate, faint fall away (real dynamic range)." },
};

function loadJSON<T>(key: string, parse: (s: string) => T, fallback: T): T {
  try { const s = localStorage.getItem(key); return s ? parse(s) : fallback; } catch { return fallback; }
}

/** Collapsible rail section (minimal UI): a header line + body shown only when open.
 *  The title is its own element so it stays queryable and clicking it toggles the section. */
function Section(props: { title: string; meta?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  return (
    <div className={"sec" + (open ? " on" : "")}>
      <div className="sechead" onClick={() => setOpen((o) => !o)}>
        <span className="caret">{open ? "▾" : "▸"}</span>
        <span className="t">{props.title}</span>
        {props.meta != null && <span className="meta">{props.meta}</span>}
      </div>
      {open && <div className="secbody">{props.children}</div>}
    </div>
  );
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
  const [worldVantage, setWorldVantage] = useState<{ pos: Vec3; label: string; world: World; type: string; worldName: string } | null>(null);
  const [showArrival, setShowArrival] = useState(false);
  const [tYears, setTYears] = useState(0);
  const [scale, setScale] = useState(86400 / SPY); // ±1 day default -- a living sky
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(PLAY_RATES[1]!.yps); // 1 day/s
  const [inertial, setInertial] = useState<InertialStar[]>([]);
  const [inertialEpoch, setInertialEpoch] = useState(0); // sim time the inertial sky was last computed at
  const [epochDelta, setEpochDelta] = useState(0);        // B5 comparator span (0 = off)
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candScanned, setCandScanned] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [pendingLabel, setPendingLabel] = useState<string | null>(null); // anchor id awaiting text
  const [fov, setFov] = useState(60);
  const [exposure, setExposure] = useState(0);
  const [showMilkyWay, setShowMilkyWay] = useState(true);
  const [bodyTrails, setBodyTrails] = useState(false);
  const [scanReq, setScanReq] = useState<{ from: number; span: number } | null>(null);
  const [sensor, setSensor] = useState<Sensor>("visible");
  const [projection, setProjection] = useState<Projection>("gnomonic");
  const [view, setView] = useState<"instrument" | "gallery">("instrument");
  const [ctlOpen, setCtlOpen] = useState(true);
  const [measurements, setMeasurements] = useState<MeasurementDef[]>(() => loadJSON(KEY.meas, parseMeasurements, []));
  const [annotations, setAnnotations] = useState<Annotation[]>(() => loadJSON(KEY.annot, parseAnnotations, []));
  const [notebook, setNotebook] = useState<Notebook>(() => loadJSON(KEY.note, parseNotebook, emptyNotebook()));
  const [survey, setSurvey] = useState<SurveyEntry[]>(() => loadJSON(KEY.survey, parseSurvey, []));
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
  // All bodies of the observed world (host star, moons, siblings), updated every frame.
  const allBodies = useMemo(() => (worldVantage ? worldBodies(worldVantage.world, tYears) : []), [worldVantage, tYears]);
  const bodyMarkers = useMemo(
    () => allBodies.map((b) => ({ dir: b.direction_icrs as Vec3, name: b.name, kind: b.kind, diamDeg: b.angularDiameterDeg, illum: b.illuminatedFraction })),
    [allBodies],
  );
  // host-star glare: the sun (host star) washes out nearby stars when it is above the horizon.
  const sun = useMemo(() => {
    const host = allBodies.find((b) => b.kind === "host_star");
    return host ? { dir: host.direction_icrs as Vec3, altDeg: host.horizontal.altDeg } : null;
  }, [allBodies]);
  const GLARE_DEG = 14;
  // Milky Way band point cloud, oriented by the vantage (recomputed on relocation).
  const mwPoints = useMemo(() => (showMilkyWay ? milkyWayBand(mw) : []), [mw, showMilkyWay]);
  useEffect(() => {
    if (!sessionInfo) return;
    // Freeze Stage-1 (proper motion) when scrubbing/playing at sub-year scales -- only
    // recompute the star field when time has moved far enough to matter. The apparatus +
    // bodies (memos below) update every frame regardless.
    const recomputed = sessionInfo.session.ensureInertial(tYears);
    if (recomputed) { setInertial([...sessionInfo.session.inertial]); setInertialEpoch(tYears); }
  }, [sessionInfo, tYears]);

  // play mode: advance sim time by `rate` years per real second (rAF-driven).
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      setTYears((t) => t + rate * dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, rate]);

  useEffect(() => { localStorage.setItem(KEY.meas, serializeMeasurements(measurements)); }, [measurements]);
  useEffect(() => { localStorage.setItem(KEY.annot, serializeAnnotations(annotations)); }, [annotations]);
  useEffect(() => { localStorage.setItem(KEY.note, serializeNotebook(notebook)); }, [notebook]);
  useEffect(() => { localStorage.setItem(KEY.survey, serializeSurvey(survey)); }, [survey]);

  // World-native time (Gate B, B1): the observed world's own rotation ("day") and orbit
  // ("year") from Kepler III, and whether it is spin-orbit locked (host star never sets).
  const worldClock = useMemo(() => {
    if (!worldVantage) return null;
    const w = worldVantage.world;
    const a = w.planet.orbit.a_au, M = Math.max(w.host_star.mass_msun, 1e-6);
    const orbitYears = Math.sqrt((a * a * a) / M);       // P[yr] = sqrt(a[AU]^3 / M[Msun])
    const orbitSec = orbitYears * SPY, rotSec = w.planet.rotation_period_s;
    const locked = Math.abs(rotSec - orbitSec) / orbitSec < 1e-3;
    return { orbitYears, rotDays: rotSec / 86400, locked, type: worldVantage.type, name: worldVantage.worldName };
  }, [worldVantage]);

  // Body trails (B4): each body's on-sky track over ONE OF ITS OWN periods (so fast moons
  // aren't undersampled), with even-time tick marks whose spacing reads as orbital speed.
  const trailPaths = useMemo(() => {
    if (!worldVantage || !bodyTrails) return [] as { pts: Vec3[]; color: number; ticks: Vec3[] }[];
    const world = worldVantage.world;
    const orbitYears = worldClock ? worldClock.orbitYears : 1;
    const Mp = Math.max(world.planet.mass_mearth * 3.003e-6, 1e-12); // planet mass in Msun
    const colorOf = (k: string) => (k === "host_star" ? 0xffcf6b : k === "moon" ? 0x9fb0c8 : 0x9fc0ff);
    const periodOf = (name: string, kind: string): number => {
      if (kind === "moon") { const m = world.moons.find((mo) => mo.name === name); if (m) return Math.sqrt(m.orbit.a_au ** 3 / Mp); }
      return orbitYears; // host reflex + siblings ~ the planet's orbital period
    };
    const N = 180, tickStep = Math.max(1, Math.round(N / 24));
    const out: { pts: Vec3[]; color: number; ticks: Vec3[] }[] = [];
    for (const id of worldBodies(world, 0).map((b) => ({ name: b.name, kind: b.kind }))) {
      const P = periodOf(id.name, id.kind), pts: Vec3[] = [], ticks: Vec3[] = [];
      for (let i = 0; i <= N; i++) {
        const b = worldBodies(world, (i / N) * P).find((x) => x.name === id.name);
        if (!b) continue;
        pts.push(b.direction_icrs as Vec3);
        if (i % tickStep === 0) ticks.push(b.direction_icrs as Vec3);
      }
      out.push({ pts, color: colorOf(id.kind), ticks });
    }
    return out;
  }, [worldVantage, bodyTrails, worldClock]);

  // Event scanner (B4): on demand, scan a window for the host's rise/set/transit (day/night)
  // and the closest approaches between bodies (conjunctions / occultation-eclipse candidates).
  const scan = useMemo<Scan | null>(() => {
    if (!scanReq || !worldVantage || !apparatus) return null;
    const { from, span } = scanReq, world = worldVantage.world, o = apparatus.o, obs = apparatus.obs;
    const at = (t: number) => worldBodies(world, t);
    const bodiesNow = at(from), events: SkyEvent[] = [];
    const host = bodiesNow.find((b) => b.kind === "host_star");
    if (host) {
      const rst = riseSetOf(o, obs, host.direction_icrs as Vec3, from);
      if (rst.circumpolar) events.push({ t: from, label: `${host.name} never sets — circumpolar`, kind: "day" });
      else if (rst.neverRises) events.push({ t: from, label: `${host.name} never rises — permanent night`, kind: "day" });
      else {
        if (rst.riseYears != null) events.push({ t: rst.riseYears, label: `${host.name} rises — dawn`, kind: "day" });
        if (rst.transitYears != null) events.push({ t: rst.transitYears, label: `${host.name} transits ${rst.transitAltitudeDeg.toFixed(0)}° — local noon`, kind: "day" });
        if (rst.setYears != null) events.push({ t: rst.setYears, label: `${host.name} sets — dusk`, kind: "day" });
      }
    }
    const names = bodiesNow.map((b) => b.name);
    const dirOf = (name: string) => (t: number) => { const b = at(t).find((x) => x.name === name); return b ? (b.direction_icrs as Vec3) : null; };
    const radAt = (name: string, t: number) => { const b = at(t).find((x) => x.name === name); return b ? b.angularDiameterDeg / 2 : 0; };
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const c = findMinSeparation(dirOf(names[i]!), dirOf(names[j]!), from, span);
      if (!c) continue;
      const rSum = radAt(names[i]!, c.timeYears) + radAt(names[j]!, c.timeYears);
      if (c.separationDeg < rSum) events.push({ t: c.timeYears, label: `${names[i]} × ${names[j]} — occultation / eclipse (${c.separationDeg.toFixed(3)}°)`, kind: "eclipse" });
      else if (c.separationDeg < 3) events.push({ t: c.timeYears, label: `${names[i]} × ${names[j]} conjunction — ${c.separationDeg.toFixed(2)}°`, kind: "conj" });
    }
    events.sort((a, b) => a.t - b.t);
    return { from, span, events };
  }, [scanReq, worldVantage, apparatus]);

  const dirById = useMemo(() => new Map(inertial.map((s) => [s.id, s.direction_icrs])), [inertial]);
  const metaById = useMemo(() => new Map(inertial.map((s) => [s.id, s])), [inertial]);
  // Proper motion per star at THIS vantage (mas/yr), from the drift over a fixed baseline.
  // Rectilinear propagation makes the rate epoch-independent, so it's computed once per
  // vantage (not per frame) -- the raw ingredient for the Proper-motion sensor.
  const pmById = useMemo(() => {
    const m = new Map<string, number>();
    if (!sky || !sessionInfo) return m;
    const obs = sessionInfo.observer, D = 250, K = (180 / Math.PI) * 3600 * 1000; // rad -> mas
    for (const s of sky.catalog.stars) {
      const d0 = directionAt(sky, obs, s.id, 0), d1 = directionAt(sky, obs, s.id, D);
      if (!d0 || !d1) continue;
      const dot = Math.max(-1, Math.min(1, d0[0] * d1[0] + d0[1] * d1[1] + d0[2] * d1[2]));
      m.set(s.id, (Math.acos(dot) * K) / D);
    }
    return m;
  }, [sky, sessionInfo]);
  const starPoints: StarPoint[] = useMemo(
    () => inertial.map((s) => ({ dir: s.direction_icrs, mag: s.mag, bp_rp: s.bp_rp, dist: s.distance_pc, pm: pmById.get(s.id) ?? 0 })),
    [inertial, pmById]);

  // Epoch comparator (B5): ghost tracks from each fast mover's current position to where it
  // drifts over the chosen span. Capped to the fastest movers so it stays legible + cheap.
  const driftPaths = useMemo(() => {
    if (!epochDelta || !sky || !sessionInfo) return [] as { pts: Vec3[]; color: number }[];
    const obs = sessionInfo.observer;
    const movers = inertial.filter((s) => (pmById.get(s.id) ?? 0) > 15)
      .sort((a, b) => (pmById.get(b.id) ?? 0) - (pmById.get(a.id) ?? 0)).slice(0, 1500);
    const out: { pts: Vec3[]; color: number }[] = [];
    for (const s of movers) {
      const d1 = directionAt(sky, obs, s.id, inertialEpoch + epochDelta);
      if (d1) out.push({ pts: [s.direction_icrs, d1], color: 0x6f8496 });
    }
    return out;
  }, [epochDelta, sky, sessionInfo, inertial, inertialEpoch, pmById]);

  // B3: propose candidate regularities from what is currently in view. Human triggers it.
  const findCandidates = () => {
    if (!sky) return;
    const vis = new Set(inertial.map((s) => s.id));
    setCandidates([
      ...comovingCandidates(sky.catalog.stars, vis),
      ...alignmentCandidates(inertial),
      ...anomalyCandidates(inertial, pmById),
    ]);
    setCandScanned(true);
  };
  // Star-centric proposal (user request): candidates that involve the selected star.
  const findFromStar = (id: string) => {
    if (!sky) return;
    setCandidates(candidatesFromStar(sky.catalog.stars, inertial, pmById, id));
    setCandScanned(true);
  };

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
    onObserve={(w) => {
      setWorldVantage({ pos: w.host_star.galactic_xyz_pc, label: w.host_star.catalog_id, world: parseWorld(w), type: w.world_type, worldName: w.name });
      setShowArrival(true); setView("instrument");
    }} />;
  if (error) return <div style={{ padding: 24, color: "#ff9" }}>Failed to load: {error}</div>;
  if (!sky) return <div style={{ padding: 24 }}>loading catalog…</div>;

  const focusId = hoverId ?? selection[0] ?? draft[draft.length - 1] ?? null;
  const focusDir = focusId ? dirById.get(focusId) : undefined;
  const focusMeta = focusId ? metaById.get(focusId) : undefined;
  const focusName = focusMeta ? focusMeta.name || focusMeta.id : null;
  const pendingLabelName = pendingLabel ? metaById.get(pendingLabel)?.name || pendingLabel : null;

  // Record the current focus object into the survey log; unnamed stars get the next VOEC-###.
  const recordSurvey = () => {
    if (!focusId || !focusDir || !focusMeta) return;
    const named = !!focusMeta.name && focusMeta.name !== focusMeta.id;
    const n = survey.filter((e) => e.designation.startsWith("VOEC-")).length + 1;
    const designation = named ? focusMeta.name : `VOEC-${String(n).padStart(3, "0")}`;
    setSurvey((s) => [...s, {
      id: uid(), designation, objectId: focusId, raDeg: raOf(focusDir), decDeg: decOf(focusDir),
      mag: focusMeta.mag, sensor, atYears: tYears, note: "", createdAtYears: tYears,
    }]);
  };

  const cap = PROPAGATION_MODELS.rectilinear.honestCapYears;
  const speculative = Math.abs(tYears) > cap;

  return (
    <div className="app">
      <button className="viewtoggle" onClick={() => setView("gallery")}>⊞ World gallery</button>
      {showArrival && worldVantage && worldClock && (
        <ArrivalCard clock={worldClock} hostLabel={worldVantage.label} distPc={Math.hypot(...worldVantage.pos)}
          world={worldVantage.world} onClose={() => setShowArrival(false)} />
      )}
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
        milkyWayPoints={mwPoints} bodies={bodyMarkers} paths={[...trailPaths, ...driftPaths]} sensor={sensor}
        projection={projection} horizonBasis={horizonBasis}
        sun={{ dirIcrs: sun && sun.altDeg > -2 ? sun.dir : null, radiusDeg: GLARE_DEG }}
      />

      <div className="controls">
        <div className="cbar" onClick={() => setCtlOpen((o) => !o)}>
          <span className="t">Instrument</span><span className="caret">{ctlOpen ? "▾ hide" : "▸ controls"}</span>
        </div>
        {ctlOpen && (
          <Toolbar tool={tool} onTool={onTool} vantage={vantage}
            setVantage={(v) => { setVantage(v); setWorldVantage(null); }}
            worldVantageLabel={worldVantage?.label ?? null} onClearWorldVantage={() => setWorldVantage(null)}
            fov={fov} nudgeFov={nudgeFov} exposure={exposure} onExposure={(v) => { setExposure(v); setExposureRef.current(v); }}
            showMilkyWay={showMilkyWay} onMilkyWay={() => setShowMilkyWay((v) => !v)}
            bodyTrails={bodyTrails} onBodyTrails={() => setBodyTrails((v) => !v)} observing={!!worldVantage}
            sensor={sensor} onSensor={setSensor}
            projection={projection} onProjection={setProjection}
            selection={selection} draft={draft}
            onFinishFigure={finishFigure} onMakeGroup={makeGroup} onFinishAlignment={finishAlignment}
            pendingLabelName={pendingLabelName} onSubmitLabel={submitLabel} onCancelLabel={() => setPendingLabel(null)} />
        )}
      </div>

      <aside className="side">
        <Readout o={apparatus?.o} obs={apparatus?.obs} t={tYears} dir={focusDir} meta={focusMeta} sun={sun} glareDeg={GLARE_DEG}
          pm={focusId ? pmById.get(focusId) : undefined} />
        <Section title="Analysis" meta={candidates.length || null} defaultOpen>
          <AnalysisPanel candidates={candidates} scanned={candScanned} onScan={findCandidates}
            anchorId={selection.length === 1 ? selection[0]! : null}
            anchorName={selection.length === 1 ? metaById.get(selection[0]!)?.name || selection[0]! : null}
            onProposeFrom={findFromStar}
            epochDelta={epochDelta} onEpoch={setEpochDelta}
            onSelect={(ids) => { setSelection(ids); setTool("select"); }} />
        </Section>
        <Section title="Event scanner" meta={worldVantage ? scan?.events.length ?? "" : "world only"}>
          <EventScanner scan={scan} worldClock={worldClock} observing={!!worldVantage}
            onScan={(span) => setScanReq({ from: tYears, span })} onJump={(t) => setTYears(t)} />
        </Section>
        <Section title="Measurements" meta={results.length || null}>
          <Measurements results={results} metaById={metaById}
            onDelete={(id) => setMeasurements((m) => m.filter((x) => x.id !== id))} onClear={() => setMeasurements([])} />
        </Section>
        <Section title="Annotations" meta={annotations.length || null}>
          <Annotations annotations={annotations} figures={figures}
            onRename={(id, name) => setAnnotations((a) => a.map((x) => (x.id === id && x.kind !== "label" ? { ...x, name } : x)))}
            onDelete={(id) => setAnnotations((a) => a.filter((x) => x.id !== id))} />
        </Section>
        <Section title="Survey log" meta={survey.length || null}>
          <SurveyPanel entries={survey} focusName={focusName} sensor={sensor} onRecord={recordSurvey}
            onJump={(t, id) => { setTYears(t); setSelection([id]); setTool("select"); }}
            onDelete={(id) => setSurvey((s) => s.filter((e) => e.id !== id))} />
        </Section>
        <Section title="Notebook" meta={(notebook.markers.length + notebook.notes.length) || null}>
          <NotebookPanel notebook={notebook} metaById={metaById} onAddNote={addNote} onAddMarker={addMarker}
            onJump={(t, ids) => { setTYears(t); if (ids?.length) { setSelection(ids); setTool("select"); } }}
            onDeleteNote={(id) => setNotebook((nb) => ({ ...nb, notes: nb.notes.filter((n) => n.id !== id) }))}
            onDeleteMarker={(id) => setNotebook((nb) => ({ ...nb, markers: nb.markers.filter((m) => m.id !== id) }))} />
        </Section>
      </aside>

      <TimeBar t={tYears} scale={scale} setScale={setScale} setT={setTYears} starCount={inertial.length} speculative={speculative}
        playing={playing} onPlay={() => setPlaying((p) => !p)} rate={rate} setRate={setRate} worldClock={worldClock} />
    </div>
  );
}

function Toolbar(props: {
  tool: Tool; onTool: (t: Tool) => void; vantage: Vantage; setVantage: (v: Vantage) => void;
  worldVantageLabel: string | null; onClearWorldVantage: () => void;
  fov: number; nudgeFov: (f: number) => void; exposure: number; onExposure: (v: number) => void;
  showMilkyWay: boolean; onMilkyWay: () => void;
  bodyTrails: boolean; onBodyTrails: () => void; observing: boolean;
  sensor: Sensor; onSensor: (s: Sensor) => void;
  projection: Projection; onProjection: (p: Projection) => void;
  selection: string[]; draft: string[];
  onFinishFigure: (name: string) => void; onMakeGroup: (name: string) => void; onFinishAlignment: () => void;
  pendingLabelName: string | null; onSubmitLabel: (t: string) => void; onCancelLabel: () => void;
}) {
  const [naming, setNaming] = useState<null | "figure" | "group">(null);
  return (
    <div className="ctl">
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
      <div className="row" style={{ marginTop: 6 }}>
        <span className="k">{props.projection === "gnomonic" ? `FOV ${props.fov.toFixed(1)}°`
          : props.projection === "fisheye" ? `fisheye · ${(60 / props.fov).toFixed(1)}×`
          : `dome (all-sky) · ${(60 / props.fov).toFixed(1)}×`}</span>
        <span className="btns"><button onClick={() => props.nudgeFov(1 / 1.4)}>zoom +</button><button onClick={() => props.nudgeFov(1.4)}>zoom −</button></span>
      </div>
      <div className="row" style={{ marginTop: 6 }}><span className="k">exposure {props.exposure >= 0 ? "+" : ""}{props.exposure.toFixed(1)}</span>
        <input type="range" min={-3} max={4} step={0.1} value={props.exposure} onChange={(e) => props.onExposure(Number(e.target.value))} style={{ width: 130 }} />
      </div>
      <div className="row" style={{ marginTop: 6 }}><span className="k">background</span>
        <span className="btns">
          <button className={props.showMilkyWay ? "active" : ""} onClick={props.onMilkyWay}>Milky Way</button>
          <button className={props.bodyTrails ? "active" : ""} onClick={props.onBodyTrails} disabled={!props.observing}
            title="draw each body's on-sky orbit track with even-time tick marks">trails</button>
        </span>
      </div>
      {props.bodyTrails && props.observing && (
        <div className="faint" style={{ fontSize: 10.5, marginTop: 3 }}>trail dots = 1/24 of each body's orbit — bunched = slow, spread = fast.</div>
      )}
      <div className="muted" style={{ marginTop: 8 }}>sensor</div>
      <div className="seg" style={{ display: "flex", marginTop: 4 }}>
        {SENSORS.map((s) => (
          <button key={s} style={{ flex: 1 }} className={props.sensor === s ? "active" : ""}
            onClick={() => props.onSensor(s)}>{SENSOR_LABEL[s]}</button>
        ))}
      </div>
      <div className="legend">
        <div className="cap">{SENSOR_LEGEND[props.sensor].cap}</div>
        {SENSOR_LEGEND[props.sensor].ramp && (
          <>
            <div className="ramp" style={{ background: SENSOR_LEGEND[props.sensor].ramp }} />
            <div className="ticks"><span>{SENSOR_LEGEND[props.sensor].ticks![0]}</span><span>{SENSOR_LEGEND[props.sensor].ticks![1]}</span></div>
          </>
        )}
      </div>
      <div className="row" style={{ marginTop: 8 }}><span className="k">projection</span>
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

function Readout(props: { o?: PlanetOrientation; obs?: GeoObserver; t: number; dir?: Vec3; meta?: InertialStar; sun: { dir: Vec3; altDeg: number } | null; glareDeg: number; pm?: number }) {
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
      {props.pm != null && <div className="row"><span className="k">proper motion</span><span className="v">{props.pm < 1000 ? `${props.pm.toFixed(1)} mas/yr` : `${(props.pm / 1000).toFixed(2)} ″/yr`}</span></div>}
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
    <>
      {props.results.length > 0 && <div style={{ marginBottom: 6 }}><button className="x" onClick={props.onClear}>clear all</button></div>}
      {props.results.length === 0 && <div className="muted">pick a measure tool, click two stars</div>}
      <div className="mlist">
        {props.results.map((r) => (
          <div key={r.id} className={"mitem" + (r.ok ? "" : " broken")}>
            <div className="top"><span className="val">{measureValue(r)}</span><button className="x" onClick={() => props.onDelete(r.id)}>✕</button></div>
            <div className="ids">{r.kind.replace(/_/g, " ")} · {r.objectIds.map(name).join(" — ")}{!r.ok && ` (missing ${r.missing.join(", ")})`}</div>
          </div>
        ))}
      </div>
    </>
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
  if (props.annotations.length === 0) return <div className="muted">draw figures, pin labels, group stars</div>;
  return (
    <>
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
    </>
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
    <>
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
    </>
  );
}

function TimeBar(props: {
  t: number; scale: number; setScale: (s: number) => void; setT: (t: number) => void; starCount: number; speculative: boolean;
  playing: boolean; onPlay: () => void; rate: number; setRate: (r: number) => void; worldClock: WorldClock | null;
}) {
  const wc = props.worldClock;
  const localYr = wc ? props.t / wc.orbitYears : 0;
  const wcTip = wc && (wc.locked
    ? `Spin-orbit locked: the host star hangs at a fixed point in the sky — no sunrise or sunset. A rotation equals one orbit (${wc.rotDays.toFixed(0)} d), so there is no solar day.`
    : `Local day ${wc.rotDays.toFixed(2)} d · local year ${wc.orbitYears.toFixed(2)} yr (Kepler from a and host mass).`);
  return (
    <div className="timebar">
      <button className={props.playing ? "active" : ""} onClick={props.onPlay} title="play / pause">{props.playing ? "❚❚" : "▶"}</button>
      <select value={props.rate} onChange={(e) => props.setRate(Number(e.target.value))} title="play rate">
        {PLAY_RATES.map((r) => <option key={r.label} value={r.yps}>{r.label}</option>)}
      </select>
      <span className={"clock" + (props.speculative ? " spec" : "")}>t = {fmtT(props.t)}{props.speculative ? " ⚠" : ""}</span>
      {wc && (
        <span className="muted" title={wcTip} style={{ whiteSpace: "nowrap" }}>
          · {localYr.toFixed(2)} local-yr {wc.locked && <b style={{ color: "var(--warn)" }}>◑ tide-locked</b>}
        </span>
      )}
      <input type="range" min={-1000} max={1000} step={0.5} value={Math.max(-1000, Math.min(1000, (props.t / props.scale) * 1000))}
        onChange={(e) => props.setT((Number(e.target.value) / 1000) * props.scale)} />
      <select value={props.scale} onChange={(e) => props.setScale(Number(e.target.value))}>
        {TIME_SCALES.map((s) => <option key={s.label} value={s.years}>{s.label}</option>)}
      </select>
      <button onClick={() => props.setT(0)}>now</button>
      <span className="muted">{props.starCount} stars</span>
    </div>
  );
}

/** Arrival card (B7): the moment of relocating to a world — where you are, in its terms. */
function ArrivalCard(props: { clock: WorldClock; hostLabel: string; distPc: number; world: World; onClose: () => void }) {
  const w = props.world, wc = props.clock;
  return (
    <div className="arrival card" style={{ width: 344, padding: "12px 14px", background: "var(--panel)", boxShadow: "0 10px 34px rgba(0,0,0,.6)" }}>
      <div className="chead" style={{ marginBottom: 8 }}>
        <span style={{ letterSpacing: ".16em", textTransform: "uppercase", fontSize: 10, color: "var(--muted)" }}>◆ Arrival</span>
        <button className="x" onClick={props.onClose}>×</button>
      </div>
      <div style={{ fontSize: 15, color: "var(--ink)" }}>{wc.name}</div>
      <div className="muted" style={{ margin: "1px 0 9px" }}>{wc.type.replace(/_/g, " ")} · orbiting {props.hostLabel}</div>
      <div className="row"><span className="k">distance from Sol</span><span className="v">{props.distPc.toFixed(2)} pc</span></div>
      <div className="row"><span className="k">host star</span><span className="v">{w.host_star.mass_msun.toFixed(2)} M☉ · {Math.round(w.host_star.teff_k)} K</span></div>
      <div className="row"><span className="k">local year</span><span className="v">{wc.orbitYears.toFixed(2)} yr</span></div>
      <div className="row"><span className="k">local day</span><span className="v">{wc.locked ? "— tide-locked" : `${wc.rotDays.toFixed(2)} d`}</span></div>
      <div className="row"><span className="k">moons</span><span className="v">{w.moons.length}</span></div>
      <div className="muted" style={{ marginTop: 9, fontSize: 11, lineHeight: 1.45 }}>
        The sky below is this world's — the real catalog, relocated to its host.{wc.locked ? " Its star never sets." : ""}
      </div>
    </div>
  );
}

/** Analysis (B3 + B5): the epoch comparator (ghost drift over a span) and candidate
 *  regularities (co-moving groups, alignments, anomalies). Everything here is a proposal —
 *  the human selects, confirms, names, records. Compute never authors a finished pattern. */
function AnalysisPanel(props: {
  candidates: Candidate[]; scanned: boolean; onScan: () => void;
  anchorId: string | null; anchorName: string | null; onProposeFrom: (id: string) => void;
  epochDelta: number; onEpoch: (y: number) => void; onSelect: (ids: string[]) => void;
}) {
  return (
    <>
      <div className="muted">epoch drift</div>
      <div className="seg" style={{ display: "flex", marginTop: 4 }}>
        {EPOCHS.map((e) => (
          <button key={e.label} style={{ flex: 1 }} className={props.epochDelta === e.y ? "active" : ""}
            onClick={() => props.onEpoch(e.y)}>{e.label}</button>
        ))}
      </div>
      <div className="faint" style={{ marginTop: 4, fontSize: 10.5 }}>ghost tracks — where the fastest movers drift over the span.</div>
      <hr className="hair" />
      <div className="btns">
        {props.anchorId
          ? <button onClick={() => props.onProposeFrom(props.anchorId!)} title="propose candidates that involve the selected star">◇ propose from {props.anchorName}</button>
          : <span className="muted">select one star to propose from it</span>}
        <button onClick={props.onScan} title="scan the whole field for regularities">scan field</button>
      </div>
      {props.scanned && props.candidates.length === 0 && <div className="muted" style={{ marginTop: 8 }}>no candidates found</div>}
      {props.candidates.length > 0 && (
        <div className="mlist" style={{ marginTop: 8 }}>
          {props.candidates.map((c) => (
            <div key={c.key} className="mitem">
              <div className="top">
                <button className="link" onClick={() => props.onSelect(c.objectIds)}>{c.label}</button>
                <span className="faint" style={{ fontSize: 10.5, whiteSpace: "nowrap" }}>{c.kind}</span>
              </div>
              <div className="ids">{c.detail}</div>
            </div>
          ))}
        </div>
      )}
      <div className="faint" style={{ marginTop: 7, fontSize: 10.5, lineHeight: 1.4 }}>
        candidates only — compute proposes, you dispose. Select to inspect; record what you confirm.
      </div>
    </>
  );
}

/** Event scanner (B4): on-demand rise/set (day-night) + body closest approaches, as
 *  candidate events the human can jump to. Nothing is auto-named. */
function EventScanner(props: {
  scan: Scan | null; worldClock: WorldClock | null; observing: boolean;
  onScan: (span: number) => void; onJump: (t: number) => void;
}) {
  if (!props.observing) return <div className="muted">observe a world to scan its sky</div>;
  const yr = props.worldClock?.orbitYears ?? 1;
  const daySpan = props.worldClock && !props.worldClock.locked ? props.worldClock.rotDays / 365.25 : yr;
  const KIND: Record<SkyEvent["kind"], string> = { day: "day/night", conj: "conjunction", eclipse: "eclipse" };
  return (
    <>
      <div className="btns">
        <button onClick={() => props.onScan(daySpan)} title="rise/set/transit + approaches over the next local day">scan next day</button>
        <button onClick={() => props.onScan(yr)} title="approaches over the next local year">next year</button>
      </div>
      {props.scan && (props.scan.events.length === 0
        ? <div className="muted" style={{ marginTop: 8 }}>no rise/set or close approaches in this window</div>
        : <div className="mlist" style={{ marginTop: 8 }}>
            {props.scan.events.map((e, i) => (
              <div key={i} className="mitem">
                <div className="top">
                  <button className="link" onClick={() => props.onJump(e.t)}>{e.label}</button>
                  <span className="faint" style={{ fontSize: 10.5, whiteSpace: "nowrap" }}>{KIND[e.kind]}</span>
                </div>
                <div className="ids">t+{fmtT(e.t - props.scan!.from)}</div>
              </div>
            ))}
          </div>)}
      <div className="faint" style={{ marginTop: 7, fontSize: 10.5, lineHeight: 1.4 }}>candidates — computed rise/set &amp; closest approaches; confirm by eye.</div>
    </>
  );
}

/** Survey log (B6): the human's record of candidate objects. Unnamed → VOEC-###. */
function SurveyPanel(props: {
  entries: SurveyEntry[]; focusName: string | null; sensor: Sensor;
  onRecord: () => void; onJump: (t: number, id: string) => void; onDelete: (id: string) => void;
}) {
  return (
    <>
      {props.focusName
        ? <button onClick={props.onRecord} title="add the focused object to the survey log">+ record “{props.focusName}” · {SENSOR_LABEL[props.sensor]}</button>
        : <div className="muted">hover or select an object to record it</div>}
      {props.entries.length > 0 && (
        <div className="mlist" style={{ marginTop: 8 }}>
          {props.entries.slice().reverse().map((e) => (
            <div key={e.id} className="mitem">
              <div className="top">
                <button className="link" onClick={() => props.onJump(e.atYears, e.objectId)}>{e.designation}</button>
                <span className="faint" style={{ fontSize: 11 }}>{e.sensor}<button className="x" onClick={() => props.onDelete(e.id)}>✕</button></span>
              </div>
              <div className="ids">{e.raDeg.toFixed(2)}° / {e.decDeg.toFixed(2)}° · m{e.mag.toFixed(1)} · {fmtT(e.atYears)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
