// World-type generator (spec section 7's deferred system generator, with teeth). The
// gallery is STRATIFIED across world types, and "weird" never means "skips validation" --
// each type has its OWN, stricter constraint regime. A sampled world that fails its type's
// physics is rejected and resampled, never shipped. Generators emit the same World schema
// (section 5) plus a declared `world_type`.
//
// All checks are real celestial mechanics with cited scalings; the engine validates them in
// CI the same way it validates everything else.

import type { World, KeplerElements } from "./world.js";

// --- physical constants (SI unless noted) ---
const G = 6.674e-11;
const MSUN = 1.989e30, MEARTH = 5.972e24;
const RSUN = 6.957e8, REARTH = 6.371e6;
const AU = 1.495978707e11, YEAR_S = 3.15576e7, DAY_S = 86400, HOUR_S = 3600;
const GYR = 1e9 * YEAR_S;

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

export interface GeneratedWorld extends World {
  world_type: WorldType;
  age_gyr: number;
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
    const a = m.orbit.a_au;
    checks.push({
      name: `moon ${m.name}: Roche < a < 0.4 R_Hill`,
      ok: a > roche && a < 0.4 * rHill,
      detail: `${roche.toFixed(5)} < ${a.toFixed(5)} < ${(0.4 * rHill).toFixed(5)} AU`,
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
      checks.push({ name: ">= 2 moons", ok: w.moons.length >= 2, detail: `${w.moons.length} moons` }, ...moonChecks(w));
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
const baseOrbit = (a_au: number, e: number, r: () => number): KeplerElements => ({
  a_au, e, i_deg: uniform(r, 0, 5), Omega_deg: uniform(r, 0, 360),
  omega_deg: uniform(r, 0, 360), M0_deg: uniform(r, 0, 360), epoch_jd: J2000_JD,
});

function buildWorld(type: WorldType, host: StarPhysical, age_gyr: number, opts: {
  a_au: number; e: number; tilt_deg: number; rotation_period_s: number;
  planet_radius_km?: number; planet_mass_mearth?: number; moons?: World["moons"]; name: string;
}): GeneratedWorld {
  return {
    schema_version: "0.1",
    name: opts.name,
    world_type: type,
    age_gyr,
    host_star: {
      catalog_id: null, galactic_xyz_pc: [0, 0, 0], space_velocity_kms: [0, 0, 0],
      mass_msun: host.mass_msun, luminosity_lsun: host.luminosity_lsun,
      teff_k: host.teff_k, radius_rsun: host.radius_rsun,
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
  };
}

function sampleOne(type: WorldType, r: () => number, idx: number): GeneratedWorld {
  const name = `${type.replace(/_/g, " ")} #${idx}`;
  switch (type) {
    case "habitable": {
      const host = mainSequenceStar(uniform(r, 0.8, 1.2)); // Sun-like, so HZ is outside the locking radius
      const hz = habitableZoneAU(host.luminosity_lsun);
      return buildWorld(type, host, uniform(r, 1, 8), {
        a_au: uniform(r, hz.inner, hz.outer), e: uniform(r, 0, 0.05),
        tilt_deg: uniform(r, 0, 35), rotation_period_s: uniform(r, 16, 40) * HOUR_S, name,
      });
    }
    case "tidally_locked": {
      const host = mainSequenceStar(uniform(r, 0.15, 0.45)); // M dwarf: HZ sits inside the locking radius
      const hz = habitableZoneAU(host.luminosity_lsun);
      const a = uniform(r, hz.inner * 0.6, hz.outer);
      const Porb_s = orbitalPeriodYears(a, host.mass_msun) * YEAR_S;
      return buildWorld(type, host, uniform(r, 3, 10), { a_au: a, e: uniform(r, 0, 0.04), tilt_deg: uniform(r, 0, 10), rotation_period_s: Porb_s, name });
    }
    case "cold_distant": {
      const host = mainSequenceStar(uniform(r, 0.3, 1.0));
      return buildWorld(type, host, uniform(r, 1, 9), {
        a_au: logUniform(r, 5, 60), e: uniform(r, 0, 0.2), tilt_deg: uniform(r, 0, 30),
        rotation_period_s: uniform(r, 10, 30) * HOUR_S, name,
      });
    }
    case "high_obliquity": {
      const host = mainSequenceStar(uniform(r, 0.6, 1.3));
      const hz = habitableZoneAU(host.luminosity_lsun);
      return buildWorld(type, host, uniform(r, 1, 8), {
        a_au: uniform(r, hz.inner, hz.outer * 1.5), e: uniform(r, 0, 0.1),
        tilt_deg: uniform(r, 50, 110), rotation_period_s: uniform(r, 12, 30) * HOUR_S, name,
      });
    }
    case "multi_moon": {
      const host = mainSequenceStar(uniform(r, 0.7, 1.3));
      const pr = uniform(r, 5000, 9000), pm = uniform(r, 0.8, 3.0);
      const hz = habitableZoneAU(host.luminosity_lsun);
      const a_planet = uniform(r, hz.inner, hz.outer * 1.4);
      const rHill = hillRadiusAU(a_planet, pm, host.mass_msun);
      const roche = rocheLimitAU(pr, pm);
      // lay moons from just outside Roche outward, each well beyond the previous mutual-Hill gap
      const n = 2 + Math.floor(r() * 3); // 2..4
      const moons: World["moons"] = [];
      let a = roche * uniform(r, 1.5, 2.2);
      for (let i = 0; i < n && a < 0.38 * rHill; i++) {
        const rad = uniform(r, 800, 2000);
        moons.push({ name: `moon ${String.fromCharCode(97 + i)}`, radius_km: rad, albedo: uniform(r, 0.06, 0.3),
          orbit: baseOrbit(a, uniform(r, 0, 0.03), r) });
        a *= uniform(r, 1.9, 2.6); // generous spacing to clear mutual Hill
      }
      return buildWorld(type, host, uniform(r, 1, 8), { a_au: a_planet, e: uniform(r, 0, 0.05), tilt_deg: uniform(r, 0, 30),
        rotation_period_s: uniform(r, 14, 28) * HOUR_S, planet_radius_km: pr, planet_mass_mearth: pm, moons, name });
    }
    case "eccentric": {
      const host = mainSequenceStar(uniform(r, 0.6, 1.3));
      const hz = habitableZoneAU(host.luminosity_lsun);
      return buildWorld(type, host, uniform(r, 1, 8), {
        a_au: uniform(r, hz.inner, hz.outer * 1.6), e: uniform(r, 0.35, 0.7),
        tilt_deg: uniform(r, 0, 35), rotation_period_s: uniform(r, 12, 30) * HOUR_S, name,
      });
    }
  }
}

/** Generate one valid world of a given type: sample, validate, resample on failure. */
export function generateWorld(type: WorldType, rng: () => number, idx = 1, maxAttempts = 3000): GeneratedWorld {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const w = sampleOne(type, rng, idx);
    if (validateWorld(w).ok) return w;
  }
  throw new Error(`could not generate a valid ${type} world in ${maxAttempts} attempts`);
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
