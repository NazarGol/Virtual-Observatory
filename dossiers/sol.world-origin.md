# Dossier — Sol (calibration world)
### Site: Origin (0.0000°, 0.0000°)

*Computed observational truth for this world, from this site. Every figure below is derived directly from the engine's orbital mechanics — nothing here is named, dated to a real calendar, or interpreted. That is the artist's work; this document is the machine's report of what the sky does.*

## 1 · The World

**Sol (calibration world)**.

Host star: (no real catalog anchor) — a real catalog identity at galactic position (0.00, 0.00, 0.00) pc. 1.00 M☉, 1.00 L☉, 5772 K, 1.00 R☉.

Planet: 6371 km radius, 1.00 M⊕, orbiting at 1.000 AU (e = 0.000), axial tilt 23.40°. 1 moon.

Observer site: 0.0000°, 0.0000° — **tropical-equivalent** (within the sub-stellar excursion — the host star can stand directly overhead here at some point in the year).

*Engine queries: `World`/`HostStar`/`Planet` schema fields; generator provenance record.*

## 2 · The Day & The Year

Sidereal rotation (spin relative to the stars): **0.9973 d** (23.93 h). Solar day — 1 **local day**, sunrise to sunrise: **1.0000 d** (24.00 h) — measurably longer than the sidereal spin, because the planet's own orbital motion adds one apparent rotation per year. Orbit (local year): **1.0000 yr**.

Day : year ratio — **365 local days, plus 0.2504 of a day** (6.01 h). That remainder is what any calendar built on whole days must reconcile.

Solstices/equinoxes (years-since-epoch, local day in parens): summer +0.7500 yr (local day 273.9); winter +0.2500 yr (local day 91.3); equinox +0.5000 yr (local day 182.6); equinox +1.0000 yr (local day 365.3).

Day length over the year: **11.97 h to 11.97 h**.

Sunrise-azimuth range over the year (the Chankillo span): **66.6° to 113.4°** (ENE to ESE), a swing of 46.9°.

*Engine queries: `orbitalPeriodYears`-equivalent (Kepler III), `findRiseSetTransit`, `inertialToHorizontal`, plus this tool's `findSolsticesEquinoxes`/`siteYearScan` (geometry.ts) built on them.*

## 3 · The Moons

**Luna** — orbital period 27.459 local days; synodic (phase) period 29.69 local days. Inclination 5.14° (to the system's reference plane), eccentricity 0.055: apparent size ranges from 1767″ to 1972″ over one orbit.

Year vs. month, in whole numbers:
- Luna: **12 months** per local year, remainder **8.96 days**.

*Engine queries: `keplerPosition`/Kepler III on each moon's `a_au` about the planet's mass; this tool's `synodicYears`/`resonanceChord`/`alignmentRecurrenceYears` (geometry.ts).*

## 4 · Eclipses & Alignments

Scanned **20.0 local years** (20.00 Julian years) for host-star × moon occultations and close conjunctions.

**Luna**: **40 eclipse seasons** in the scan window, spaced ~**182.7 local days** apart, averaging **2.6 events** over **47.0 local days** each.
  Master cycle: seasons repeat with period **365.3 local days** (one full local year — this engine models no nodal precession, so the cycle does not drift; empirical residual **10.53 days**, i.e. no detectable Saros-like beat).

*Engine queries: `findMinSeparation` (per-orbit local minima, windowed around analytic node-crossings of the host star's ecliptic longitude); this tool's `scanEclipseSeasons` (geometry.ts).*

## 5 · The Stars

The 30 brightest stars from this vantage (full table in the appendix). Brightest: **HIP32349** at magnitude -1.44.

North pole: **HIP11767**, 0.74° off (mag 1.97).
South pole: **HIP104382**, 1.04° off (mag 5.45).

**288 tight naked-eye groupings** (≤3° apart, among stars mag ≤ 4) — candidate asterism seeds, listed by designation only:
- Gaia DR3 4357027756659697664 — HIP79593 (0.00°)
- Gaia DR3 4357027756659697664 — HIP79882 (1.41°)
- Gaia DR3 4993479684438433792 — HIP2072 (1.37°)
- Gaia DR3 4993479684438433792 — HIP2081 (0.00°)
- Gaia DR3 4038055447778237312 — HIP89642 (0.00°)
- Gaia DR3 4038055447778237312 — HIP90185 (2.73°)
- Gaia DR3 1222646935698492160 — Gaia DR3 1273423791421021568 (2.83°)
- Gaia DR3 1222646935698492160 — HIP75695 (2.83°)
- Gaia DR3 1222646935698492160 — HIP76267 (0.00°)
- Gaia DR3 1222646935698492160 — HIP76952 (1.85°)
- Gaia DR3 5111187420714898304 — HIP18543 (0.00°)
- Gaia DR3 4429785739602747392 — Gaia DR3 4426032591025363200 (2.54°)
- Gaia DR3 4429785739602747392 — HIP77070 (0.00°)
- Gaia DR3 4429785739602747392 — HIP77622 (2.54°)
- Gaia DR3 3704342295607157120 — HIP63090 (0.00°)
- Gaia DR3 4473334474604992384 — HIP86742 (0.00°)
- Gaia DR3 4473334474604992384 — HIP87108 (2.16°)
- Gaia DR3 4629125170492116224 — HIP17678 (0.00°)
- Gaia DR3 702343774145932544 — Gaia DR3 810952158347760128 (2.45°)
- Gaia DR3 702343774145932544 — HIP45688 (2.45°)
- *(268 more in the appendix)*

Milky Way band: reaches **29.8°** altitude at this site — a diagonal arc across the sky, crossing the horizon near WSW and ENE.

Zenith stars (pass within 2° of overhead once per rotation): HIP26727.

*Engine queries: `relocateStar` (Stage 1) over the full catalog; this tool's `nearestToPole`/`tightGroupings`/`milkyWayAtSite`/`zenithStars` (geometry.ts); Milky Way orientation via `helioToGalcen`/`galactocentricToIcrs`.*

## 6 · Rising & Setting

Rise/set azimuths for the 30 brightest stars (full table in the appendix) — the raw data for a star compass.

No circumpolar stars among the brightest 30 at this site.

**7 shared rising houses** (stars rising within the same 5°-wide azimuth bin):
- ~145° (SE): HIP30438, HIP7588, HIP61084
- ~150° (SSE): HIP71683, HIP68702, HIP62434, HIP71681
- ~100° (E): HIP24436, HIP65474
- ~85° (E): HIP37279, HIP27989, HIP25336
- ~80° (E): HIP97649, HIP49669
- ~60° (ENE): HIP37826, HIP36850, HIP25428
- ~120° (ESE): HIP113368, HIP33579

Heliacal rising/setting dates found for 30 of the 30 (calendar-anchor stars; full dates in the appendix).

*Engine queries: `findRiseSetTransit` + `inertialToHorizontal` at the rise/set moments; this tool's `heliacalDates` (geometry.ts, arcus-visionis proxy: sun between -6° and -18° altitude at the star's rise/set).*

## 7 · Deep Time

**100 local years** (1.00e+2 yr) — within the validated range. The fastest of the top-10 brightest stars drifts up to **0.103°**.
**1,000 local years** (1.00e+3 yr) — within the validated range. The fastest of the top-10 brightest stars drifts up to **1.030°** — enough to visibly deform a tight grouping over that span.
**10,000 local years** (1.00e+4 yr) — within the validated range. The fastest of the top-10 brightest stars drifts up to **10.195°** — enough to visibly deform a tight grouping over that span.

**Axial precession is not modeled** in this engine — the spin pole's RA/Dec is fixed for all simulated time. A real planet's precession (Earth's is ~26,000 yr) would slowly rotate every rising/setting/zenith/pole table in this document; none of that motion is represented here.

Honest caps: rectilinear propagation is validated to **1e+5 yr**; galactic-orbit propagation to **1e+6 yr**. Figures beyond these are extrapolation.

*Engine queries: `relocateStar` at two epochs (this tool's `properMotionDriftDeg`, geometry.ts); `PROPAGATION_MODELS` honest-cap metadata.*

## 8 · Appendix — full tables

### 8.1 World parameters
| field | value |
| --- | --- |
| world_type | — |
| age_gyr | — |
| host.catalog_id | — |
| host.mass_msun | 1.000 |
| host.luminosity_lsun | 1.000 |
| host.teff_k | 5772.000 |
| host.radius_rsun | 1.000 |
| planet.radius_km | 6371.000 |
| planet.mass_mearth | 1.000 |
| planet.a_au | 1.000 |
| planet.e | 0.000 |
| planet.axial_tilt_deg | 23.400 |
| site.lat_deg | 0.000 |
| site.lon_deg | 0.000 |

### 8.2 Calendar
| field | value |
| --- | --- |
| rotation_days_sidereal | 0.997 |
| solar_day_hours | 24.000 |
| orbit_years | 1.000 |
| days_per_year_local | 365.250 |
| summer_solstice_yr | 0.750 |
| winter_solstice_yr | 0.250 |
| equinox_1_yr | 0.500 |
| equinox_2_yr | 1.000 |
| min_day_hours | 11.967 |
| max_day_hours | 11.967 |
| min_rise_az_deg | 66.560 |
| max_rise_az_deg | 113.440 |

### 8.3 Moons
| moon | period_local_days | synodic | inc_deg | e | ang_diam_min_arcsec | ang_diam_max_arcsec |
| --- | --- | --- | --- | --- | --- | --- |
| Luna | 27.459 | 29.69 local days | 5.145 | 0.055 | 1766.780 | 1972.038 |

### 8.4 Eclipse seasons (per moon, summarized)
| moon | start_yr | end_yr | duration_local_days | event_count | min_sep_deg |
| --- | --- | --- | --- | --- | --- |
| Luna | 0.400 | 0.481 | 29.468 | 2.000 | 1.083 |
| Luna | 0.885 | 0.966 | 29.376 | 2.000 | 1.338 |
| Luna | 1.375 | 1.537 | 58.928 | 3.000 | 2.847 |
| Luna | 1.861 | 2.022 | 58.799 | 3.000 | 5.239 |
| Luna | 2.351 | 2.512 | 59.045 | 3.000 | 6.194 |
| Luna | 2.836 | 2.998 | 58.813 | 3.000 | 3.814 |
| Luna | 3.408 | 3.488 | 29.450 | 2.000 | 2.309 |
| Luna | 3.893 | 3.973 | 29.373 | 2.000 | 0.110 |
| Luna | 4.383 | 4.541 | 57.719 | 3.000 | 1.621 |
| Luna | 4.868 | 5.029 | 58.803 | 3.000 | 4.027 |
| Luna | 5.359 | 5.520 | 59.004 | 3.000 | 5.527 |
| Luna | 5.844 | 6.005 | 58.805 | 3.000 | 5.030 |
| Luna | 6.415 | 6.496 | 29.434 | 2.000 | 3.531 |
| Luna | 6.900 | 6.981 | 29.371 | 2.000 | 1.119 |
| Luna | 7.391 | 7.471 | 29.493 | 2.000 | 0.393 |
| Luna | 7.876 | 8.037 | 58.811 | 3.000 | 2.808 |
| Luna | 8.366 | 8.528 | 58.967 | 3.000 | 4.313 |
| Luna | 8.852 | 9.013 | 58.800 | 3.000 | 6.237 |
| Luna | 9.342 | 9.503 | 59.100 | 3.000 | 4.747 |
| Luna | 9.908 | 9.988 | 29.372 | 2.000 | 2.346 |
| Luna | 10.398 | 10.479 | 29.472 | 2.000 | 0.836 |
| Luna | 10.884 | 11.041 | 57.495 | 3.000 | 1.584 |
| Luna | 11.374 | 11.535 | 58.934 | 3.000 | 3.093 |
| Luna | 11.859 | 12.020 | 58.799 | 3.000 | 5.481 |
| Luna | 12.349 | 12.511 | 59.054 | 3.000 | 5.953 |
| Luna | 12.916 | 12.996 | 29.375 | 2.000 | 3.569 |
| Luna | 13.406 | 13.487 | 29.453 | 2.000 | 2.064 |
| Luna | 13.891 | 13.972 | 29.373 | 2.000 | 0.356 |
| Luna | 14.382 | 14.541 | 58.280 | 3.000 | 1.867 |
| Luna | 14.867 | 15.028 | 58.802 | 3.000 | 4.271 |
| Luna | 15.357 | 15.519 | 59.011 | 3.000 | 5.769 |
| Luna | 15.843 | 16.004 | 58.806 | 3.000 | 4.786 |
| Luna | 16.414 | 16.494 | 29.437 | 2.000 | 3.287 |
| Luna | 16.899 | 16.979 | 29.372 | 2.000 | 0.873 |
| Luna | 17.389 | 17.470 | 29.497 | 2.000 | 0.639 |
| Luna | 17.875 | 18.036 | 58.809 | 3.000 | 3.053 |
| Luna | 18.365 | 18.526 | 58.974 | 3.000 | 4.557 |
| Luna | 18.850 | 19.011 | 58.801 | 3.000 | 5.996 |
| Luna | 19.340 | 19.502 | 59.110 | 3.000 | 4.504 |
| Luna | 19.906 | 19.987 | 29.372 | 2.000 | 2.100 |

### 8.5 Brightest 30 stars
| designation | mag | bp_rp | dist_pc | visibility |
| --- | --- | --- | --- | --- |
| HIP32349 | -1.440 | 0.009 | 2.637 | rises and sets |
| HIP30438 | -0.620 | 0.164 | 95.877 | rises and sets |
| HIP69673 | -0.050 | 1.239 | 11.255 | rises and sets |
| HIP71683 | -0.010 | 0.710 | 1.347 | rises and sets |
| HIP91262 | 0.030 | -0.001 | 7.756 | rises and sets |
| HIP24608 | 0.080 | 0.795 | 12.938 | rises and sets |
| HIP24436 | 0.180 | -0.030 | 236.967 | rises and sets |
| HIP37279 | 0.400 | 0.432 | 3.497 | rises and sets |
| HIP7588 | 0.450 | -0.158 | 44.092 | rises and sets |
| HIP27989 | 0.450 | 1.500 | 131.062 | rises and sets |
| HIP68702 | 0.610 | -0.231 | 161.031 | rises and sets |
| HIP97649 | 0.760 | 0.221 | 5.143 | rises and sets |
| HIP60718 | 0.770 | -0.243 | 98.328 | rises and sets |
| HIP21421 | 0.870 | 1.538 | 19.964 | rises and sets |
| HIP65474 | 0.980 | -0.235 | 80.386 | rises and sets |
| HIP80763 | 1.060 | 1.865 | 185.185 | rises and sets |
| HIP37826 | 1.160 | 0.991 | 10.337 | rises and sets |
| HIP113368 | 1.170 | 0.145 | 7.688 | rises and sets |
| HIP62434 | 1.250 | -0.238 | 108.108 | rises and sets |
| HIP71681 | 1.350 | 0.900 | 1.347 | rises and sets |
| HIP49669 | 1.360 | -0.087 | 23.759 | rises and sets |
| HIP33579 | 1.500 | -0.211 | 132.100 | rises and sets |
| HIP36850 | 1.580 | 0.034 | 15.805 | rises and sets |
| HIP61084 | 1.590 | 1.600 | 26.961 | rises and sets |
| HIP85927 | 1.620 | -0.231 | 215.517 | rises and sets |
| HIP25336 | 1.640 | -0.224 | 74.516 | rises and sets |
| HIP25428 | 1.650 | -0.130 | 40.177 | rises and sets |
| HIP45238 | 1.670 | 0.070 | 34.083 | rises and sets |
| HIP109268 | 1.730 | -0.070 | 31.095 | rises and sets |
| HIP26727 | 1.740 | -0.199 | 250.627 | rises and sets |

### 8.6 Tight groupings (full)
| a | b | sep_deg |
| --- | --- | --- |
| Gaia DR3 4357027756659697664 | HIP79593 | 0.001 |
| Gaia DR3 4357027756659697664 | HIP79882 | 1.406 |
| Gaia DR3 4993479684438433792 | HIP2072 | 1.372 |
| Gaia DR3 4993479684438433792 | HIP2081 | 0.002 |
| Gaia DR3 4038055447778237312 | HIP89642 | 0.001 |
| Gaia DR3 4038055447778237312 | HIP90185 | 2.725 |
| Gaia DR3 1222646935698492160 | Gaia DR3 1273423791421021568 | 2.832 |
| Gaia DR3 1222646935698492160 | HIP75695 | 2.831 |
| Gaia DR3 1222646935698492160 | HIP76267 | 0.001 |
| Gaia DR3 1222646935698492160 | HIP76952 | 1.850 |
| Gaia DR3 5111187420714898304 | HIP18543 | 0.001 |
| Gaia DR3 4429785739602747392 | Gaia DR3 4426032591025363200 | 2.540 |
| Gaia DR3 4429785739602747392 | HIP77070 | 0.001 |
| Gaia DR3 4429785739602747392 | HIP77622 | 2.539 |
| Gaia DR3 3704342295607157120 | HIP63090 | 0.002 |
| Gaia DR3 4473334474604992384 | HIP86742 | 0.001 |
| Gaia DR3 4473334474604992384 | HIP87108 | 2.163 |
| Gaia DR3 4629125170492116224 | HIP17678 | 0.001 |
| Gaia DR3 702343774145932544 | Gaia DR3 810952158347760128 | 2.451 |
| Gaia DR3 702343774145932544 | HIP45688 | 2.451 |
| Gaia DR3 702343774145932544 | HIP45860 | 0.001 |
| Gaia DR3 4076915349846977664 | HIP90496 | 0.001 |
| Gaia DR3 3736865265441207424 | HIP63608 | 0.001 |
| Gaia DR3 5512070906394195968 | HIP36377 | 0.001 |
| Gaia DR3 510204838759030144 | HIP6686 | 0.001 |
| Gaia DR3 4683897617110115200 | HIP2021 | 0.010 |
| Gaia DR3 5859405805013401984 | HIP61585 | 2.144 |
| Gaia DR3 5859405805013401984 | HIP62322 | 2.688 |
| Gaia DR3 4049975081571729920 | HIP88635 | 0.001 |
| Gaia DR3 3557567320183657472 | HIP52943 | 0.001 |
| Gaia DR3 4935615308047192576 | HIP6867 | 0.001 |
| Gaia DR3 3211922645854328832 | HIP23875 | 0.001 |
| Gaia DR3 3211922645854328832 | HIP24674 | 2.996 |
| Gaia DR3 5826168461855385472 | HIP77952 | 0.002 |
| Gaia DR3 5826168461855385472 | HIP79664 | 2.274 |
| Gaia DR3 2887731882922767744 | HIP26634 | 2.871 |
| Gaia DR3 2887731882922767744 | HIP27628 | 0.002 |
| Gaia DR3 2255173119658513408 | HIP94376 | 0.001 |
| Gaia DR3 6838311796136238976 | Gaia DR3 6838023243053666688 | 1.750 |
| Gaia DR3 6838311796136238976 | HIP106985 | 1.751 |
| Gaia DR3 6838311796136238976 | HIP107556 | 0.002 |
| Gaia DR3 2858629802998456576 | HIP3092 | 0.001 |
| Gaia DR3 4444057469252265984 | HIP83000 | 0.001 |
| Gaia DR3 1517698716348324992 | HIP63125 | 0.001 |
| Gaia DR3 2281778105594488192 | HIP116727 | 0.001 |
| Gaia DR3 6270558110774003968 | HIP68895 | 0.001 |
| Gaia DR3 3520586071217872896 | HIP60965 | 0.001 |
| Gaia DR3 6762701233364896000 | HIP92855 | 2.942 |
| Gaia DR3 6762701233364896000 | HIP93506 | 2.403 |
| Gaia DR3 6762701233364896000 | HIP93864 | 0.001 |
| Gaia DR3 4269932382607207040 | HIP89962 | 0.004 |
| Gaia DR3 1487434040320076800 | HIP71075 | 0.001 |
| Gaia DR3 1018776176872261248 | HIP46853 | 0.005 |
| Gaia DR3 3288921720025503360 | Gaia DR3 3287731945364911232 | 1.398 |
| Gaia DR3 3288921720025503360 | HIP22449 | 0.002 |
| Gaia DR3 6058271964884299520 | HIP59747 | 1.829 |
| Gaia DR3 6058271964884299520 | HIP60260 | 0.001 |
| Gaia DR3 6058271964884299520 | HIP60718 | 2.769 |
| Gaia DR3 1014058103758571520 | HIP44127 | 0.002 |
| Gaia DR3 1014058103758571520 | HIP44471 | 1.157 |
| Gaia DR3 4573412435280434560 | HIP84379 | 0.001 |
| Gaia DR3 2470140321630664064 | HIP5364 | 0.001 |
| Gaia DR3 5964991494281655808 | HIP82729 | 0.001 |
| Gaia DR3 1041808368494264576 | HIP41704 | 0.001 |
| Gaia DR3 6195030801635544704 | HIP64962 | 2.481 |
| Gaia DR3 1284537517514584704 | HIP71053 | 0.001 |
| Gaia DR3 5849837854861497856 | HIP71908 | 0.001 |
| Gaia DR3 2195115561168483712 | HIP102422 | 0.004 |
| Gaia DR3 5888394463447019392 | HIP74395 | 0.001 |
| Gaia DR3 399402894487590144 | HIP7607 | 0.001 |
| Gaia DR3 1278391075717325312 | HIP74666 | 0.001 |
| Gaia DR3 2211820991085587584 | HIP112724 | 0.001 |
| Gaia DR3 3561350430457837056 | HIP55282 | 0.001 |
| Gaia DR3 5965222838410499328 | HIP84143 | 0.001 |
| Gaia DR3 4594497769766809216 | HIP86974 | 0.004 |
| Gaia DR3 4594497769766809216 | HIP87933 | 2.919 |
| Gaia DR3 3352485999058854912 | HIP32362 | 0.001 |
| Gaia DR3 5843518239925459456 | HIP61199 | 2.394 |
| Gaia DR3 5843518239925459456 | HIP63613 | 0.001 |
| Gaia DR3 3748360796947806208 | HIP51069 | 0.001 |
| Gaia DR3 1876510592179455744 | HIP112440 | 1.304 |
| Gaia DR3 1876510592179455744 | HIP112748 | 0.001 |
| Gaia DR3 5164120762333028736 | Gaia DR3 5164707970261890560 | 2.565 |
| Gaia DR3 5164120762333028736 | HIP16537 | 2.561 |
| Gaia DR3 5164120762333028736 | HIP17378 | 0.003 |
| Gaia DR3 5136659462996725888 | HIP9347 | 0.001 |
| Gaia DR3 3478394889483944320 | HIP56343 | 0.001 |
| Gaia DR3 2452378776434477184 | HIP8102 | 0.009 |
| Gaia DR3 5922299347569528832 | HIP85258 | 0.848 |
| Gaia DR3 2478112158887431296 | HIP6537 | 0.001 |
| Gaia DR3 425040000962559616 | HIP3179 | 1.731 |
| Gaia DR3 425040000962559616 | HIP3821 | 0.005 |
| Gaia DR3 786420645182229504 | HIP57399 | 0.001 |
| Gaia DR3 6427464123776727168 | HIP99240 | 0.007 |
| Gaia DR3 3662636823132300032 | HIP66249 | 0.001 |
| Gaia DR3 1939115478598580352 | HIP116584 | 0.002 |
| Gaia DR3 588551501854159744 | HIP47508 | 0.001 |
| Gaia DR3 4156500578347841408 | HIP91117 | 0.001 |
| Gaia DR3 3683687763520080384 | HIP61941 | 0.003 |
| Gaia DR3 5273030069128572928 | HIP41312 | 0.001 |
| Gaia DR3 805881416880407936 | HIP50372 | 0.001 |
| Gaia DR3 805881416880407936 | HIP50801 | 1.715 |
| Gaia DR3 2658974606111711488 | HIP114971 | 0.003 |
| Gaia DR3 5164707970261890560 | HIP16537 | 0.004 |
| Gaia DR3 5164707970261890560 | HIP17378 | 2.566 |
| Gaia DR3 3796442680948579328 | HIP57757 | 0.004 |
| Gaia DR3 2965792913525710976 | Gaia DR3 2964000159821218432 | 2.237 |
| Gaia DR3 2965792913525710976 | HIP27072 | 2.235 |
| Gaia DR3 2965792913525710976 | HIP27654 | 0.003 |
| Gaia DR3 4937200425857908992 | HIP9007 | 0.003 |
| Gaia DR3 2964000159821218432 | HIP27072 | 0.002 |
| Gaia DR3 2964000159821218432 | HIP27654 | 2.239 |
| Gaia DR3 4296708789290712064 | HIP97649 | 2.707 |
| Gaia DR3 4296708789290712064 | HIP98036 | 0.002 |
| Gaia DR3 4529285391533766400 | HIP90139 | 0.001 |
| Gaia DR3 738259665062428416 | HIP53229 | 0.001 |
| Gaia DR3 873035017257455104 | HIP36046 | 0.001 |
| Gaia DR3 4672726716408826240 | HIP17440 | 0.001 |
| Gaia DR3 4840356816072211712 | HIP19747 | 0.001 |
| Gaia DR3 643819484617141504 | HIP47908 | 2.727 |
| Gaia DR3 643819484617141504 | HIP48455 | 0.001 |
| Gaia DR3 433103132037681536 | HIP14668 | 0.001 |
| Gaia DR3 2139664063041544576 | Gaia DR3 2136270970154631168 | 2.521 |
| Gaia DR3 2139664063041544576 | HIP94779 | 0.001 |
| Gaia DR3 2139664063041544576 | HIP95853 | 2.521 |
| Gaia DR3 5173421634271199104 | HIP13701 | 0.001 |
| Gaia DR3 3174163561130003840 | HIP21594 | 0.001 |
| Gaia DR3 4990516294443333504 | HIP765 | 0.001 |
| Gaia DR3 1273423791421021568 | HIP75695 | 0.001 |
| Gaia DR3 1273423791421021568 | HIP76267 | 2.831 |
| Gaia DR3 5775835843156608256 | Gaia DR3 5777500503761872128 | 1.463 |
| Gaia DR3 5775835843156608256 | HIP81065 | 0.001 |
| Gaia DR3 6539947667988856320 | HIP114421 | 0.001 |
| Gaia DR3 2392584791494639744 | HIP115438 | 0.001 |
| Gaia DR3 3992011061833780096 | HIP54872 | 2.584 |
| Gaia DR3 2995725777563537792 | HIP27288 | 2.379 |
| Gaia DR3 2995725777563537792 | HIP28103 | 0.001 |
| Gaia DR3 660136821288588416 | HIP42911 | 0.001 |
| Gaia DR3 6838023243053666688 | HIP106985 | 0.001 |
| Gaia DR3 6838023243053666688 | HIP107556 | 1.750 |
| Gaia DR3 1891598193816300544 | HIP109176 | 0.001 |
| Gaia DR3 3287731945364911232 | HIP22449 | 1.398 |
| Gaia DR3 4929469381645492864 | HIP7083 | 0.001 |
| Gaia DR3 1193030490492925824 | HIP77233 | 2.485 |
| Gaia DR3 1193030490492925824 | HIP78072 | 0.006 |
| Gaia DR3 4426032591025363200 | HIP77070 | 2.540 |
| Gaia DR3 4426032591025363200 | HIP77622 | 0.001 |
| Gaia DR3 1049765396704695936 | HIP48319 | 0.001 |
| Gaia DR3 2136270970154631168 | HIP94779 | 2.520 |
| Gaia DR3 2136270970154631168 | HIP95853 | 0.001 |
| Gaia DR3 6337717036911729024 | HIP71957 | 0.001 |
| Gaia DR3 1988193348344678656 | HIP111169 | 0.001 |
| Gaia DR3 5059348952161258624 | HIP14879 | 0.003 |
| Gaia DR3 6001701610563428224 | HIP76297 | 1.501 |
| Gaia DR3 364785939116867072 | HIP4436 | 0.001 |
| Gaia DR3 5416916936743969152 | HIP50191 | 0.001 |
| Gaia DR3 2677558895241364864 | HIP110395 | 0.001 |
| Gaia DR3 2677558895241364864 | HIP110960 | 2.255 |
| Gaia DR3 6127688772460862976 | HIP60823 | 2.307 |
| Gaia DR3 6127688772460862976 | HIP61622 | 0.001 |
| Gaia DR3 6127688772460862976 | HIP61932 | 0.756 |
| Gaia DR3 2200153454733285248 | HIP109492 | 2.415 |
| Gaia DR3 5364580148905328256 | HIP51986 | 0.001 |
| Gaia DR3 5364580148905328256 | HIP52727 | 1.964 |
| Gaia DR3 3845263368043470080 | HIP45336 | 0.002 |
| Gaia DR3 436648129327098496 | HIP15863 | 2.472 |
| Gaia DR3 1563590510627624064 | HIP65378 | 0.004 |
| Gaia DR3 1563590510627624064 | HIP65477 | 0.196 |
| Gaia DR3 5961830948155839360 | HIP85696 | 1.759 |
| Gaia DR3 5961830948155839360 | HIP85927 | 1.638 |
| Gaia DR3 5961830948155839360 | HIP86670 | 1.222 |
| Gaia DR3 5777500503761872128 | HIP81065 | 1.463 |
| Gaia DR3 810952158347760128 | HIP45688 | 0.001 |
| Gaia DR3 810952158347760128 | HIP45860 | 2.451 |
| Gaia DR3 816649002967779584 | HIP44248 | 0.002 |
| Gaia DR3 6368016725517046144 | HIP98495 | 0.001 |
| Gaia DR3 878467085735262720 | HIP37826 | 0.963 |
| Gaia DR3 1763000413344449792 | HIP101769 | 2.675 |
| Gaia DR3 1763000413344449792 | HIP101958 | 1.700 |
| HIP2072 | HIP2081 | 1.374 |
| HIP2920 | HIP3179 | 2.688 |
| HIP3179 | HIP3821 | 1.729 |
| HIP8832 | HIP8903 | 1.536 |
| HIP13531 | HIP14328 | 1.747 |
| HIP14354 | HIP14576 | 2.192 |
| HIP15900 | HIP16083 | 0.913 |
| HIP16537 | HIP17378 | 2.561 |
| HIP17499 | HIP17573 | 0.334 |
| HIP17499 | HIP17702 | 0.595 |
| HIP17499 | HIP17847 | 0.980 |
| HIP17573 | HIP17702 | 0.460 |
| HIP17573 | HIP17847 | 0.823 |
| HIP17702 | HIP17847 | 0.386 |
| HIP20042 | HIP20535 | 1.293 |
| HIP20205 | HIP20455 | 2.057 |
| HIP20205 | HIP20885 | 2.139 |
| HIP20205 | HIP20894 | 2.148 |
| HIP20455 | HIP20885 | 2.079 |
| HIP20455 | HIP20889 | 2.121 |
| HIP20455 | HIP20894 | 2.162 |
| HIP20885 | HIP20894 | 0.094 |
| HIP20885 | HIP21421 | 1.846 |
| HIP20894 | HIP21421 | 1.856 |
| HIP23453 | HIP23767 | 0.776 |
| HIP23875 | HIP24674 | 2.996 |
| HIP24436 | HIP24674 | 1.556 |
| HIP25281 | HIP25930 | 2.818 |
| HIP25859 | HIP26634 | 2.225 |
| HIP25930 | HIP26727 | 2.736 |
| HIP26634 | HIP27628 | 2.871 |
| HIP27072 | HIP27654 | 2.236 |
| HIP27288 | HIP28103 | 2.379 |
| HIP27673 | HIP28380 | 2.523 |
| HIP29655 | HIP30343 | 1.867 |
| HIP34481 | HIP35228 | 2.641 |
| HIP42515 | HIP42828 | 2.241 |
| HIP42536 | HIP42913 | 1.902 |
| HIP43109 | HIP43813 | 2.194 |
| HIP43783 | HIP45080 | 2.611 |
| HIP43783 | HIP45101 | 2.559 |
| HIP44127 | HIP44471 | 1.157 |
| HIP45080 | HIP45556 | 0.844 |
| HIP45556 | HIP46701 | 2.914 |
| HIP45688 | HIP45860 | 2.452 |
| HIP45941 | HIP46701 | 2.390 |
| HIP47908 | HIP48455 | 2.728 |
| HIP50371 | HIP51576 | 1.816 |
| HIP50372 | HIP50801 | 1.715 |
| HIP51576 | HIP52419 | 2.978 |
| HIP51986 | HIP52727 | 1.963 |
| HIP59196 | HIP59449 | 1.724 |
| HIP59747 | HIP60260 | 1.830 |
| HIP59747 | HIP61084 | 2.682 |
| HIP60260 | HIP60718 | 2.768 |
| HIP60823 | HIP61622 | 2.308 |
| HIP60823 | HIP61932 | 2.526 |
| HIP61199 | HIP63613 | 2.393 |
| HIP61585 | HIP62322 | 1.320 |
| HIP61622 | HIP61932 | 0.755 |
| HIP65378 | HIP65477 | 0.197 |
| HIP67464 | HIP67472 | 0.786 |
| HIP67464 | HIP68245 | 1.683 |
| HIP67472 | HIP68245 | 1.643 |
| HIP67472 | HIP68282 | 2.849 |
| HIP68002 | HIP68282 | 2.544 |
| HIP68245 | HIP68282 | 2.704 |
| HIP71681 | HIP71683 | 0.004 |
| HIP73273 | HIP73334 | 1.036 |
| HIP73807 | HIP74376 | 2.037 |
| HIP75141 | HIP76297 | 2.653 |
| HIP75695 | HIP76267 | 2.831 |
| HIP76267 | HIP76952 | 1.850 |
| HIP76470 | HIP76600 | 1.681 |
| HIP77070 | HIP77622 | 2.540 |
| HIP77233 | HIP78072 | 2.484 |
| HIP77952 | HIP79664 | 2.273 |
| HIP78401 | HIP78933 | 2.465 |
| HIP78820 | HIP78933 | 0.922 |
| HIP78820 | HIP79374 | 1.582 |
| HIP78933 | HIP79374 | 1.716 |
| HIP79593 | HIP79882 | 1.407 |
| HIP80112 | HIP80763 | 2.028 |
| HIP80763 | HIP81266 | 2.291 |
| HIP82514 | HIP82545 | 0.096 |
| HIP85696 | HIP85927 | 0.598 |
| HIP85696 | HIP86670 | 2.884 |
| HIP85927 | HIP86670 | 2.601 |
| HIP86670 | HIP87261 | 2.460 |
| HIP86742 | HIP87108 | 2.162 |
| HIP86974 | HIP87933 | 2.916 |
| HIP87933 | HIP88794 | 2.192 |
| HIP89642 | HIP90185 | 2.724 |
| HIP92041 | HIP92855 | 2.256 |
| HIP92420 | HIP93194 | 1.976 |
| HIP92855 | HIP93864 | 2.941 |
| HIP93085 | HIP93683 | 1.738 |
| HIP93085 | HIP94141 | 2.809 |
| HIP93506 | HIP93864 | 2.405 |
| HIP93683 | HIP94141 | 1.384 |
| HIP94779 | HIP95853 | 2.521 |
| HIP97278 | HIP97649 | 2.071 |
| HIP97365 | HIP98337 | 2.853 |
| HIP97649 | HIP98036 | 2.705 |
| HIP100064 | HIP100345 | 2.349 |
| HIP101769 | HIP101958 | 1.410 |
| HIP106985 | HIP107556 | 1.751 |
| HIP110395 | HIP110960 | 2.255 |
| HIP112440 | HIP112748 | 1.304 |

### 8.7 Rising & setting (brightest 30)
| designation | rise_az_deg | set_az_deg | visibility | heliacal_rising_yr | heliacal_setting_yr |
| --- | --- | --- | --- | --- | --- |
| HIP32349 | 106.716 | 253.284 | rises and sets | 0.229 | 0.329 |
| HIP30438 | 142.696 | 217.304 | rises and sets | 0.217 | 0.317 |
| HIP69673 | 70.818 | 289.182 | rises and sets | 0.117 | 0.654 |
| HIP71683 | 150.834 | 209.166 | rises and sets | 0.138 | 0.671 |
| HIP91262 | 51.216 | 308.784 | rises and sets | 0.292 | 0.825 |
| HIP24608 | 44.002 | 315.998 | rises and sets | 0.175 | 0.275 |
| HIP24436 | 98.202 | 261.798 | rises and sets | 0.171 | 0.271 |
| HIP37279 | 84.775 | 275.225 | rises and sets | 0.263 | 0.362 |
| HIP7588 | 147.237 | 212.763 | rises and sets | 0.021 | 0.129 |
| HIP27989 | 82.593 | 277.407 | rises and sets | 0.200 | 0.300 |
| HIP68702 | 150.373 | 209.627 | rises and sets | 0.108 | 0.646 |
| HIP97649 | 81.132 | 278.868 | rises and sets | 0.338 | 0.875 |
| HIP60718 | 153.099 | 206.901 | rises and sets | 0.037 | 0.575 |
| HIP21421 | 73.491 | 286.509 | rises and sets | 0.146 | 0.246 |
| HIP65474 | 101.161 | 258.839 | rises and sets | 0.083 | 0.617 |
| HIP80763 | 116.432 | 243.568 | rises and sets | 0.208 | 0.742 |
| HIP37826 | 61.974 | 298.026 | rises and sets | 0.267 | 0.371 |
| HIP113368 | 119.622 | 240.378 | rises and sets | 0.471 | 0.008 |
| HIP62434 | 149.689 | 210.311 | rises and sets | 0.054 | 0.592 |
| HIP71681 | 150.837 | 209.163 | rises and sets | 0.138 | 0.671 |
| HIP49669 | 78.033 | 281.967 | rises and sets | 0.362 | 0.471 |
| HIP33579 | 118.972 | 241.028 | rises and sets | 0.237 | 0.338 |
| HIP36850 | 58.112 | 301.888 | rises and sets | 0.263 | 0.362 |
| HIP61084 | 147.113 | 212.887 | rises and sets | 0.046 | 0.579 |
| HIP85927 | 127.104 | 232.896 | rises and sets | 0.250 | 0.783 |
| HIP25336 | 83.650 | 276.350 | rises and sets | 0.179 | 0.279 |
| HIP25428 | 61.393 | 298.607 | rises and sets | 0.179 | 0.279 |
| HIP45238 | 159.717 | 200.283 | rises and sets | 0.325 | 0.429 |
| HIP109268 | 136.961 | 223.039 | rises and sets | 0.433 | 0.971 |
| HIP26727 | 91.943 | 268.057 | rises and sets | 0.188 | 0.287 |

### 8.8 Deep-time drift (top 10 brightest)

**100 local years:**
| star | drift_deg |
| --- | --- |
| HIP32349 | 0.037 |
| HIP30438 | 0.001 |
| HIP69673 | 0.063 |
| HIP71683 | 0.103 |
| HIP91262 | 0.010 |
| HIP24608 | 0.012 |
| HIP24436 | 0.000 |
| HIP37279 | 0.035 |
| HIP7588 | 0.003 |
| HIP27989 | 0.001 |

**1000 local years:**
| star | drift_deg |
| --- | --- |
| HIP32349 | 0.372 |
| HIP30438 | 0.009 |
| HIP69673 | 0.633 |
| HIP71683 | 1.030 |
| HIP91262 | 0.097 |
| HIP24608 | 0.120 |
| HIP24436 | 0.001 |
| HIP37279 | 0.350 |
| HIP7588 | 0.027 |
| HIP27989 | 0.008 |

**10000 local years:**
| star | drift_deg |
| --- | --- |
| HIP32349 | 3.715 |
| HIP30438 | 0.086 |
| HIP69673 | 6.305 |
| HIP71683 | 10.195 |
| HIP91262 | 0.974 |
| HIP24608 | 1.205 |
| HIP24436 | 0.005 |
| HIP37279 | 3.492 |
| HIP7588 | 0.269 |
| HIP27989 | 0.082 |

---
*Generated by tools/emit_dossier.ts · catalog: catalog/local_volume_300pc.json · world schema 0.1*
