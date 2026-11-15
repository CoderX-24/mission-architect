# Mission Architect — Handover v2

*Supersedes the original HANDOVER.md. Written 14 Nov 2026, late in day one.*
*Updated 15 Nov 2026: section 11b adds the surface segment and the UI pass;*
*section 11c adds team sessions, difficulty levels, saved missions and the debrief.*

## 0. Read this first

You are picking up a NASA Space Apps Challenge 2026 project mid-hackathon.
The project is **working, tested and deployable**. Do not rebuild it. Read this
whole document before changing anything.

**Deadline: Sunday 15 Nov 2026, 23:59 IST. Absolute.** Nothing saved or
submitted after that is eligible.

**The two outstanding risks, in order:**

1. **The submission has never been filed.** Section 12 has every field
   pre-written. It takes ten minutes. Re-submitting is free and only the last
   click is judged, so banking a rough one early is pure insurance.
2. **The 7-slide deck has not been made.** Section 13 has every slide drafted
   and the exact capture list.

Everything else is built. Section 11 lists what the previous session added;
**section 11b lists the surface segment and the UI pass. Section 11c lists real
time multiplayer, difficulty levels, mission files and the post-mission
debrief.**

---

## 1. Competition context

**Event:** NASA Space Apps Challenge 2026, theme "The Next Frontier"
**Challenge:** Space Mission Design Game (Intermediate / Beginner-Youth, Games)
**Team:** Doon-Dev, 2 people, registered at the **Satna virtual event (IST)**
**Repo:** https://github.com/CoderX-24/mission-architect (public)
**Live:** https://coderx-24.github.io/mission-architect/

The repo is owned by **CoderX-24**. The second team member is a *collaborator*,
not the owner — this matters, because the Claude GitHub App cannot be installed
on the repo by a collaborator, so an AI session cannot be given push access
without the owner acting. Work is delivered as **self-contained shell scripts**
instead (see section 9). That loop is proven and produces byte-identical builds.

### Challenge brief, in summary

Build an interactive game where participants design, manage and simulate a
complete space mission: objective, spacecraft design, instrument selection,
launch vehicle, orbit, and constraints on budget, mass, power, communications,
data and lifetime. A strong solution includes: a functional interactive game,
clear UI, mission configuration, resource management, collaboration for up to
four, and a mission simulation and evaluation system.

---

## 2. Submission rules that constrain design

- **Project Demonstration must be EITHER a video of 30 seconds or less, OR a
  slide deck of no more than 7 slides.** Public link, no login.
  Decision: **7-slide deck with embedded gameplay GIFs.** 30 seconds is about
  75 words of narration and cannot carry the argument.
- Project link must be public, no password or registration.
- **NASA data use is mandatory for a Global Award.** Link Text + full URL pairs.
- "Space Agency Partner & Other Data" must list EVERY external resource:
  libraries, fonts, images, AI assistance.
- **AI tool use is explicitly permitted** and should be declared, not hidden.
- **"Save Progress" is NOT "Submit for Judging".** Two separate buttons.
- **You may submit repeatedly. Only the final click is judged.**
- Use the edit Lock toggle; a teammate can overwrite unsaved changes.
- Max 6 team members for Global Judging eligibility.

---

## 3. Judging

Scored **1 to 5 on each of five criteria**: Impact, Creativity, Validity,
Relevance, Presentation.

Funnel from 2025: 18,860 teams registered → ~11,500 projects submitted →
1,294 Global Nominees (~7%) → 45 Global Finalists → 10 Global Winners.
About 40% of registered teams never submit at all.

**Global Nominees are chosen at LOCAL events.** The first gate is the Satna
local judges, not NASA. Clarity and a working demo beat sophistication.

**Target award: Best Mission Concept.**

---

## 4. Research on past winners (do not re-research this)

### 2025 Global Winners
Best Use of Science — SpaceGenes+ · Best Use of Technology — Twisters ·
Galactic Impact — Astro Sweepers · **Best Mission Concept — PureFlow** ·
Most Inspirational — Photonics Odyssey · Best Storytelling — HerCode Space ·
Global Connection — Gaia+LEO · Art & Technology — Zumorroda-X ·
Local Impact — QUEÑARIS

### Patterns
1. Global winners are overwhelmingly **tools and platforms, not "games."**
   Game-shaped projects win soft categories.
2. Winners use **actual NASA datasets**, not just NASA documents for constants.
3. Winners are legible in 60 seconds, with specific memorable names.
4. Winning write-ups use the language of **platforms, engines and simulators.**

### THE KEY PRECEDENT: PureFlow (2025, Best Mission Concept)
Team from Aracaju, Brazil. Challenge: "Your Home in Space: The Habitat Layout
Creator." NASA described it as "an interactive systems engineering platform that
allows users to design, model in 3D, and validate space habitats," then test
designs against real space-weather threats such as solar storms.
Live: https://larasdiniz.github.io/PureFlow-2025/src/public/html/home/home.html

It is a **static GitHub Pages site**. Drag-and-drop functional areas, "real-time
validation against NASA requirements." A Brazilian press report states one member
integrated NASA's DONKI API for real-time solar storm detection, describing it as
"more than a static design tool, a kind of intelligent survival simulator."

Their "100% NASA Standards" claim has no supporting detail on the site. Mission
Architect's per-entry citations are stronger evidence.

**Mission Architect is the same shape of project and is more rigorous on data.
As of the last session it also beats PureFlow on experience: PureFlow validates a
static design; Mission Architect runs the mission and enumerates the whole trade
space.**

---

## 5. Stack and architecture

Vite 8 + React 19 (JavaScript, not TypeScript), plain CSS, no backend, no
database, no accounts. Static site to GitHub Pages via `gh-pages`.

### Architectural contract (DO NOT BREAK)

`App.jsx` owns ONE config object. Screens receive `config`, `setConfig` and
`result`. `result = useMemo(() => runMission(config), [config])`.
**No screen calculates anything.** The UI only renders what `runMission` returns.

`runMission` has not been modified at any point. Everything added since is
**additive** — new pure modules that *consume* its output. Keep it that way.

### File inventory

```
src/
  data/
    objectives.json            5 mission objectives
    instruments.json           12 science instruments
    components.json            8 subsystem groups (array, battery, comms,
                               adcs, propulsion, thermal, obc, structure)
    orbits.json                6 orbits (LEO 400, SSO 705, GTO, GEO, lunar, Mars)
    launchers.json             4 launch vehicles
    events.json                7 scripted in-flight events
    spaceweather-fallback.json 433 REAL NASA CME records (section 8)
    roles.json                 4 team roles
  sim/
    constants.js    G0, solar constant, integration factor, ops cost
    mass.js         payload + bus dry mass
    deltaV.js       delta-v budget + Tsiolkovsky propellant mass
    power.js        inverse-square solar flux, degradation, eclipse, battery
    data.js         data generation vs link budget
    budget.js       development + launch + ops cost
    score.js        margin grading, instrument-objective matching, scoring
    events.js       seeded deterministic event selection (mulberry32)
    spaceWeather.js NASA DONKI fetch + CME stress model
    runMission.js   orchestrator: config -> checks, margins, events, score
    telemetry.js    [NEW] time-domain reconstruction (section 11)
    tradeSpace.js   [NEW] exhaustive bus enumeration + Pareto front (section 11)
    outpost.js      [NEW] surface segment derivation + site plan (section 11b)
    difficulty.js   [NEW] level rules, score multiplier, guidance (section 11c)
    debrief.js      [NEW] post-mission analysis + role attribution (section 11c)
  ui/
    Dashboard.jsx        live margin bars, healthy band drawn into the track
    PhaseNav.jsx         10-phase tab bar, scoped per role, ?phase= deep links
    ObjectiveScreen.jsx / PayloadScreen.jsx / SpacecraftScreen.jsx / OrbitScreen.jsx
    ResultScreen.jsx     verdict, FlightConsole, score breakdown, flight log
    TradeScreen.jsx      [NEW] trade space scatter + efficient frontier
    OutpostScreen.jsx    [NEW] surface segment: scene, readouts, provenance table
    DebriefScreen.jsx    [NEW] debrief, team notes, send-feedback form
    Lobby.jsx            [NEW] create/join a session, waiting room, roles
    SpaceWeatherPanel.jsx
    SourcesPanel.jsx     every entry + its NASA citation
    Landing.jsx          hero with live orbit, 4 feature cards, 6 stats, demo CTA
    RoleBar.jsx / ShareButton.jsx
  viz/
    OrbitCanvas.jsx      2D animated orbit (used on the landing hero)
    SpacecraftView.jsx   SVG schematic drawn to scale from the design
    FlightConsole.jsx    [NEW] the mission, running (section 11)
    OutpostView.jsx      [NEW] isometric site plan, day/night, to scale (section 11b)
  net/
    protocol.js          [NEW] pure session state machine + role ownership
    transport.js         [NEW] BroadcastChannel + WebRTC, de-duplicated
    useSession.js        [NEW] host-authoritative React hook
  share/encode.js        mission config <-> URL hash, ?phase= and ?join= links
  share/missionFile.js   [NEW] save to disk, validated load
  App.jsx                single config object, useMemo(runMission)
  App.css                all styles + design system
  fonts.css              [NEW] self-hosted @font-face, latin only
  index.css              reset
scripts/fetch-spaceweather.mjs
tests/
  sanity.mjs             three-case engine calibration (DO NOT let this change)
  telemetry.mjs          [NEW] 25 assertions, telemetry vs runMission
  tradespace.mjs         [NEW] 8 assertions, exhaustiveness + Pareto correctness
  outpost.mjs            [NEW] traceability, determinism, no overlaps, 144-config sweep
  difficulty.mjs         [NEW] level layer never touches the engine, debrief sanity
  session.mjs            [NEW] authority, ownership, scopes, standings
  missionfile.mjs        [NEW] round trip + 14 hostile files refused
```

---

## 6. The config object

```js
{
  objectiveId: 'forest_biomass',
  orbitId: 'leo_sso',
  launcherId: 'rideshare',
  instrumentIds: ['multispectral_imager', 'lidar_altimeter'],
  components: {
    array: 'array_m', battery: 'batt_m', comms: 'comms_x', adcs: 'adcs_fine',
    propulsion: 'prop_mono', thermal: 'therm_passive', obc: 'obc_basic',
    structure: 'struct_small',
  },
  lifetimeYears: 5,
  difficulty: 'normal',   // optional: 'easy' | 'normal' | 'hard'
}
```

`runMission(config)` returns:

```js
{
  flies, checks[], margins{mass,power,budget,data,deltaV}, events[],
  mass{payloadKg,busKg,dryKg,propKg,wetKg,capacityKg},
  deltaV{insertion,stationKeeping,disposal,totalMs},
  power{fluxWm2,powerBOL,powerEOL,orbitAvgW,loadW,eclipseMin,energyNeededWh,
        batteryCapacityWh,batteryOk,margin},
  data{generatedGbPerDay,downlinkMbps,downlinkGbPerDay,returnFraction,margin},
  budget{...,totalUsdM,budgetUsdM,margin},
  score{sciencePerDay,lifetimeFactor,scienceScore,grades,marginBonus,
        efficiency,efficiencyBonus,riskMultiplier,final},
  analogue{mission,url}, summary
}
```

### Valid IDs (useful when writing tests — inventing IDs crashes `mass.js`)

```
array      : array_s, array_m, array_l, array_xl
battery    : batt_s, batt_m, batt_l
comms      : comms_s, comms_x, comms_ka, comms_laser
adcs       : adcs_coarse, adcs_wheels, adcs_fine
propulsion : prop_cold, prop_mono, prop_bi, prop_ion
thermal    : therm_passive, therm_active, therm_cryo
obc        : obc_basic, obc_rad
structure  : struct_cubesat, struct_small, struct_large
launchers  : electron, falcon9, atlas5, rideshare
objectives : forest_biomass, mars_recon, lunar_south_pole, deep_sky_survey, space_weather
orbits     : leo_low, leo_sso, gto, geo, lunar, mars
```

---

## 7. The physics (all real, all cited)

```
flux        = 1361 / solarDistanceAu^2            // W/m^2, inverse square
powerBOL    = flux * areaM2 * efficiency * 0.9    // 0.9 = packing + cosine loss
degradation = degradationPerYear * (1 + radiationIndex)
powerEOL    = powerBOL * (1 - degradation)^years
orbitAvgW   = powerEOL * (1 - eclipseFraction)
eclipseMin  = periodMin * eclipseFraction
energyWh    = (loadW * eclipseMin / 60) / (depthOfDischarge * 0.9)

deltaV      = insertion + stationKeeping*years + (0.05*that + 30)
propMass    = dryKg * (exp(deltaV / (ispS * 9.80665)) - 1)   // Tsiolkovsky
wetKg       = dryKg + propMass
FAIL if wetKg > launcher.capacityKg[orbitId]

generatedGbPerDay = sum(dataRateMbps * dutyCycle) * 86400 / 8000
downlinkMbps      = baseRateMbps * (txPowerW/50) * (antennaM/1.0)^2 * orbit.linkFactor
downlinkGbPerDay  = downlinkMbps * groundContactMinPerDay * 60 / 8000
returnFraction    = min(1, downlink/generated)

devCost   = (instrumentCost + busCost) * 1.35
totalCost = devCost + launcher.costUsdM + 8*years
```

`linkFactor` folds range loss and ground-station aperture into one calibrated
term (LEO 1.0, SSO 0.90, GTO 0.40, GEO 0.35, lunar 0.16, Mars 0.055). Mars
insertion delta-v is 1800 m/s assuming aerobraking, as MRO used.

### Margin grading (src/sim/score.js)

| Margin | Grade | Bonus |
|---|---|---|
| < 0% | FAIL | mission does not fly |
| 0–10% | RISKY | 0, high event risk |
| 10–35% | NOMINAL | +10 |
| 35–50% | GENEROUS | +5 |
| > 50% | OVERDESIGNED | −4 |

### Scoring

```
sciencePerDay = sum(scienceValue * match)   // 1.0 required, 0.25 bonus, 0 irrelevant
scienceScore  = sciencePerDay * returnFraction * lifetimeFactor * 100
final         = round(scienceScore * riskMultiplier + marginBonus + efficiencyBonus)
riskMultiplier = max(0.2, 1 - eventsFailed*0.22)
```

**The core idea — protect it.** Real missions hold 10–35% margin because
everything grows between design and launch. The game rewards margin discipline
and punishes both zero margin and gross overdesign. No other entry models this.

---

## 8. NASA DONKI space weather integration

- Endpoint: `https://api.nasa.gov/DONKI/CME?startDate=&endDate=&api_key=`
- **CORS is open**, so a static site calls it directly. No backend needed.
- **Max 60 days per request.** Longer ranges return plain-text errors, not JSON.
- `DEMO_KEY` is shared globally and **will** rate-limit (429 observed in
  testing). A free personal key from https://api.nasa.gov is instant.
- Key lives in `.env` as `VITE_NASA_API_KEY`. **`.env` is gitignored.**
  Vite bakes `VITE_*` into the client bundle — acceptable for a free public-tier
  key, and should be mentioned in the README.
- `scripts/fetch-spaceweather.mjs` writes `src/data/spaceweather-fallback.json`.
  Currently **433 real CMEs, 2026-07-16 to 2026-11-13**. The app falls back to
  this whenever the live fetch fails, **so validation never breaks during
  judging. This was observed working under a real 429.**

### Stress model

```
stress = (cme.speed / 1000) * (0.30 + orbit.radiationIndex)
```

| stress ≥ | Band | Needs power margin | Needs data margin | Needs redundant ADCS |
|---|---|---|---|---|
| 0.95 | Extreme | 20% | 10% | yes |
| 0.65 | Severe | 12% | 5% | no |
| 0.40 | Moderate | 6% | — | no |

**Storms fail a design through THREE independent paths — power margin, data
margin, and a single-event upset with no redundant ADCS.** Any code that grades
storms must go through `assessSpaceWeather`, never reimplement it. (This was a
real bug; see section 11.)

Orbit choice changes exposure by roughly 5× — physically correct, since Earth's
magnetosphere shields low orbits.

---

## 9. Verified working — run these

```bash
node tests/sanity.mjs       # engine calibration. MUST print 1665 / 15 / 522 / 1687
node tests/telemetry.mjs    # 25 assertions. MUST print ALL TELEMETRY CHECKS PASS
node tests/tradespace.mjs   # 8 assertions.  MUST print ALL TRADE SPACE CHECKS PASS
node tests/outpost.mjs      # surface segment. MUST print ALL OUTPOST CHECKS PASS
node tests/difficulty.mjs   # difficulty + debrief. MUST print ALL DIFFICULTY CHECKS PASS
node tests/session.mjs      # multiplayer protocol. MUST print ALL SESSION CHECKS PASS
node tests/missionfile.mjs  # save/load. MUST print ALL MISSION FILE CHECKS PASS
npm run build               # must complete clean
```

Expected sanity output:

```
GOOD   -> flies:true   score:1665   mass=95% power=80% budget=1%  data=200%
GREEDY -> flies:false  score:15     7 constraint failures
CHEAP  -> flies:true   score:522    mass=69% power=55% budget=79% data=-27%
MARS   -> flies:true   score:1687   mass=34% power=86% budget=31% data=200%
```

**If those four numbers change, something is wrong. Do not retune the catalogs
without re-running this.**

### Delivery loop (because push access is unavailable — see section 1)

Changes are delivered as self-contained shell scripts that write whole files via
heredocs, back up what they replace, and refuse to report success unless the
test suites and the build pass. Generate one like this:

```bash
node -e '
const fs=require("fs");
const files=["src/sim/telemetry.js","src/App.css"];   // files to ship
let s="#!/usr/bin/env bash\nset -euo pipefail\n";
for(const f of files){
  const d="__EOF_"+f.replace(/[^A-Za-z0-9]/g,"_").toUpperCase()+"__";
  s+=`mkdir -p "$(dirname ${f})"\ncat > ${f} <<'"'"'${d}'"'"'\n`+fs.readFileSync(f,"utf8")+`${d}\n\n`;
}
s+="node tests/sanity.mjs | grep -E \"^===\"\nnode tests/telemetry.mjs | tail -1\nnpm run build\n";
fs.writeFileSync("apply.sh",s);
'
```

Always test a generated script against a **pristine checkout** before sending it.

---

## 10. Gotchas that have already cost time

1. **JSON imports need an import attribute**: `import X from './x.json' with
   { type: 'json' }`. Node requires it; Vite accepts it.
2. **macOS sed needs an empty arg**: `sed -i '' 's/a/b/' file`.
3. **Never put a bare `*` selector at the start of a CSS line** when code is
   copy-pasted through chat — the asterisk is eaten as a markdown bullet and
   produces an empty selector that breaks the production build. Lightning CSS
   only runs on `vite build`, never `vite dev`, so it passes locally and fails
   on deploy.
4. **`vite.config.js` must have `base: '/mission-architect/'`** matching the
   repo name, or GitHub Pages serves a blank white page.
5. GitHub Pages needs the repo to be **public**.
6. Vite's default `index.css` centres everything and must be overridden.
7. DONKI returns plain-text errors, not JSON — always check the response starts
   with `[` before parsing.
8. **`src/viz/SpacecraftView.jsx` was untracked for most of the hackathon.** A
   GitHub ZIP or fresh clone did not contain it. Check `git status` before
   assuming a file is safe.
9. **In some sandboxes `node_modules/.bin/vite` is copied, not symlinked**, so
   `npm run build` fails with `Cannot find module .../node_modules/dist/node/cli.js`.
   Workaround: `node node_modules/vite/bin/vite.js build`. Does not affect macOS.
10. **React controlled `<input type="range">` ignores a directly-set `.value`
    plus synthetic event.** To drive it in a browser test, focus it and send
    keyboard events (`End`, `ArrowRight`).
11. Remote Control / repo push access could not be granted (section 1). Don't
    spend deadline time retrying it.

---

## 11. What the last session added

All four steps are **built, browser-tested and verified**. They may or may not
have been applied to the working tree yet — check for `src/fonts.css`,
`src/sim/telemetry.js` and `src/sim/tradeSpace.js`.

### Step 1 — Visual identity pass
- Self-hosted type system: Space Grotesk (display), Inter (body), JetBrains Mono
  (every number, tabular). Latin-only `@font-face` in `src/fonts.css`, **three
  files, 111 KB, zero CDN requests at runtime** — nothing external can break the
  site during judging.
- Colour is **status, never decoration**. Amber is brand/interactive only.
- **The healthy 10–35% margin band is drawn into every bar track**, so the core
  thesis is visible without reading.
- Section headers as mono micro-labels; phase nav as a segmented control;
  layered surfaces, inner highlights, masked engineering grid.
- Landing rebuilt: hero with a live orbit already running, plus a fifth stat —
  433 real NASA solar storms.

**Bug fixed:** the shipped default config *did not fly*. `adcs_wheels` gives 20″
pointing; the lidar altimeter needs 5″. A judge clicking *Start designing →
Simulate* saw a red `MISSION DOES NOT FLY` on a design they never made. Default
ADCS changed to `adcs_fine`: **flies, score 1709, mass 20% and budget 24% both
NOMINAL.** `tests/sanity.mjs` does not cover `INITIAL`, so it was unaffected.

### Step 2 — `src/sim/telemetry.js`
Pure time-domain reconstruction. **No new physics, no new constants.** Every
series integrates back to a number `runMission` already reports, and
`tests/telemetry.mjs` asserts exactly that (mean array output == `orbitAvgW`,
eclipse minutes match, data rates integrate to the per-day figures, the
time-domain battery verdict equals the analytic `batteryOk`, degradation
reproduces `powerBOL`/`powerEOL`).

Exports `orbitTimeline` (per-timestep array/battery/buffer over one orbit, with
an optional `atYear` epoch), `missionTimeline` (degradation and brownout year),
`stormTimeline` (DONKI records at an epoch).

Produces a genuinely useful figure: **`daysToFillRecorder`** — e.g. a Mars design
with an S-band link fills its recorder in 2.3 days, then loses 56.3 GB/day.

### Step 3 — `src/viz/FlightConsole.jsx`
The mission, running, on the Simulate tab.
- **Orbit view**: spacecraft flies its real orbit, one lap per 12 s, labelled
  `1 second ≈ N minutes`. Dims in eclipse, passes *behind* the planet, drops a
  link line to the ground station during a pass.
- **Telemetry strip chart**: array power, battery SOC, recorder fill on one
  shared time axis, eclipse and contact bands shaded across all lanes, load line
  crossing the power trace.
- **Mission timeline**: scrub launch → end of life; the orbit above re-flies at
  that array age. Default goes 2940 W → 2492 W, margin 65% → 58%.
- **Storms on their own axis**, with real dates — conflating a 120-day record
  with a 5-year mission would have been dishonest.

**Bug fixed:** `stormTimeline` originally reimplemented only the power-margin
check and was blind to the data-margin and ADCS paths. It now **delegates to
`assessSpaceWeather`**, and a test asserts the console and the Space Weather tab
return identical verdicts on identical records.

**Copy fixed:** the console claimed "a storm you survive at launch can end you at
end of life." For the default design that is false — 0 storms degrade it at both
epochs. It now computes both epochs and only makes that claim when true.

### Step 4 — `src/sim/tradeSpace.js` + `src/ui/TradeScreen.jsx`
`runMission` costs **0.013 ms**, so the *entire* bus design space — all **10,368**
combinations — is enumerated **exhaustively in under 100 ms**. Nothing sampled.

For the default: **76 of 10,368 fly (0.7%)**, 2 on the efficient frontier, and
the default design is on it. Mars case: design scores 41 while **379 dominate
it**, and 770 is reachable for no more money.

Scatter + frontier + your design marked, and when a better bus exists it shows a
component-by-component diff with a one-click **Adopt this design**.

**Bug fixed:** `onFront` originally tested membership of the drawn frontier list,
which produced a contradictory "0 designs beat yours **and** not on the frontier"
whenever two buses tie on both axes. Pareto-optimal now means *nothing dominates
it*, asserted by test.

### Known limitation, worth knowing
The array catalog jumps 2 m² → 8 m² with nothing between, so for
`forest_biomass` every flying design is power-**overdesigned** and the storm
mechanic cannot bite through the power path. Not a bug, and **do not retune the
catalog** — but "flown against real NASA storms" lands harder when a judge can
see a storm actually break something. The Mars/`comms_s` case does overflow the
recorder, so the mechanic demonstrably works; this one objective is too
comfortable.

---

## 11b. What the overnight session added (14-15 Nov)

**All of it is built, tested and verified against a headless browser.** Four test
suites pass, `npm run build` is clean, and `tests/sanity.mjs` still prints
**1665 / 15 / 522 / 1687** — `runMission` was not touched, and neither were the
catalogs.

### The surface segment — `src/sim/outpost.js`, `src/viz/OutpostView.jsx`, `src/ui/OutpostScreen.jsx`

A ninth phase: **the installation your design builds on the body it flew to**,
drawn isometrically and to scale, with a day/night cycle, shadows that follow the
Sun, and your own orbiter passing overhead dropping a relay link.

It adds **no physics to the mission**. `designOutpost({ config, result })` is pure
and consumes what `runMission` already returned. Three sites — Earth ground
segment, lunar south pole, Mars — differ only in declared surface conditions
(transmission, illumination, dust, length of the dark).

The sizing law, which is the whole argument:

```
cargoMultiple     = floor(launcher capacity to this orbit / spacecraft dry mass)
modulesPerLanding = min(4, cargoMultiple)
units             = min(24, modulesPerLanding * lifetimeYears)
farm area         = units * array.areaM2
available power   = (1361 / AU^2 * transmission) * farm * efficiency * 0.9
                    * illumination * dust
battery bank      = units * battery.capacityWh * depthOfDischarge
generated         = units * mission generated GB/day
relay home        = the ONE orbiter's downlink GB/day, deliberately not scaled
habitats          = min(spare power / 22 kW, ceil(units / 3))
crew              = min(habitats * 4, spare power / 2.5 kW)
```

**The three findings it produces that no other screen can:**

1. **One orbiter, many instrument suites.** Landing more hardware multiplies what
   the outpost measures and does not multiply the link. The default Earth
   programme generates 435 GB/day, gets 145 GB/day home, and loses 290 GB/day
   permanently. `tests/outpost.mjs` asserts relay capacity never scales with units
   — if that assertion ever fails, the outpost has become a fantasy.
2. **Batteries are not a night solution.** The pack that carries an orbiter through
   a 35-minute eclipse is asked to carry a base through 12 to 72 hours of dark. It
   lasts under an hour, and the screen prints the multiple of the bank you would
   actually need. This is why surface power studies reach for fission.
3. **Overdesign in orbit is capability on the ground.** An array the trade study
   grades OVERDESIGNED is exactly what supports a crewed base — the same number is
   a penalty in one phase and the enabling choice in the next.

**Honesty structure, and the reason it holds up to a judge:** two kinds of number,
kept apart on screen. Mission numbers come from the design and are cited to NASA
in the app. The eleven figures the mission physics cannot supply — crew per
module, kW of life support, kg of water per kWh, pad diameter — are published as
`SURFACE_ASSUMPTIONS` under the scene with a one-line justification each, plus the
per-site conditions. The **"What sized this"** table prints the arithmetic behind
every headline figure. If a dimension is not in that table, it is not on the
drawing.

Storm grading goes through `assessSpaceWeather`, exactly as section 8 demands. The
surface does **not** get its own storm model.

### `tests/outpost.mjs`

Asserts flux identity with the mission, farm area, recomputed available power,
battery bank, generated data, cargo multiple; relay independence from unit count;
habitat and crew caps; that no two structures overlap after the deterministic
separation pass; that one config always builds one identical site plan; that an
undeliverable design builds nothing and says so; and sweeps **144 configurations**
across every objective, allowed orbit and launch vehicle checking for non-finite
numbers. 84 of the 144 are deliverable, so the constraint bites.

### UI/UX pass

- **Landing**: a fourth story card (the programme), a **sixth stat** (10,368
  designs enumerated), and a second CTA — *See what a design builds on the Moon* —
  that loads a lunar demo config straight onto the surface segment. A judge can
  reach the differentiator in one click from the first screen.
- **Deep links**: `?phase=<id>` opens any tab directly and the URL keeps up as you
  move. `?phase=outpost` is the link to send a judge. `readPhase`/`writePhase` in
  `src/share/encode.js`.
- **Option lists are a grid** (`.card-grid`), not a single column. The spacecraft
  screen is roughly half its old height; payload, orbit and launcher the same.
- **Schematic frame** capped at 620px and centred, so it hugs the drawing instead
  of floating in an empty panel. Scale bar set in mono.
- Mobile verified by CDP device emulation at 390x844: `scrollWidth === viewport`,
  zero overflowing elements.

### Verification method, so it can be repeated

A dev server plus headless Chrome, screenshotted and read back; a CDP script
(device metrics override + `Page.captureScreenshot`) for phone widths and for
measuring overflow. Both night and day states of the scene were captured and
checked, on all three bodies.

---

## 11c. Team sessions, difficulty, saved missions, debrief (15 Nov)

Four features, seven test suites, `runMission` still untouched, sanity still
**1665 / 15 / 522 / 1687**.

### Real-time multiplayer - `src/net/`

```
net/protocol.js    pure. state machine, role ownership, codes, scopes, standings
net/transport.js   browser. BroadcastChannel AND WebRTC, both at once
net/useSession.js  React. host runs reduce(), clients render what arrives
ui/Lobby.jsx       create / join / waiting room / connection truth
```

**Host-authoritative.** Clients send intents, the host validates them against
the sender's role and broadcasts the whole state. State is a few kB, so there
are no diffs and no merge conflicts to get wrong.

**Two transports run simultaneously and messages are de-duplicated by id.**
BroadcastChannel covers tabs on one machine and cannot fail. PeerJS covers real
devices through the free public broker. The fallback is therefore not a decision
anybody makes: if the broker is down the session still works on this machine and
the UI says exactly which one you have. `peerjs` is imported lazily, so a solo
player never downloads it - it is a separate 115 kB chunk.

**Ownership comes from `roles.json`**, the same `owns` array the screens are
scoped by, so what you can see and what you can change cannot drift apart.
Planner -> objective + orbit + launcher. Science -> instruments. Engineer -> the
bus. Operations -> lifetime and the run. A patch touching a field you do not own
is refused **whole**, never half-applied.

**Two modes.** Collaborative (one mission, four roles) and head to head (a copy
each, same objective and level, ranked in the debrief - the objective is locked
in that mode or the scores would not compare).

Session codes are five characters from an alphabet with no O, 0, I or 1,
because somebody has to read them out across a room. `?join=CODE` opens the
lobby with the code filled in; the waiting room copies that link.

### Difficulty - `src/sim/difficulty.js`

Three levels: **Cadet** (every hint, forgiving events, x0.85), **Engineer** (the
calibrated default, x1), **Flight Director** (no hints, five events, every
margin must clear 10% and budget must hold 15% reserve, x1.25).

It is a layer **on top of** a finished result: extra checks, a score multiplier
and guidance flags. It never modifies `runMission`. Guidance is applied by one
class on the app root (`.no-hints`, `.no-fixes`) rather than threaded through
twelve screens. A config with no `level` key is byte-identical to what the
engine was calibrated against, which is why `INITIAL` deliberately does not set
one - adding any key changes the event seed.

### Saved missions - `src/share/missionFile.js`

`Save design` downloads a readable JSON file; `Load design` validates it hard
and rebuilds the config **field by field from a known list**, so nothing else in
the file reaches the app. Every unknown id is refused with a sentence naming
what is wrong, because an unknown id otherwise reaches `mass.js` and throws
there. The snapshot in the file is for human reading and is never read back -
editing the score in the file changes nothing. Loading is disabled inside a
collaborative session, where the mission belongs to the team.

### Debrief - `src/sim/debrief.js` + `src/ui/DebriefScreen.jsx`

A new phase. Why the score is the score, margins thinnest first, what the trade
study says you left on the table, which real DONKI storm would have ended you,
what the design builds on the surface, and up to six ranked actions, each
attributed to the role that answers for it.

All three kinds of feedback live here and are deliberately different things:
the app critiques the design; the team rates and annotates the mission inside
the session; and a *Send feedback* form hands the user a prefilled GitHub issue
or email. With no backend that is the only honest option - **it drafts, the user
sends.** Nothing is submitted silently.

### Tests - three new suites, seven in total

```
node tests/difficulty.mjs    difficulty layer + debrief analysis
node tests/session.mjs       protocol: authority, ownership, scopes, standings
node tests/missionfile.mjs   round trip + fourteen hostile files refused
```

`tests/session.mjs` is the one to read first: it asserts that a player cannot
patch a field they do not own, that a mixed legal/illegal patch is refused
whole, that only the host starts the session or sets the level, and that what
`scopeFor` shows matches what `reduce` allows.

### Verified in a real browser, not only in Node

`scratchpad/multi.mjs` drives **two tabs through DevTools**: host creates a
session, second tab joins by link, both claim roles, host starts. It then
asserts the nav is scoped per role, that each player lands on a screen they
control, that an instrument added by Science changes the Planner's score, that
a peeked screen's controls are genuinely `:disabled`, and that clicking one
changes nothing. The broker answered during that run, so cross-device play is
confirmed live, not just in theory.

---

## 12. Pre-written submission content

> **`SUBMISSION.md` in the repo root is the paste-ready version of this section**,
> including the Project Details prose written out in full under all twelve
> headings and a Summary measured at 197 words. Paste from there, not from here;
> what follows is kept as the reference copy.

**Project Name:** Mission Architect

**Project:** https://coderx-24.github.io/mission-architect/

**Summary (50–200 words):**

> Mission Architect is a browser-based mission design and validation platform
> that puts you in the role of a NASA mission designer. Choose a science
> objective, select instruments, build a spacecraft, pick an orbit and a launch
> vehicle — then fly it. Every choice carries real engineering consequences:
> solar flux falls off with the inverse square of distance from the Sun, so an
> array sized for Earth browns out at Mars; adding an instrument adds mass, power
> draw, cost, and data you may not be able to downlink. The platform teaches one
> lesson no other tool does: real missions are not designed to spend 100% of
> their budget. They hold 10 to 35 percent margin, because everything grows
> between design and launch. Designs are then flown as a live simulation — array
> output collapsing into eclipse, battery draining, the recorder filling between
> ground passes — and validated against real coronal mass ejections recorded in
> NASA's DONKI database. Finally, all 10,368 possible spacecraft configurations
> are enumerated exhaustively to show the efficient frontier, and where your
> design sits on it. Every figure is cited to a NASA source inside the app.

**NASA Data (Link Text / URL):**

```
Design and Develop Science Missions
https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf
CubeSat 101
https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf
NASA DONKI Space Weather Database
https://ccmc.gsfc.nasa.gov/tools/DONKI/
NASA Open APIs
https://api.nasa.gov/
NASA Mission Viz
https://nasa.github.io/mission-viz/
Build It Yourself: Space Telescope Game
https://science.nasa.gov/mission/webb/game-build-it-yourself/
Landsat 9
https://science.nasa.gov/mission/landsat-9/
Mars Reconnaissance Orbiter
https://science.nasa.gov/mission/mars-reconnaissance-orbiter/
Lunar Reconnaissance Orbiter
https://science.nasa.gov/mission/lro/
SPHEREx
https://science.nasa.gov/mission/spherex/
DSCOVR
https://science.nasa.gov/mission/dscovr/
```

**Space Agency Partner & Other Data:**

```
React — https://react.dev/
Vite — https://vite.dev/
gh-pages — https://www.npmjs.com/package/gh-pages
Inter (SIL Open Font License) — https://fonts.google.com/specimen/Inter
Space Grotesk (SIL Open Font License) — https://fonts.google.com/specimen/Space+Grotesk
JetBrains Mono (SIL Open Font License) — https://fonts.google.com/specimen/JetBrains+Mono
Fontsource — https://fontsource.org/
Claude (AI coding assistant, permitted by the submission form) — https://claude.ai/
```

**Project Details:** write under these headings — What it does / How it works /
The margin mechanic / Live mission simulation / Space weather validation against
real NASA DONKI records / Exhaustive trade study / Educational impact / How we
used NASA data / Tools / Creativity / AI assistance.

**Framing note:** describe it as an *"interactive mission design and validation
platform"*, not a "game" — that is how every Global Winner describes itself. The
code does not change.

---

## 13. The 7-slide deck (drafted, not built)

Revised after the surface segment landed. Seven slides is the hard cap, so the
old "design" and "failure" slides are merged — failure is more persuasive shown
inside the design flow than given a slide of its own — and the deck now closes on
the outpost, which is the image a judge will remember.

**Slide 1 — Title.** Mission Architect · An interactive mission design and
validation platform · Team Doon-Dev, Satna · live URL.

**Slide 2 — The problem.** Students learn orbital mechanics, spacecraft design
and operations as three separate subjects and never see them interact. Change
the orbit and the power budget moves. Add an instrument and the downlink fails.
No textbook shows you that. A simulator does.

**Slide 3 — Design, with consequences — alone or as a crew of four.**
*(GIF: margin bars moving, ending on a constraint going red; then two windows
side by side, one player's instrument choice moving the other player's margins)*
Five phases. Inverse square law, Tsiolkovsky. Never "mission failed" — always
*"Array delivers 1620 W at end of life; the spacecraft draws 1652 W"*, and the
way out. Four people can hold the four roles of a real mission team at once:
you control your own subsystem, everyone shares the margins, nobody can overrule
anybody. Three difficulty levels, from Cadet to Flight Director.

**Slide 4 — The margin mechanic.** *(static — this slide is the thesis, and
motion competes with reading)* 10–35% reserve. Spend it all → RISKY. Hoard it →
OVERDESIGNED. The healthy band is drawn into every bar.

**Slide 5 — Flown against real NASA data.** *(GIF: flight console + scrubber)*
Array collapsing into eclipse, battery draining, recorder filling between ground
passes. Then flown against real CMEs from NASA DONKI, with observing spacecraft
named. 433 records, and a bundled fallback so validation cannot break mid-judging.

**Slide 6 — Not one design. Every design.** *(GIF: trade space)*
**10,368 configurations enumerated. 76 fly. 0.7%.** The efficient frontier,
computed in the browser, your design marked on it.

**Slide 7 — What your design builds on the ground.** *(GIF: surface segment,
dragged from day into night)* The same design, landed. Solar farm sized by your
array, habitats paid for in spare kilowatts, a 1.8 m crew figure for scale, your
orbiter overhead with the relay link up. **You can land twenty copies of your
instrument suite and you still have one orbiter to carry the data home.** Static
site · no backend · NASA DONKI API · live link.

### Capture list — 7 recordings, ~8 s each, 1280×800, crop browser chrome

1. **Spacecraft tab** — click array S → M → L → XL, margin bars moving
2. **Orbit tab** — switch SSO → Mars, power check flipping to FAIL with W figures
3. **Simulate tab** — flight console, one full orbit through eclipse and a pass
4. **Simulate tab** — drag mission scrubber launch → end of life, wattage falling
5. **Trade Space tab** — load, scatter and frontier draw, design ringed
6. **Two windows side by side** — create a session in one, join with the code in
   the other, take two roles, and change an instrument in one window while the
   other window's margin bars move. This is the collaboration evidence; the
   challenge brief asks for it explicitly.
7. **Surface Segment tab** — open on the lunar demo, drag the day slider from
   noon into night: panels go dark, habitat windows light, the orbiter comes over
   with the link up. Use the landing page button *See what a design builds on the
   Moon*, or the direct link `?phase=outpost`.

macOS: **Cmd+Shift+5** → Record Selected Portion. Convert to GIF, or upload the
`.mov` directly if the slide tool accepts video.

---

## 14. Commands

```bash
npm install                          # first run
npm run dev                          # local dev server
npm run deploy                       # vite build + publish to gh-pages
node tests/sanity.mjs                # engine calibration — 1665/15/522/1687
node tests/telemetry.mjs             # telemetry vs runMission
node tests/tradespace.mjs            # trade study correctness
node tests/outpost.mjs               # surface segment traceability
node tests/difficulty.mjs            # difficulty layer and debrief
node tests/session.mjs               # multiplayer protocol
node tests/missionfile.mjs           # saved mission files
source .env && node scripts/fetch-spaceweather.mjs   # refresh CME snapshot
```

After any change:

```bash
for t in sanity telemetry tradespace outpost difficulty session missionfile; do node tests/$t.mjs || break; done && npm run build
npm run deploy && git add -A && git commit -m "..." && git push
```

---

## 15. What to do next, in order

1. **File the submission.** Everything is written: paste from **`SUBMISSION.md`**,
   which has all twelve Project Details headings in full prose and a 197-word
   summary. Save Progress *and* Submit for Judging — they are two buttons.
   Re-submitting is free and only the last click is judged, so a rough one banked
   early is pure insurance. Roughly ten minutes.
2. **Commit and push.** As of this writing `main` is **4 commits ahead of
   origin** and the live site is still the build from midday on 14 Nov, which
   does not contain the visual pass, the flight console, the trade space or the
   surface segment. A judge following the project link today sees none of it.
3. **`npm run deploy`**, then open the live URL on a phone. Mobile was verified
   by emulation, not on glass.
4. **Record the 6 GIFs**, build the 7 slides (section 13), publish publicly.
5. **Re-submit** with the deck link.
6. Only then consider: a personal NASA API key so the badge reads
   LIVE FROM NASA DONKI during judging.

**Do not** start new features. The gap to a Global Nominee is presentation, not
capability — and the surface segment is the last thing the build needed.

### Still open, deliberately

- The README was rewritten this session and now documents the `.env` / `VITE_*`
  behaviour, so the section 15 item about it is closed.
- The array catalog still jumps 2 m² → 8 m² with nothing between (section 11's
  known limitation). **Do not retune it.** The surface segment gives the storm
  mechanic a second place to bite, which softens the problem without touching a
  calibrated catalog.
