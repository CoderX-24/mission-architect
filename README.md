# Mission Architect

**An interactive mission design and validation platform.**
Design a spacecraft against real engineering constraints, fly it, validate it against real
coronal mass ejections from NASA DONKI, enumerate every alternative design, and see what your
design builds on the surface of the body it went to.

**Live:** https://coderx-24.github.io/mission-architect/
Built for the NASA Space Apps Challenge 2026 — *Space Mission Design Game* — by **Team Doon-Dev**,
designed and built by **Ranveer** and **Vibhor**.

---

## What it does

Ten phases, one engine. Choose a science objective, select instruments, build a spacecraft
bus, pick an orbit and a launch vehicle. Every choice is recomputed into mass, power, cost,
data and delta-v, and every failure is reported with the numbers and the way out — never just
"mission failed":

> Array delivers 1620 W orbit-average at end of life; the spacecraft draws 1652 W (−2% margin).

### The four things that make it different

1. **Margin is the mechanic.** Real missions do not spend 100% of their budget. They hold
   10–35% in reserve, because everything grows between design and launch. Designs are graded
   on that reserve: spend it all and you are RISKY, hoard it and you are OVERDESIGNED. The
   healthy band is drawn into every margin bar.
2. **The mission runs.** The flight console flies the spacecraft through its real orbit —
   array output collapsing into eclipse, battery draining, recorder filling between ground
   passes — and every series is a time-domain reconstruction of a number the engine already
   reported, asserted by tests.
3. **Validated against real NASA data.** 433 real coronal mass ejections from NASA's DONKI
   database, each with measured speed and observing spacecraft. A storm can end a mission
   through three independent paths: power margin, data margin, or a single-event upset with no
   redundant attitude control.
4. **Not one design — every design.** `runMission` costs 0.013 ms, so all **10,368** bus
   configurations are enumerated exhaustively in the browser and plotted with the Pareto
   frontier. For the default objective, 76 of 10,368 fly.

### Four people, four roles, one spacecraft

Up to four players share a mission in real time with a five-character join code. Each holds one
role from `roles.json` and controls only their own subsystem: the Planner owns the objective,
orbit and launch vehicle, Science owns the instruments, Engineering owns the bus, Operations
owns lifetime and the run. **You see the screens you control, everyone sees the margins move,
and nobody can overrule anybody** — which is how the argument that makes a mission design good
actually happens.

A session reaches other tabs on the same machine through `BroadcastChannel` and other devices
through WebRTC over a free public broker. Both run at once, so if the broker is unreachable the
session keeps working locally and the interface says which one you have rather than pretending.
There is still no backend and no account. Head-to-head mode gives everyone their own copy of
the same objective and ranks them at the end.

### Difficulty, for different amounts of expertise

**Cadet** explains every screen, softens the in-flight events and scores at ×0.85.
**Engineer** is the calibrated default. **Flight Director** turns the hints off, draws five
events instead of three, requires every margin to clear 10% and the budget to hold 15% reserve,
and scores at ×1.25. It is a layer on top of the engine, not a change to it.

### Debrief, and three kinds of feedback

After a run: why the score is the score, margins thinnest first, what the trade study says you
left on the table, which real storm would have ended you, and ranked actions attributed to the
role that answers for each. In a session your team rates and annotates the mission for each
other. And a feedback form drafts a GitHub issue or an email for you to send — with no backend,
nothing is submitted silently.

### Saving a mission

`Save design` writes a readable JSON file to your computer; `Load design` validates it field by
field and refuses anything it does not recognise with a sentence saying why. A shared link
carries a mission between people; a file carries it between laptops and years.

### ArchitectX, the built-in assistant

A `?` in the bottom corner opens help: an intro for a first-time visitor, a filterable FAQ of 25
topics, and **ArchitectX**, which answers questions about *your* mission.

It is deliberately **not a language model**, and the interface says so where you type. It matches
your question to topics written by the team, then computes the specifics by calling the same
engine as the rest of the app — so it needs no API key, works offline, and cannot invent a
number. Ask it *"why doesn't my mission fly?"* and it lists the actual failing checks; ask *"how
do I get more power?"* and it runs the next array size up and tells you what that costs in mass,
money and margin.

### Surface segment

The newest phase takes the design further than the orbit. Your array, battery, link, launch
vehicle and instruments are carried down to the body you flew to, and the installation they
buy is drawn to scale against a 1.8 m crew figure — solar farm, habitats, battery hall, ground
terminal, radiators, volatiles plant, landing pads — with a day/night cycle and your own
orbiter passing overhead to take the data home.

Nothing on that drawing is decoration. Every dimension traces to a mission number, the table
under the scene prints the arithmetic for each one, and the figures the mission cannot supply
are declared as surface assumptions rather than buried. It is also where the hardest lesson in
the project lands: **you can land twenty copies of your instrument suite and you still only
have one orbiter to carry the data home.**

---

## Running it

```bash
npm install
npm run dev        # local dev server
npm run build      # production build
npm run deploy     # build and publish to GitHub Pages
```

### Tests

The engine is covered by eight suites, all plain Node, no framework:

```bash
node tests/sanity.mjs      # engine calibration — must print 1665 / 15 / 522 / 1687
node tests/telemetry.mjs   # the animation agrees with the physics, assertion by assertion
node tests/tradespace.mjs  #  8 assertions: exhaustiveness and Pareto correctness
node tests/outpost.mjs     # surface segment traces back to mission numbers
node tests/difficulty.mjs  # the difficulty layer never modifies the engine
node tests/session.mjs     # multiplayer: who may change what, and what they see
node tests/missionfile.mjs # round trip, and 14 hostile files refused
node tests/architectx.mjs  # the assistant's answers match a freshly run mission
```

`tests/sanity.mjs` is the calibration gate. If those four scores change, something is wrong.

### NASA API key (optional)

The app calls NASA DONKI directly from the browser — the endpoint sends CORS headers, so no
backend is needed. Without a key it uses `DEMO_KEY`, which is shared globally and will
rate-limit. A free personal key from https://api.nasa.gov is instant:

```bash
echo 'VITE_NASA_API_KEY=your_key_here' > .env
```

`.env` is gitignored. Note that Vite inlines `VITE_*` variables into the client bundle at build
time, so this is only appropriate for a free public-tier key, never a secret. **If the live
fetch fails or rate-limits, the app falls back to a bundled snapshot of the same real DONKI
records, so validation never breaks** — tested against a real HTTP 429.

To refresh the snapshot:

```bash
source .env && node scripts/fetch-spaceweather.mjs
```

---

## Architecture

```
src/sim/      pure engine — runMission() owns every number
src/ui/       screens — they render what the engine returns, they never calculate
src/viz/      canvas and SVG views
src/data/     catalogs, every entry carrying its NASA citation
src/help/     the assistant: curated topics and a matcher, both pure
src/net/      session protocol, transports, host-authoritative hook
src/share/    the whole mission encodes into a URL, or a file on your disk
```

`App.jsx` holds one config object and one `useMemo(() => runMission(config))`. No screen
calculates anything. Everything added since the engine was written is additive: new pure
modules that *consume* its output, which is why the simulation, the storm validation, the
trade study and the surface segment cannot disagree with each other.

Static site. No backend, no database, no accounts. Solo play makes one network call, to
NASA's own API; team sessions add a public WebRTC broker for peer introductions.

Missions are shareable three ways: the config encodes into the URL hash, `?phase=` deep-links
any tab (e.g. [`?phase=outpost`](https://coderx-24.github.io/mission-architect/?phase=outpost)),
and `?join=CODE` opens the lobby for a team session.

---

## Data and credits

Engineering practice and sizing from NASA's *Design and Develop Science Missions* and
*CubeSat 101*. Space weather from **NASA DONKI** via **NASA Open APIs**. Mission analogues and
catalog anchors from Landsat 9, Mars Reconnaissance Orbiter, Lunar Reconnaissance Orbiter,
SPHEREx and DSCOVR. Every entry in every catalog carries its source link inside the app, on
the Sources tab.

Built with React and Vite, with PeerJS for team sessions. Typefaces: Space Grotesk, Inter and
JetBrains Mono (SIL Open Font
License), self-hosted — no third-party code loads at runtime.

**Team Doon-Dev** — Ranveer and Vibhor. Claude (Anthropic) was used as a coding assistant, which the Space Apps rules permit and we
declare rather than hide. All engineering decisions, constants, NASA sources and calibration
targets were chosen and verified by the team, and every change is gated on the eight test
suites above, which CI runs before it will publish the site.
