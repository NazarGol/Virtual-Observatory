# Dossier — tidally locked #2
### Site: Equator (20.0000°, 0.0000°)

*Computed observational truth for this world, from this site. Every figure below is derived directly from the engine's orbital mechanics — nothing here is named, dated to a real calendar, or interpreted. That is the artist's work; this document is the machine's report of what the sky does.*

## 1 · The World

**tidally locked #2** — a *tidally locked* world, 7.14 Gyr old.

Host star: Gaia DR3 6847167606385195648 — a real catalog identity at galactic position (7.39, 2.07, -4.32) pc. 0.78 M☉, 0.43 L☉, 5141 K, 0.82 R☉.

Planet: 6371 km radius, 1.00 M⊕, orbiting at 0.217 AU (e = 0.002), axial tilt 3.33°. 1 moon.

Observer site: 20.0000°, 0.0000° — **temperate-equivalent** (outside the sub-stellar excursion but short of the polar threshold — an ordinary mid-latitude site with a real but bounded seasonal swing).

<details><summary>Provenance (real vs. derived/sampled)</summary>

- **host**: real — real catalog star Gaia DR3 6847167606385195648: observed galactic position & space velocity; luminosity from its absolute magnitude (M=5.76, BP-RP 1.08)
- **host_star.galactic_xyz_pc**: real — real: the host star's catalog position (the observer's vantage)
- **host_star.luminosity_lsun**: real — real-derived: from the host's observed absolute magnitude (distance + apparent mag)
- **host_star.mass_msun**: derived — derived: mass-luminosity relation L = M^3.5
- **host_star.radius_rsun**: derived — derived: main-sequence radius R = M^0.8
- **host_star.teff_k**: derived — derived: Teff = Tsun*(L/R^2)^0.25, consistent with L and R
- **planet.orbit.a_au**: derived — sampled inside the tidal-locking radius a_lock=0.546 AU (Gladman 1996: tau_lock < system age)
- **planet.orbit.e**: derived — sampled for a tidally locked world
- **planet.axial_tilt_deg**: derived — sampled
- **planet.rotation_period_s**: derived — = orbital period: spin-orbit synchronous (Kepler from a and host mass)
- **moons**: derived — a single moon is often the only moving body under a fixed sun; inclined orbit -> eclipse seasons; periapsis clears Roche

</details>

*Engine queries: `World`/`HostStar`/`Planet` schema fields; generator provenance record.*

## 2 · The Day & The Year

**This world has no day.** Rotation period (41.788 d) equals orbital period (0.1144 yr) — the planet is spin-orbit locked. There is no sunrise or sunset at this site; the host star sits at a fixed point in the sky.

Fixed host-star position at this site: **altitude -1.14°, azimuth 93.13° (E)** — below the horizon; this site never sees the host star.

*(Orbital eccentricity can cause a small longitudinal libration of the sub-stellar point over one orbit; not tabulated here — see the appendix for the raw orbit elements.)*

*Engine queries: `orbitalPeriodYears`-equivalent (Kepler III), `findRiseSetTransit`, `inertialToHorizontal`, plus this tool's `findSolsticesEquinoxes`/`siteYearScan` (geometry.ts) built on them.*

## 3 · The Moons

**moon a** — orbital period 1.223 real days (no local day on this world); synodic (phase) period 1.26 real days (this world has no local day). Inclination 18.39° (to the system's reference plane), eccentricity 0.109: apparent size ranges from 14564″ to 18115″ over one orbit.

Year vs. month, in whole numbers:
- moon a: **33 months** per local year, remainder **— (no local day on this world)**.

*Engine queries: `keplerPosition`/Kepler III on each moon's `a_au` about the planet's mass; this tool's `synodicYears`/`resonanceChord`/`alignmentRecurrenceYears` (geometry.ts).*

## 4 · Eclipses & Alignments

Scanned **20.0 local years** (2.29 Julian years) for host-star × moon occultations and close conjunctions.

**moon a**: **40 eclipse seasons** in the scan window, spaced ~**20.9 real days (no local day on this world)** apart, averaging **11.2 events** over **13.2 real days (no local day on this world)** each.
  Master cycle: seasons repeat with period **41.8 real days (no local day on this world)** (one full local year — this engine models no nodal precession, so the cycle does not drift; empirical residual **0.53 real days (no local day on this world)**, i.e. no detectable Saros-like beat).

*Engine queries: `findMinSeparation` (per-orbit local minima, windowed around analytic node-crossings of the host star's ecliptic longitude); this tool's `scanEclipseSeasons` (geometry.ts).*

## 5 · The Stars

The 30 brightest stars from this vantage (full table in the appendix). Brightest: **HIP30438** at magnitude -0.59.

*(1 catalog entry within 0.1 pc of the host star's own position was excluded as a cross-matched duplicate detection of the host itself, not a distinct background star — see `HOST_DUPLICATE_EXCLUSION_PC` in geometry.ts.)*

North pole: **HIP112833**, 1.48° off (mag 5.95).
South pole: **Gaia DR3 6342293925862497792**, 2.54° off (mag 4.78).

**289 tight naked-eye groupings** (≤3° apart, among stars mag ≤ 4) — candidate asterism seeds, listed by designation only:
- Gaia DR3 4357027756659697664 — HIP79593 (0.65°)
- Gaia DR3 4993479684438433792 — HIP2072 (2.17°)
- Gaia DR3 4993479684438433792 — HIP2081 (1.32°)
- Gaia DR3 4038055447778237312 — HIP86670 (2.88°)
- Gaia DR3 4038055447778237312 — HIP89642 (0.66°)
- Gaia DR3 1222646935698492160 — HIP76267 (0.66°)
- Gaia DR3 5111187420714898304 — HIP18543 (1.00°)
- Gaia DR3 4429785739602747392 — Gaia DR3 4426032591025363200 (1.78°)
- Gaia DR3 4429785739602747392 — HIP77070 (0.32°)
- Gaia DR3 4429785739602747392 — HIP77622 (1.34°)
- Gaia DR3 3704342295607157120 — Gaia DR3 3662636823132300032 (1.69°)
- Gaia DR3 3704342295607157120 — HIP63090 (0.56°)
- Gaia DR3 3704342295607157120 — HIP66249 (1.95°)
- Gaia DR3 4473334474604992384 — HIP86742 (0.30°)
- Gaia DR3 4629125170492116224 — HIP17678 (0.10°)
- Gaia DR3 702343774145932544 — HIP45860 (0.00°)
- Gaia DR3 4076915349846977664 — HIP90496 (0.34°)
- Gaia DR3 3736865265441207424 — HIP63608 (0.61°)
- Gaia DR3 5512070906394195968 — HIP36377 (0.30°)
- Gaia DR3 510204838759030144 — HIP6686 (0.30°)
- *(269 more in the appendix)*

Milky Way band: reaches **87.3°** altitude at this site — an arch, passing near overhead, crossing the horizon near NNW and SSE.

Zenith stars (pass within 2° of overhead once per rotation): HIP21421.

*Engine queries: `relocateStar` (Stage 1) over the full catalog; this tool's `nearestToPole`/`tightGroupings`/`milkyWayAtSite`/`zenithStars` (geometry.ts); Milky Way orientation via `helioToGalcen`/`galactocentricToIcrs`.*

## 6 · Rising & Setting

Rise/set azimuths for the 30 brightest stars (full table in the appendix) — the raw data for a star compass.

No circumpolar stars among the brightest 30 at this site.

**8 shared rising houses** (stars rising within the same 5°-wide azimuth bin):
- ~145° (SE): HIP30438, HIP7588, HIP109268
- ~80° (E): HIP27989, HIP107556
- ~160° (SSE): HIP68702, HIP60718, HIP62434
- ~120° (ESE): HIP80763, HIP33579
- ~75° (ENE): Gaia DR3 6838311796136238976, HIP32349
- ~130° (SE): HIP90185, HIP85927, Gaia DR3 4038055447778237312
- ~140° (SE): HIP61084, HIP86228
- ~155° (SSE): HIP100751, HIP45238


*Engine queries: `findRiseSetTransit` + `inertialToHorizontal` at the rise/set moments; this tool's `heliacalDates` (geometry.ts, arcus-visionis proxy: sun between -6° and -18° altitude at the star's rise/set).*

## 7 · Deep Time

**100 local years** (1.14e+1 yr) — within the validated range. The fastest of the top-10 brightest stars drifts up to **0.005°**.
**1,000 local years** (1.14e+2 yr) — within the validated range. The fastest of the top-10 brightest stars drifts up to **0.053°**.
**10,000 local years** (1.14e+3 yr) — within the validated range. The fastest of the top-10 brightest stars drifts up to **0.533°**.

**Axial precession is not modeled** in this engine — the spin pole's RA/Dec is fixed for all simulated time. A real planet's precession (Earth's is ~26,000 yr) would slowly rotate every rising/setting/zenith/pole table in this document; none of that motion is represented here.

Honest caps: rectilinear propagation is validated to **1e+5 yr**; galactic-orbit propagation to **1e+6 yr**. Figures beyond these are extrapolation.

*Engine queries: `relocateStar` at two epochs (this tool's `properMotionDriftDeg`, geometry.ts); `PROPAGATION_MODELS` honest-cap metadata.*

## 8 · Appendix — full tables

### 8.1 World parameters
| field | value |
| --- | --- |
| world_type | tidally_locked |
| age_gyr | 7.138 |
| host.catalog_id | Gaia DR3 6847167606385195648 |
| host.mass_msun | 0.784 |
| host.luminosity_lsun | 0.426 |
| host.teff_k | 5140.637 |
| host.radius_rsun | 0.823 |
| planet.radius_km | 6371.000 |
| planet.mass_mearth | 1.000 |
| planet.a_au | 0.217 |
| planet.e | 0.002 |
| planet.axial_tilt_deg | 3.329 |
| site.lat_deg | 20.000 |
| site.lon_deg | 0.000 |

### 8.2 Calendar
| field | value |
| --- | --- |
| rotation_days_sidereal | 41.788 |
| orbit_years | 0.114 |
| fixed_sun_alt_deg | -1.138 |
| fixed_sun_az_deg | 93.129 |

### 8.3 Moons
| moon | period_local_days | synodic | inc_deg | e | ang_diam_min_arcsec | ang_diam_max_arcsec |
| --- | --- | --- | --- | --- | --- | --- |
| moon a | — | 1.26 real days (this world has no local day) | 18.392 | 0.109 | 14563.879 | 18115.312 |

### 8.4 Eclipse seasons (per moon, summarized)
| moon | start_yr | end_yr | duration_local_days | event_count | min_sep_deg |
| --- | --- | --- | --- | --- | --- |
| moon a | 0.024 | 0.058 | — | 11.000 | 0.909 |
| moon a | 0.079 | 0.117 | — | 12.000 | 1.041 |
| moon a | 0.137 | 0.172 | — | 10.000 | 0.368 |
| moon a | 0.193 | 0.231 | — | 12.000 | 1.578 |
| moon a | 0.251 | 0.286 | — | 11.000 | 0.173 |
| moon a | 0.307 | 0.344 | — | 12.000 | 1.293 |
| moon a | 0.365 | 0.403 | — | 12.000 | 0.713 |
| moon a | 0.424 | 0.458 | — | 9.000 | 0.755 |
| moon a | 0.479 | 0.517 | — | 12.000 | 1.254 |
| moon a | 0.538 | 0.572 | — | 10.000 | 3.181 |
| moon a | 0.593 | 0.631 | — | 12.000 | 1.630 |
| moon a | 0.652 | 0.686 | — | 11.000 | 0.322 |
| moon a | 0.710 | 0.745 | — | 11.000 | 1.090 |
| moon a | 0.766 | 0.803 | — | 12.000 | 0.860 |
| moon a | 0.824 | 0.859 | — | 11.000 | 0.550 |
| moon a | 0.879 | 0.917 | — | 12.000 | 1.398 |
| moon a | 0.938 | 0.972 | — | 11.000 | 0.009 |
| moon a | 0.993 | 1.031 | — | 12.000 | 1.474 |
| moon a | 1.052 | 1.086 | — | 11.000 | 0.532 |
| moon a | 1.111 | 1.145 | — | 11.000 | 0.936 |
| moon a | 1.166 | 1.204 | — | 12.000 | 1.072 |
| moon a | 1.224 | 1.259 | — | 9.000 | 3.003 |
| moon a | 1.279 | 1.318 | — | 12.000 | 1.612 |
| moon a | 1.338 | 1.373 | — | 10.000 | 0.141 |
| moon a | 1.393 | 1.431 | — | 12.000 | 1.272 |
| moon a | 1.452 | 1.490 | — | 12.000 | 0.680 |
| moon a | 1.511 | 1.545 | — | 11.000 | 0.731 |
| moon a | 1.566 | 1.604 | — | 12.000 | 1.218 |
| moon a | 1.625 | 1.659 | — | 10.000 | 0.190 |
| moon a | 1.680 | 1.718 | — | 12.000 | 1.654 |
| moon a | 1.738 | 1.773 | — | 11.000 | 0.350 |
| moon a | 1.797 | 1.832 | — | 11.000 | 1.117 |
| moon a | 1.852 | 1.890 | — | 12.000 | 0.891 |
| moon a | 1.911 | 1.945 | — | 9.000 | 2.824 |
| moon a | 1.966 | 2.004 | — | 12.000 | 1.431 |
| moon a | 2.025 | 2.059 | — | 11.000 | 0.040 |
| moon a | 2.080 | 2.118 | — | 12.000 | 1.453 |
| moon a | 2.139 | 2.177 | — | 12.000 | 0.499 |
| moon a | 2.197 | 2.232 | — | 11.000 | 0.913 |
| moon a | 2.253 | 2.287 | — | 11.000 | 1.037 |

### 8.5 Brightest 30 stars
| designation | mag | bp_rp | dist_pc | visibility |
| --- | --- | --- | --- | --- |
| HIP30438 | -0.588 | 0.164 | 97.292 | rises and sets |
| HIP24436 | 0.225 | -0.030 | 241.979 | rises and sets |
| HIP7588 | 0.281 | -0.158 | 40.787 | rises and sets |
| HIP113368 | 0.304 | 0.145 | 5.160 | rises and sets |
| HIP91262 | 0.472 | -0.001 | 9.507 | rises and sets |
| HIP27989 | 0.563 | 1.500 | 138.058 | rises and sets |
| HIP68702 | 0.568 | -0.231 | 157.956 | rises and sets |
| HIP69673 | 0.615 | 1.239 | 15.285 | rises and sets |
| HIP60718 | 0.735 | -0.243 | 96.762 | rises and sets |
| HIP97649 | 0.936 | 0.221 | 5.578 | rises and sets |
| HIP80763 | 0.994 | 1.865 | 179.649 | rises and sets |
| HIP65474 | 1.017 | -0.235 | 81.752 | rises and sets |
| Gaia DR3 6838311796136238976 | 1.027 | 0.687 | 5.055 | rises and sets |
| HIP107556 | 1.062 | 0.180 | 5.190 | rises and sets |
| HIP24608 | 1.078 | 0.795 | 20.490 | rises and sets |
| HIP109268 | 1.154 | -0.070 | 23.855 | rises and sets |
| HIP62434 | 1.217 | -0.238 | 106.475 | rises and sets |
| HIP90185 | 1.370 | -0.031 | 36.545 | rises and sets |
| HIP21421 | 1.473 | 1.538 | 26.354 | rises and sets |
| HIP85927 | 1.547 | -0.231 | 208.401 | rises and sets |
| HIP33579 | 1.577 | -0.211 | 136.853 | rises and sets |
| HIP61084 | 1.586 | 1.600 | 26.908 | rises and sets |
| HIP32349 | 1.607 | 0.009 | 10.728 | rises and sets |
| HIP100751 | 1.631 | -0.118 | 48.729 | rises and sets |
| HIP86032 | 1.664 | 0.155 | 11.823 | rises and sets |
| HIP82396 | 1.668 | 1.144 | 15.061 | rises and sets |
| HIP86228 | 1.670 | 0.406 | 76.417 | rises and sets |
| HIP45238 | 1.671 | 0.070 | 34.100 | rises and sets |
| Gaia DR3 4038055447778237312 | 1.679 | 1.827 | 34.275 | rises and sets |
| Gaia DR3 4076915349846977664 | 1.682 | 1.201 | 15.659 | rises and sets |

### 8.6 Tight groupings (full)
| a | b | sep_deg |
| --- | --- | --- |
| Gaia DR3 4357027756659697664 | HIP79593 | 0.647 |
| Gaia DR3 4993479684438433792 | HIP2072 | 2.167 |
| Gaia DR3 4993479684438433792 | HIP2081 | 1.316 |
| Gaia DR3 4038055447778237312 | HIP86670 | 2.880 |
| Gaia DR3 4038055447778237312 | HIP89642 | 0.662 |
| Gaia DR3 1222646935698492160 | HIP76267 | 0.661 |
| Gaia DR3 5111187420714898304 | HIP18543 | 1.002 |
| Gaia DR3 4429785739602747392 | Gaia DR3 4426032591025363200 | 1.777 |
| Gaia DR3 4429785739602747392 | HIP77070 | 0.316 |
| Gaia DR3 4429785739602747392 | HIP77622 | 1.341 |
| Gaia DR3 3704342295607157120 | Gaia DR3 3662636823132300032 | 1.686 |
| Gaia DR3 3704342295607157120 | HIP63090 | 0.564 |
| Gaia DR3 3704342295607157120 | HIP66249 | 1.952 |
| Gaia DR3 4473334474604992384 | HIP86742 | 0.299 |
| Gaia DR3 4629125170492116224 | HIP17678 | 0.096 |
| Gaia DR3 702343774145932544 | HIP45860 | 0.002 |
| Gaia DR3 4076915349846977664 | HIP90496 | 0.339 |
| Gaia DR3 3736865265441207424 | HIP63608 | 0.605 |
| Gaia DR3 5512070906394195968 | HIP36377 | 0.299 |
| Gaia DR3 510204838759030144 | HIP6686 | 0.296 |
| Gaia DR3 4683897617110115200 | HIP2021 | 0.008 |
| Gaia DR3 4683897617110115200 | HIP37229 | 2.858 |
| Gaia DR3 5859405805013401984 | HIP61585 | 1.855 |
| Gaia DR3 5859405805013401984 | HIP62322 | 2.543 |
| Gaia DR3 4049975081571729920 | HIP88635 | 0.727 |
| Gaia DR3 3557567320183657472 | HIP52943 | 0.089 |
| Gaia DR3 4935615308047192576 | HIP6867 | 0.289 |
| Gaia DR3 3211922645854328832 | HIP23875 | 0.131 |
| Gaia DR3 5826168461855385472 | HIP61084 | 0.258 |
| Gaia DR3 5826168461855385472 | HIP77952 | 0.449 |
| Gaia DR3 2887731882922767744 | HIP27628 | 0.379 |
| Gaia DR3 2255173119658513408 | HIP94376 | 0.365 |
| Gaia DR3 6838311796136238976 | HIP107556 | 1.465 |
| Gaia DR3 2858629802998456576 | HIP3092 | 0.263 |
| Gaia DR3 2858629802998456576 | HIP5447 | 0.516 |
| Gaia DR3 4444057469252265984 | HIP83000 | 0.460 |
| Gaia DR3 1517698716348324992 | HIP63125 | 0.982 |
| Gaia DR3 2281778105594488192 | HIP116727 | 0.007 |
| Gaia DR3 6270558110774003968 | HIP68895 | 0.631 |
| Gaia DR3 3520586071217872896 | HIP60965 | 0.394 |
| Gaia DR3 6762701233364896000 | HIP92041 | 2.629 |
| Gaia DR3 6762701233364896000 | HIP92855 | 1.474 |
| Gaia DR3 6762701233364896000 | HIP93864 | 0.287 |
| Gaia DR3 4269932382607207040 | HIP87108 | 2.845 |
| Gaia DR3 4269932382607207040 | HIP89962 | 0.203 |
| Gaia DR3 1487434040320076800 | HIP71075 | 0.139 |
| Gaia DR3 6058271964884299520 | HIP59747 | 1.325 |
| Gaia DR3 6058271964884299520 | HIP60260 | 0.042 |
| Gaia DR3 4573412435280434560 | HIP84379 | 0.533 |
| Gaia DR3 2470140321630664064 | HIP5364 | 0.323 |
| Gaia DR3 5964991494281655808 | HIP82729 | 1.192 |
| Gaia DR3 1041808368494264576 | HIP41704 | 0.044 |
| Gaia DR3 1284537517514584704 | HIP71053 | 0.901 |
| Gaia DR3 5849837854861497856 | HIP71908 | 0.005 |
| Gaia DR3 2195115561168483712 | HIP11767 | 2.376 |
| Gaia DR3 2195115561168483712 | HIP102422 | 0.036 |
| Gaia DR3 5888394463447019392 | HIP74395 | 0.365 |
| Gaia DR3 399402894487590144 | HIP7607 | 0.076 |
| Gaia DR3 1278391075717325312 | HIP74666 | 0.387 |
| Gaia DR3 4942522955488925696 | Gaia DR3 4929469381645492864 | 2.877 |
| Gaia DR3 4942522955488925696 | HIP7083 | 2.636 |
| Gaia DR3 2211820991085587584 | HIP112724 | 0.431 |
| Gaia DR3 3561350430457837056 | HIP55282 | 0.119 |
| Gaia DR3 5965222838410499328 | HIP76297 | 2.179 |
| Gaia DR3 5965222838410499328 | HIP84143 | 0.562 |
| Gaia DR3 4594497769766809216 | HIP86974 | 0.345 |
| Gaia DR3 5843518239925459456 | HIP57363 | 2.003 |
| Gaia DR3 5843518239925459456 | HIP63613 | 0.798 |
| Gaia DR3 3748360796947806208 | HIP51069 | 0.082 |
| Gaia DR3 1876510592179455744 | HIP112748 | 0.522 |
| Gaia DR3 1876510592179455744 | HIP113881 | 1.745 |
| Gaia DR3 5136659462996725888 | HIP9347 | 0.266 |
| Gaia DR3 3478394889483944320 | HIP56343 | 0.104 |
| Gaia DR3 5922299347569528832 | HIP85258 | 0.816 |
| Gaia DR3 2478112158887431296 | HIP6537 | 0.293 |
| Gaia DR3 786420645182229504 | HIP57399 | 0.063 |
| Gaia DR3 6427464123776727168 | HIP99240 | 0.084 |
| Gaia DR3 3662636823132300032 | HIP63090 | 2.186 |
| Gaia DR3 3662636823132300032 | HIP66249 | 0.305 |
| Gaia DR3 1939115478598580352 | Gaia DR3 1891598193816300544 | 2.696 |
| Gaia DR3 1939115478598580352 | HIP3179 | 2.126 |
| Gaia DR3 1939115478598580352 | HIP109176 | 2.533 |
| Gaia DR3 1939115478598580352 | HIP116584 | 0.066 |
| Gaia DR3 588551501854159744 | HIP47508 | 0.003 |
| Gaia DR3 4156500578347841408 | HIP91117 | 0.324 |
| Gaia DR3 5273030069128572928 | Gaia DR3 5210240327318434304 | 0.927 |
| Gaia DR3 5273030069128572928 | HIP41312 | 0.004 |
| Gaia DR3 5273030069128572928 | HIP42536 | 2.952 |
| Gaia DR3 805881416880407936 | HIP50372 | 1.904 |
| Gaia DR3 805881416880407936 | HIP50801 | 1.609 |
| Gaia DR3 2658974606111711488 | Gaia DR3 2661524098698483456 | 2.048 |
| Gaia DR3 2658974606111711488 | HIP114971 | 0.340 |
| Gaia DR3 4937200425857908992 | HIP9007 | 0.171 |
| Gaia DR3 4296708789290712064 | HIP98036 | 0.491 |
| Gaia DR3 4529285391533766400 | HIP88794 | 0.718 |
| Gaia DR3 4529285391533766400 | HIP90139 | 0.838 |
| Gaia DR3 4672726716408826240 | HIP17440 | 1.175 |
| Gaia DR3 4672726716408826240 | HIP19780 | 1.351 |
| Gaia DR3 4840356816072211712 | HIP19747 | 0.060 |
| Gaia DR3 643819484617141504 | HIP47908 | 2.295 |
| Gaia DR3 2139664063041544576 | Gaia DR3 2136270970154631168 | 2.431 |
| Gaia DR3 2139664063041544576 | HIP94779 | 0.012 |
| Gaia DR3 2139664063041544576 | HIP95853 | 2.457 |
| Gaia DR3 5173421634271199104 | HIP13701 | 0.102 |
| Gaia DR3 6203033940614597504 | HIP72010 | 0.712 |
| Gaia DR3 3174163561130003840 | HIP24436 | 0.992 |
| Gaia DR3 3174163561130003840 | HIP24674 | 2.567 |
| Gaia DR3 4990516294443333504 | HIP765 | 0.346 |
| Gaia DR3 1273423791421021568 | HIP75695 | 0.244 |
| Gaia DR3 5775835843156608256 | Gaia DR3 5777500503761872128 | 1.726 |
| Gaia DR3 5775835843156608256 | HIP72370 | 1.940 |
| Gaia DR3 5775835843156608256 | HIP81065 | 0.437 |
| Gaia DR3 6539947667988856320 | HIP114421 | 0.764 |
| Gaia DR3 2392584791494639744 | HIP115438 | 0.132 |
| Gaia DR3 6838023243053666688 | HIP106985 | 1.226 |
| Gaia DR3 1398822783330261248 | HIP79992 | 2.048 |
| Gaia DR3 1398822783330261248 | HIP81833 | 1.524 |
| Gaia DR3 6419476755916988032 | HIP91792 | 0.170 |
| Gaia DR3 1891598193816300544 | HIP3179 | 2.992 |
| Gaia DR3 1891598193816300544 | HIP4427 | 2.682 |
| Gaia DR3 1891598193816300544 | HIP109176 | 0.569 |
| Gaia DR3 1891598193816300544 | HIP116584 | 2.720 |
| Gaia DR3 4929469381645492864 | HIP7083 | 0.334 |
| Gaia DR3 4426032591025363200 | HIP77070 | 2.056 |
| Gaia DR3 4426032591025363200 | HIP77622 | 0.533 |
| Gaia DR3 5935306123457567616 | HIP80000 | 0.997 |
| Gaia DR3 2022881668925464320 | HIP95947 | 2.343 |
| Gaia DR3 2136270970154631168 | HIP94779 | 2.422 |
| Gaia DR3 2136270970154631168 | HIP95853 | 0.033 |
| Gaia DR3 6337717036911729024 | HIP71957 | 0.586 |
| Gaia DR3 1988193348344678656 | HIP111169 | 0.137 |
| Gaia DR3 6704767209778958976 | HIP90568 | 0.431 |
| Gaia DR3 4951967794731342464 | HIP13847 | 2.605 |
| Gaia DR3 6001701610563428224 | HIP75141 | 1.561 |
| Gaia DR3 6260822966106824576 | HIP77853 | 0.263 |
| Gaia DR3 364785939116867072 | HIP4436 | 1.225 |
| Gaia DR3 2677558895241364864 | HIP110395 | 2.306 |
| Gaia DR3 2677558895241364864 | HIP111497 | 1.601 |
| Gaia DR3 6127688772460862976 | HIP61622 | 0.228 |
| Gaia DR3 6127688772460862976 | HIP61932 | 0.388 |
| Gaia DR3 2200153454733285248 | HIP109492 | 2.197 |
| Gaia DR3 5961830948155839360 | HIP86170 | 0.743 |
| Gaia DR3 5961830948155839360 | HIP87261 | 2.015 |
| Gaia DR3 2745491430891511168 | HIP118268 | 0.233 |
| Gaia DR3 2630155547353593216 | HIP114855 | 0.055 |
| Gaia DR3 5777500503761872128 | HIP72370 | 0.263 |
| Gaia DR3 5777500503761872128 | HIP81065 | 1.401 |
| Gaia DR3 5210240327318434304 | HIP41312 | 0.926 |
| Gaia DR3 6368016725517046144 | HIP98495 | 0.275 |
| Gaia DR3 2661524098698483456 | HIP114971 | 1.747 |
| Gaia DR3 1763000413344449792 | HIP101769 | 2.415 |
| Gaia DR3 1763000413344449792 | HIP102532 | 2.030 |
| Gaia DR3 2756363608023588864 | HIP116771 | 0.410 |
| Gaia DR3 6573503732074732288 | HIP108085 | 2.925 |
| Gaia DR3 6805455124526007424 | Gaia DR3 6828451375858909568 | 2.975 |
| Gaia DR3 6805455124526007424 | HIP102485 | 0.078 |
| Gaia DR3 6805455124526007424 | HIP105881 | 0.500 |
| Gaia DR3 6754054639555151744 | HIP98066 | 2.971 |
| Gaia DR3 5877059048308526720 | HIP66657 | 2.887 |
| Gaia DR3 5877059048308526720 | HIP74824 | 0.062 |
| Gaia DR3 2719475542667772416 | HIP112447 | 0.337 |
| Gaia DR3 4900108950849461248 | HIP30122 | 2.731 |
| Gaia DR3 4900108950849461248 | HIP30277 | 2.427 |
| Gaia DR3 4530744134231683840 | HIP92043 | 0.413 |
| Gaia DR3 4295095221652796160 | HIP96229 | 0.026 |
| Gaia DR3 6401464693867773568 | HIP32607 | 1.434 |
| Gaia DR3 6401464693867773568 | HIP105858 | 0.331 |
| Gaia DR3 6718857073327910144 | HIP94114 | 0.503 |
| Gaia DR3 4058689054864359552 | HIP85423 | 0.083 |
| Gaia DR3 6828451375858909568 | HIP105881 | 2.534 |
| Gaia DR3 6630558558672843392 | HIP88866 | 0.392 |
| Gaia DR3 4115142207982341504 | HIP84893 | 0.222 |
| Gaia DR3 4512265810537057664 | HIP92161 | 0.104 |
| Gaia DR3 6471630024096107008 | HIP102333 | 0.013 |
| Gaia DR3 6463748969563201152 | HIP105319 | 0.202 |
| Gaia DR3 4177224620176470912 | HIP88175 | 0.243 |
| Gaia DR3 6612242034982766848 | HIP109422 | 0.499 |
| Gaia DR3 6697578465310949376 | HIP40526 | 2.430 |
| Gaia DR3 6697578465310949376 | HIP99461 | 0.348 |
| Gaia DR3 4079684229322231040 | HIP81377 | 2.797 |
| HIP2021 | HIP37229 | 2.851 |
| HIP2072 | HIP2081 | 1.657 |
| HIP3092 | HIP5447 | 0.491 |
| HIP3179 | HIP4427 | 2.396 |
| HIP3179 | HIP109176 | 2.483 |
| HIP3179 | HIP116584 | 2.072 |
| HIP4427 | HIP109176 | 2.183 |
| HIP8903 | HIP9884 | 1.393 |
| HIP8903 | HIP13209 | 1.590 |
| HIP9884 | HIP13209 | 2.516 |
| HIP11001 | HIP12394 | 0.273 |
| HIP11767 | HIP102422 | 2.383 |
| HIP12706 | HIP15900 | 0.725 |
| HIP12706 | HIP16083 | 1.306 |
| HIP15900 | HIP16083 | 0.591 |
| HIP17440 | HIP19780 | 2.526 |
| HIP17499 | HIP17573 | 0.414 |
| HIP17499 | HIP17702 | 0.598 |
| HIP17499 | HIP17847 | 0.855 |
| HIP17573 | HIP17702 | 0.400 |
| HIP17573 | HIP17847 | 0.653 |
| HIP17702 | HIP17847 | 0.268 |
| HIP20205 | HIP20894 | 2.127 |
| HIP20889 | HIP20894 | 2.856 |
| HIP21421 | HIP26451 | 2.369 |
| HIP24436 | HIP24674 | 2.143 |
| HIP24608 | HIP28360 | 0.896 |
| HIP25281 | HIP25930 | 2.738 |
| HIP25859 | HIP26634 | 2.306 |
| HIP25930 | HIP26727 | 2.715 |
| HIP29655 | HIP30343 | 2.585 |
| HIP30122 | HIP30277 | 2.079 |
| HIP32607 | HIP105858 | 1.582 |
| HIP40526 | HIP99461 | 2.741 |
| HIP41312 | HIP42536 | 2.950 |
| HIP43109 | HIP43813 | 2.053 |
| HIP43783 | HIP45080 | 2.261 |
| HIP43783 | HIP45238 | 0.377 |
| HIP44511 | HIP44816 | 1.777 |
| HIP45080 | HIP45238 | 2.142 |
| HIP45080 | HIP45556 | 2.129 |
| HIP45101 | HIP45556 | 2.328 |
| HIP45941 | HIP46701 | 1.641 |
| HIP50335 | HIP50583 | 2.916 |
| HIP50335 | HIP54872 | 2.926 |
| HIP50371 | HIP51576 | 1.402 |
| HIP50371 | HIP52419 | 2.807 |
| HIP50372 | HIP50801 | 2.862 |
| HIP51576 | HIP52419 | 2.545 |
| HIP54872 | HIP57632 | 1.944 |
| HIP56211 | HIP91262 | 2.705 |
| HIP57363 | HIP63613 | 2.801 |
| HIP59196 | HIP59449 | 1.228 |
| HIP59316 | HIP61359 | 2.796 |
| HIP59747 | HIP60260 | 1.358 |
| HIP61084 | HIP77952 | 0.706 |
| HIP61585 | HIP62322 | 1.368 |
| HIP61622 | HIP61932 | 0.616 |
| HIP63090 | HIP66249 | 2.468 |
| HIP66657 | HIP74824 | 2.926 |
| HIP67464 | HIP67472 | 0.994 |
| HIP67464 | HIP68245 | 1.633 |
| HIP67472 | HIP68245 | 1.357 |
| HIP67472 | HIP68282 | 2.232 |
| HIP68002 | HIP68282 | 2.552 |
| HIP68245 | HIP68282 | 2.605 |
| HIP68756 | HIP75458 | 2.068 |
| HIP71536 | HIP74376 | 2.658 |
| HIP71860 | HIP74376 | 0.587 |
| HIP72370 | HIP81065 | 1.640 |
| HIP73273 | HIP73334 | 1.052 |
| HIP75264 | HIP84143 | 2.717 |
| HIP76297 | HIP84143 | 2.116 |
| HIP77070 | HIP77622 | 1.591 |
| HIP78401 | HIP78933 | 2.624 |
| HIP78820 | HIP78933 | 0.733 |
| HIP78820 | HIP79374 | 1.178 |
| HIP78933 | HIP79374 | 1.826 |
| HIP79992 | HIP81833 | 2.951 |
| HIP80112 | HIP80763 | 1.692 |
| HIP80763 | HIP81266 | 1.756 |
| HIP82514 | HIP82545 | 0.777 |
| HIP82514 | HIP86170 | 2.621 |
| HIP83081 | HIP83153 | 2.955 |
| HIP83895 | HIP87585 | 0.945 |
| HIP85696 | HIP85927 | 1.139 |
| HIP85696 | HIP86670 | 2.861 |
| HIP85696 | HIP87261 | 2.731 |
| HIP85927 | HIP86670 | 2.361 |
| HIP86170 | HIP87261 | 2.582 |
| HIP87108 | HIP89962 | 2.726 |
| HIP88794 | HIP90139 | 0.597 |
| HIP92041 | HIP92855 | 2.481 |
| HIP92041 | HIP93864 | 2.910 |
| HIP92420 | HIP93194 | 1.659 |
| HIP92855 | HIP93864 | 1.554 |
| HIP93085 | HIP93683 | 1.029 |
| HIP93429 | HIP93805 | 2.269 |
| HIP93747 | HIP95501 | 1.510 |
| HIP94779 | HIP95853 | 2.448 |
| HIP95241 | HIP95347 | 2.856 |
| HIP101769 | HIP102532 | 2.818 |
| HIP102485 | HIP105881 | 0.574 |
| HIP104887 | HIP109492 | 2.111 |
| HIP106481 | HIP109492 | 2.791 |
| HIP109176 | HIP116584 | 2.544 |
| HIP110997 | HIP111043 | 0.256 |
| HIP112748 | HIP113881 | 1.228 |
| HIP114131 | HIP114421 | 2.558 |

### 8.7 Rising & setting (brightest 30)
| designation | rise_az_deg | set_az_deg | visibility | heliacal_rising_yr | heliacal_setting_yr |
| --- | --- | --- | --- | --- | --- |
| HIP30438 | 142.718 | 217.282 | rises and sets | — | — |
| HIP24436 | 96.901 | 263.099 | rises and sets | — | — |
| HIP7588 | 146.632 | 213.368 | rises and sets | — | — |
| HIP113368 | 86.171 | 273.829 | rises and sets | — | — |
| HIP91262 | 14.485 | 345.515 | rises and sets | — | — |
| HIP27989 | 80.787 | 279.213 | rises and sets | — | — |
| HIP68702 | 160.554 | 199.446 | rises and sets | — | — |
| HIP69673 | 61.185 | 298.815 | rises and sets | — | — |
| HIP60718 | 161.772 | 198.228 | rises and sets | — | — |
| HIP97649 | 26.949 | 333.051 | rises and sets | — | — |
| HIP80763 | 119.161 | 240.839 | rises and sets | — | — |
| HIP65474 | 102.066 | 257.934 | rises and sets | — | — |
| Gaia DR3 6838311796136238976 | 77.112 | 282.888 | rises and sets | — | — |
| HIP107556 | 77.970 | 282.030 | rises and sets | — | — |
| HIP24608 | 46.997 | 313.003 | rises and sets | — | — |
| HIP109268 | 142.803 | 217.197 | rises and sets | — | — |
| HIP62434 | 157.637 | 202.363 | rises and sets | — | — |
| HIP90185 | 127.773 | 232.227 | rises and sets | — | — |
| HIP21421 | 66.674 | 293.326 | rises and sets | — | — |
| HIP85927 | 130.506 | 229.494 | rises and sets | — | — |
| HIP33579 | 118.739 | 241.261 | rises and sets | — | — |
| HIP61084 | 141.184 | 218.816 | rises and sets | — | — |
| HIP32349 | 72.940 | 287.060 | rises and sets | — | — |
| HIP100751 | 156.806 | 203.194 | rises and sets | — | — |
| HIP86032 | 52.499 | 307.501 | rises and sets | — | — |
| HIP82396 | 123.584 | 236.416 | rises and sets | — | — |
| HIP86228 | 138.030 | 221.970 | rises and sets | — | — |
| HIP45238 | 153.533 | 206.467 | rises and sets | — | — |
| Gaia DR3 4038055447778237312 | 131.051 | 228.949 | rises and sets | — | — |
| Gaia DR3 4076915349846977664 | 114.433 | 245.567 | rises and sets | — | — |

### 8.8 Deep-time drift (top 10 brightest)

**100 local years:**
| star | drift_deg |
| --- | --- |
| HIP30438 | 0.000 |
| HIP24436 | 0.000 |
| HIP7588 | 0.000 |
| HIP113368 | 0.001 |
| HIP91262 | 0.001 |
| HIP27989 | 0.000 |
| HIP68702 | 0.000 |
| HIP69673 | 0.005 |
| HIP60718 | 0.000 |
| HIP97649 | 0.002 |

**1000 local years:**
| star | drift_deg |
| --- | --- |
| HIP30438 | 0.001 |
| HIP24436 | 0.000 |
| HIP7588 | 0.003 |
| HIP113368 | 0.009 |
| HIP91262 | 0.008 |
| HIP27989 | 0.001 |
| HIP68702 | 0.001 |
| HIP69673 | 0.053 |
| HIP60718 | 0.001 |
| HIP97649 | 0.018 |

**10000 local years:**
| star | drift_deg |
| --- | --- |
| HIP30438 | 0.010 |
| HIP24436 | 0.001 |
| HIP7588 | 0.033 |
| HIP113368 | 0.095 |
| HIP91262 | 0.081 |
| HIP27989 | 0.009 |
| HIP68702 | 0.014 |
| HIP69673 | 0.533 |
| HIP60718 | 0.012 |
| HIP97649 | 0.176 |

---
*Generated by tools/emit_dossier.ts · catalog: catalog/local_volume_300pc.json · world schema 0.1*
