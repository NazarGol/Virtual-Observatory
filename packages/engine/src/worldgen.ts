// World-type generator (spec section 7's deferred system generator, with teeth). The
// gallery is STRATIFIED across world types, and "weird" never means "skips validation" --
// each type has its OWN, stricter constraint regime. A sampled world that fails its type's
// physics is rejected and resampled, never shipped. Generators emit the same World schema
// (section 5) plus a declared `world_type`.
//
// All checks are real celestial mechanics with cited scalings; the engine validates them in
// CI the same way it validates everything else.

import type { World, KeplerElements } from "./world.js";
import type { CatalogStar } from "./catalog.js";
import type { Vec3 } from "./vec.js";

// --- physical constants (SI unless noted) ---
const G = 6.674e-11;
const MSUN = 1.989e30, MEARTH = 5.972e24;
const RSUN = 6.957e8;
const AU = 1.495978707e11, YEAR_S = 3.15576e7, DAY_S = 86400, HOUR_S = 3600;

export type WorldType =
  | "habitable" | "tidally_locked" | "cold_distant"
  | "high_obliquity" | "multi_moon" | "eccentric";

export const WORLD_TYPES: WorldType[] = [
  "habitable", "tidally_locked", "cold_distant", "high_obliquity", "multi_moon", "eccentric",
];

export interface StarPhysical {
  mass_msun: number;
  luminosity_lsun: number;
  radius_rsun: number;
  teff_k: number;
}

/** One generated parameter's origin: real (from the catalog), or how it was derived/sampled. */
export interface ParamProvenance { value?: number | string; note: string; real?: boolean }

export interface GeneratedWorld extends World {
  world_type: WorldType;
  age_gyr: number;
  seed?: number;
  /** Per-parameter provenance: real-where-known, derived/sampled-where-not (spec section 2.3). */
  provenance?: Record<string, ParamProvenance>;
}

/** A real catalog star adopted as a host, with physical params derived where the data can't
 *  give them directly. Real: position, velocity, luminosity (from observed absolute mag). */
export interface RealHost {
  catalog_id: string;
  galactic_xyz_pc: Vec3;
  space_velocity_kms: Vec3;
  mass_msun: number;
  luminosity_lsun: number;
  radius_rsun: number;
  teff_k: number;
  abs_mag: number;
  bp_rp: number;
}

export interface Check { name: string; ok: boolean; detail: string }
export interface Validation { ok: boolean; checks: Check[] }

// --- seedable RNG (mulberry32) so generation + tests are deterministic ---
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const uniform = (r: () => number, lo: number, hi: number) => lo + (hi - lo) * r();
const logUniform = (r: () => number, lo: number, hi: number) => Math.exp(uniform(r, Math.log(lo), Math.log(hi)));

// --- physics helpers ---
/** Main-sequence host star from its mass (rough but monotonic relations). */
export function mainSequenceStar(mass_msun: number): StarPhysical {
  const luminosity_lsun = Math.pow(mass_msun, 3.5);
  const radius_rsun = Math.pow(mass_msun, 0.8);
  const teff_k = 5772 * Math.pow(luminosity_lsun / (radius_rsun * radius_rsun), 0.25);
  return { mass_msun, luminosity_lsun, radius_rsun, teff_k };
}

/** Conservative habitable zone (AU) from stellar luminosity, flux limits S=[1.1, 0.53]. */
export function habitableZoneAU(luminosity_lsun: number): { inner: number; outer: number } {
  return { inner: Math.sqrt(luminosity_lsun / 1.1), outer: Math.sqrt(luminosity_lsun / 0.53) };
}

const SUN_ABS_V = 4.83;
/** Rough main-sequence line: absolute magnitude vs BP-RP color, anchored on the Sun. */
const msLine = (bp_rp: number) => 4.6 + 5.0 * (bp_rp - 0.82) + 2.5 * (bp_rp - 0.82) ** 2;

/** True for a main-sequence F/G/K dwarf (not a giant/subdwarf). Giants sit ~2-5 mag brighter
 *  (lower absMag) than the MS at the same color, so a band around the MS line excludes them. */
export function isFGKMainSequence(bp_rp: number, absMag: number): boolean {
  if (bp_rp < 0.4 || bp_rp > 1.4) return false; // F/G/K color range (excludes M dwarfs)
  const d = absMag - msLine(bp_rp);
  return d > -1.5 && d < 2.2;
}

/** Absolute magnitude of a catalog star from its apparent magnitude and distance. */
export const absoluteMag = (mag_ref: number, d_ref_pc: number) => mag_ref - 5 * Math.log10(d_ref_pc / 10);

/**
 * Adopt a real catalog star as a host. REAL: galactic position, space velocity, and
 * luminosity (from the observed absolute magnitude). DERIVED (main-sequence relations, since
 * the catalog can't give them): mass from mass-luminosity, radius from mass, Teff from L & R.
 */
export function deriveHost(star: CatalogStar): RealHost {
  const abs_mag = absoluteMag(star.mag_ref, star.d_ref_pc);
  const luminosity_lsun = Math.pow(10, 0.4 * (SUN_ABS_V - abs_mag));
  const mass_msun = Math.pow(luminosity_lsun, 1 / 3.5);
  const radius_rsun = Math.pow(mass_msun, 0.8);
  const teff_k = 5772 * Math.pow(luminosity_lsun / (radius_rsun * radius_rsun), 0.25);
  return {
    catalog_id: star.id, galactic_xyz_pc: star.pos_pc, space_velocity_kms: star.vel_kms,
    mass_msun, luminosity_lsun, radius_rsun, teff_k, abs_mag, bp_rp: star.bp_rp,
  };
}

/** Select real F/G/K main-sequence hosts from the catalog, spread by distance so worlds get
 *  genuinely different vantages. */
export function selectHosts(stars: CatalogStar[], limit = 60): RealHost[] {
  const cands = stars.filter(
    (s) => s.id !== "SOL" && isFGKMainSequence(s.bp_rp, absoluteMag(s.mag_ref, s.d_ref_pc)),
  );
  cands.sort((a, b) => a.d_ref_pc - b.d_ref_pc);
  const stride = Math.max(1, Math.floor(cands.length / limit));
  const out: RealHost[] = [];
  for (let i = 0; i < cands.length && out.length < limit; i += stride) out.push(deriveHost(cands[i]!));
  return out;
}

/** Keplerian orbital period (years) for semi-major axis a (AU) about mass M (Msun). */
export const orbitalPeriodYears = (a_au: number, mass_msun: number) => Math.sqrt((a_au ** 3) / mass_msun);

/**
 * Tidal spin-down (locking) timescale in years (Gladman et al. 1996):
 *   tau = omega a^6 I Q / (3 G M_*^2 k2 R_p^5),  I = alpha m_p R_p^2.
 * A planet is expected to be tidally locked when tau < the system age.
 */
export function tidalLockTimescaleYears(
  a_au: number, mass_msun: number, planetRadiusKm: number, planetMassEarth: number,
  Q = 100, k2 = 0.3, initialSpinHours = 12,
): number {
  const a = a_au * AU;
  const Mstar = mass_msun * MSUN;
  const Rp = planetRadiusKm * 1000;
  const Mp = planetMassEarth * MEARTH;
  const omega = (2 * Math.PI) / (initialSpinHours * HOUR_S);
  const I = 0.33 * Mp * Rp * Rp;
  const tau_s = (omega * Math.pow(a, 6) * I * Q) / (3 * G * Mstar * Mstar * k2 * Math.pow(Rp, 5));
  return tau_s / YEAR_S;
}

/** Hill radius (AU) of the planet about its star. */
export function hillRadiusAU(a_planet_au: number, planetMassEarth: number, mass_msun: number): number {
  const mp_msun = (planetMassEarth * MEARTH) / MSUN;
  return a_planet_au * Math.cbrt(mp_msun / (3 * mass_msun));
}

/** Fluid Roche limit (AU) for a satellite of density rho_m about the planet. */
export function rocheLimitAU(planetRadiusKm: number, planetMassEarth: number, moonDensity = 3000): number {
  const Rp = planetRadiusKm * 1000;
  const rho_p = (planetMassEarth * MEARTH) / ((4 / 3) * Math.PI * Rp ** 3);
  const d = 2.44 * Rp * Math.cbrt(rho_p / moonDensity);
  return d / AU;
}

const moonMassEarth = (radiusKm: number, density = 3000) =>
  (((4 / 3) * Math.PI * (radiusKm * 1000) ** 3 * density)) / MEARTH;

// --- validators (per type) ---
const tilt = (w: World) => w.planet.axial_tilt_deg;
const ecc = (w: World) => w.planet.orbit.e;
const semi = (w: World) => w.planet.orbit.a_au;

function commonChecks(w: GeneratedWorld): Check[] {
  const e = ecc(w);
  const peri = semi(w) * (1 - e);
  const starR_au = (w.host_star.radius_rsun * RSUN) / AU;
  return [
    { name: "bound", ok: e >= 0 && e < 1, detail: `e=${e.toFixed(3)}` },
    { name: "not grazing star", ok: peri > 5 * starR_au, detail: `periastron ${peri.toFixed(3)} AU > ${(5 * starR_au).toFixed(4)} AU` },
  ];
}

function moonChecks(w: GeneratedWorld): Check[] {
  const checks: Check[] = [];
  const rHill = hillRadiusAU(semi(w), w.planet.mass_mearth, w.host_star.mass_msun);
  const roche = rocheLimitAU(w.planet.radius_km, w.planet.mass_mearth);
  const moons = [...w.moons].sort((a, b) => a.orbit.a_au - b.orbit.a_au);
  for (const m of moons) {
    const a = m.orbit.a_au, e = m.orbit.e;
    const peri = a * (1 - e), apo = a * (1 + e); // eccentric moon: check the extremes, not a
    checks.push({
      name: `moon ${m.name}: Roche < periapsis, apoapsis < 0.4 R_Hill`,
      ok: peri > roche && apo < 0.4 * rHill,
      detail: `peri ${peri.toFixed(5)} > Roche ${roche.toFixed(5)}; apo ${apo.toFixed(5)} < ${(0.4 * rHill).toFixed(5)} AU`,
    });
  }
  // mutual Hill stability between adjacent moons (separation > 3.5 mutual Hill radii)
  for (let i = 1; i < moons.length; i++) {
    const m1 = moons[i - 1]!, m2 = moons[i]!;
    const mu = (moonMassEarth(m1.radius_km) + moonMassEarth(m2.radius_km)) * MEARTH;
    const Rh = Math.cbrt(mu / (3 * w.planet.mass_mearth * MEARTH)) * ((m1.orbit.a_au + m2.orbit.a_au) / 2);
    const sep = (m2.orbit.a_au - m1.orbit.a_au) / Rh;
    checks.push({ name: `moons ${m1.name}/${m2.name} mutually Hill-stable`, ok: sep > 3.5, detail: `Delta=${sep.toFixed(2)} (>3.5)` });
  }
  return checks;
}

export function validateWorld(w: GeneratedWorld): Validation {
  const checks = [...commonChecks(w)];
  // Any world may now carry moons (not just multi_moon): validate them wherever they appear.
  if (w.moons.length > 0) checks.push(...moonChecks(w));
  const hz = habitableZoneAU(w.host_star.luminosity_lsun);
  const tau = tidalLockTimescaleYears(semi(w), w.host_star.mass_msun, w.planet.radius_km, w.planet.mass_mearth);
  const ageYr = w.age_gyr * 1e9;
  const Porb_s = orbitalPeriodYears(semi(w), w.host_star.mass_msun) * YEAR_S;

  switch (w.world_type) {
    case "habitable":
      checks.push(
        { name: "in habitable zone", ok: semi(w) >= hz.inner && semi(w) <= hz.outer, detail: `a=${semi(w).toFixed(3)} in [${hz.inner.toFixed(3)}, ${hz.outer.toFixed(3)}] AU` },
        { name: "low eccentricity", ok: ecc(w) < 0.1, detail: `e=${ecc(w).toFixed(3)}` },
        { name: "sane obliquity", ok: tilt(w) < 45, detail: `${tilt(w).toFixed(1)} deg` },
        { name: "has a day (not tide-locked)", ok: tau > ageYr, detail: `tau_lock ${(tau / 1e9).toExponential(2)} Gyr > age ${w.age_gyr} Gyr` },
      );
      break;
    case "tidally_locked":
      checks.push(
        { name: "locking is expected (tau < age)", ok: tau < ageYr, detail: `tau_lock ${(tau / 1e9).toExponential(2)} Gyr < age ${w.age_gyr} Gyr` },
        { name: "spin synchronized (Prot = Porb)", ok: Math.abs(w.planet.rotation_period_s - Porb_s) / Porb_s < 1e-9, detail: `Prot=${(w.planet.rotation_period_s / DAY_S).toFixed(2)} d, Porb=${(Porb_s / DAY_S).toFixed(2)} d` },
      );
      break;
    case "cold_distant":
      checks.push(
        { name: "beyond the outer HZ (cold)", ok: semi(w) > hz.outer, detail: `a=${semi(w).toFixed(2)} > HZ_outer ${hz.outer.toFixed(2)} AU` },
        { name: "dim sun (flux < 0.3 S_earth)", ok: w.host_star.luminosity_lsun / semi(w) ** 2 < 0.3, detail: `S=${(w.host_star.luminosity_lsun / semi(w) ** 2).toExponential(2)} S_earth` },
        { name: "not ejected (a < 200 AU, bound)", ok: semi(w) < 200, detail: `a=${semi(w).toFixed(1)} AU` },
      );
      break;
    case "high_obliquity":
      checks.push(
        { name: "extreme obliquity (>45 deg)", ok: tilt(w) > 45 && tilt(w) <= 180, detail: `${tilt(w).toFixed(1)} deg` },
      );
      break;
    case "multi_moon":
      checks.push({ name: ">= 2 moons", ok: w.moons.length >= 2, detail: `${w.moons.length} moons` });
      break;
    case "eccentric":
      checks.push(
        { name: "high eccentricity", ok: ecc(w) >= 0.3 && ecc(w) < 0.95, detail: `e=${ecc(w).toFixed(3)}` },
      );
      break;
  }
  return { ok: checks.every((c) => c.ok), checks };
}

// --- per-type samplers ---
const J2000_JD = 2451545.0;
const round4 = (x: number) => Math.round(x * 1e4) / 1e4;

/** A moon orbit with real inclination + random node/argument/phase (the engine already
 *  propagates all of these). Inclination is relative to the ecliptic -- the planet orbit sits
 *  in the ICRS x-y plane (i=0) -- so an inclined moon aligns with the host star only near its
 *  nodes, which is what makes eclipses cluster into seasons. */
const moonOrbit = (a: number, e: number, iDeg: number, r: () => number): KeplerElements => ({
  a_au: a, e, i_deg: iDeg, Omega_deg: uniform(r, 0, 360), omega_deg: uniform(r, 0, 360), M0_deg: uniform(r, 0, 360), epoch_jd: J2000_JD,
});

interface MoonPlan { max: number; incMaxDeg: number; eMax: number; resonant?: boolean }

/**
 * Sample a moon system around a planet, VALID BY CONSTRUCTION (periapsis clears Roche,
 * apoapsis stays inside 0.4 R_Hill, adjacent moons stay mutually Hill-stable > 3.7). Moons
 * carry inclination (eclipse seasons) and, for resonant systems, a near-2:1 period chain
 * (Laplace-type -> recurring alignments). Returns [] when there is simply no room (a very
 * close-in planet with a tiny Hill sphere) -- moons are common but never forced.
 */
function sampleMoons(r: () => number, host: RealHost, a_planet: number, planetMassEarth: number, planetRadiusKm: number, plan: MoonPlan): World["moons"] {
  const rHill = hillRadiusAU(a_planet, planetMassEarth, host.mass_msun);
  const roche = rocheLimitAU(planetRadiusKm, planetMassEarth);
  const aMax = 0.34 * rHill, aMin = roche * 1.5;
  if (plan.max <= 0 || aMin >= aMax) return [];
  const name = (i: number) => `moon ${String.fromCharCode(97 + i)}`;
  const mk = (a: number, i: number): World["moons"][number] => {
    const eCap = Math.max(0, Math.min(plan.eMax, 0.9 * (aMax / a - 1), 0.9 * (1 - roche / a)));
    const e = eCap > 0.01 ? uniform(r, 0, eCap) : 0;
    const inc = uniform(r, Math.min(2, plan.incMaxDeg), plan.incMaxDeg);
    const radius_km = plan.resonant ? uniform(r, 500, 1300) : uniform(r, 700, 1900);
    return { name: name(i), radius_km, albedo: uniform(r, 0.06, 0.32), orbit: moonOrbit(a, e, inc, r) };
  };
  const mutualOK = (m1: World["moons"][number], m2: World["moons"][number]) => {
    const mu = (moonMassEarth(m1.radius_km) + moonMassEarth(m2.radius_km)) * MEARTH;
    const Rh = Math.cbrt(mu / (3 * planetMassEarth * MEARTH)) * ((m1.orbit.a_au + m2.orbit.a_au) / 2);
    return (m2.orbit.a_au - m1.orbit.a_au) / Rh > 3.7;
  };
  const moons: World["moons"] = [];
  if (plan.resonant && plan.max >= 2) {
    const RATIO = Math.cbrt(4); // a2/a1 for a 2:1 period ratio (P ∝ a^1.5)
    let a = uniform(r, aMin, Math.min(aMin * 1.5, aMax / RATIO));
    moons.push(mk(a, 0));
    for (let i = 1; i < plan.max; i++) {
      const m = mk(a * RATIO, i);
      if (m.orbit.a_au * (1 + m.orbit.e) >= aMax || !mutualOK(moons[moons.length - 1]!, m)) break;
      moons.push(m); a *= RATIO;
    }
  } else {
    const count = 1 + Math.floor(r() * plan.max);
    let a = uniform(r, aMin, Math.min(aMin * 2.2, aMax * 0.6));
    for (let i = 0; i < count && a < aMax; i++) {
      const m = mk(a, i);
      if (m.orbit.a_au * (1 + m.orbit.e) >= aMax || (moons.length && !mutualOK(moons[moons.length - 1]!, m))) break;
      moons.push(m);
      a *= uniform(r, 2.1, 2.9);
    }
  }
  return moons;
}

function buildWorld(type: WorldType, host: RealHost, age_gyr: number, seed: number, opts: {
  a_au: number; e: number; tilt_deg: number; rotation_period_s: number;
  planet_radius_km?: number; planet_mass_mearth?: number; moons?: World["moons"];
  name: string; aNote: string; rotNote?: string; moonNote?: string;
}): GeneratedWorld {
  const provenance: Record<string, ParamProvenance> = {
    host: { value: host.catalog_id, real: true, note: `real catalog star ${host.catalog_id}: observed galactic position & space velocity; luminosity from its absolute magnitude (M=${host.abs_mag.toFixed(2)}, BP-RP ${host.bp_rp.toFixed(2)})` },
    "host_star.galactic_xyz_pc": { real: true, note: "real: the host star's catalog position (the observer's vantage)" },
    "host_star.luminosity_lsun": { value: round4(host.luminosity_lsun), real: true, note: "real-derived: from the host's observed absolute magnitude (distance + apparent mag)" },
    "host_star.mass_msun": { value: round4(host.mass_msun), note: "derived: mass-luminosity relation L = M^3.5" },
    "host_star.radius_rsun": { value: round4(host.radius_rsun), note: "derived: main-sequence radius R = M^0.8" },
    "host_star.teff_k": { value: Math.round(host.teff_k), note: "derived: Teff = Tsun*(L/R^2)^0.25, consistent with L and R" },
    "planet.orbit.a_au": { value: round4(opts.a_au), note: opts.aNote },
    "planet.orbit.e": { value: round4(opts.e), note: `sampled for a ${type.replace(/_/g, " ")} world` },
    "planet.axial_tilt_deg": { value: round4(opts.tilt_deg), note: type === "high_obliquity" ? "sampled > 45 deg (extreme obliquity)" : "sampled" },
    "planet.rotation_period_s": { value: Math.round(opts.rotation_period_s), note: opts.rotNote ?? "sampled" },
  };
  if (opts.moons?.length) provenance["moons"] = { value: opts.moons.length, note: opts.moonNote ?? "inclined moon orbits (eclipse seasons); periapsis clears Roche, apoapsis within 0.4 R_Hill; adjacent moons mutually Hill-stable (Delta > 3.5)" };

  return {
    schema_version: "0.1",
    name: opts.name,
    world_type: type,
    age_gyr,
    seed,
    host_star: {
      catalog_id: host.catalog_id, galactic_xyz_pc: host.galactic_xyz_pc, space_velocity_kms: host.space_velocity_kms,
      mass_msun: host.mass_msun, luminosity_lsun: host.luminosity_lsun, teff_k: host.teff_k, radius_rsun: host.radius_rsun,
    },
    planet: {
      radius_km: opts.planet_radius_km ?? 6371, mass_mearth: opts.planet_mass_mearth ?? 1,
      rotation_period_s: opts.rotation_period_s, axial_tilt_deg: opts.tilt_deg,
      north_pole_inertial: { ra_deg: 0, dec_deg: 90 - opts.tilt_deg },
      orbit: { a_au: opts.a_au, e: opts.e, i_deg: 0, Omega_deg: 0, omega_deg: 0, M0_deg: 0, epoch_jd: J2000_JD },
    },
    moons: opts.moons ?? [],
    observer: { lat_deg: 0, lon_deg: 0, elevation_m: 0 },
    epoch_jd: J2000_JD,
    catalog_ref: "catalog/local_volume_300pc.json",
    provenance,
  };
}

/** Sample a planet+moon system of the given type around a REAL host. Validators unchanged;
 *  each type samples the parameters its physics needs FOR THIS host (e.g. tidal-lock uses the
 *  host's real locking radius, the HZ uses the host's real luminosity). */
function samplePlanetSystem(type: WorldType, r: () => number, host: RealHost, idx: number, seed: number): GeneratedWorld {
  const name = `${type.replace(/_/g, " ")} #${idx}`;
  const hz = habitableZoneAU(host.luminosity_lsun);
  const age = uniform(r, 1, 9);
  switch (type) {
    case "habitable": {
      const a = uniform(r, hz.inner, hz.outer);
      return buildWorld(type, host, age, seed, {
        a_au: a, e: uniform(r, 0, 0.05),
        tilt_deg: uniform(r, 0, 35), rotation_period_s: uniform(r, 16, 40) * HOUR_S, name,
        moons: sampleMoons(r, host, a, 1, 6371, { max: 2, incMaxDeg: 15, eMax: 0.1 }),
        aNote: `sampled in the host's habitable zone [${hz.inner.toFixed(3)}, ${hz.outer.toFixed(3)}] AU`,
      });
    }
    case "tidally_locked": {
      // Locking radius for THIS host: tau_lock ~ C a^6, C = tau_lock(1 AU); a_lock where tau = age.
      const C = tidalLockTimescaleYears(1, host.mass_msun, 6371, 1);
      const aLock = Math.pow((age * 1e9) / C, 1 / 6);
      const starR_au = (host.radius_rsun * RSUN) / AU;
      const a = uniform(r, Math.max(0.02, 8 * starR_au), 0.85 * aLock);
      const Porb_s = orbitalPeriodYears(a, host.mass_msun) * YEAR_S;
      return buildWorld(type, host, age, seed, {
        a_au: a, e: uniform(r, 0, 0.03), tilt_deg: uniform(r, 0, 8), rotation_period_s: Porb_s, name,
        // with the host star fixed in the sky, a moon is the only moving body -- the most evocative case
        moons: sampleMoons(r, host, a, 1, 6371, { max: 1, incMaxDeg: 22, eMax: 0.15 }),
        moonNote: "a single moon is often the only moving body under a fixed sun; inclined orbit -> eclipse seasons; periapsis clears Roche",
        aNote: `sampled inside the tidal-locking radius a_lock=${aLock.toFixed(3)} AU (Gladman 1996: tau_lock < system age)`,
        rotNote: "= orbital period: spin-orbit synchronous (Kepler from a and host mass)",
      });
    }
    case "cold_distant": {
      const a = logUniform(r, Math.max(5, Math.sqrt(host.luminosity_lsun / 0.28)), 60);
      return buildWorld(type, host, age, seed, {
        a_au: a, e: uniform(r, 0, 0.2),
        tilt_deg: uniform(r, 0, 30), rotation_period_s: uniform(r, 10, 30) * HOUR_S, name,
        moons: sampleMoons(r, host, a, 1, 6371, { max: 2, incMaxDeg: 20, eMax: 0.15 }),
        aNote: "sampled far beyond the outer HZ, where the host's flux < 0.3 S_earth (a small, dim sun)",
      });
    }
    case "high_obliquity": {
      const a = uniform(r, hz.inner, hz.outer * 1.5);
      return buildWorld(type, host, age, seed, {
        a_au: a, e: uniform(r, 0, 0.1),
        tilt_deg: uniform(r, 50, 110), rotation_period_s: uniform(r, 12, 30) * HOUR_S, name,
        moons: sampleMoons(r, host, a, 1, 6371, { max: 2, incMaxDeg: 30, eMax: 0.15 }),
        aNote: "sampled near the host's habitable zone",
      });
    }
    case "multi_moon": {
      const pr = uniform(r, 5000, 9000), pm = uniform(r, 1.5, 4);
      const a_planet = uniform(r, hz.inner, hz.outer * 1.4);
      const moons = sampleMoons(r, host, a_planet, pm, pr, { max: 2 + Math.floor(r() * 3), incMaxDeg: 18, eMax: 0.08, resonant: true });
      return buildWorld(type, host, age, seed, {
        a_au: a_planet, e: uniform(r, 0, 0.05), tilt_deg: uniform(r, 0, 30), rotation_period_s: uniform(r, 14, 28) * HOUR_S,
        planet_radius_km: pr, planet_mass_mearth: pm, moons, name,
        moonNote: "near-2:1 resonant chain (Laplace-type: recurring multi-moon alignments); inclined orbits -> eclipse seasons; adjacent moons mutually Hill-stable",
        aNote: "sampled near the host's habitable zone",
      });
    }
    case "eccentric": {
      const a = uniform(r, hz.inner, hz.outer * 1.6);
      return buildWorld(type, host, age, seed, {
        a_au: a, e: uniform(r, 0.35, 0.7),
        tilt_deg: uniform(r, 0, 35), rotation_period_s: uniform(r, 12, 30) * HOUR_S, name,
        // a moderately eccentric moon: apparent size (and a "supermoon") cycles over its orbit
        moons: sampleMoons(r, host, a, 1, 6371, { max: 1, incMaxDeg: 18, eMax: 0.3 }),
        moonNote: "eccentric moon: apparent size cycles over the orbit; periapsis clears Roche (checked at a(1-e))",
        aNote: "semi-major axis near the host's HZ; the apparent sun then pulses in size over the year",
      });
    }
  }
}

function syntheticHost(r: () => number): RealHost {
  const ms = mainSequenceStar(uniform(r, 0.75, 1.25));
  return { catalog_id: "synthetic", galactic_xyz_pc: [0, 0, 0], space_velocity_kms: [0, 0, 0], ...ms, abs_mag: SUN_ABS_V, bp_rp: 0.7 };
}

/** Generate one valid world of a type around a REAL catalog host (sample, validate, resample). */
export function generateWorldForHost(type: WorldType, host: RealHost, rng: () => number, idx = 1, seed = 0, maxAttempts = 3000): GeneratedWorld {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const w = samplePlanetSystem(type, rng, host, idx, seed);
    if (validateWorld(w).ok) return w;
  }
  throw new Error(`could not generate a valid ${type} world around ${host.catalog_id} in ${maxAttempts} attempts`);
}

/** Physics-only path: generate a world around a SYNTHETIC host (for unit tests). Real gallery
 *  worlds come from generateWorldForHost with a catalog star. */
export function generateWorld(type: WorldType, rng: () => number, idx = 1, maxAttempts = 3000): GeneratedWorld {
  return generateWorldForHost(type, syntheticHost(rng), rng, idx, 0, maxAttempts);
}

/**
 * A gallery of N worlds that SPANS every type (at least one of each), the rest filled by
 * round-robin. Each world is physics-valid for its declared type.
 */
export function generateGallery(n: number, seed = 1): GeneratedWorld[] {
  const rng = mulberry32(seed);
  const count = Math.max(n, WORLD_TYPES.length);
  const out: GeneratedWorld[] = [];
  for (let i = 0; i < count; i++) {
    out.push(generateWorld(WORLD_TYPES[i % WORLD_TYPES.length]!, rng, i + 1));
  }
  return out;
}
