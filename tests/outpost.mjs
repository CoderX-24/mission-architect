// The surface segment has to be evidence, not an illustration. Every assertion
// below exists to stop the drawing drifting away from the mission: each
// dimension on the site plan has to trace back to a number runMission already
// reported, the plan has to be reproducible from the config alone, and no
// building may stand on another.
//
// The assertion this suite exists for is DATA RELAY. Landing twenty copies of
// an instrument suite multiplies what the outpost measures and does NOT
// multiply the orbiter carrying it home. If that ever starts scaling, the
// outpost has become a fantasy and this test fails.

import { runMission } from '../src/sim/runMission.js'
import { designOutpost, siteFor, overlaps, SITES, SURFACE_ASSUMPTIONS } from '../src/sim/outpost.js'
import COMPONENTS from '../src/data/components.json' with { type: 'json' }
import OBJECTIVES from '../src/data/objectives.json' with { type: 'json' }
import LAUNCHERS from '../src/data/launchers.json' with { type: 'json' }
import { SOLAR_CONSTANT, PACKING_COSINE_LOSS } from '../src/sim/constants.js'

let failures = 0
const near = (a, b, tol, what) => {
  const ok = Math.abs(a - b) <= tol * Math.max(1, Math.abs(b))
  console.log(`   ${ok ? 'OK  ' : 'FAIL'} ${what}: got ${Number(a).toFixed(3)}, expected ~${Number(b).toFixed(3)}`)
  if (!ok) failures++
}
const is = (a, b, what) => {
  const ok = a === b
  console.log(`   ${ok ? 'OK  ' : 'FAIL'} ${what}: ${a} === ${b}`)
  if (!ok) failures++
}
const ok = (cond, what) => {
  console.log(`   ${cond ? 'OK  ' : 'FAIL'} ${what}`)
  if (!cond) failures++
}

const BASE = {
  objectiveId: 'forest_biomass', orbitId: 'leo_sso', launcherId: 'rideshare',
  instrumentIds: ['multispectral_imager', 'lidar_altimeter'],
  components: { array: 'array_m', battery: 'batt_m', comms: 'comms_x', adcs: 'adcs_fine',
    propulsion: 'prop_mono', thermal: 'therm_passive', obc: 'obc_basic', structure: 'struct_small' },
  lifetimeYears: 5,
}
const MOON = {
  objectiveId: 'lunar_south_pole', orbitId: 'lunar', launcherId: 'falcon9',
  instrumentIds: ['thermal_imager', 'dust_analyzer'],
  components: { array: 'array_l', battery: 'batt_l', comms: 'comms_x', adcs: 'adcs_fine',
    propulsion: 'prop_bi', thermal: 'therm_active', obc: 'obc_rad', structure: 'struct_small' },
  lifetimeYears: 4,
}
const MARS = {
  objectiveId: 'mars_recon', orbitId: 'mars', launcherId: 'falcon9',
  instrumentIds: ['terrain_camera'],
  components: { array: 'array_xl', battery: 'batt_l', comms: 'comms_ka', adcs: 'adcs_fine',
    propulsion: 'prop_bi', thermal: 'therm_active', obc: 'obc_rad', structure: 'struct_large' },
  lifetimeYears: 6,
}
const UNDELIVERABLE = {
  ...BASE, launcherId: 'electron',
  components: { ...BASE.components, structure: 'struct_large' },
}

const build = c => designOutpost({ config: c, result: runMission(c) })

const deepFinite = (obj, path = '') => {
  if (typeof obj === 'number') {
    if (!Number.isFinite(obj)) { console.log('   FAIL non-finite at ' + path + ': ' + obj); failures++ }
    return
  }
  if (Array.isArray(obj)) return obj.forEach((v, i) => deepFinite(v, path + '[' + i + ']'))
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) deepFinite(obj[k], path + '.' + k)
  }
}

// ---------------------------------------------------------------------------
console.log('\n=== SITE SELECTION follows the orbit, not the objective name')
is(siteFor({ orbitId: 'mars' }).id, 'mars', 'mars orbit -> Mars site')
is(siteFor({ orbitId: 'lunar' }).id, 'moon', 'lunar orbit -> Moon site')
is(siteFor({ orbitId: 'leo_sso' }).id, 'earth', 'SSO -> Earth ground segment')
is(siteFor({ orbitId: 'geo' }).id, 'earth', 'GEO -> Earth ground segment')
is(siteFor({ orbitId: 'nonsense' }).id, 'earth', 'unknown orbit falls back to Earth')

// ---------------------------------------------------------------------------
console.log('\n=== EVERY DIMENSION TRACES BACK to a mission number')
for (const [name, cfg] of Object.entries({ BASE, MOON, MARS })) {
  const r = runMission(cfg)
  const o = build(cfg)
  const array = COMPONENTS.array.find(a => a.id === cfg.components.array)
  const battery = COMPONENTS.battery.find(b => b.id === cfg.components.battery)
  const launcher = LAUNCHERS.find(l => l.id === cfg.launcherId)

  console.log(` -- ${name}: ${o.site.name}, ${o.units} units, ${o.cls.label}`)
  near(o.power.flux, r.power.fluxWm2, 1e-9, name + ' flux is the mission flux, unchanged')
  near(o.power.farmAreaM2, o.units * array.areaM2, 1e-9, name + ' farm area = units x array area')
  near(o.power.surfaceFlux, SOLAR_CONSTANT / Math.pow(
    r.power.fluxWm2 === SOLAR_CONSTANT ? 1 : Math.sqrt(SOLAR_CONSTANT / r.power.fluxWm2), 2)
    * o.site.transmission, 1e-6, name + ' surface flux = mission flux x transmission')
  near(o.power.peakKw,
    o.power.surfaceFlux * o.power.farmAreaM2 * array.efficiency * PACKING_COSINE_LOSS / 1000,
    1e-9, name + ' peak power recomputes from flux x area x efficiency x packing')
  near(o.power.availKw, o.power.peakKw * o.site.illumination * o.site.dust, 1e-9,
    name + ' available power = peak x illumination x dust')
  near(o.power.hardwareKw, o.units * r.power.loadW / 1000, 1e-9,
    name + ' landed hardware draws the flight load')
  near(o.night.bankKwh, o.units * battery.capacityWh * battery.depthOfDischarge / 1000, 1e-9,
    name + ' battery bank = units x capacity x depth of discharge')
  near(o.data.generatedGbPerDay, o.units * r.data.generatedGbPerDay, 1e-9,
    name + ' outpost generates units x the mission rate')
  is(o.cargoMultiple, Math.floor(r.mass.capacityKg / r.mass.dryKg),
    name + ' cargo multiple = launcher capacity / dry mass')
  ok(o.structures.length > 0, name + ' produced a site plan')
  ok(o.extentM > 0 && o.extentM < 5000, name + ' site extent is a sane number of metres')
  deepFinite(o, name)
}

// ---------------------------------------------------------------------------
console.log('\n=== ONE ORBITER: relay capacity must NOT scale with the outpost')
{
  const o = build(BASE)
  const r = runMission(BASE)
  near(o.data.relayGbPerDay, r.data.downlinkGbPerDay, 1e-9,
    'relay home equals the single orbiter downlink')
  ok(o.units > 1, 'this case lands more than one unit')
  ok(o.data.generatedGbPerDay > o.data.relayGbPerDay,
    'landed suites out-produce the one orbiter')
  near(o.data.lostGbPerDay, o.data.generatedGbPerDay - o.data.relayGbPerDay, 1e-9,
    'science lost per day is the difference')
  ok(o.data.relayFraction < 1, 'relay fraction is below 1 when the link is the bottleneck')
  ok(o.data.backlogDays !== null && o.data.backlogDays > 0, 'a finite backlog time is reported')
}

// ---------------------------------------------------------------------------
console.log('\n=== HABITATION is bought with power, and capped by landed mass')
for (const [name, cfg] of Object.entries({ BASE, MOON, MARS })) {
  const o = build(cfg)
  const perHab = 12 + 4 * 2.5
  ok(o.habitats <= Math.ceil(o.units / 3), name + ' habitats capped by landed mass')
  ok(o.habitats <= Math.max(0, Math.floor((o.power.availKw - o.power.hardwareKw) / perHab)),
    name + ' habitats capped by spare power')
  ok(o.crew.crew <= o.habitats * 4, name + ' crew fits the pressurised modules')
  ok(o.crew.crew === 0 || o.power.availKw > o.power.hardwareKw,
    name + ' crew only where power is left over after the hardware')
}

// ---------------------------------------------------------------------------
console.log('\n=== NOTHING STANDS ON ANYTHING ELSE')
for (const [name, cfg] of Object.entries({ BASE, MOON, MARS, UNDELIVERABLE })) {
  const o = build(cfg)
  const fixed = o.structures.filter(s => s.kind !== 'crew' && s.kind !== 'rover')
  let clashes = 0
  for (let i = 0; i < fixed.length; i++) {
    for (let k = i + 1; k < fixed.length; k++) if (overlaps(fixed[i], fixed[k])) clashes++
  }
  is(clashes, 0, name + ' site plan has no overlapping structures (' + fixed.length + ' checked)')
  ok(o.structures.every(s => s.w > 0 && s.d > 0 && s.h > 0),
    name + ' every structure has real dimensions')
}

// ---------------------------------------------------------------------------
console.log('\n=== THE SAME DESIGN ALWAYS BUILDS THE SAME OUTPOST')
{
  const a = JSON.stringify(build(MOON).structures)
  const b = JSON.stringify(build(MOON).structures)
  is(a === b, true, 'site plan is reproducible from the config alone')
  const c = JSON.stringify(build({ ...MOON, lifetimeYears: 3 }).structures)
  is(a !== c, true, 'a different design builds a different outpost')
}

// ---------------------------------------------------------------------------
console.log('\n=== AN UNDELIVERABLE DESIGN BUILDS NOTHING, AND SAYS SO')
{
  const o = build(UNDELIVERABLE)
  is(o.units, 0, 'nothing is landed when the vehicle cannot lift the spacecraft')
  is(o.deliverable, false, 'outpost reports itself undeliverable')
  is(o.cls.id, 'none', 'classified as no outpost possible')
  is(o.habitats, 0, 'no habitats')
  is(o.crew.crew, 0, 'no crew')
  ok(o.structures.length <= 3, 'only the surveyed site is drawn')
}

// ---------------------------------------------------------------------------
console.log('\n=== EVERY OBJECTIVE, ORBIT AND LAUNCH VEHICLE SURVIVES THE SWEEP')
{
  let built = 0, delivered = 0
  const combos = []
  for (const obj of OBJECTIVES) {
    for (const orbitId of obj.allowedOrbits) {
      for (const l of LAUNCHERS) {
        for (const arrayId of ['array_s', 'array_xl']) {
          for (const years of [obj.minLifetimeYears, 10]) {
            combos.push({
              objectiveId: obj.id, orbitId, launcherId: l.id,
              instrumentIds: obj.requiredMeasurements.length ? BASE.instrumentIds : [],
              components: { ...BASE.components, array: arrayId },
              lifetimeYears: years,
            })
          }
        }
      }
    }
  }
  for (const cfg of combos) {
    const o = build(cfg)
    built++
    if (o.deliverable) delivered++
    deepFinite(o, 'sweep')
    if (o.units < 0 || o.habitats < 0 || o.crew.crew < 0) { failures++; console.log('   FAIL negative count') }
    if (o.data.relayFraction < 0 || o.data.relayFraction > 1) { failures++; console.log('   FAIL relay fraction out of range') }
  }
  ok(built === combos.length, built + ' configurations built without throwing')
  ok(delivered > 0 && delivered < built, delivered + ' of ' + built + ' were deliverable, so the constraint bites')
}

// ---------------------------------------------------------------------------
console.log('\n=== SURFACE ASSUMPTIONS ARE ALL DECLARED')
{
  ok(SURFACE_ASSUMPTIONS.length >= 8, SURFACE_ASSUMPTIONS.length + ' assumptions published for review')
  ok(SURFACE_ASSUMPTIONS.every(a => a.why && a.why.length > 20), 'every assumption explains itself')
  ok(Object.values(SITES).every(s => s.note && s.transmission > 0 && s.nightHours > 0),
    'every site declares its conditions')
}

console.log(failures === 0 ? '\nALL OUTPOST CHECKS PASS\n' : '\n' + failures + ' OUTPOST CHECK(S) FAILED\n')
process.exit(failures === 0 ? 0 : 1)
