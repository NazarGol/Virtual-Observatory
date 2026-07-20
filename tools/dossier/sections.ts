// Dossier section builders (Phase 8 Gate B). Each function returns a plain, JSON-serializable
// data object for one section of the document -- computed once, then both the prose and the
// appendix table in render.ts read from the SAME object, so every printed number is checkable
// against the appendix. Nothing here interprets or names anything; that is the artist's job.
import {
  planetOrientation, inertialToHorizontal, raDecToVec,
  type World, type Vec3, type CatalogStar, type GeoObserver,
} from "../../packages/engine/src/index.js";
import * as G from "./geometry.js";
import { PROPAGATION_MODELS } from "../../packages/engine/src/propagation.js";

const R2D = 180 / Math.PI;
const AU_KM = 1.495978707e8;
const R_SUN_KM = 6.957e5;

export interface SiteMeta { latDeg: number; lonDeg: number; label: string }

// ---------------------------------------------------------------------------------------
// SECTION 1 -- The World
// ---------------------------------------------------------------------------------------
export interface Section1 {
  worldName: string; worldType: string | null; ageGyr: number | null;
  host: { catalogId: string | null; posPc: Vec3; massMsun: number; luminosityLsun: number; teffK: number; radiusRsun: number };
  planet: { radiusKm: number; massMearth: number; aAu: number; e: number; axialTiltDeg: number };
  moonCount: number;
  site: SiteMeta;
  latitudeClass: "tropical-equivalent" | "temperate-equivalent" | "polar-equivalent";
  provenance: Record<string, { value?: number | string; note: string; real?: boolean }> | null;
}
export function buildSection1(world: World, raw: Record<string, unknown>, site: SiteMeta): Section1 {
  const tilt = world.planet.axial_tilt_deg;
  const latitudeClass: Section1["latitudeClass"] =
    Math.abs(site.latDeg) <= tilt ? "tropical-equivalent"
      : Math.abs(site.latDeg) >= 90 - tilt ? "polar-equivalent" : "temperate-equivalent";
  return {
    worldName: world.name, worldType: (raw["world_type"] as string) ?? null, ageGyr: (raw["age_gyr"] as number) ?? null,
    host: {
      catalogId: world.host_star.catalog_id, posPc: world.host_star.galactic_xyz_pc,
      massMsun: world.host_star.mass_msun, luminosityLsun: world.host_star.luminosity_lsun,
      teffK: world.host_star.teff_k, radiusRsun: world.host_star.radius_rsun,
    },
    planet: {
      radiusKm: world.planet.radius_km, massMearth: world.planet.mass_mearth,
      aAu: world.planet.orbit.a_au, e: world.planet.orbit.e, axialTiltDeg: tilt,
    },
    moonCount: world.moons.length, site, latitudeClass,
    provenance: (raw["provenance"] as Section1["provenance"]) ?? null,
  };
}

// ---------------------------------------------------------------------------------------
// SECTION 2 -- The Day & The Year
// ---------------------------------------------------------------------------------------
export interface Section2 {
  locked: boolean;
  rotationDays: number; solarDayHours: number | null; orbitYears: number; orbitDaysInLocalDays: number;
  daysPerYearWhole: number; daysPerYearRemainder: number;
  solstices: { summer: number; winter: number; equinox1: number; equinox2: number } | null;
  yearScan: ReturnType<typeof G.siteYearScan> | null;
  fixedSun: { altDeg: number; azDeg: number } | null; // locked worlds only
}
export function buildSection2(world: World, site: GeoObserver): Section2 {
  const locked = G.isLocked(world);
  const rotD = G.rotationDays(world), orbY = G.orbitYears(world);
  const solarDayYr = G.solarDayYears(world);
  const solarDayHours = solarDayYr == null ? null : (solarDayYr * G.SPY) / 3600;
  // the calendar day is the SOLAR day (sunrise to sunrise), not the sidereal rotation period
  // -- a planet completes one extra sidereal spin per year relative to the stars versus
  // relative to its own sun (Earth: 366.25 sidereal rotations/yr but 365.25 solar days/yr).
  const orbitDaysInLocalDays = solarDayYr == null ? NaN : orbY / solarDayYr;
  const daysPerYearWhole = Math.floor(orbitDaysInLocalDays);
  const daysPerYearRemainder = orbitDaysInLocalDays - daysPerYearWhole;
  if (locked) {
    const o = planetOrientation(world);
    const dir = G.sunDirAt(world, 0);
    const h = inertialToHorizontal(dir, o, site, 0);
    return { locked, rotationDays: rotD, solarDayHours: null, orbitYears: orbY, orbitDaysInLocalDays: NaN,
      daysPerYearWhole: NaN, daysPerYearRemainder: NaN, solstices: null, yearScan: null,
      fixedSun: { altDeg: h.altDeg, azDeg: h.azDeg } };
  }
  const sq = G.findSolsticesEquinoxes(world);
  const yearScan = G.siteYearScan(world, site);
  return {
    locked, rotationDays: rotD, solarDayHours, orbitYears: orbY, orbitDaysInLocalDays, daysPerYearWhole, daysPerYearRemainder,
    solstices: { summer: sq.summerSolstice, winter: sq.winterSolstice, equinox1: sq.equinox1, equinox2: sq.equinox2 },
    yearScan, fixedSun: null,
  };
}

// ---------------------------------------------------------------------------------------
// SECTION 3 -- The Moons
// ---------------------------------------------------------------------------------------
export interface Section3 {
  locked: boolean;
  moons: (G.MoonFacts & { synodicNote: string })[];
  chord: ReturnType<typeof G.resonanceChord>;
  alignmentRecurrenceYears: number | null;
  yearMonthTable: { moon: string; monthsPerYear: number; remainderDays: number | null }[];
}
export function buildSection3(world: World): Section3 {
  const locked = G.isLocked(world);
  const orbY = G.orbitYears(world);
  const moons = world.moons.map((m) => {
    const f = G.moonFacts(world, m);
    const synodicNote = f.synodicYears == null ? "locked to the sun's apparent motion (no distinct phase cycle)"
      : f.synodicLocalDays == null ? `${(f.synodicYears * 365.25).toFixed(2)} real days (this world has no local day)`
        : `${f.synodicLocalDays.toFixed(2)} local days`;
    return { ...f, synodicNote };
  });
  const yearMonthTable = world.moons.map((m) => {
    const f = G.moonFacts(world, m);
    const monthYears = f.synodicYears ?? f.periodYears;
    const monthsPerYear = orbY / monthYears;
    const remainderYears = (monthsPerYear - Math.floor(monthsPerYear)) * monthYears;
    return { moon: m.name, monthsPerYear: Math.floor(monthsPerYear), remainderDays: G.toLocalDays(world, remainderYears) };
  });
  return { locked, moons, chord: G.resonanceChord(world), alignmentRecurrenceYears: G.alignmentRecurrenceYears(world), yearMonthTable };
}

// ---------------------------------------------------------------------------------------
// SECTION 4 -- Eclipses & Alignments
// ---------------------------------------------------------------------------------------
export interface SeasonSummary { moon: string; startYears: number; endYears: number; eventCount: number; minSepDeg: number }
export interface Section4 {
  scanSpanYears: number;
  perMoon: { moon: string; seasons: SeasonSummary[]; avgSpacingYears: number | null; avgSpacingLocalDays: number | null;
    masterCycleYears: number | null; masterCycleResidualLocalDays: number | null; masterCycleResidualYears: number | null }[];
  pairSynodic: { a: string; b: string; synodicYears: number | null; synodicLocalDays: number | null }[];
}
export function buildSection4(world: World, spanOrbits = 20): Section4 {
  const orbY = G.orbitYears(world);
  const spanYears = spanOrbits * orbY;
  const perMoon = world.moons.map((m) => {
    const seasons = G.scanEclipseSeasons(world, spanYears, m);
    const summaries: SeasonSummary[] = seasons.map((s) => ({
      moon: m.name, startYears: s.startYears, endYears: s.endYears, eventCount: s.events.length,
      minSepDeg: s.closestSepDeg,
    }));
    let avgSpacing: number | null = null, masterCycle: number | null = null, residualYears: number | null = null;
    if (summaries.length > 1) {
      const gaps = summaries.slice(1).map((s, i) => s.startYears - summaries[i]!.startYears);
      avgSpacing = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      // no nodal precession is modeled -> season phase (mod orbYears) should repeat exactly;
      // report the RMS residual as the empirical measure of that (near-zero = no drift).
      const phases = summaries.map((s) => s.startYears % orbY);
      // cluster phases into the two node-groups (nearest of the first two phases)
      const centers = [phases[0]!, phases.find((p) => Math.abs(p - phases[0]!) > orbY * 0.25) ?? phases[0]!];
      const residuals = phases.map((p) => Math.min(...centers.map((c) => Math.abs(p - c))));
      const rms = Math.sqrt(residuals.reduce((a, b) => a + b * b, 0) / residuals.length);
      masterCycle = orbY; residualYears = rms;
    }
    return {
      moon: m.name, seasons: summaries, avgSpacingYears: avgSpacing,
      avgSpacingLocalDays: avgSpacing == null ? null : G.toLocalDays(world, avgSpacing),
      masterCycleYears: masterCycle,
      masterCycleResidualLocalDays: residualYears == null ? null : G.toLocalDays(world, residualYears),
      masterCycleResidualYears: residualYears,
    };
  });
  const pairSynodic: Section4["pairSynodic"] = [];
  for (let i = 0; i < world.moons.length; i++) for (let j = i + 1; j < world.moons.length; j++) {
    const pi = G.moonPeriodYears(world, world.moons[i]!), pj = G.moonPeriodYears(world, world.moons[j]!);
    const syn = G.synodicYears(pi, pj);
    pairSynodic.push({ a: world.moons[i]!.name, b: world.moons[j]!.name, synodicYears: syn, synodicLocalDays: syn == null ? null : G.toLocalDays(world, syn) });
  }
  return { scanSpanYears: spanYears, perMoon, pairSynodic };
}

// ---------------------------------------------------------------------------------------
// SECTION 5 -- The Stars
// ---------------------------------------------------------------------------------------
export interface StarRow { designation: string; magnitude: number; colorIndex: number; distancePc: number; visibility: string }
export interface Section5 {
  brightest: StarRow[];
  northPole: { star: string; sepDeg: number; mag: number } | null;
  southPole: { star: string; sepDeg: number; mag: number } | null;
  groupings: { a: string; b: string; sepDeg: number }[];
  milkyWay: { maxAltDeg: number; classification: string; horizonCrossingsAzDeg: number[] };
  zenith: string[];
  excludedNearHost: number;
}
export function buildSection5(world: World, stars: G.SkyStar[], site: GeoObserver, excludedNearHost: number, tYears = 0, n = 30): Section5 {
  const o = planetOrientation(world);
  const top = G.brightest(stars, n);
  const brightest: StarRow[] = top.map((s) => {
    const { visibility } = G.riseSetClass(s.dir, o, site, tYears);
    return { designation: s.name, magnitude: s.mag, colorIndex: s.bp_rp, distancePc: s.distance_pc, visibility };
  });
  const pole = raDecToVec(o.northPoleRaDeg, o.northPoleDecDeg);
  const southPoleDir: Vec3 = [-pole[0], -pole[1], -pole[2]];
  const np = G.nearestToPole(stars, pole);
  const sp = G.nearestToPole(stars, southPoleDir);
  const bright636 = stars.filter((s) => s.mag <= 4.0);
  const groupings = G.tightGroupings(bright636, 3);
  const mw = G.milkyWayAtSite(world.host_star.galactic_xyz_pc, o, site, tYears);
  const classification = mw.maxAltDeg > 55 ? "an arch, passing near overhead" : mw.maxAltDeg < 25 ? "a low road along the horizon" : "a diagonal arc across the sky";
  const zenith = G.zenithStars(top, o, site, 2).map((s) => s.name);
  return {
    brightest,
    northPole: np ? { star: np.star.name, sepDeg: np.sepDeg, mag: np.star.mag } : null,
    southPole: sp ? { star: sp.star.name, sepDeg: sp.sepDeg, mag: sp.star.mag } : null,
    groupings, milkyWay: { maxAltDeg: mw.maxAltDeg, classification, horizonCrossingsAzDeg: mw.horizonCrossingsAzDeg }, zenith,
    excludedNearHost,
  };
}

// ---------------------------------------------------------------------------------------
// SECTION 6 -- Rising & Setting
// ---------------------------------------------------------------------------------------
export interface RiseSetRow { designation: string; riseAzDeg: number | null; setAzDeg: number | null; visibility: string; heliacalRisingYears: number | null; heliacalSettingYears: number | null }
export interface Section6 {
  rows: RiseSetRow[];
  sharedHouses: { binCenterDeg: number; stars: string[] }[];
  circumpolar: string[];
}
export function buildSection6(world: World, stars: G.SkyStar[], site: GeoObserver, tYears = 0, n = 30): Section6 {
  const o = planetOrientation(world);
  const top = G.brightest(stars, n);
  const rows: RiseSetRow[] = top.map((s) => {
    const { visibility } = G.riseSetClass(s.dir, o, site, tYears);
    const az = G.riseSetAzimuths(s.dir, o, site, tYears);
    const helio = G.heliacalDates(s.dir, world, site);
    return { designation: s.name, riseAzDeg: az?.riseAzDeg ?? null, setAzDeg: az?.setAzDeg ?? null, visibility, heliacalRisingYears: helio.risingYears, heliacalSettingYears: helio.settingYears };
  });
  const bins = new Map<number, string[]>();
  for (const r of rows) {
    if (r.riseAzDeg == null) continue;
    const bin = Math.round(r.riseAzDeg / 5) * 5;
    const arr = bins.get(bin) ?? []; arr.push(r.designation); bins.set(bin, arr);
  }
  const sharedHouses = [...bins.entries()].filter(([, s]) => s.length > 1).map(([binCenterDeg, s]) => ({ binCenterDeg, stars: s }));
  const circumpolar = rows.filter((r) => r.visibility === "circumpolar").map((r) => r.designation);
  return { rows, sharedHouses, circumpolar };
}

// ---------------------------------------------------------------------------------------
// SECTION 7 -- Deep Time
// ---------------------------------------------------------------------------------------
export interface Section7 {
  driftSpans: { localYears: number; realYears: number; withinCap: boolean; drift: { star: string; driftDeg: number }[] }[];
  precessionModeled: false;
  honestCapRectilinearYears: number; honestCapGalacticYears: number;
}
export function buildSection7(world: World, catalogStars: CatalogStar[], top: G.SkyStar[]): Section7 {
  const orbY = G.orbitYears(world);
  const byId = new Map(catalogStars.map((s) => [s.id, s]));
  const spans = [100, 1000, 10000];
  const cap = PROPAGATION_MODELS.rectilinear.honestCapYears;
  const driftSpans = spans.map((localYears) => {
    const realYears = localYears * orbY;
    const drift = top.slice(0, 10).map((s) => {
      const cs = byId.get(s.id);
      return { star: s.name, driftDeg: cs ? G.properMotionDriftDeg(cs, world.host_star.galactic_xyz_pc, realYears) : 0 };
    });
    return { localYears, realYears, withinCap: Math.abs(realYears) <= cap, drift };
  });
  return { driftSpans, precessionModeled: false, honestCapRectilinearYears: cap, honestCapGalacticYears: PROPAGATION_MODELS.galactic.honestCapYears };
}

export interface Dossier {
  world: World; raw: Record<string, unknown>; site: SiteMeta; generatedFromCatalog: string;
  s1: Section1; s2: Section2; s3: Section3; s4: Section4; s5: Section5; s6: Section6; s7: Section7;
}
export function buildDossier(world: World, raw: Record<string, unknown>, catalog: CatalogStar[], catalogPath: string, site: SiteMeta): Dossier {
  const geoSite: GeoObserver = { latDeg: site.latDeg, lonDeg: site.lonDeg };
  const { stars, excludedNearHost } = G.relocatedStars(catalog, world.host_star.galactic_xyz_pc, 0);
  return {
    world, raw, site, generatedFromCatalog: catalogPath,
    s1: buildSection1(world, raw, site),
    s2: buildSection2(world, geoSite),
    s3: buildSection3(world),
    s4: buildSection4(world),
    s5: buildSection5(world, stars, geoSite, excludedNearHost),
    s6: buildSection6(world, stars, geoSite),
    s7: buildSection7(world, catalog, G.brightest(stars, 30)),
  };
}

export { R2D, AU_KM, R_SUN_KM };
