# Dossier — multi moon #1
### Site: Cairo (30.0444°, 31.2357°)

*Computed observational truth for this world, from this site. Every figure below is derived directly from the engine's orbital mechanics — nothing here is named, dated to a real calendar, or interpreted. That is the artist's work; this document is the machine's report of what the sky does.*

## 1 · The World

**multi moon #1** — a *multi moon* world, 2.55 Gyr old.

Host star: HIP47592 — a real catalog identity at galactic position (-3.19, -13.47, 5.46) pc. 1.22 M☉, 2.02 L☉, 6350 K, 1.17 R☉.

Planet: 6201 km radius, 2.57 M⊕, orbiting at 1.691 AU (e = 0.019), axial tilt 5.23°. 3 moons.

Observer site: 30.0444°, 31.2357° — **temperate-equivalent** (outside the sub-stellar excursion but short of the polar threshold — an ordinary mid-latitude site with a real but bounded seasonal swing).

<details><summary>Provenance (real vs. derived/sampled)</summary>

- **host**: real — real catalog star HIP47592: observed galactic position & space velocity; luminosity from its absolute magnitude (M=4.07, BP-RP 0.53)
- **host_star.galactic_xyz_pc**: real — real: the host star's catalog position (the observer's vantage)
- **host_star.luminosity_lsun**: real — real-derived: from the host's observed absolute magnitude (distance + apparent mag)
- **host_star.mass_msun**: derived — derived: mass-luminosity relation L = M^3.5
- **host_star.radius_rsun**: derived — derived: main-sequence radius R = M^0.8
- **host_star.teff_k**: derived — derived: Teff = Tsun*(L/R^2)^0.25, consistent with L and R
- **planet.orbit.a_au**: derived — sampled near the host's habitable zone
- **planet.orbit.e**: derived — sampled for a multi moon world
- **planet.axial_tilt_deg**: derived — sampled
- **planet.rotation_period_s**: derived — sampled
- **moons**: derived — near-2:1 resonant chain (Laplace-type: recurring multi-moon alignments); inclined orbits -> eclipse seasons; adjacent moons mutually Hill-stable

</details>

*Engine queries: `World`/`HostStar`/`Planet` schema fields; generator provenance record.*

## 2 · The Day & The Year

Sidereal rotation (spin relative to the stars): **0.6656 d** (15.98 h). Solar day — 1 **local day**, sunrise to sunrise: **0.6662 d** (15.99 h) — measurably longer than the sidereal spin, because the planet's own orbital motion adds one apparent rotation per year. Orbit (local year): **1.9893 yr**.

Day : year ratio — **1090 local days, plus 0.5707 of a day** (9.13 h). That remainder is what any calendar built on whole days must reconcile.

Solstices/equinoxes (years-since-epoch, local day in parens): summer +0.9947 yr (local day 545.3); winter +0.0000 yr (local day 0.0); equinox +0.4850 yr (local day 265.9); equinox +1.5043 yr (local day 824.7).

Day length over the year: **7.72 h to 8.26 h**.

Sunrise-azimuth range over the year (the Chankillo span): **83.8° to 96.0°** (E to E), a swing of 12.2°.

*Engine queries: `orbitalPeriodYears`-equivalent (Kepler III), `findRiseSetTransit`, `inertialToHorizontal`, plus this tool's `findSolsticesEquinoxes`/`siteYearScan` (geometry.ts) built on them.*

## 3 · The Moons

**moon a** — orbital period 1.279 local days; synodic (phase) period 1.28 local days. Inclination 13.27° (to the system's reference plane), eccentricity 0.021: apparent size ranges from 7905″ to 8250″ over one orbit.

**moon b** — orbital period 2.559 local days; synodic (phase) period 2.57 local days. Inclination 10.05° (to the system's reference plane), eccentricity 0.048: apparent size ranges from 4247″ to 4676″ over one orbit.

**moon c** — orbital period 5.118 local days; synodic (phase) period 5.14 local days. Inclination 14.52° (to the system's reference plane), eccentricity 0.018: apparent size ranges from 2253″ to 2336″ over one orbit.

**The chord** (period ratios between adjacent moons):
- moon a : moon b = 2.0000 — near **2:1** resonance
- moon b : moon c = 2.0000 — near **2:1** resonance

The full multi-moon configuration recurs (all moons return near their starting phase together) every **5.12 local days**.

Year vs. month, in whole numbers:
- moon a: **851 months** per local year, remainder **0.44 days**.
- moon b: **425 months** per local year, remainder **0.44 days**.
- moon c: **212 months** per local year, remainder **0.44 days**.

*Engine queries: `keplerPosition`/Kepler III on each moon's `a_au` about the planet's mass; this tool's `synodicYears`/`resonanceChord`/`alignmentRecurrenceYears` (geometry.ts).*

## 4 · Eclipses & Alignments

Scanned **20.0 local years** (39.79 Julian years) for host-star × moon occultations and close conjunctions.

**moon a**: **40 eclipse seasons** in the scan window, spaced ~**545.5 local days** apart, averaging **33.8 events** over **42.2 local days** each.
  Master cycle: seasons repeat with period **1090.6 local days** (one full local year — this engine models no nodal precession, so the cycle does not drift; empirical residual **0.39 days**, i.e. no detectable Saros-like beat).

**moon b**: **40 eclipse seasons** in the scan window, spaced ~**545.6 local days** apart, averaging **16.8 events** over **40.8 local days** each.
  Master cycle: seasons repeat with period **1090.6 local days** (one full local year — this engine models no nodal precession, so the cycle does not drift; empirical residual **1.17 days**, i.e. no detectable Saros-like beat).

**moon c**: **40 eclipse seasons** in the scan window, spaced ~**545.7 local days** apart, averaging **11.7 events** over **55.9 local days** each.
  Master cycle: seasons repeat with period **1090.6 local days** (one full local year — this engine models no nodal precession, so the cycle does not drift; empirical residual **1.84 days**, i.e. no detectable Saros-like beat).

Moon-pair conjunction cycles (synodic periods):
- moon a × moon b: every **2.56 local days**
- moon a × moon c: every **1.71 local days**
- moon b × moon c: every **5.12 local days**

*Engine queries: `findMinSeparation` (per-orbit local minima, windowed around analytic node-crossings of the host star's ecliptic longitude); this tool's `scanEclipseSeasons` (geometry.ts).*

## 5 · The Stars

The 30 brightest stars from this vantage (full table in the appendix). Brightest: **HIP30438** at magnitude -0.85.

*(1 catalog entry within 0.1 pc of the host star's own position was excluded as a cross-matched duplicate detection of the host itself, not a distinct background star — see `HOST_DUPLICATE_EXCLUSION_PC` in geometry.ts.)*

North pole: **HIP46977**, 2.41° off (mag 4.80).
South pole: **HIP51839**, 0.90° off (mag 3.97).

**294 tight naked-eye groupings** (≤3° apart, among stars mag ≤ 4) — candidate asterism seeds, listed by designation only:
- Gaia DR3 4357027756659697664 — HIP79593 (0.93°)
- Gaia DR3 4993479684438433792 — HIP2081 (1.13°)
- Gaia DR3 4038055447778237312 — HIP89642 (1.31°)
- Gaia DR3 4038055447778237312 — HIP90185 (1.53°)
- Gaia DR3 1222646935698492160 — HIP76267 (0.75°)
- Gaia DR3 5111187420714898304 — HIP18543 (1.94°)
- Gaia DR3 4429785739602747392 — HIP77070 (0.34°)
- Gaia DR3 4429785739602747392 — HIP84345 (2.68°)
- Gaia DR3 3704342295607157120 — HIP63090 (1.18°)
- Gaia DR3 4473334474604992384 — HIP86742 (0.20°)
- Gaia DR3 4629125170492116224 — HIP17678 (0.17°)
- Gaia DR3 702343774145932544 — HIP45860 (0.01°)
- Gaia DR3 4076915349846977664 — HIP90496 (0.32°)
- Gaia DR3 3736865265441207424 — HIP63608 (1.61°)
- Gaia DR3 5512070906394195968 — Gaia DR3 5541379935031012608 (2.64°)
- Gaia DR3 5512070906394195968 — HIP36377 (0.52°)
- Gaia DR3 5512070906394195968 — HIP40706 (2.45°)
- Gaia DR3 510204838759030144 — HIP3179 (2.17°)
- Gaia DR3 510204838759030144 — HIP6686 (0.29°)
- Gaia DR3 5859405805013401984 — Gaia DR3 6054346605287699968 (2.94°)
- *(274 more in the appendix)*

Milky Way band: reaches **63.4°** altitude at this site — an arch, passing near overhead, crossing the horizon near NNW and SSE.

No catalog stars from the brightest 30 pass within 2° of the zenith at this latitude.

*Engine queries: `relocateStar` (Stage 1) over the full catalog; this tool's `nearestToPole`/`tightGroupings`/`milkyWayAtSite`/`zenithStars` (geometry.ts); Milky Way orientation via `helioToGalcen`/`galactocentricToIcrs`.*

## 6 · Rising & Setting

Rise/set azimuths for the 30 brightest stars (full table in the appendix) — the raw data for a star compass.

Circumpolar at this site: HIP36850, HIP37826.

**5 shared rising houses** (stars rising within the same 5°-wide azimuth bin):
- ~160° (SSE): HIP30438, HIP61932
- ~40° (NE): HIP49669, HIP25428
- ~75° (ENE): HIP27989, HIP25336
- ~105° (ESE): HIP65474, HIP39757
- ~50° (NE): HIP21421, HIP50583, HIP31681

Heliacal rising/setting dates found for 22 of the 30 (calendar-anchor stars; full dates in the appendix).

*Engine queries: `findRiseSetTransit` + `inertialToHorizontal` at the rise/set moments; this tool's `heliacalDates` (geometry.ts, arcus-visionis proxy: sun between -6° and -18° altitude at the star's rise/set).*

## 7 · Deep Time

**100 local years** (1.99e+2 yr) — within the validated range. The fastest of the top-10 brightest stars drifts up to **0.056°**.
**1,000 local years** (1.99e+3 yr) — within the validated range. The fastest of the top-10 brightest stars drifts up to **0.570°**.
**10,000 local years** (1.99e+4 yr) — within the validated range. The fastest of the top-10 brightest stars drifts up to **6.296°** — enough to visibly deform a tight grouping over that span.

**Axial precession is not modeled** in this engine — the spin pole's RA/Dec is fixed for all simulated time. A real planet's precession (Earth's is ~26,000 yr) would slowly rotate every rising/setting/zenith/pole table in this document; none of that motion is represented here.

Honest caps: rectilinear propagation is validated to **1e+5 yr**; galactic-orbit propagation to **1e+6 yr**. Figures beyond these are extrapolation.

*Engine queries: `relocateStar` at two epochs (this tool's `properMotionDriftDeg`, geometry.ts); `PROPAGATION_MODELS` honest-cap metadata.*

## 8 · Appendix — full tables

### 8.1 World parameters
| field | value |
| --- | --- |
| world_type | multi_moon |
| age_gyr | 2.550 |
| host.catalog_id | HIP47592 |
| host.mass_msun | 1.223 |
| host.luminosity_lsun | 2.020 |
| host.teff_k | 6349.978 |
| host.radius_rsun | 1.174 |
| planet.radius_km | 6201.221 |
| planet.mass_mearth | 2.569 |
| planet.a_au | 1.691 |
| planet.e | 0.019 |
| planet.axial_tilt_deg | 5.226 |
| site.lat_deg | 30.044 |
| site.lon_deg | 31.236 |

### 8.2 Calendar
| field | value |
| --- | --- |
| rotation_days_sidereal | 0.666 |
| solar_day_hours | 15.990 |
| orbit_years | 1.989 |
| days_per_year_local | 1090.571 |
| summer_solstice_yr | 0.995 |
| winter_solstice_yr | 0.000 |
| equinox_1_yr | 0.485 |
| equinox_2_yr | 1.504 |
| min_day_hours | 7.719 |
| max_day_hours | 8.257 |
| min_rise_az_deg | 83.814 |
| max_rise_az_deg | 95.972 |

### 8.3 Moons
| moon | period_local_days | synodic | inc_deg | e | ang_diam_min_arcsec | ang_diam_max_arcsec |
| --- | --- | --- | --- | --- | --- | --- |
| moon a | 1.279 | 1.28 local days | 13.274 | 0.021 | 7905.234 | 8249.897 |
| moon b | 2.559 | 2.57 local days | 10.051 | 0.048 | 4247.435 | 4675.561 |
| moon c | 5.118 | 5.14 local days | 14.519 | 0.018 | 2252.505 | 2335.783 |

### 8.4 Eclipse seasons (per moon, summarized)
| moon | start_yr | end_yr | duration_local_days | event_count | min_sep_deg |
| --- | --- | --- | --- | --- | --- |
| moon a | 0.242 | 0.319 | 42.275 | 34.000 | 0.039 |
| moon a | 1.256 | 1.333 | 42.269 | 34.000 | 0.039 |
| moon a | 2.230 | 2.307 | 42.275 | 34.000 | 0.026 |
| moon a | 3.244 | 3.321 | 42.269 | 34.000 | 0.023 |
| moon a | 4.221 | 4.298 | 42.289 | 34.000 | 0.008 |
| moon a | 5.235 | 5.312 | 42.269 | 34.000 | 0.010 |
| moon a | 6.209 | 6.287 | 42.275 | 34.000 | 0.042 |
| moon a | 7.224 | 7.301 | 42.269 | 34.000 | 0.043 |
| moon a | 8.198 | 8.275 | 42.275 | 34.000 | 0.023 |
| moon a | 9.212 | 9.289 | 42.269 | 34.000 | 0.020 |
| moon a | 10.189 | 10.266 | 42.275 | 34.000 | 0.011 |
| moon a | 11.203 | 11.280 | 42.269 | 34.000 | 0.013 |
| moon a | 12.177 | 12.254 | 42.275 | 34.000 | 0.046 |
| moon a | 13.191 | 13.268 | 42.269 | 34.000 | 0.046 |
| moon a | 14.166 | 14.243 | 42.275 | 34.000 | 0.020 |
| moon a | 15.180 | 15.257 | 42.269 | 34.000 | 0.016 |
| moon a | 16.157 | 16.234 | 42.275 | 34.000 | 0.015 |
| moon a | 17.171 | 17.248 | 42.269 | 34.000 | 0.016 |
| moon a | 18.145 | 18.222 | 42.275 | 34.000 | 0.049 |
| moon a | 19.159 | 19.236 | 42.269 | 34.000 | 0.046 |
| moon a | 20.136 | 20.211 | 40.994 | 33.000 | 0.016 |
| moon a | 21.148 | 21.225 | 42.269 | 33.000 | 0.013 |
| moon a | 22.124 | 22.202 | 42.275 | 34.000 | 0.018 |
| moon a | 23.139 | 23.216 | 42.269 | 34.000 | 0.020 |
| moon a | 24.113 | 24.190 | 42.275 | 34.000 | 0.047 |
| moon a | 25.127 | 25.204 | 42.269 | 34.000 | 0.043 |
| moon a | 26.101 | 26.179 | 42.275 | 33.000 | 0.013 |
| moon a | 27.118 | 27.193 | 40.988 | 33.000 | 0.010 |
| moon a | 28.092 | 28.169 | 42.275 | 34.000 | 0.021 |
| moon a | 29.106 | 29.183 | 42.269 | 34.000 | 0.023 |
| moon a | 30.081 | 30.158 | 42.275 | 34.000 | 0.044 |
| moon a | 31.095 | 31.172 | 42.269 | 34.000 | 0.039 |
| moon a | 32.069 | 32.146 | 42.275 | 33.000 | 0.009 |
| moon a | 33.086 | 33.163 | 42.217 | 33.000 | 0.007 |
| moon a | 34.060 | 34.137 | 42.275 | 34.000 | 0.025 |
| moon a | 35.074 | 35.151 | 42.269 | 34.000 | 0.026 |
| moon a | 36.049 | 36.126 | 42.275 | 34.000 | 0.040 |
| moon a | 37.063 | 37.140 | 42.269 | 34.000 | 0.036 |
| moon a | 38.039 | 38.116 | 42.231 | 33.000 | 0.006 |
| moon a | 39.051 | 39.131 | 43.541 | 34.000 | 0.003 |
| moon b | 0.564 | 0.639 | 41.047 | 17.000 | 0.018 |
| moon b | 1.584 | 1.654 | 38.467 | 16.000 | 0.056 |
| moon b | 2.553 | 2.628 | 41.047 | 17.000 | 0.007 |
| moon b | 3.573 | 3.648 | 41.047 | 17.000 | 0.068 |
| moon b | 4.541 | 4.616 | 41.047 | 17.000 | 0.032 |
| moon b | 5.561 | 5.636 | 41.031 | 17.000 | 0.042 |
| moon b | 6.530 | 6.605 | 41.047 | 16.000 | 0.057 |
| moon b | 7.550 | 7.625 | 41.031 | 17.000 | 0.016 |
| moon b | 8.523 | 8.598 | 41.094 | 17.000 | 0.064 |
| moon b | 9.538 | 9.613 | 41.031 | 17.000 | 0.010 |
| moon b | 10.511 | 10.586 | 41.047 | 17.000 | 0.039 |
| moon b | 11.527 | 11.602 | 41.031 | 17.000 | 0.036 |
| moon b | 12.500 | 12.575 | 41.047 | 17.000 | 0.013 |
| moon b | 13.520 | 13.590 | 38.467 | 15.000 | 0.061 |
| moon b | 14.488 | 14.563 | 41.047 | 17.000 | 0.012 |
| moon b | 15.508 | 15.583 | 41.031 | 17.000 | 0.063 |
| moon b | 16.477 | 16.552 | 41.047 | 17.000 | 0.037 |
| moon b | 17.497 | 17.572 | 41.031 | 17.000 | 0.037 |
| moon b | 18.470 | 18.540 | 38.481 | 16.000 | 0.062 |
| moon b | 19.485 | 19.560 | 41.031 | 17.000 | 0.011 |
| moon b | 20.459 | 20.533 | 41.047 | 17.000 | 0.059 |
| moon b | 21.474 | 21.549 | 41.031 | 17.000 | 0.015 |
| moon b | 22.447 | 22.522 | 41.047 | 17.000 | 0.034 |
| moon b | 23.462 | 23.537 | 41.031 | 17.000 | 0.041 |
| moon b | 24.436 | 24.510 | 41.047 | 17.000 | 0.008 |
| moon b | 25.451 | 25.526 | 41.031 | 16.000 | 0.066 |
| moon b | 26.424 | 26.499 | 41.047 | 17.000 | 0.017 |
| moon b | 27.444 | 27.519 | 41.031 | 17.000 | 0.058 |
| moon b | 28.413 | 28.487 | 41.047 | 17.000 | 0.042 |
| moon b | 29.433 | 29.507 | 41.031 | 17.000 | 0.032 |
| moon b | 30.406 | 30.480 | 40.947 | 16.000 | 0.067 |
| moon b | 31.421 | 31.496 | 41.031 | 17.000 | 0.006 |
| moon b | 32.394 | 32.469 | 41.047 | 17.000 | 0.054 |
| moon b | 33.410 | 33.484 | 41.031 | 17.000 | 0.020 |
| moon b | 34.383 | 34.458 | 41.047 | 17.000 | 0.029 |
| moon b | 35.398 | 35.473 | 41.031 | 17.000 | 0.046 |
| moon b | 36.371 | 36.446 | 41.047 | 17.000 | 0.003 |
| moon b | 37.391 | 37.466 | 40.988 | 16.000 | 0.072 |
| moon b | 38.360 | 38.435 | 41.047 | 17.000 | 0.022 |
| moon b | 39.380 | 39.455 | 41.031 | 17.000 | 0.052 |
| moon c | 0.313 | 0.417 | 56.562 | 12.000 | 0.152 |
| moon c | 1.336 | 1.439 | 56.548 | 12.000 | 0.063 |
| moon c | 2.302 | 2.405 | 56.562 | 12.000 | 0.115 |
| moon c | 3.324 | 3.427 | 56.548 | 12.000 | 0.099 |
| moon c | 4.290 | 4.393 | 56.562 | 11.000 | 0.077 |
| moon c | 5.313 | 5.416 | 56.548 | 12.000 | 0.135 |
| moon c | 6.279 | 6.382 | 56.562 | 11.000 | 0.040 |
| moon c | 7.301 | 7.404 | 56.548 | 12.000 | 0.171 |
| moon c | 8.277 | 8.380 | 56.384 | 11.000 | 0.003 |
| moon c | 9.289 | 9.393 | 56.548 | 12.000 | 0.208 |
| moon c | 10.265 | 10.368 | 56.562 | 12.000 | 0.034 |
| moon c | 11.278 | 11.381 | 56.548 | 12.000 | 0.176 |
| moon c | 12.254 | 12.357 | 56.562 | 12.000 | 0.072 |
| moon c | 13.266 | 13.370 | 56.548 | 12.000 | 0.140 |
| moon c | 14.242 | 14.345 | 56.562 | 12.000 | 0.109 |
| moon c | 15.255 | 15.358 | 56.548 | 12.000 | 0.104 |
| moon c | 16.231 | 16.334 | 56.562 | 12.000 | 0.146 |
| moon c | 17.253 | 17.347 | 51.407 | 10.000 | 0.067 |
| moon c | 18.219 | 18.322 | 56.562 | 12.000 | 0.183 |
| moon c | 19.241 | 19.335 | 51.407 | 10.000 | 0.388 |
| moon c | 20.208 | 20.311 | 56.562 | 12.000 | 0.211 |
| moon c | 21.230 | 21.324 | 51.407 | 11.000 | 0.005 |
| moon c | 22.196 | 22.299 | 56.562 | 12.000 | 0.174 |
| moon c | 23.218 | 23.321 | 56.548 | 12.000 | 0.041 |
| moon c | 24.185 | 24.288 | 56.562 | 12.000 | 0.137 |
| moon c | 25.207 | 25.310 | 56.548 | 12.000 | 0.077 |
| moon c | 26.173 | 26.276 | 56.562 | 12.000 | 0.100 |
| moon c | 27.195 | 27.298 | 56.548 | 12.000 | 0.113 |
| moon c | 28.162 | 28.265 | 56.562 | 11.000 | 0.063 |
| moon c | 29.184 | 29.287 | 56.548 | 12.000 | 0.150 |
| moon c | 30.159 | 30.253 | 51.420 | 10.000 | 0.025 |
| moon c | 31.172 | 31.275 | 56.548 | 12.000 | 0.186 |
| moon c | 32.148 | 32.251 | 56.560 | 12.000 | 0.012 |
| moon c | 33.161 | 33.264 | 56.548 | 12.000 | 0.198 |
| moon c | 34.136 | 34.240 | 56.562 | 12.000 | 0.049 |
| moon c | 35.149 | 35.252 | 56.548 | 12.000 | 0.161 |
| moon c | 36.125 | 36.228 | 56.562 | 12.000 | 0.086 |
| moon c | 37.138 | 37.241 | 56.548 | 12.000 | 0.125 |
| moon c | 38.113 | 38.217 | 56.562 | 12.000 | 0.124 |
| moon c | 39.136 | 39.229 | 51.407 | 11.000 | 0.089 |

### 8.5 Brightest 30 stars
| designation | mag | bp_rp | dist_pc | visibility |
| --- | --- | --- | --- | --- |
| HIP30438 | -0.846 | 0.164 | 86.420 | rises and sets |
| HIP24436 | 0.127 | -0.030 | 231.226 | rises and sets |
| HIP49669 | 0.323 | -0.087 | 14.734 | rises and sets |
| HIP27989 | 0.350 | 1.500 | 125.157 | rises and sets |
| HIP68702 | 0.506 | -0.231 | 153.497 | never rises |
| HIP7588 | 0.510 | -0.158 | 45.319 | rises and sets |
| HIP60718 | 0.553 | -0.243 | 88.991 | never rises |
| HIP65474 | 0.762 | -0.235 | 72.715 | rises and sets |
| HIP42913 | 0.774 | 0.043 | 14.359 | never rises |
| HIP69673 | 0.835 | 1.239 | 16.915 | rises and sets |
| HIP39757 | 0.838 | 0.458 | 7.687 | rises and sets |
| HIP61084 | 0.887 | 1.600 | 19.500 | rises and sets |
| HIP24608 | 1.035 | 0.795 | 20.081 | rises and sets |
| HIP62434 | 1.054 | -0.238 | 98.784 | never rises |
| HIP80763 | 1.065 | 1.865 | 185.587 | rises and sets |
| HIP45238 | 1.086 | 0.070 | 26.048 | never rises |
| HIP46651 | 1.174 | 0.371 | 6.072 | never rises |
| HIP21421 | 1.254 | 1.538 | 23.825 | rises and sets |
| HIP33579 | 1.301 | -0.211 | 120.512 | rises and sets |
| HIP46390 | 1.336 | 1.440 | 40.218 | rises and sets |
| HIP50583 | 1.456 | 1.128 | 29.841 | rises and sets |
| HIP25336 | 1.526 | -0.224 | 70.703 | rises and sets |
| HIP31681 | 1.629 | 0.001 | 27.969 | rises and sets |
| HIP36850 | 1.632 | 0.034 | 16.189 | circumpolar |
| HIP61932 | 1.634 | -0.023 | 30.815 | rises and sets |
| HIP39953 | 1.639 | -0.145 | 244.931 | rises and sets |
| HIP85927 | 1.639 | -0.231 | 217.450 | rises and sets |
| HIP37826 | 1.666 | 0.991 | 13.050 | circumpolar |
| HIP25428 | 1.672 | -0.130 | 40.582 | rises and sets |
| HIP26727 | 1.682 | -0.199 | 244.055 | rises and sets |

### 8.6 Tight groupings (full)
| a | b | sep_deg |
| --- | --- | --- |
| Gaia DR3 4357027756659697664 | HIP79593 | 0.931 |
| Gaia DR3 4993479684438433792 | HIP2081 | 1.133 |
| Gaia DR3 4038055447778237312 | HIP89642 | 1.308 |
| Gaia DR3 4038055447778237312 | HIP90185 | 1.528 |
| Gaia DR3 1222646935698492160 | HIP76267 | 0.751 |
| Gaia DR3 5111187420714898304 | HIP18543 | 1.936 |
| Gaia DR3 4429785739602747392 | HIP77070 | 0.343 |
| Gaia DR3 4429785739602747392 | HIP84345 | 2.681 |
| Gaia DR3 3704342295607157120 | HIP63090 | 1.185 |
| Gaia DR3 4473334474604992384 | HIP86742 | 0.201 |
| Gaia DR3 4629125170492116224 | HIP17678 | 0.170 |
| Gaia DR3 702343774145932544 | HIP45860 | 0.006 |
| Gaia DR3 4076915349846977664 | HIP90496 | 0.316 |
| Gaia DR3 3736865265441207424 | HIP63608 | 1.612 |
| Gaia DR3 5512070906394195968 | Gaia DR3 5541379935031012608 | 2.640 |
| Gaia DR3 5512070906394195968 | HIP36377 | 0.522 |
| Gaia DR3 5512070906394195968 | HIP40706 | 2.446 |
| Gaia DR3 510204838759030144 | HIP3179 | 2.165 |
| Gaia DR3 510204838759030144 | HIP6686 | 0.289 |
| Gaia DR3 5859405805013401984 | Gaia DR3 6054346605287699968 | 2.937 |
| Gaia DR3 5859405805013401984 | HIP59929 | 0.613 |
| Gaia DR3 5859405805013401984 | HIP61585 | 2.844 |
| Gaia DR3 4049975081571729920 | HIP88635 | 0.953 |
| Gaia DR3 4049975081571729920 | HIP93085 | 1.807 |
| Gaia DR3 4049975081571729920 | HIP94141 | 2.951 |
| Gaia DR3 3557567320183657472 | HIP52943 | 0.153 |
| Gaia DR3 4935615308047192576 | HIP6867 | 0.457 |
| Gaia DR3 3211922645854328832 | HIP23875 | 0.408 |
| Gaia DR3 5826168461855385472 | HIP77952 | 0.369 |
| Gaia DR3 2887731882922767744 | HIP20042 | 2.288 |
| Gaia DR3 2887731882922767744 | HIP27628 | 1.143 |
| Gaia DR3 2255173119658513408 | HIP94376 | 0.285 |
| Gaia DR3 4444057469252265984 | HIP83000 | 0.383 |
| Gaia DR3 1517698716348324992 | HIP63125 | 2.550 |
| Gaia DR3 5249119024128109952 | Gaia DR3 5409223585178017152 | 2.022 |
| Gaia DR3 5249119024128109952 | HIP47175 | 1.963 |
| Gaia DR3 6270558110774003968 | HIP68895 | 1.233 |
| Gaia DR3 3520586071217872896 | HIP60965 | 1.235 |
| Gaia DR3 6762701233364896000 | HIP93506 | 2.250 |
| Gaia DR3 6762701233364896000 | HIP93864 | 0.635 |
| Gaia DR3 1487434040320076800 | HIP71075 | 0.225 |
| Gaia DR3 1018776176872261248 | HIP46853 | 0.124 |
| Gaia DR3 6058271964884299520 | HIP60260 | 0.069 |
| Gaia DR3 6058271964884299520 | HIP60718 | 2.263 |
| Gaia DR3 6058271964884299520 | HIP62434 | 2.852 |
| Gaia DR3 1014058103758571520 | HIP44127 | 0.165 |
| Gaia DR3 4573412435280434560 | HIP84379 | 0.359 |
| Gaia DR3 2470140321630664064 | HIP5364 | 0.291 |
| Gaia DR3 5964991494281655808 | HIP82729 | 2.036 |
| Gaia DR3 1041808368494264576 | HIP41704 | 0.163 |
| Gaia DR3 6195030801635544704 | HIP61359 | 2.800 |
| Gaia DR3 1284537517514584704 | HIP71053 | 1.578 |
| Gaia DR3 5849837854861497856 | HIP71908 | 0.005 |
| Gaia DR3 5888394463447019392 | HIP74395 | 0.626 |
| Gaia DR3 399402894487590144 | HIP7607 | 0.081 |
| Gaia DR3 1278391075717325312 | HIP74666 | 0.550 |
| Gaia DR3 2211820991085587584 | Gaia DR3 2200153454733285248 | 2.452 |
| Gaia DR3 2211820991085587584 | HIP109492 | 2.055 |
| Gaia DR3 3561350430457837056 | HIP55282 | 0.182 |
| Gaia DR3 5965222838410499328 | HIP84143 | 0.571 |
| Gaia DR3 5965222838410499328 | HIP90185 | 1.772 |
| Gaia DR3 5965222838410499328 | HIP92041 | 1.068 |
| Gaia DR3 3352485999058854912 | HIP18532 | 2.802 |
| Gaia DR3 3352485999058854912 | HIP32362 | 2.494 |
| Gaia DR3 5843518239925459456 | HIP63613 | 1.544 |
| Gaia DR3 3748360796947806208 | HIP51069 | 0.064 |
| Gaia DR3 3478394889483944320 | HIP56343 | 0.197 |
| Gaia DR3 5922299347569528832 | HIP82363 | 0.201 |
| Gaia DR3 5922299347569528832 | HIP83081 | 2.696 |
| Gaia DR3 5922299347569528832 | HIP85258 | 1.936 |
| Gaia DR3 3897724469419137664 | HIP57380 | 0.399 |
| Gaia DR3 786420645182229504 | HIP57399 | 0.190 |
| Gaia DR3 3662636823132300032 | HIP66249 | 0.734 |
| Gaia DR3 588551501854159744 | HIP47508 | 0.016 |
| Gaia DR3 3683687763520080384 | HIP61941 | 0.958 |
| Gaia DR3 5273030069128572928 | HIP37504 | 2.871 |
| Gaia DR3 5273030069128572928 | HIP41312 | 0.008 |
| Gaia DR3 805881416880407936 | HIP50801 | 2.504 |
| Gaia DR3 3796442680948579328 | HIP57757 | 0.573 |
| Gaia DR3 3796442680948579328 | HIP81833 | 2.220 |
| Gaia DR3 2965792913525710976 | HIP24305 | 2.156 |
| Gaia DR3 2965792913525710976 | HIP25606 | 2.556 |
| Gaia DR3 2965792913525710976 | HIP27654 | 0.595 |
| Gaia DR3 738259665062428416 | HIP53229 | 0.463 |
| Gaia DR3 738259665062428416 | HIP54539 | 0.900 |
| Gaia DR3 873035017257455104 | Gaia DR3 5760701787150565888 | 1.187 |
| Gaia DR3 873035017257455104 | HIP36046 | 1.705 |
| Gaia DR3 873035017257455104 | HIP43726 | 1.163 |
| Gaia DR3 4672726716408826240 | HIP17440 | 2.040 |
| Gaia DR3 4840356816072211712 | HIP19747 | 0.116 |
| Gaia DR3 2952868119987647744 | HIP33160 | 0.653 |
| Gaia DR3 643819484617141504 | HIP48455 | 1.598 |
| Gaia DR3 6203033940614597504 | HIP72010 | 1.251 |
| Gaia DR3 3174163561130003840 | HIP21594 | 0.836 |
| Gaia DR3 4990516294443333504 | HIP9236 | 2.192 |
| Gaia DR3 1273423791421021568 | HIP75695 | 0.331 |
| Gaia DR3 5642935536248627456 | HIP43409 | 0.036 |
| Gaia DR3 5775835843156608256 | Gaia DR3 5777500503761872128 | 1.370 |
| Gaia DR3 5775835843156608256 | HIP81065 | 0.782 |
| Gaia DR3 2995725777563537792 | HIP28103 | 0.347 |
| Gaia DR3 660136821288588416 | HIP42911 | 0.048 |
| Gaia DR3 6419476755916988032 | HIP91792 | 0.338 |
| Gaia DR3 4929469381645492864 | HIP5165 | 1.157 |
| Gaia DR3 1049765396704695936 | Gaia DR3 1144716265942885888 | 1.775 |
| Gaia DR3 1049765396704695936 | HIP48319 | 0.054 |
| Gaia DR3 5935306123457567616 | HIP80000 | 1.694 |
| Gaia DR3 3553136288324444544 | HIP53740 | 0.896 |
| Gaia DR3 1144716265942885888 | HIP48319 | 1.814 |
| Gaia DR3 3334901543952614528 | HIP26366 | 0.474 |
| Gaia DR3 4389237503121158016 | HIP79882 | 1.394 |
| Gaia DR3 6260822966106824576 | HIP81377 | 1.907 |
| Gaia DR3 5416916936743969152 | HIP50191 | 0.070 |
| Gaia DR3 6127688772460862976 | HIP61622 | 0.444 |
| Gaia DR3 6127688772460862976 | HIP61932 | 1.596 |
| Gaia DR3 6127688772460862976 | HIP66657 | 2.966 |
| Gaia DR3 2200153454733285248 | HIP109492 | 2.475 |
| Gaia DR3 5364580148905328256 | HIP51986 | 0.373 |
| Gaia DR3 5364580148905328256 | HIP60009 | 1.231 |
| Gaia DR3 5364580148905328256 | HIP60718 | 2.983 |
| Gaia DR3 3905768599567468544 | HIP58948 | 0.430 |
| Gaia DR3 3845263368043470080 | HIP45336 | 1.488 |
| Gaia DR3 5777500503761872128 | HIP81065 | 1.856 |
| Gaia DR3 810952158347760128 | HIP45688 | 1.968 |
| Gaia DR3 5210240327318434304 | HIP40702 | 0.060 |
| Gaia DR3 878467085735262720 | HIP37629 | 0.402 |
| Gaia DR3 5210161643517558528 | HIP45238 | 2.477 |
| Gaia DR3 5877059048308526720 | HIP74824 | 0.101 |
| Gaia DR3 5877059048308526720 | HIP85792 | 2.690 |
| Gaia DR3 6171375049483037696 | HIP67153 | 0.069 |
| Gaia DR3 3526420114274019456 | HIP61174 | 0.145 |
| Gaia DR3 6054346605287699968 | HIP51986 | 2.752 |
| Gaia DR3 6054346605287699968 | HIP60009 | 2.524 |
| Gaia DR3 6054346605287699968 | HIP60718 | 2.497 |
| Gaia DR3 5409223585178017152 | HIP45101 | 2.870 |
| Gaia DR3 5409223585178017152 | HIP47175 | 0.277 |
| Gaia DR3 5509770796785820416 | HIP34834 | 0.441 |
| Gaia DR3 5541379935031012608 | HIP36377 | 2.933 |
| Gaia DR3 5541379935031012608 | HIP40706 | 0.529 |
| Gaia DR3 3818309974360005888 | HIP54182 | 0.141 |
| Gaia DR3 5289757523635492096 | HIP34481 | 1.803 |
| Gaia DR3 6141742283401003264 | HIP77634 | 1.870 |
| Gaia DR3 6141742283401003264 | HIP80763 | 1.651 |
| Gaia DR3 5357075947709011456 | HIP51523 | 0.543 |
| Gaia DR3 5357075947709011456 | HIP72370 | 2.121 |
| Gaia DR3 5531762678610961664 | HIP37606 | 2.006 |
| Gaia DR3 5593584059914156800 | HIP20535 | 1.729 |
| Gaia DR3 5593584059914156800 | HIP38423 | 1.681 |
| Gaia DR3 6148648281576023424 | HIP69996 | 2.503 |
| Gaia DR3 6148648281576023424 | HIP71860 | 1.903 |
| Gaia DR3 3551002857809958400 | HIP53252 | 1.119 |
| Gaia DR3 5702029029197580160 | HIP42430 | 1.445 |
| Gaia DR3 5588607120530408832 | HIP37853 | 0.523 |
| Gaia DR3 3765286988182947840 | HIP49809 | 0.433 |
| Gaia DR3 5725122999630404096 | HIP40035 | 0.165 |
| Gaia DR3 5730371484020807808 | HIP44075 | 0.288 |
| Gaia DR3 5760701787150565888 | HIP33018 | 2.955 |
| Gaia DR3 5760701787150565888 | HIP36046 | 0.909 |
| Gaia DR3 5760701787150565888 | HIP43726 | 2.018 |
| HIP2920 | HIP24608 | 2.708 |
| HIP3179 | HIP6686 | 2.428 |
| HIP5348 | HIP17440 | 2.315 |
| HIP11767 | HIP46733 | 0.943 |
| HIP13209 | HIP21421 | 2.590 |
| HIP15900 | HIP16083 | 1.157 |
| HIP17499 | HIP17573 | 0.327 |
| HIP17499 | HIP17702 | 0.524 |
| HIP17499 | HIP17847 | 1.123 |
| HIP17499 | HIP20455 | 2.288 |
| HIP17499 | HIP20889 | 0.973 |
| HIP17573 | HIP17702 | 0.593 |
| HIP17573 | HIP17847 | 1.186 |
| HIP17573 | HIP20455 | 2.608 |
| HIP17573 | HIP20889 | 1.196 |
| HIP17702 | HIP17847 | 0.609 |
| HIP17702 | HIP20455 | 2.495 |
| HIP17702 | HIP20889 | 0.675 |
| HIP17847 | HIP20455 | 2.707 |
| HIP17847 | HIP20889 | 0.617 |
| HIP20042 | HIP27628 | 1.582 |
| HIP20205 | HIP20455 | 1.989 |
| HIP20205 | HIP20885 | 2.349 |
| HIP20205 | HIP20894 | 1.560 |
| HIP20455 | HIP20885 | 2.400 |
| HIP20455 | HIP20889 | 2.092 |
| HIP20455 | HIP20894 | 1.588 |
| HIP20535 | HIP38423 | 2.681 |
| HIP20885 | HIP20894 | 0.936 |
| HIP20889 | HIP20894 | 2.946 |
| HIP21444 | HIP22109 | 1.906 |
| HIP21444 | HIP25247 | 1.578 |
| HIP22109 | HIP25247 | 0.419 |
| HIP24305 | HIP27654 | 2.082 |
| HIP24436 | HIP24674 | 1.987 |
| HIP25281 | HIP25930 | 2.893 |
| HIP25859 | HIP26634 | 2.220 |
| HIP25930 | HIP26727 | 2.461 |
| HIP27673 | HIP28380 | 0.847 |
| HIP29655 | HIP30343 | 2.962 |
| HIP30438 | HIP32768 | 1.065 |
| HIP33018 | HIP36046 | 2.097 |
| HIP33302 | HIP39757 | 2.919 |
| HIP34922 | HIP36377 | 2.852 |
| HIP36046 | HIP43726 | 2.766 |
| HIP36377 | HIP40706 | 2.657 |
| HIP37279 | HIP112158 | 2.750 |
| HIP37504 | HIP41312 | 2.863 |
| HIP43783 | HIP45101 | 2.846 |
| HIP44382 | HIP46651 | 2.402 |
| HIP44816 | HIP45448 | 2.436 |
| HIP45080 | HIP45101 | 2.897 |
| HIP45080 | HIP45556 | 1.851 |
| HIP45080 | HIP46701 | 2.937 |
| HIP45101 | HIP46701 | 2.599 |
| HIP45101 | HIP47175 | 2.744 |
| HIP46701 | HIP47175 | 2.801 |
| HIP50371 | HIP51576 | 2.764 |
| HIP50954 | HIP102395 | 2.264 |
| HIP51523 | HIP72370 | 2.302 |
| HIP51986 | HIP60009 | 1.078 |
| HIP51986 | HIP60718 | 2.788 |
| HIP52727 | HIP57439 | 1.712 |
| HIP53229 | HIP54539 | 0.614 |
| HIP53253 | HIP61199 | 2.724 |
| HIP56561 | HIP57439 | 2.517 |
| HIP57632 | HIP85670 | 1.411 |
| HIP57757 | HIP81833 | 1.775 |
| HIP58001 | HIP75097 | 1.742 |
| HIP59196 | HIP59449 | 2.600 |
| HIP59199 | HIP72622 | 1.604 |
| HIP59774 | HIP75097 | 2.463 |
| HIP59929 | HIP61585 | 2.234 |
| HIP59929 | HIP62322 | 2.731 |
| HIP60009 | HIP60718 | 1.753 |
| HIP60260 | HIP60718 | 2.292 |
| HIP60260 | HIP62434 | 2.881 |
| HIP61585 | HIP62322 | 1.446 |
| HIP61622 | HIP61932 | 1.159 |
| HIP62434 | HIP63003 | 2.990 |
| HIP62896 | HIP67464 | 1.073 |
| HIP62896 | HIP67472 | 1.917 |
| HIP62896 | HIP68245 | 2.526 |
| HIP67464 | HIP67472 | 0.977 |
| HIP67464 | HIP68245 | 1.882 |
| HIP67472 | HIP68245 | 2.356 |
| HIP67927 | HIP69673 | 2.213 |
| HIP68002 | HIP68282 | 2.662 |
| HIP68245 | HIP68282 | 2.943 |
| HIP69996 | HIP71860 | 2.094 |
| HIP70090 | HIP71865 | 2.351 |
| HIP71352 | HIP73273 | 1.825 |
| HIP71352 | HIP73334 | 1.005 |
| HIP71536 | HIP73807 | 2.482 |
| HIP73273 | HIP73334 | 1.035 |
| HIP73807 | HIP74117 | 2.801 |
| HIP74117 | HIP75264 | 1.270 |
| HIP74824 | HIP85792 | 2.787 |
| HIP74946 | HIP76440 | 2.363 |
| HIP74946 | HIP82273 | 2.534 |
| HIP75141 | HIP76297 | 2.242 |
| HIP76470 | HIP80112 | 1.675 |
| HIP78104 | HIP78265 | 2.842 |
| HIP78265 | HIP80112 | 2.984 |
| HIP78401 | HIP78820 | 2.158 |
| HIP78401 | HIP78933 | 2.147 |
| HIP78820 | HIP78933 | 1.556 |
| HIP80000 | HIP86670 | 2.958 |
| HIP80112 | HIP80763 | 2.620 |
| HIP81833 | HIP87808 | 2.847 |
| HIP82363 | HIP83081 | 2.709 |
| HIP82363 | HIP85258 | 1.737 |
| HIP82514 | HIP82545 | 2.087 |
| HIP84012 | HIP86263 | 2.491 |
| HIP84012 | HIP88048 | 1.169 |
| HIP84143 | HIP90185 | 2.131 |
| HIP84143 | HIP92041 | 0.532 |
| HIP84143 | HIP92855 | 2.583 |
| HIP85696 | HIP85927 | 0.825 |
| HIP86228 | HIP86670 | 2.714 |
| HIP86263 | HIP88048 | 1.728 |
| HIP87261 | HIP89931 | 2.263 |
| HIP88635 | HIP93085 | 2.639 |
| HIP89642 | HIP90185 | 2.755 |
| HIP90185 | HIP92041 | 2.646 |
| HIP92041 | HIP92855 | 2.241 |
| HIP92041 | HIP93085 | 2.874 |
| HIP92420 | HIP93194 | 2.531 |
| HIP92855 | HIP93085 | 2.876 |
| HIP92855 | HIP94141 | 1.458 |
| HIP93085 | HIP94141 | 2.114 |
| HIP93506 | HIP93864 | 2.871 |
| HIP93747 | HIP97365 | 0.933 |
| HIP102488 | HIP104732 | 2.634 |
| HIP108085 | HIP109268 | 1.842 |
| HIP112122 | HIP112623 | 0.192 |

### 8.7 Rising & setting (brightest 30)
| designation | rise_az_deg | set_az_deg | visibility | heliacal_rising_yr | heliacal_setting_yr |
| --- | --- | --- | --- | --- | --- |
| HIP30438 | 158.220 | 201.780 | rises and sets | 0.580 | 0.240 |
| HIP24436 | 96.432 | 263.568 | rises and sets | 0.315 | 0.506 |
| HIP49669 | 37.891 | 322.109 | rises and sets | 0.589 | 1.218 |
| HIP27989 | 77.144 | 282.856 | rises and sets | 0.315 | 0.622 |
| HIP68702 | — | — | never rises | — | — |
| HIP7588 | 135.361 | 224.639 | rises and sets | 0.066 | 1.964 |
| HIP60718 | — | — | never rises | — | — |
| HIP65474 | 103.935 | 256.065 | rises and sets | 0.232 | 1.268 |
| HIP42913 | — | — | never rises | — | — |
| HIP69673 | 47.407 | 312.593 | rises and sets | 0.423 | 1.774 |
| HIP39757 | 104.772 | 255.228 | rises and sets | 0.332 | 0.472 |
| HIP61084 | 175.908 | 184.092 | rises and sets | 0.945 | 1.127 |
| HIP24608 | 18.834 | 341.166 | rises and sets | 0.763 | 0.448 |
| HIP62434 | — | — | never rises | — | — |
| HIP80763 | 120.227 | 239.773 | rises and sets | 0.530 | 1.451 |
| HIP45238 | — | — | never rises | — | — |
| HIP46651 | — | — | never rises | — | — |
| HIP21421 | 49.824 | 310.176 | rises and sets | 1.102 | 0.398 |
| HIP33579 | 124.678 | 235.322 | rises and sets | 0.514 | 0.539 |
| HIP46390 | 98.205 | 261.795 | rises and sets | 0.663 | 0.887 |
| HIP50583 | 48.668 | 311.332 | rises and sets | 0.630 | 1.169 |
| HIP25336 | 74.593 | 285.407 | rises and sets | 0.249 | 0.555 |
| HIP31681 | 49.869 | 310.131 | rises and sets | 0.199 | 0.680 |
| HIP36850 | — | — | circumpolar | — | — |
| HIP61932 | 161.895 | 198.105 | rises and sets | 0.597 | 1.069 |
| HIP39953 | 153.792 | 206.208 | rises and sets | 0.754 | 0.489 |
| HIP85927 | 131.303 | 228.697 | rises and sets | 0.671 | 1.500 |
| HIP37826 | — | — | circumpolar | — | — |
| HIP25428 | 40.636 | 319.364 | rises and sets | 0.083 | 0.630 |
| HIP26727 | 89.869 | 270.131 | rises and sets | 0.340 | 0.564 |

### 8.8 Deep-time drift (top 10 brightest)

**100 local years:**
| star | drift_deg |
| --- | --- |
| HIP30438 | 0.002 |
| HIP24436 | 0.000 |
| HIP49669 | 0.022 |
| HIP27989 | 0.002 |
| HIP68702 | 0.002 |
| HIP7588 | 0.005 |
| HIP60718 | 0.002 |
| HIP65474 | 0.003 |
| HIP42913 | 0.009 |
| HIP69673 | 0.056 |

**1000 local years:**
| star | drift_deg |
| --- | --- |
| HIP30438 | 0.019 |
| HIP24436 | 0.001 |
| HIP49669 | 0.221 |
| HIP27989 | 0.017 |
| HIP68702 | 0.024 |
| HIP7588 | 0.049 |
| HIP60718 | 0.023 |
| HIP65474 | 0.032 |
| HIP42913 | 0.092 |
| HIP69673 | 0.570 |

**10000 local years:**
| star | drift_deg |
| --- | --- |
| HIP30438 | 0.189 |
| HIP24436 | 0.011 |
| HIP49669 | 2.220 |
| HIP27989 | 0.170 |
| HIP68702 | 0.244 |
| HIP7588 | 0.494 |
| HIP60718 | 0.233 |
| HIP65474 | 0.320 |
| HIP42913 | 0.913 |
| HIP69673 | 6.296 |

---
*Generated by tools/emit_dossier.ts · catalog: catalog/local_volume_300pc.json · world schema 0.1*
