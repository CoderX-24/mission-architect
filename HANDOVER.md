# Mission Architect — Handover


## 0. Read this first


You are picking up a NASA Space Apps Challenge 2026 project mid-hackathon.
The project is **working and deployed**. Do not rebuild it. Read the whole
document before changing anything.


**The one job:** the project's visual design and simulation experience are not
yet at Global Winner level. Everything else is done. See section 11.


---


## 1. Competition context


**Event:** NASA Space Apps Challenge 2026, theme "The Next Frontier"
**Challenge:** Space Mission Design Game (Intermediate / Beginner-Youth, Games)
**Team:** Doon-Dev, 2 people, registered at the **Satna virtual event (IST)**
**Started:** Saturday 14 Nov 2026, 09:00 IST
**Deadline:** Sunday 15 Nov 2026, **23:59 IST**. Anything saved OR submitted
  after that is ineligible. No exceptions, no edit requests.
**Repo:** https://github.com/CoderX-24/mission-architect (public)
**Live:** https://coderx-24.github.io/mission-architect/
### Challenge brief, in summary
Build an interactive game where participants design, manage and simulate a
complete space mission: mission objective, spacecraft design, instrument
selection, launch vehicle, orbit, and constraints on budget, mass, power,
communications, data and lifetime. Optionally support collaboration for up to
four participants. The brief lists as part of "a strong solution": a functional
interactive game, a clear UI, a mission configuration system, resource
management, collaboration for up to four, and a mission simulation and
evaluation system.


---


## 2. Submission rules that constrain design


**Project Demonstration must be EITHER a video of 30 seconds or less, OR a
  slide deck of no more than 7 slides.** Public link, no login.
  Decision made: **7-slide deck with embedded gameplay GIFs.** 30 seconds is
  about 75 words of narration and cannot carry the argument.
Project link must be public, no password or registration.
**NASA data use is mandatory for a Global Award.** Link Text + full URL pairs.
"Space Agency Partner & Other Data" must list EVERY external resource:
  libraries, fonts, images, AI assistance.
**AI tool use is explicitly permitted** by the submission form and should be
  declared, not hidden.
**"Save Progress" is NOT "Submit for Judging".** Two separate buttons.
**You may submit repeatedly. Only the final click is judged.** So banking an
  early rough submission is free insurance.
Use the edit Lock toggle; a teammate can overwrite unsaved changes.
Max 6 team members for Global Judging eligibility.
### STATUS: THE SUBMISSION HAS NOT BEEN FILED YET
This is the single largest outstanding risk. Pre-written submission content is
in section 12. It takes ten minutes. Do it before adding features.


---


## 3. Judging


Scored **1 to 5 on each of five criteria** at every level:
**Impact, Creativity, Validity, Relevance, Presentation.**


Funnel from 2025: 18,860 teams registered -> ~11,500 projects submitted ->
1,294 Global Nominees (~7%) -> 45 Global Finalists -> 10 Global Winners.
About 40% of registered teams never submit at all.


**Global Nominees are chosen at LOCAL events.** The first gate is the Satna
local judges, not NASA. They will have many projects and limited domain depth.
Clarity and a working demo beat sophistication.


Ten Global Awards: Best Use of Science, Best Use of Data, Best Use of
Technology, Galactic Impact, Best Mission Concept, Best Storytelling, Global
Connection, Art & Technology, Local Impact, Most Inspirational.


**Target award: Best Mission Concept.** See section 4.


---


## 4. Research on past winners (do not re-research this)


### 2025 Global Winners
| Award | Team |
|---|---|
| Best Use of Science | SpaceGenes+ |
| Best Use of Technology | Twisters |
| Galactic Impact | Astro Sweepers |
| Best Mission Concept | **PureFlow** |
| Most Inspirational | Photonics Odyssey |
| Best Use of Storytelling | HerCode Space |
| Global Connection | Gaia+LEO |
| Art & Technology | Zumorroda-X |
| Local Impact | QUEÑARIS |


### 2024 Global Winners
WMPGang (Science), GaamaRamma (Data), 42 QuakeHeroes (Technology),
NVS-knot (Galactic Impact), Innovisionaries (Most Inspirational),
Asteroid Destroyer (Global Connection), Connected Earth Museum (Art &
Technology), Team I.O. (Local Impact).


### Patterns
Global winners are overwhelmingly **tools and platforms, not "games."**
   When game-shaped projects win they win soft categories (a star-ID game took
   Most Inspirational 2022; a water-cycle web game took Best Storytelling 2023).
2. Winners use **actual NASA datasets**, not just NASA documents for constants.
3. Winners are legible in 60 seconds, with specific memorable names.
4. Winning write-ups use the language of **platforms, engines and simulators.**


### THE KEY PRECEDENT: PureFlow (2025, Best Mission Concept)
Team from Aracaju, Brazil. Challenge: "Your Home in Space: The Habitat
  Layout Creator."
NASA's description: "an interactive systems engineering platform that allows
  users to design, model in 3D, and validate space habitats," then test designs
  against real space-weather threats such as solar storms.
Live site: https://larasdiniz.github.io/PureFlow-2025/src/public/html/home/home.html
It is a **static GitHub Pages site**. Drag-and-drop functional areas,
  "real-time validation against NASA requirements," configurable by crew size,
  mission duration and destination.
Landing page structure: hero, three feature cards, a stats bar
  ("3 habitat shapes / 10+ functional areas / infinity configurations /
  100% NASA standards").
**A Brazilian press report states one team member integrated NASA's DONKI API
  for real-time solar storm detection, and describes the platform as "more than
  a static design tool, a kind of intelligent survival simulator."**
Note: their "100% NASA Standards" claim has no supporting detail anywhere on
  the site. Mission Architect's per-entry citations are stronger evidence.


**Structurally, Mission Architect is the same shape of project as PureFlow and
is already more rigorous on data. The remaining gap is visual and experiential.**


---


## 5. What has been built


### Stack
Vite 8 + React (JavaScript, not TypeScript), plain CSS, no backend, no
database, no accounts. Deployed as a static site to GitHub Pages via the
gh-pages package. Deployment is proven and working.


### Concept
A five-phase mission designer with live engineering validation:
**Objective -> Payload -> Spacecraft -> Orbit & Launch -> Simulate**, plus
**Space Weather** and **Sources** tabs. A margin dashboard is always visible.


### The core idea (this is the project's thesis — protect it)
Real missions are not designed to spend 100% of their budget. They hold 10-35%
margin because everything grows between design and launch. The game rewards
margin discipline and punishes both zero margin and gross overdesign. Random
events test exactly those margins. No other entry will model this.


### File inventory
src/
  data/
    objectives.json              5 mission objectives
    instruments.json             12 science instruments
    components.json              8 subsystem groups (array, battery, comms,
                                 adcs, propulsion, thermal, obc, structure)
    orbits.json                  6 orbits (LEO 400, SSO 705, GTO, GEO, lunar, Mars)
    launchers.json               4 launch vehicles (Electron, Falcon 9,
                                 Atlas V 401, F9 rideshare)
    events.json                  7 scripted in-flight events
    spaceweather-fallback.json   433 REAL NASA CME records (see section 8)
    roles.json                   4 team roles
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
  ui/
    Dashboard.jsx        live margin bars (THE demo centerpiece)
    PhaseNav.jsx         7-phase tab bar
    ObjectiveScreen.jsx
    PayloadScreen.jsx
    SpacecraftScreen.jsx
    OrbitScreen.jsx
    ResultScreen.jsx     verdict, score breakdown, flight log, mission analogue
    SpaceWeatherPanel.jsx
    SourcesPanel.jsx     every entry + its NASA citation
    Landing.jsx          hero, 3 feature cards, stats bar
    RoleBar.jsx          4 team roles with competing priorities
    ShareButton.jsx
  viz/
    OrbitCanvas.jsx      2D animated orbit, sun, eclipse shading
    SpacecraftView.jsx   SVG schematic drawn to scale from the design
  share/
    encode.js            mission config <-> URL hash
  App.jsx                single config object, useMemo(runMission)
  App.css                all styles
  index.css              reset
scripts/
  fetch-spaceweather.mjs  pulls real CMEs from NASA DONKI, writes fallback
tests/
  sanity.mjs              three-case calibration test


### Architectural contract (do not break this)
App.jsx owns ONE config object. Screens receive config, setConfig and
result. result = useMemo(() => runMission(config), [config]).
**No screen calculates anything.** The UI only renders what runMission
returns. This is what allows the UI to be rebuilt without touching the physics.


---


## 6. The config object
js
{
  objectiveId: 'forest_biomass',
  orbitId: 'leo_sso',
  launcherId: 'rideshare',
  instrumentIds: ['multispectral_imager', 'lidar_altimeter'],
  components: {
    array: 'array_m', battery: 'batt_m', comms: 'comms_x', adcs: 'adcs_wheels',
    propulsion: 'prop_mono', thermal: 'therm_passive', obc: 'obc_basic',
    structure: 'struct_small',
  },
  lifetimeYears: 5,
  difficulty: 'normal',   // optional: 'easy' | 'normal' | 'hard'
}


runMission(config) returns:
js
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


---


## 7. The physics (all real, all cited)
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


linkFactor is a single calibrated term folding range loss and ground-station
aperture together (LEO 1.0, SSO 0.90, GTO 0.40, GEO 0.35, lunar 0.16, Mars
0.055). Mars insertion delta-v is 1800 m/s assuming aerobraking, as Mars
Reconnaissance Orbiter used.


### Margin grading (src/sim/score.js)
| Margin | Grade | Bonus |
|---|---|---|
| < 0% | FAIL | mission does not fly |
| 0-10% | RISKY | 0, high event risk |
| 10-35% | NOMINAL | +10 |
| 35-50% | GENEROUS | +5 |
| > 50% | OVERDESIGNED | -4 |


### Scoring
sciencePerDay = sum(scienceValue * match)   // match: 1.0 required, 0.25 bonus, 0 irrelevant
scienceScore  = sciencePerDay * returnFraction * lifetimeFactor * 100
final         = round(scienceScore * riskMultiplier + marginBonus + efficiencyBonus)
riskMultiplier = max(0.2, 1 - eventsFailed*0.22)


---


## 8. NASA DONKI space weather integration (the differentiator)


This is the feature that closes the gap with PureFlow. **It works and is live.**


Endpoint: `https://api.nasa.gov/DONKI/CME?startDate=&endDate=&api_key=`
**CORS is open** (access-control-allow-origin: *), so a static site calls it
  directly from the browser. No backend, no proxy needed.
**Max 60 days per request.** Longer ranges return a plain-text error, not JSON.
DEMO_KEY is shared globally and is usually rate-limited. A free personal key
  from https://api.nasa.gov is instant.
Key lives in .env as VITE_NASA_API_KEY. **.env is gitignored and is NOT
  in the handover zip.** A new key must be generated.
  Note: Vite bakes VITE_* into the client bundle. That is acceptable for a
  free NASA public-tier key and should be mentioned in the README.
scripts/fetch-spaceweather.mjs pulls two 60-day windows and writes
  src/data/spaceweather-fallback.json. Currently **433 real CMEs,
  2026-07-16 to 2026-11-13**. The app falls back to this whenever the live
  fetch fails, so validation never breaks during judging.


### Real CME speed distribution (measured from the 433 records)
n 433  min 207  p50 424  p75 570  p90 770  p99 1305  max 1580
0-500: 283   500-700: 88   700-1000: 49
1000-1200: 8  1200-1500: 4  1500-2000: 1  2000+: 0


### Stress model
stress = (cme.speed / 1000) * (0.30 + orbit.radiationIndex)
Bands (calibrated against the distribution above):
| stress >= | Band | Needs power margin | Needs data margin | Needs redundant ADCS |
|---|---|---|---|---|
| 0.95 | Extreme | 20% | 10% | yes |
| 0.65 | Severe | 12% | 5% | no |
| 0.40 | Moderate | 6% | - | no |


Effect: sun-synchronous orbit sees ~21 significant storms in 60 days;
geostationary and Mars see several times more. **Orbit choice changes space
weather exposure by roughly 5x, which is physically correct** (Earth's
magnetosphere shields low orbits) and is a teaching moment no other entry has.


---


## 9. Verified working


node tests/sanity.mjs output, confirmed on the team's machine:
GOOD   -> flies:true   score:1665   mass=95% power=80% budget=1%  data=200%
GREEDY -> flies:false  score:15     7 constraint failures
CHEAP  -> flies:true   score:522    mass=69% power=55% budget=79% data=-27%
MARS   -> flies:true   score:1687   mass=34% power=86% budget=31% data=200%
A thoughtful design flies. A greedy one fails on structure, power, battery,
thermal, pointing, downlink and budget simultaneously. A cheap smallsat flies
but returns far less science. This calibration is correct — do not retune it
without re-running this test.


Also confirmed in the browser: Space Weather tab shows **"LIVE FROM NASA DONKI"**
with real CME IDs such as 2026-10-17T02:48:00-CME-001, 1048 km/s, O-type,
observed by SOHO LASCO/C2, LASCO/C3, STEREO A SECCHI/COR2 and GOES CCOR-1.


---


## 10. Gotchas that have already cost time


**JSON imports need an import attribute**: `import X from './x.json' with
   { type: 'json' }`. Node requires it; Vite accepts it. Confirmed working.
2. **macOS sed needs an empty arg**: sed -i '' 's/a/b/' file.
3. **Never put a bare * selector at the start of a CSS line** when the code is
   being copy-pasted through chat — the leading asterisk gets eaten as a
   markdown bullet and produces { box-sizing: border-box; }, an empty selector
   that breaks the production build. Lightning CSS only runs on vite build,
   never on vite dev, so this passes locally and fails on deploy.
4. **vite.config.js must have base: '/mission-architect/'** matching the repo
   name, or GitHub Pages serves a blank white page.
5. GitHub Pages needs the repo to be **public**.
6. Vite's default index.css centres everything (`display:flex; place-items:
   center; text-align:center`) and must be overridden.
7. DONKI returns plain-text errors, not JSON — always check the response starts
   with [ before parsing.


---


## 11. THE REMAINING JOB


Everything in sections 5-9 works. The outstanding gap, in the team's own words:


 "the website is still not as visually appealing and simulating as the winners"
### What exists visually
Landing.jsx — hero, three feature cards, stats bar. Clean but plain.
Dashboard.jsx — five live margin bars, colour-graded. Functional.
OrbitCanvas.jsx — 2D canvas: central body, orbit ellipse, moving spacecraft
  dot that dims in eclipse, sun marker, eclipse % and period labels. Basic.
SpacecraftView.jsx — SVG schematic drawn to scale from the actual design.
  Solar wing length from real m², dish radius from real antenna diameter, bus
  size from structure class, instruments on the nadir face sized by mass,
  radiators when active thermal is fitted, cyan nozzle for ion propulsion,
  5 m scale bar. Proportions are genuinely correct and it updates live.
  **This works but reads as a technical diagram, not as something impressive.**


### The direction that was agreed but not built
**Take the spacecraft schematic and fly it.** On the Simulate phase, run the
mission as an animation rather than a static report:
The spacecraft moves through its real orbit at its real period
Array output visibly falls as it enters eclipse; the battery drains and
  recovers on the real eclipse duration
A ground-station pass dumps the data buffer; the buffer visibly fills between
  passes and overflows if the downlink is undersized
A real CME from the DONKI feed washes over the spacecraft **on the date it
  actually happened**, and the consequence plays out visually
A mission timeline scrubs from launch to end of life
PureFlow showed a static habitat and validated it. Showing the mission
**running**, driven entirely by the player's own numbers and real NASA storm
records, would beat it.


### Constraints on how to do it
Stay static. No backend, no database. Deployment reliability during judging
  matters more than any feature.
Avoid Three.js. It was considered and rejected: roughly 8 hours versus 2 for
  canvas/SVG, and generic 3D is less impressive to a NASA judge than an accurate
  engineering visualisation.
Do not break the runMission contract in section 5.
Do not retune the catalogs without re-running tests/sanity.mjs.
Everything must still work at phone width.
### Also still open
**The submission has not been filed.** Section 12.
The 7-slide deck with gameplay GIFs is not made.
Role mode is informational only; there is no live sync between players.
  A Firebase project was created but is unused. The agreed design if it is ever
  built: local state stays the source of truth, sync is an optional try/catch
  wrapper skipped entirely when there is no room code, so it can never take the
  game down during judging.
Consider reframing the language from "game" to "interactive mission design
  and validation platform" in the submission, matching how every winner
  describes itself. The code does not change.


---


## 12. Pre-written submission content


**Project Name:** Mission Architect


**Project:** https://coderx-24.github.io/mission-architect/


**Demo:** 7-slide deck. Suggested slides: 1 title / 2 the problem (students
learn orbital mechanics, spacecraft design and operations separately and never
see them interact) / 3 GIF of designing with margin bars moving / 4 GIF of a
constraint failing and explaining itself / 5 the margin mechanic alone /
6 GIF of real NASA CMEs hitting the spacecraft / 7 NASA data, stack, live link.


**Summary (50-200 words):**
Mission Architect is a browser game that puts players in the role of a NASA
mission designer. Choose a science objective, select instruments, build a
spacecraft, pick an orbit and a launch vehicle, then simulate the mission and
find out what you got wrong. Every choice carries real engineering consequences:
solar flux falls off with the inverse square of distance from the Sun, so an
array sized for Earth browns out at Mars; adding an instrument adds mass, power
draw, cost, and data you may not be able to downlink. The game teaches one
lesson no other tool does. Real missions are not designed to spend 100% of their
budget. They hold 10 to 35 percent margin, because everything grows between
design and launch. Designs are then flown against real coronal mass ejections
recorded in NASA's DONKI database. Every figure in the game is cited to a NASA
source inside the app itself.


**NASA Data (Link Text / URL):**
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


**Space Agency Partner & Other Data:**
React — https://react.dev/
Vite — https://vite.dev/
gh-pages — https://www.npmjs.com/package/gh-pages
Claude (AI coding assistant, permitted by the submission form) — https://claude.ai/


**Project Details:** write under these headings — What it does / How it works /
The margin mechanic / Space weather validation against real NASA DONKI records /
Educational impact / How we used NASA data / Tools / Creativity / AI assistance.


---


## 13. Commands
npm run dev                          # local dev server
npm run deploy                       # vite build + publish to gh-pages
node tests/sanity.mjs                # three-case engine calibration
source .env && node scripts/fetch-spaceweather.mjs   # refresh CME snapshot


After any change: npm run deploy && git add -A && git commit -m "..." && git push
