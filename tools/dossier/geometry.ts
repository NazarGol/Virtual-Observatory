// Dossier geometry helpers (Phase 8 Gate B). Pure computation over the engine's public
// surface -- no rendering, no LLM, no invented facts. Every function here traces back to a
// named engine query (see the footer each dossier section prints); this file adds only the
// SCAN/AGGREGATION logic the engine doesn't already provide (season clustering, resonance
// detection, heliacal-visibility criteria, etc.), built entirely from engine primitives.
import {
  keplerPosition, worldBodies, planetOrientation, findRiseSetTransit, findMinSeparation,
  inertialToHorizontal, greatCircleDeg, relocateStar, galacticToIcrs, helioToGalcen,
  galactocentricToIcrs, raDecToVec, MEARTH_PER_MSUN,
  type World, type Moon, type CatalogStar, type Vec3, type PlanetOrientation as POrient,
  type GeoObserver, type ApparentBody,
} from "../../packages/engine/src/index.js";

export const SPY = 31_557_600; // seconds per Julian year (matches the engine's constant)
export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;

export interface Site { latDeg: number; lonDeg: number; label: string; elevation_m?: number }

// --- basic world-native units ---------------------------------------------------------

/** The planet's own orbital period, in Julian years (Kepler III: P = sqrt(a^3 / M)). */
export function orbitYears(world: World): number {
  const a = world.planet.orbit.a_au, M = Math.max(world.host_star.mass_msun, 1e-9);
  return Math.sqrt((a * a * a) / M);
}

/** SIDEREAL rotation period, in days (seconds -> days): one rotation relative to the
 *  inertial frame -- the schema's own rotation_period_s. NOT the calendar day; see
 *  solarDayYears below for that. */
export function rotationDays(world: World): number { return world.planet.rotation_period_s / 86400; }
export function isLocked(world: World): boolean {
  const rot = world.planet.rotation_period_s, orb = orbitYears(world) * SPY;
  return Math.abs(rot - orb) / orb < 1e-3;
}

/** The world's SOLAR day (sunrise-to-sunrise), in years -- the correct "1 local day" unit
 *  for every calendar fact (day:year ratio, moon periods in local days, event spacing...).
 *  Distinct from the sidereal rotation period: a planet completes one extra sidereal spin
 *  per year relative to the stars versus relative to its own sun (Earth: 366.25 sidereal
 *  rotations per year but 365.25 solar days -- the textbook synodic-day relation, reused
 *  here via the same synodicYears() formula). Null for a locked world (rotation == orbit:
 *  no distinct solar day exists -- see isLocked / section 2's "no day" case). */
export function solarDayYears(world: World): number | null {
  return synodicYears(world.planet.rotation_period_s / SPY, orbitYears(world));
}

/** Convert a span of years to LOCAL (solar) days, or null if the world is locked (no local
 *  day exists -- callers should fall back to hours/real-Julian-days, explicitly labeled). */
export function toLocalDays(world: World, years: number): number | null {
  const day = solarDayYears(world);
  return day == null ? null : years / day;
}

/** A moon's own orbital period around the planet, in Julian years. */
export function moonPeriodYears(world: World, moon: Moon): number {
  const Mplanet = Math.max(world.planet.mass_mearth / MEARTH_PER_MSUN, 1e-15);
  return Math.sqrt((moon.orbit.a_au ** 3) / Mplanet);
}

/** Synodic period of a moon relative to the host star (its PHASE cycle), in years:
 *  1/Psyn = |1/Psid - 1/Pyear|. When the two periods coincide (Pyear -> Psid) the moon
 *  never loses lock with the sun's apparent motion and the synodic period is undefined. */
export function synodicYears(pSiderealYears: number, pOuterYears: number): number | null {
  const diff = Math.abs(1 / pSiderealYears - 1 / pOuterYears);
  return diff < 1e-12 ? null : 1 / diff;
}

// --- site-relative sky geometry ---------------------------------------------------------

/** Rise/set/transit + horizontal classification for a fixed inertial direction at a site. */
export function riseSetClass(dir: Vec3, o: POrient, site: GeoObserver, tYears: number) {
  const rst = findRiseSetTransit(dir, o, site, tYears);
  const visibility = rst.circumpolar ? "circumpolar" : rst.neverRises ? "never rises" : "rises and sets";
  return { rst, visibility };
}

/** Rise/set AZIMUTHS (degrees) for a fixed direction at a site, or null if it doesn't
 *  rise/set (circumpolar or never-rising). */
export function riseSetAzimuths(dir: Vec3, o: POrient, site: GeoObserver, tYears: number):
  { riseAzDeg: number; setAzDeg: number } | null {
  const rst = findRiseSetTransit(dir, o, site, tYears);
  if (rst.riseYears == null || rst.setYears == null) return null;
  return {
    riseAzDeg: inertialToHorizontal(dir, o, site, rst.riseYears).azDeg,
    setAzDeg: inertialToHorizontal(dir, o, site, rst.setYears).azDeg,
  };
}

/** The "declination" of a direction in the PLANET's own equatorial frame (i.e. what
 *  latitude circle it passes through zenith on, as the planet rotates). Used for zenith
 *  stars and the pole search -- both are properties of the planet's spin frame, not the
 *  observer's momentary horizontal frame. */
export function planetFrameDecDeg(o: POrient, dir: Vec3): number {
  const pole = raDecToVec(o.northPoleRaDeg, o.northPoleDecDeg);
  const dot = pole[0] * dir[0] + pole[1] * dir[1] + pole[2] * dir[2];
  return Math.asin(Math.max(-1, Math.min(1, dot))) * R2D;
}

// --- the host star's position over an orbit (calendar facts) ---------------------------

/** Direction to the host star from the planet at time t (ICRS unit vector). */
export function sunDirAt(world: World, tYears: number): Vec3 {
  const bodies = worldBodies(world, tYears);
  const host = bodies.find((b) => b.kind === "host_star");
  if (!host) throw new Error("world has no host_star body");
  return host.direction_icrs as Vec3;
}

/** The host star's ecliptic longitude (degrees, [0,360)) at time t. The planet's orbital
 *  plane is the reference ("ecliptic"); worldgen always builds it at i=0, Omega=0 (the ICRS
 *  x-y plane), which is also the plane moon inclinations/nodes are measured against, so this
 *  reduces to a plain atan2 in ICRS x/y. (Documented assumption: planet orbit inclination 0,
 *  true for every world in this repo, generated or hand-authored Sol.) */
export function sunEclipticLonDeg(world: World, tYears: number): number {
  const d = sunDirAt(world, tYears);
  return ((Math.atan2(d[1], d[0]) * R2D) + 360) % 360;
}

/** The host star's declination in the PLANET's own equatorial (spin) frame at time t -- this
 *  is the quantity that peaks at the solstices and crosses zero at the equinoxes. */
export function sunPlanetDecDeg(world: World, tYears: number): number {
  return planetFrameDecDeg(planetOrientation(world), sunDirAt(world, tYears));
}

/** Scan one full orbit for the host star's planet-frame declination extrema (solstices) and
 *  zero-crossings (equinoxes). Returns each as {tYears, kind}. Coarse grid + refine. */
export function findSolsticesEquinoxes(world: World, fromYears = 0): {
  summerSolstice: number; winterSolstice: number; equinox1: number; equinox2: number;
} {
  const P = orbitYears(world), N = 360;
  const f = (t: number) => sunPlanetDecDeg(world, t);
  let maxT = fromYears, minT = fromYears, maxV = -Infinity, minV = Infinity;
  const samples: { t: number; v: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const t = fromYears + (i / N) * P, v = f(t);
    samples.push({ t, v });
    if (v > maxV) { maxV = v; maxT = t; }
    if (v < minV) { minV = v; minT = t; }
  }
  const refine = (t0: number) => goldenMax((t) => f(t), t0 - P / N, t0 + P / N);
  const refineMin = (t0: number) => goldenMax((t) => -f(t), t0 - P / N, t0 + P / N);
  const zeros: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!, b = samples[i]!;
    if ((a.v < 0) !== (b.v < 0)) zeros.push(bisect((t) => f(t), a.t, b.t));
  }
  return {
    summerSolstice: refine(maxT), winterSolstice: refineMin(minT),
    equinox1: zeros[0] ?? fromYears, equinox2: zeros[1] ?? fromYears + P / 2,
  };
}

function bisect(f: (t: number) => number, t0: number, t1: number, iters = 60): number {
  let a = t0, b = t1, fa = f(a);
  for (let k = 0; k < iters; k++) {
    const m = 0.5 * (a + b), fm = f(m);
    if (fa < 0 !== fm < 0) b = m; else { a = m; fa = fm; }
  }
  return 0.5 * (a + b);
}
function goldenMax(f: (t: number) => number, t0: number, t1: number, iters = 60): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let a = t0, b = t1, c = b - g * (b - a), d = a + g * (b - a), fc = f(c), fd = f(d);
  for (let k = 0; k < iters; k++) {
    if (fc > fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = f(c); }
    else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = f(d); }
  }
  return 0.5 * (a + b);
}

/** Day-length + rise-azimuth range at a site over one orbit (the "Chankillo span" for the
 *  host star). For each of N points across the orbital year, treat the host star's direction
 *  as fixed over ONE rotation (a day << year for any non-locked world) and run a rise/set
 *  scan -- this is the same approximation real horizon astronomy uses for "today's sunrise". */
export function siteYearScan(world: World, site: GeoObserver, N = 96): {
  minDayHours: number; maxDayHours: number; minDayT: number; maxDayT: number;
  minRiseAz: number; maxRiseAz: number; anyCircumpolarDay: boolean; anyPolarNight: boolean;
} {
  const o = planetOrientation(world), P = orbitYears(world), rotYears = world.planet.rotation_period_s / SPY;
  let minH = Infinity, maxH = -Infinity, minT = 0, maxT = 0, minAz = Infinity, maxAz = -Infinity;
  let anyCircum = false, anyPolarNight = false;
  for (let i = 0; i < N; i++) {
    const t0 = (i / N) * P;
    const dir = sunDirAt(world, t0);
    const rst = findRiseSetTransit(dir, o, site, t0);
    if (rst.circumpolar) { anyCircum = true; continue; }
    if (rst.neverRises) { anyPolarNight = true; continue; }
    // findRiseSetTransit returns whichever crossing falls first in [t0, t0+period]; if the
    // star is already up at t0 that's "set" before "rise", so the night (not the day) is the
    // simple difference -- day length is the complement over the rotation period.
    const period = o.rotationPeriodSeconds / SPY;
    const hours = ((rst.riseYears! < rst.setYears! ? rst.setYears! - rst.riseYears! : period - (rst.riseYears! - rst.setYears!)) * SPY) / 3600;
    if (hours < minH) { minH = hours; minT = t0; }
    if (hours > maxH) { maxH = hours; maxT = t0; }
    // refine the rise direction at the actual rise moment for an accurate azimuth
    const dirAtRise = sunDirAt(world, rst.riseYears!);
    const az = inertialToHorizontal(dirAtRise, o, site, rst.riseYears!).azDeg;
    if (az < minAz) minAz = az;
    if (az > maxAz) maxAz = az;
  }
  return {
    minDayHours: Number.isFinite(minH) ? minH : NaN, maxDayHours: Number.isFinite(maxH) ? maxH : NaN,
    minDayT: minT, maxDayT: maxT,
    minRiseAz: Number.isFinite(minAz) ? minAz : NaN, maxRiseAz: Number.isFinite(maxAz) ? maxAz : NaN,
    anyCircumpolarDay: anyCircum, anyPolarNight: anyPolarNight,
  };
  void rotYears; // (kept for documentation of the day<<year approximation; not itself used)
}

// --- moons: resonance + eclipse seasons -------------------------------------------------

export interface MoonFacts {
  name: string; periodYears: number; periodLocalDays: number | null;
  synodicYears: number | null; synodicLocalDays: number | null; incDeg: number; e: number;
  angDiamMinDeg: number; angDiamMaxDeg: number;
}

export function moonFacts(world: World, moon: Moon): MoonFacts {
  const P = moonPeriodYears(world, moon), syn = synodicYears(P, orbitYears(world));
  const peri = moon.orbit.a_au * (1 - moon.orbit.e), apo = moon.orbit.a_au * (1 + moon.orbit.e);
  const AU_KM = 1.495978707e8;
  const angDiam = (distAu: number) => 2 * Math.atan((moon.radius_km / AU_KM) / distAu) * R2D;
  return {
    name: moon.name, periodYears: P, periodLocalDays: toLocalDays(world, P),
    synodicYears: syn, synodicLocalDays: syn == null ? null : toLocalDays(world, syn),
    incDeg: moon.orbit.i_deg, e: moon.orbit.e,
    angDiamMinDeg: angDiam(apo), angDiamMaxDeg: angDiam(peri),
  };
}

/** Near-integer period ratios between adjacent moons (by semi-major axis), the "chord". */
export function resonanceChord(world: World): { a: string; b: string; ratio: number; nearest: string | null }[] {
  const moons = [...world.moons].sort((x, y) => x.orbit.a_au - y.orbit.a_au);
  const out: { a: string; b: string; ratio: number; nearest: string | null }[] = [];
  for (let i = 1; i < moons.length; i++) {
    const p1 = moonPeriodYears(world, moons[i - 1]!), p2 = moonPeriodYears(world, moons[i]!);
    const ratio = p2 / p1;
    let nearest: string | null = null, best = 0.05;
    for (const [n, d] of [[2, 1], [3, 2], [3, 1], [4, 3], [5, 2], [5, 3]] as [number, number][]) {
      const target = n / d, err = Math.abs(ratio - target) / target;
      if (err < best) { best = err; nearest = `${n}:${d}`; }
    }
    out.push({ a: moons[i - 1]!.name, b: moons[i]!.name, ratio, nearest });
  }
  return out;
}

/** Recurrence interval of the FULL multi-moon configuration: the smallest T (years) such
 *  that every moon returns close to its starting orbital phase simultaneously. Found by
 *  searching multiples of the longest moon's period for the one where every OTHER moon's
 *  accumulated phase is also near-integer (a numeric LCM over real-valued periods). */
export function alignmentRecurrenceYears(world: World, tolDeg = 3, maxMultiple = 5000): number | null {
  if (world.moons.length < 2) return null;
  const periods = world.moons.map((m) => moonPeriodYears(world, m));
  const longest = Math.max(...periods);
  for (let k = 1; k <= maxMultiple; k++) {
    const T = longest * k;
    const ok = periods.every((p) => {
      const cycles = T / p, frac = cycles - Math.round(cycles);
      return Math.abs(frac) * 360 < tolDeg;
    });
    if (ok) return T;
  }
  return null;
}

export interface EclipseEvent { tYears: number; a: string; b: string; sepDeg: number; kind: "occultation" | "conjunction" | "near" }
export interface EclipseSeason { startYears: number; endYears: number; events: EclipseEvent[]; closestSepDeg: number }

/** Angular radius (deg) of a body of the given km radius at AU distance dist. */
function angRadiusDeg(radiusKm: number, distAu: number): number {
  const AU_KM = 1.495978707e8;
  return Math.atan((radiusKm / AU_KM) / Math.max(distAu, 1e-9)) * R2D;
}

/** Scan for host-star x moon occultation/eclipse events over spanYears, using the analytic
 *  node-crossing structure (Fix: the sun's ecliptic longitude sweeps 360 deg once per
 *  ORBITAL year, so it crosses a moon's two nodes at a computable, small number of times --
 *  eclipse SEASONS are keyed to the PLANET's year, not the moon's short period). Around each
 *  crossing, a narrow window is scanned at moon-orbit resolution for the actual events. */
export function scanEclipseSeasons(world: World, spanYears: number, moon: Moon): EclipseSeason[] {
  const P = orbitYears(world), Pmoon = moonPeriodYears(world, moon);
  const nodeLons = [moon.orbit.Omega_deg, (moon.orbit.Omega_deg + 180) % 360];
  // find every time in [0, spanYears] where the sun's ecliptic longitude crosses a node
  const crossings: number[] = [];
  const NGRID = Math.max(24, Math.ceil((spanYears / P) * 24));
  for (const nodeLon of nodeLons) {
    const f = (t: number) => {
      let d = sunEclipticLonDeg(world, t) - nodeLon;
      d = ((d + 540) % 360) - 180; // wrap to [-180, 180)
      return d;
    };
    let prevT = 0, prevV = f(0);
    for (let i = 1; i <= NGRID; i++) {
      const t = (i / NGRID) * spanYears, v = f(t);
      if ((prevV < 0) !== (v < 0) && Math.abs(v - prevV) < 180) crossings.push(bisect(f, prevT, t));
      prevT = t; prevV = v;
    }
  }
  crossings.sort((a, b) => a - b);
  // around each crossing, enumerate real events at moon-orbit resolution
  // Cap the window well below the ~P/2 spacing between the two nodes -- otherwise a moon
  // whose own period is a non-negligible FRACTION of the planet's year (e.g. a real-Moon-like
  // case, Pmoon/P ~ 0.075) makes 6*Pmoon balloon past half the orbit, so the two nodes'
  // search windows overlap and their events get merged into one bloated "season". 0.2*P keeps
  // real separation from the other node (>=0.1*P clearance) while still being generous
  // relative to any realistic eclipse-limit season width.
  const halfWindow = Math.min(0.2 * P, Math.max(6 * Pmoon, 0.02 * P));
  const dirMoon = (t: number) => { const b = worldBodies(world, t).find((x) => x.name === moon.name); return b ? b.direction_icrs as Vec3 : null; };
  const dirHost = (t: number) => sunDirAt(world, t);
  const classify = (sepDeg: number, distAu: number, hostDistAu: number): EclipseEvent["kind"] | null => {
    const R_SUN_KM = 6.957e5;
    const rMoon = angRadiusDeg(moon.radius_km, distAu), rHostDeg = angRadiusDeg(world.host_star.radius_rsun * R_SUN_KM, hostDistAu);
    if (sepDeg < rMoon + rHostDeg) return "occultation";
    if (sepDeg < 3) return "conjunction";
    if (sepDeg < 20) return "near"; // informational: geometrically close, not visually notable
    return null;
  };
  // A SEASON is a real astronomical structure keyed to the sun's proximity to a node -- it
  // exists (twice per orbital year) whether or not any pass within it happens to be tight
  // enough to be a "conjunction"/"occultation". Each crossing gets exactly one season entry,
  // anchored on its closest per-orbit approach; any tighter passes nearby are recorded as
  // events within it. (Earlier version gated season EXISTENCE on hitting a fixed 3 deg bar,
  // which silently dropped real seasons whose closest pass fell just outside it -- see the
  // git history for the investigation.)
  const seasons: EclipseSeason[] = [];
  for (const tc of crossings) {
    const from = Math.max(0, tc - halfWindow), to = Math.min(spanYears, tc + halfWindow);
    if (to <= from) continue;
    // Per-orbit local minima: step in windows sized to Pmoon (with a safety margin), NOT
    // span/nOrbits -- a window narrower than one true orbital period can split the real
    // per-orbit minimum across a boundary, so findMinSeparation sees only the (elevated) edge
    // value on each side and misses the true close approach entirely. A 1.2x-Pmoon window,
    // stepped by Pmoon so windows overlap, guarantees every true minimum sits in some
    // window's interior.
    const winWidth = Pmoon * 1.2;
    const passes: { tYears: number; sepDeg: number; kind: EclipseEvent["kind"] | null }[] = [];
    for (let wf = from; wf < to; wf += Pmoon) {
      const wt = Math.min(to, wf + winWidth);
      const c = findMinSeparation(dirMoon, dirHost, wf, wt - wf, 24);
      if (!c) continue;
      const bodiesAtC = worldBodies(world, c.timeYears);
      const distAu = bodiesAtC.find((x) => x.name === moon.name)?.distance_au ?? 1;
      const hostDistAu = bodiesAtC.find((x) => x.kind === "host_star")?.distance_au ?? 1;
      passes.push({ tYears: c.timeYears, sepDeg: c.separationDeg, kind: classify(c.separationDeg, distAu, hostDistAu) });
    }
    if (passes.length === 0) continue;
    // de-duplicate near-identical minima from overlapping windows
    passes.sort((a, b) => a.tYears - b.tYears);
    const dedup: typeof passes = [];
    for (const p of passes) {
      const last = dedup[dedup.length - 1];
      if (last && Math.abs(p.tYears - last.tYears) < Pmoon * 0.5) { if (p.sepDeg < last.sepDeg) dedup[dedup.length - 1] = p; continue; }
      dedup.push(p);
    }
    const events: EclipseEvent[] = dedup.filter((p): p is typeof p & { kind: EclipseEvent["kind"] } => p.kind != null)
      .map((p) => ({ tYears: p.tYears, a: moon.name, b: "host", sepDeg: p.sepDeg, kind: p.kind }));
    const closest = dedup.reduce((m, p) => Math.min(m, p.sepDeg), Infinity);
    const times = events.length ? events.map((e) => e.tYears) : [dedup.reduce((b, p) => (p.sepDeg < b.sepDeg ? p : b)).tYears];
    seasons.push({ startYears: Math.min(...times), endYears: Math.max(...times), events, closestSepDeg: closest });
  }
  return seasons;
}

// --- catalog / star-field queries --------------------------------------------------------

export interface SkyStar { id: string; name: string; dir: Vec3; mag: number; bp_rp: number; distance_pc: number }

/** Stars within this PHYSICAL distance (pc) of the relocation origin are dropped as
 *  catalog-duplicate detections of the HOST ITSELF, not distinct background stars. Found
 *  while building this tool: the source catalog carries cross-matched HIP/Gaia rows for the
 *  same physical star at very slightly different baked positions (observed gap: ~0.065 pc
 *  for one host), which the engine's own exact-zero check (relocateStar returns null only
 *  at distance===0) does not catch -- the near-duplicate reappears as an impossible,
 *  point-blank "star". 0.1 pc (~20,600 AU) safely covers that gap while remaining far
 *  tighter than any real unrelated star's separation in a 10^4-star, 300 pc catalog, so a
 *  genuine close companion is not the concern this guards against. */
export const HOST_DUPLICATE_EXCLUSION_PC = 0.1;

export interface RelocatedStars { stars: SkyStar[]; excludedNearHost: number }

/** The whole catalog relocated to (origin_pc, tYears) as ICRS directions -- pure Stage-1, no
 *  session/caching machinery needed for an offline one-shot tool. Drops catalog rows within
 *  HOST_DUPLICATE_EXCLUSION_PC of the origin (see above) and reports how many were dropped,
 *  so the exclusion is auditable rather than silent. */
export function relocatedStars(catalog: CatalogStar[], originPc: Vec3, tYears: number): RelocatedStars {
  const out: SkyStar[] = [];
  let excludedNearHost = 0;
  for (const s of catalog) {
    const dPc = Math.hypot(s.pos_pc[0] - originPc[0], s.pos_pc[1] - originPc[1], s.pos_pc[2] - originPc[2]);
    if (dPc > 0 && dPc < HOST_DUPLICATE_EXCLUSION_PC) { excludedNearHost++; continue; }
    const r = relocateStar(s, { origin_pc: originPc, vel_kms: [0, 0, 0] }, tYears);
    if (!r) continue; // exact coincidence with the origin (distance_pc === 0)
    out.push({ id: r.id, name: r.name || r.id, dir: galacticToIcrs(r.direction_gal), mag: r.mag, bp_rp: r.bp_rp, distance_pc: r.distance_pc });
  }
  return { stars: out, excludedNearHost };
}

export const brightest = (stars: SkyStar[], n: number): SkyStar[] =>
  [...stars].sort((a, b) => a.mag - b.mag).slice(0, n);

/** Nearest naked-eye (mag <= limit) star to a pole direction, or null if none within cap. */
export function nearestToPole(stars: SkyStar[], poleDir: Vec3, magLimit = 6.0, capDeg = 20): { star: SkyStar; sepDeg: number } | null {
  let best: SkyStar | null = null, bestSep = Infinity;
  for (const s of stars) {
    if (s.mag > magLimit) continue;
    const sep = greatCircleDeg(s.dir, poleDir);
    if (sep < bestSep) { bestSep = sep; best = s; }
  }
  return best && bestSep <= capDeg ? { star: best, sepDeg: bestSep } : null;
}

/** Tight naked-eye groupings (pairs) within maxSepDeg among the given stars. Listed neutrally
 *  by designation -- candidate asterism seeds, never named/interpreted here. */
export function tightGroupings(stars: SkyStar[], maxSepDeg = 3): { a: string; b: string; sepDeg: number }[] {
  const out: { a: string; b: string; sepDeg: number }[] = [];
  for (let i = 0; i < stars.length; i++) for (let j = i + 1; j < stars.length; j++) {
    const sep = greatCircleDeg(stars[i]!.dir, stars[j]!.dir);
    if (sep <= maxSepDeg) out.push({ a: stars[i]!.name, b: stars[j]!.name, sepDeg: sep });
  }
  return out;
}

/** Stars whose planet-frame declination places them within toleranceDeg of the site's
 *  latitude -- i.e. they pass within that tolerance of the zenith once per rotation. */
export function zenithStars(stars: SkyStar[], o: POrient, site: GeoObserver, toleranceDeg = 2): SkyStar[] {
  return stars.filter((s) => Math.abs(planetFrameDecDeg(o, s.dir) - site.latDeg) <= toleranceDeg);
}

/** The Milky Way band's orientation at a site: galactic-centre and disk-normal directions
 *  (vantage-dependent, same construction as the app's milkyway.ts), plus a coarse
 *  classification of how the band's great circle sits against the site's horizon at the
 *  reference time (arch overhead vs. a road along the horizon) and which two azimuths it
 *  crosses the horizon at. */
export function milkyWayAtSite(originPc: Vec3, o: POrient, site: GeoObserver, tYears: number): {
  galacticCenterIcrs: Vec3; diskNormalIcrs: Vec3; maxAltDeg: number; horizonCrossingsAzDeg: number[];
} {
  const gc = helioToGalcen(originPc, [0, 0, 0]).pos;
  const diskNormalIcrs = normalizeV(galactocentricToIcrs([0, 0, 1]));
  const galacticCenterIcrs = normalizeV(galactocentricToIcrs(normalizeV([-gc[0], -gc[1], -gc[2]])));
  // sample the great circle perpendicular to diskNormalIcrs (the band's ridge line)
  const C = galacticCenterIcrs, N = diskNormalIcrs, T = normalizeV(crossV(N, C));
  let maxAlt = -90, prevAlt = 0, crossings: number[] = [];
  for (let i = 0; i <= 360; i++) {
    const a = (i * Math.PI) / 180;
    const dir: Vec3 = [Math.cos(a) * C[0] + Math.sin(a) * T[0], Math.cos(a) * C[1] + Math.sin(a) * T[1], Math.cos(a) * C[2] + Math.sin(a) * T[2]];
    const h = inertialToHorizontal(dir, o, site, tYears);
    if (h.altDeg > maxAlt) maxAlt = h.altDeg;
    if (i > 0 && (prevAlt < 0) !== (h.altDeg < 0)) crossings.push(h.azDeg);
    prevAlt = h.altDeg;
  }
  return { galacticCenterIcrs, diskNormalIcrs, maxAltDeg: maxAlt, horizonCrossingsAzDeg: crossings.slice(0, 2) };
}
const normalizeV = (v: Vec3): Vec3 => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
const crossV = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Heliacal rising: the first day in the orbital year when, at the moment a star rises, the
 *  sun sits between civil and nautical twilight depth (-6 to -18 deg) -- the classical
 *  visibility window -- immediately after a period where the star's rise was masked by
 *  daylight. Heliacal SETTING: the mirror condition at the star's last visible evening set.
 *  Returns years-since-epoch of each event within one orbital year, or null if the star
 *  never enters/leaves the sun's glare at this site (e.g. circumpolar, or too far from the
 *  ecliptic to ever conjunct closely). */
export function heliacalDates(dir: Vec3, world: World, site: GeoObserver): { risingYears: number | null; settingYears: number | null } {
  const o = planetOrientation(world), P = orbitYears(world), N = 240;
  const sunAltAtStarRise = (t0: number): number | null => {
    const rst = findRiseSetTransit(dir, o, site, t0);
    if (rst.riseYears == null) return null;
    return inertialToHorizontal(sunDirAt(world, rst.riseYears), o, site, rst.riseYears).altDeg;
  };
  const sunAltAtStarSet = (t0: number): number | null => {
    const rst = findRiseSetTransit(dir, o, site, t0);
    if (rst.setYears == null) return null;
    return inertialToHorizontal(sunDirAt(world, rst.setYears), o, site, rst.setYears).altDeg;
  };
  let risingYears: number | null = null, settingYears: number | null = null;
  let prevRiseVisible: boolean | null = null, prevSetVisible: boolean | null = null;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * P;
    const sa = sunAltAtStarRise(t);
    if (sa != null) {
      const visible = sa <= -6 && sa >= -18;
      if (risingYears == null && prevRiseVisible === false && visible) risingYears = t;
      prevRiseVisible = visible || sa < -18 ? visible : prevRiseVisible; // only track the masked->visible edge
      if (sa > -6) prevRiseVisible = false; // in daylight glare: definitely masked
      else if (visible) prevRiseVisible = true;
    }
    const sb = sunAltAtStarSet(t);
    if (sb != null) {
      const visible = sb <= -6 && sb >= -18;
      if (settingYears == null && prevSetVisible === true && !visible && sb < -18) settingYears = t;
      if (sb > -6) prevSetVisible = false;
      else if (visible) prevSetVisible = true;
    }
  }
  return { risingYears, settingYears };
}

/** Angular drift of a star's inertial direction, holding the OBSERVER fixed at its epoch
 *  position (isolating the star's own proper motion, not the observer's own path through
 *  the galaxy). Returns degrees of drift over deltaYears. */
export function properMotionDriftDeg(star: CatalogStar, originPc: Vec3, deltaYears: number): number {
  const d0 = relocateStar(star, { origin_pc: originPc }, 0);
  const d1 = relocateStar(star, { origin_pc: originPc }, deltaYears);
  if (!d0 || !d1) return 0;
  return greatCircleDeg(galacticToIcrs(d0.direction_gal), galacticToIcrs(d1.direction_gal));
}

export type { World, Moon, CatalogStar, Vec3, ApparentBody, POrient, GeoObserver };
