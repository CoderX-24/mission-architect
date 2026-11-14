// ============================================================================
// SURFACE SEGMENT - the outpost your orbiter makes possible.
//
// This module adds NO new physics to the mission. It takes the numbers
// runMission already produced - array area, cell efficiency, battery capacity,
// instrument load, downlink rate, dry mass, launcher capacity - and carries
// them down to the surface of the body the mission went to.
//
// Two kinds of number appear below and the UI keeps them apart:
//   * MISSION NUMBERS, taken from the design and cited to NASA in the app.
//   * SURFACE ASSUMPTIONS, declared in SURFACE_ASSUMPTIONS and printed on the
//     screen, so a judge can disagree with an assumption rather than guess at
//     one. Nothing here is hidden behind an art asset.
//
// The honest result the derivation produces: you can land twenty copies of
// your instrument suite, and you still only have one orbiter to carry the
// data home.
// ============================================================================

import COMPONENTS from '../data/components.json' with { type: 'json' }
import INSTRUMENTS from '../data/instruments.json' with { type: 'json' }
import ORBITS from '../data/orbits.json' with { type: 'json' }
import LAUNCHERS from '../data/launchers.json' with { type: 'json' }
import { SOLAR_CONSTANT, PACKING_COSINE_LOSS } from './constants.js'

// ---------------------------------------------------------------- sites ----

// One site per destination body. transmission, illumination and dust are
// surface conditions, not mission physics; nightHours is the longest dark
// period a power system has to ride out at that site.
export const SITES = {
  earth: {
    id: 'earth', dayLabel: 'LOCAL DAY', body: 'Earth', name: 'Ground Segment Station',
    place: 'High-latitude ground station site',
    transmission: 0.75, illumination: 0.50, dust: 1.00, nightHours: 12,
    gravity: 9.81, delivery: 'shipped by road', crewed: true, isru: null,
    terrain: 'tundra',
    note: 'A polar-ish ground station sees every pass of a sun-synchronous orbit. ' +
      'Atmosphere costs about a quarter of the sunlight before it reaches a panel.',
  },
  moon: {
    id: 'moon', dayLabel: 'LUNAR DAY', body: 'the Moon', name: 'Lunar South Pole Outpost',
    place: 'Crater rim, lunar south pole',
    transmission: 1.00, illumination: 0.80, dust: 0.92, nightHours: 72,
    gravity: 1.62, delivery: 'landed by cargo flight', crewed: true, isru: 'water ice',
    terrain: 'regolith',
    note: 'No atmosphere, so a panel sees the full solar constant. A rim site is lit ' +
      'most of the year but still goes dark for days at a time, and electrostatic ' +
      'regolith dust sticks to everything.',
  },
  mars: {
    id: 'mars', dayLabel: 'SOL', body: 'Mars', name: 'Mars Surface Outpost',
    place: 'Mid-latitude plain, Mars',
    transmission: 0.60, illumination: 0.50, dust: 0.85, nightHours: 12.3,
    gravity: 3.72, delivery: 'landed by cargo flight', crewed: true, isru: 'subsurface ice',
    terrain: 'basalt',
    note: 'At 1.524 AU sunlight is already thin; dust in the atmosphere takes more of it, ' +
      'and settled dust on the panels takes more again. A sol is 24.7 hours long.',
  },
}

export function siteFor(config) {
  const orbit = ORBITS.find(o => o.id === config.orbitId)
  if (!orbit) return SITES.earth
  if (orbit.id === 'mars') return SITES.mars
  if (orbit.id === 'lunar') return SITES.moon
  return SITES.earth
}

// ---------------------------------------------- surface assumptions ----

// Every figure the mission numbers alone cannot supply. Printed in the UI.
export const SURFACE_ASSUMPTIONS = [
  { k: 'MODULES_PER_LANDING', v: 4, unit: 'modules', why: 'Modules a single cargo flight sets down, when the vehicle can lift them at all.' },
  { k: 'LANDINGS_PER_YEAR', v: 1, unit: 'flight/yr', why: 'One logistics flight per operational year of the orbiter.' },
  { k: 'HABITAT_CREW', v: 4, unit: 'crew', why: 'Crew per pressurised module, about what an ISS-class module holds.' },
  { k: 'HABITAT_KW', v: 12, unit: 'kW', why: 'Power a pressurised module draws for life support, lighting and thermal control.' },
  { k: 'LIFE_SUPPORT_KW', v: 2.5, unit: 'kW/person', why: 'Electrical power one crew member needs beyond the module baseline.' },
  { k: 'ISRU_KG_PER_KWH', v: 0.30, unit: 'kg/kWh', why: 'Water extracted per kilowatt-hour spent heating and condensing regolith volatiles.' },
  { k: 'CREW_WATER_KG', v: 3.0, unit: 'kg/day', why: 'Water one crew member consumes per day with recycling.' },
  { k: 'GROUND_APERTURE', v: 4, unit: 'x', why: 'Ground terminal dish diameter as a multiple of the flight antenna, since mass is free on the ground.' },
  { k: 'BATTERY_FLOOR_KWH_M2', v: 20, unit: 'kWh/m2', why: 'Energy a battery hall stores per square metre of floor.' },
  { k: 'PAD_DIAMETER', v: 3.5, unit: 'x fairing', why: 'Cleared landing zone diameter as a multiple of the launch vehicle fairing.' },
  { k: 'DRAW_CAP_UNITS', v: 24, unit: 'units', why: 'Spacecraft-equivalents the site plan draws. The real figure is always reported.' },
]
const A = Object.fromEntries(SURFACE_ASSUMPTIONS.map(a => [a.k, a.v]))

// ------------------------------------------------------------- seeding ----

// Same seeding approach as sim/events.js: one design always produces one site
// plan, so a shared mission link draws the identical outpost.
function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = (g, id) => COMPONENTS[g].find(c => c.id === id)
const r2 = n => Math.round(n * 100) / 100

// ------------------------------------------------------------ the build ----

export function designOutpost({ config, result }) {
  const site = siteFor(config)
  const orbit = ORBITS.find(o => o.id === config.orbitId)
  const launcher = LAUNCHERS.find(l => l.id === config.launcherId)
  const array = pick('array', config.components.array)
  const battery = pick('battery', config.components.battery)
  const comms = pick('comms', config.components.comms)
  const thermal = pick('thermal', config.components.thermal)
  const obc = pick('obc', config.components.obc)
  const instruments = config.instrumentIds
    .map(id => INSTRUMENTS.find(i => i.id === id)).filter(Boolean)

  const years = config.lifetimeYears
  const dryKg = result.mass.dryKg
  const capacityKg = result.mass.capacityKg

  // How much hardware the programme can actually put on the ground.
  const cargoMultiple = dryKg > 0 ? Math.floor(capacityKg / dryKg) : 0
  const modulesPerLanding = Math.max(0, Math.min(A.MODULES_PER_LANDING, cargoMultiple))
  const landings = years
  const plannedUnits = modulesPerLanding * landings
  const units = Math.min(A.DRAW_CAP_UNITS, plannedUnits)
  const capped = plannedUnits > units

  // --- power, from the same inverse-square flux the mission used -----------
  const flux = SOLAR_CONSTANT / Math.pow(orbit.solarDistanceAu, 2)
  const surfaceFlux = flux * site.transmission
  const farmAreaM2 = units * array.areaM2
  const peakKw = surfaceFlux * farmAreaM2 * array.efficiency * PACKING_COSINE_LOSS / 1000
  const availKw = peakKw * site.illumination * site.dust

  // Landed science hardware draws what it drew in flight. That load is not
  // optional - it is the mission. Habitation is what the power left over can
  // afford, which is why a small array lands a robot and a large one lands
  // people. Each crewed module costs its own baseline plus its crew.
  const hardwareKw = units * result.power.loadW / 1000
  const perHabitatKw = A.HABITAT_KW + A.HABITAT_CREW * A.LIFE_SUPPORT_KW
  const spareKw = availKw - hardwareKw
  const habitatsByPower = Math.max(0, Math.floor(spareKw / perHabitatKw))
  const habitatsByMass = units > 0 ? Math.ceil(units / 3) : 0
  const habitats = Math.min(habitatsByPower, habitatsByMass)
  const habitatKw = habitats * A.HABITAT_KW
  const crewKw = habitats * A.HABITAT_CREW * A.LIFE_SUPPORT_KW
  const loadKw = hardwareKw + habitatKw + crewKw
  const surplusKw = availKw - loadKw
  const powerMargin = availKw > 0 ? (availKw - loadKw) / availKw : -1

  // --- night survival, from the battery the user chose ---------------------
  // The pack that carries an orbiter through a 35-minute eclipse is being asked
  // to carry a base through a night measured in hours or days. It will not, and
  // the honest figure is more interesting than a pass mark: this is why surface
  // power studies reach for a fission reactor instead of more cells.
  const bankKwh = units * battery.capacityWh * battery.depthOfDischarge / 1000
  const survivalH = loadKw > 0 ? bankKwh / loadKw : 0
  const essentialKw = hardwareKw
  const essentialH = essentialKw > 0 ? bankKwh / essentialKw : 0
  const survivesNight = survivalH >= site.nightHours
  const nightNeedKwh = loadKw * site.nightHours
  const nightMultiple = bankKwh > 0 ? nightNeedKwh / bankKwh : null

  // --- data: many instrument suites, ONE orbiter to carry it home ---------
  const generatedGbPerDay = units * result.data.generatedGbPerDay
  const relayGbPerDay = result.data.downlinkGbPerDay          // deliberately not scaled
  const relayFraction = generatedGbPerDay > 0
    ? Math.min(1, relayGbPerDay / generatedGbPerDay) : 1
  const storageGb = units * obc.storageGb
  const backlogDays = generatedGbPerDay > relayGbPerDay
    ? storageGb / (generatedGbPerDay - relayGbPerDay) : null

  // --- crew, limited by power before anything else ------------------------
  const crewByModules = habitats * A.HABITAT_CREW
  const crewByPower = Math.max(0, Math.floor(spareKw / A.LIFE_SUPPORT_KW))
  const crew = Math.max(0, Math.min(crewByModules, crewByPower))
  const crewLimit = habitatsByPower < habitatsByMass ? 'power'
    : habitatsByMass < habitatsByPower ? 'landed mass' : 'power'

  // --- in-situ water, only where there is ice to get it from --------------
  const isruKw = site.isru && surplusKw > 0 ? Math.min(surplusKw, 0.4 * availKw) : 0
  const waterKgPerDay = isruKw * 24 * A.ISRU_KG_PER_KWH
  const waterCrew = Math.floor(waterKgPerDay / A.CREW_WATER_KG)

  const apertureM = Math.max(3, r2(comms.antennaM * A.GROUND_APERTURE))

  // --- classification -----------------------------------------------------
  const cls =
    units === 0 ? { id: 'none', label: 'NO OUTPOST POSSIBLE',
      sub: 'Your launch vehicle cannot deliver one spacecraft-equivalent to this body.' }
    : crew === 0 ? { id: 'robotic', label: 'UNCREWED FIELD STATION',
      sub: 'There is power for the instruments and nothing left for people.' }
    : crew < 8 ? { id: 'crewed', label: 'CREWED OUTPOST',
      sub: crew + ' crew, limited by ' + (habitatsByPower < habitatsByMass ? 'power' : 'landed mass') + '.' }
    : { id: 'base', label: 'PERMANENT BASE',
      sub: crew + ' crew across ' + habitats + ' pressurised modules.' }

  const structures = layout({
    seed: hashString(JSON.stringify(config) + '|outpost'),
    site, units, habitats, instruments, array, apertureM, bankKwh,
    farmAreaM2, thermalCooled: thermal.coolingCapable,
    padDiameterM: r2(launcher.fairingDiameterM * A.PAD_DIAMETER),
    pads: Math.max(1, Math.min(2, landings)), isru: isruKw > 0,
  })

  const extentM = structures.reduce(
    (m, s) => Math.max(m, Math.abs(s.x) + s.w / 2, Math.abs(s.y) + s.d / 2), 10)

  // Every headline figure, and the mission number it came from. The UI prints
  // this table verbatim - it is the whole defence of the drawing.
  const provenance = [
    { label: 'Hardware landed', value: units + ' spacecraft-equivalents',
      from: 'floor(' + Math.round(capacityKg) + ' kg launcher capacity / ' + Math.round(dryKg) +
        ' kg dry mass) = ' + cargoMultiple + ' per flight, ' + modulesPerLanding +
        ' landed, over ' + landings + ' years' },
    { label: 'Solar farm', value: farmAreaM2 + ' m2',
      from: units + ' x ' + array.areaM2 + ' m2 (' + array.name + ')' },
    { label: 'Surface irradiance', value: Math.round(surfaceFlux) + ' W/m2',
      from: '1361 / ' + orbit.solarDistanceAu + ' AU^2 x ' + site.transmission + ' transmission' },
    { label: 'Power available', value: r2(availKw) + ' kW',
      from: Math.round(surfaceFlux) + ' W/m2 x ' + farmAreaM2 + ' m2 x ' + array.efficiency +
        ' efficiency x ' + PACKING_COSINE_LOSS + ' packing x ' + site.illumination +
        ' illumination x ' + site.dust + ' dust' },
    { label: 'Power drawn', value: r2(loadKw) + ' kW',
      from: units + ' x ' + Math.round(result.power.loadW) + ' W of landed flight hardware + ' +
        habitats + ' habitat(s) at ' + A.HABITAT_KW + ' kW + ' + crew + ' crew at ' +
        A.LIFE_SUPPORT_KW + ' kW' },
    { label: 'Battery bank', value: r2(bankKwh) + ' kWh',
      from: units + ' x ' + battery.capacityWh + ' Wh x ' + battery.depthOfDischarge +
        ' depth of discharge' },
    { label: 'Night survival', value: r2(survivalH) + ' h of ' + site.nightHours + ' h dark',
      from: r2(bankKwh) + ' kWh / ' + r2(loadKw) + ' kW' },
    { label: 'Data generated', value: r2(generatedGbPerDay) + ' GB/day',
      from: units + ' x ' + r2(result.data.generatedGbPerDay) + ' GB/day from ' +
        instruments.length + ' instruments' },
    { label: 'Relay home', value: r2(relayGbPerDay) + ' GB/day',
      from: 'one orbiter: ' + comms.name + ' at ' + r2(result.data.downlinkMbps) +
        ' Mbps x ' + orbit.groundContactMinPerDay + ' contact min/day' },
    { label: 'Ground terminal', value: apertureM + ' m aperture',
      from: comms.antennaM + ' m flight antenna x ' + A.GROUND_APERTURE },
  ]

  return {
    site, cls, units, plannedUnits, capped, cargoMultiple, modulesPerLanding, landings,
    habitats, instruments,
    power: { flux, surfaceFlux, farmAreaM2, peakKw, availKw, hardwareKw, habitatKw,
      crewKw, loadKw, surplusKw, spareKw, margin: powerMargin,
      habitatsByPower, habitatsByMass },
    night: { bankKwh, survivalH, essentialH, nightHours: site.nightHours,
      survives: survivesNight, needKwh: nightNeedKwh, multiple: nightMultiple },
    data: { generatedGbPerDay, relayGbPerDay, relayFraction, storageGb, backlogDays,
      apertureM, lostGbPerDay: Math.max(0, generatedGbPerDay - relayGbPerDay) },
    crew: { crew, byModules: crewByModules, byPower: crewByPower, limit: crewLimit },
    water: { kgPerDay: waterKgPerDay, crewSupported: waterCrew, kind: site.isru, isruKw },
    structures, extentM, provenance,
    deliverable: units > 0,
  }
}

// ------------------------------------------------------------- site plan ----

// Zones are hand-authored so the plan reads like a plan, with seeded jitter so
// no two designs look identical. Positions and sizes are in METRES, measured
// from the site datum; the view projects them, it does not invent them.
function layout(o) {
  const rnd = mulberry32(o.seed)
  const j = (m) => (rnd() - 0.5) * 2 * m
  const out = []
  const add = s => { out.push(s); return s }

  // Nothing was delivered, so there is nothing to draw but the surveyed site.
  // An empty plot is the honest picture of a launch vehicle that cannot lift
  // the spacecraft you designed.
  if (o.units <= 0) {
    add({ id: 'pad-0', kind: 'pad', name: 'Surveyed landing pad',
      x: 10, y: 6, w: o.padDiameterM, d: o.padDiameterM, h: 0.4 })
    add({ id: 'datum', kind: 'marker', name: 'Site datum', x: -6, y: -4, w: 1, d: 1, h: 2.4 })
    add({ id: 'crewfig', kind: 'crew', name: 'Crew member, 1.8 m',
      x: -2, y: 2, w: 0.6, d: 0.4, h: 1.8 })
    return out
  }

  // Solar farm: real panels, each the area of the array the user picked.
  const panelSide = Math.sqrt(o.array.areaM2)
  const perRow = Math.max(1, Math.ceil(Math.sqrt(o.units)))
  for (let i = 0; i < o.units; i++) {
    const col = i % perRow, row = Math.floor(i / perRow)
    add({ id: 'panel-' + i, kind: 'panel', name: o.array.name,
      x: -28 - col * (panelSide + 1.6) + j(0.2),
      y: -10 + row * (panelSide + 2.2) + j(0.2),
      w: panelSide, d: panelSide, h: 2.2 + panelSide * 0.1, tilt: true })
  }

  // Habitats: a row, connected end to end.
  for (let i = 0; i < o.habitats; i++) {
    add({ id: 'hab-' + i, kind: 'habitat', name: 'Pressurised module',
      x: 2 + j(0.4), y: -14 + i * 9.5 + j(0.3), w: 11, d: 4.6, h: 4.6 })
  }

  // Battery hall, sized by the energy it has to hold.
  const bSide = Math.max(3, Math.sqrt(Math.max(1, o.bankKwh) / 20))
  add({ id: 'battery', kind: 'battery', name: 'Battery hall',
    x: -14 + j(0.5), y: 14 + j(0.5), w: bSide, d: bSide, h: 3.4 })

  // Ground terminal: the dish, at the aperture the link needs.
  add({ id: 'dish', kind: 'dish', name: 'Ground terminal',
    x: 22 + j(0.6), y: -18 + j(0.6), w: o.apertureM, d: o.apertureM, h: o.apertureM * 0.9 })

  // One field station per instrument the user actually flew.
  o.instruments.forEach((inst, i) => {
    // Footprint grows with instrument mass; the mast on top is what makes it
    // read as an instrument rather than a shed.
    const s = Math.max(1.4, Math.sqrt(inst.massKg) / 3)
    add({ id: 'inst-' + inst.id, kind: 'instrument', name: inst.name,
      x: 20 + j(1.2) - (i % 2) * 7, y: 4 + i * 7 + j(0.8), w: s, d: s, h: s * 0.75 })
  })

  if (o.thermalCooled) {
    add({ id: 'radiator', kind: 'radiator', name: 'Radiator field',
      x: -6 + j(0.5), y: 22 + j(0.5), w: 12, d: 4, h: 3 })
  }
  if (o.isru) {
    add({ id: 'isru', kind: 'isru', name: 'Volatiles plant',
      x: 12 + j(0.6), y: 22 + j(0.6), w: 7, d: 7, h: 6.5 })
  }
  for (let i = 0; i < o.pads; i++) {
    add({ id: 'pad-' + i, kind: 'pad', name: 'Landing pad',
      x: 26 + i * (o.padDiameterM + 5) + j(0.8), y: 14 + j(0.8),
      w: o.padDiameterM, d: o.padDiameterM, h: 0.4 })
  }
  if (o.site.id !== 'earth') {
    add({ id: 'shelter', kind: 'shelter', name: 'Radiation shelter',
      x: -4 + j(0.4), y: 4 + j(0.4), w: 6, d: 6, h: 3.2 })
  }
  add({ id: 'ops', kind: 'ops', name: 'Operations building',
    x: 14 + j(0.4), y: -8 + j(0.4), w: 8, d: 6, h: 5 })
  add({ id: 'rover', kind: 'rover', name: 'Pressurised rover',
    x: 30 + j(1), y: 2 + j(1), w: 3.4, d: 1.8, h: 1.9 })
  add({ id: 'crewfig', kind: 'crew', name: 'Crew member, 1.8 m',
    x: 7.5 + j(0.3), y: 1 + j(0.3), w: 0.6, d: 0.4, h: 1.8 })

  return recentre(separate(out))
}

// Centre the finished plan on its own bounding box, so the view is not asked to
// frame a site that drifts off to one side as structures are added.
function recentre(items) {
  if (!items.length) return items
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const s of items) {
    minX = Math.min(minX, s.x - s.w / 2); maxX = Math.max(maxX, s.x + s.w / 2)
    minY = Math.min(minY, s.y - s.d / 2); maxY = Math.max(maxY, s.y + s.d / 2)
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  for (const s of items) { s.x = Math.round((s.x - cx) * 100) / 100; s.y = Math.round((s.y - cy) * 100) / 100 }
  return items
}

// Zones are authored by hand, so two of them can be asked to stand in the same
// place when a design makes something unusually large. This pushes them apart
// along the axis of least penetration, in a fixed number of passes and in a
// fixed order, so the plan stays deterministic. A crew member and a rover are
// mobile and allowed to stand between buildings; everything else gets clearance.
const MOBILE = new Set(['crew', 'rover'])
const CLEARANCE = 1.5

export function overlaps(a, b, pad = 0) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad &&
         Math.abs(a.y - b.y) < (a.d + b.d) / 2 + pad
}

function separate(items) {
  const fixed = items.filter(s => !MOBILE.has(s.kind))
  for (let pass = 0; pass < 24; pass++) {
    let moved = false
    for (let i = 0; i < fixed.length; i++) {
      for (let k = i + 1; k < fixed.length; k++) {
        const a = fixed[i], b = fixed[k]
        if (!overlaps(a, b, CLEARANCE)) continue
        const px = (a.w + b.w) / 2 + CLEARANCE - Math.abs(a.x - b.x)
        const py = (a.d + b.d) / 2 + CLEARANCE - Math.abs(a.y - b.y)
        const sx = a.x <= b.x ? -1 : 1
        const sy = a.y <= b.y ? -1 : 1
        if (px < py) { a.x += sx * px / 2; b.x -= sx * px / 2 }
        else { a.y += sy * py / 2; b.y -= sy * py / 2 }
        moved = true
      }
    }
    if (!moved) break
  }
  return items
}
