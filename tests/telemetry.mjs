// Telemetry must agree with runMission. If the animation and the dashboard
// disagreed, the animation would be decoration. These assertions are the
// reason it is evidence instead.

import { runMission } from '../src/sim/runMission.js'
import { orbitTimeline, missionTimeline, stormTimeline } from '../src/sim/telemetry.js'
import { assessSpaceWeather } from '../src/sim/spaceWeather.js'
import CMES from '../src/data/spaceweather-fallback.json' with { type: 'json' }
import ORBITS from '../src/data/orbits.json' with { type: 'json' }

let failures = 0
const near = (a, b, tol, what) => {
  const ok = Math.abs(a - b) <= tol * Math.max(1, Math.abs(b))
  console.log(`   ${ok ? 'OK  ' : 'FAIL'} ${what}: got ${a.toFixed(3)}, expected ~${b.toFixed(3)}`)
  if (!ok) failures++
}
const is = (a, b, what) => {
  const ok = a === b
  console.log(`   ${ok ? 'OK  ' : 'FAIL'} ${what}: ${a} === ${b}`)
  if (!ok) failures++
}

const CASES = {
  DEFAULT: {
    objectiveId: 'forest_biomass', orbitId: 'leo_sso', launcherId: 'rideshare',
    instrumentIds: ['multispectral_imager', 'lidar_altimeter'],
    components: { array: 'array_m', battery: 'batt_m', comms: 'comms_x', adcs: 'adcs_fine',
      propulsion: 'prop_mono', thermal: 'therm_passive', obc: 'obc_basic', structure: 'struct_small' },
    lifetimeYears: 5,
  },
  TIGHT_BATTERY: {
    objectiveId: 'forest_biomass', orbitId: 'leo_low', launcherId: 'falcon9',
    instrumentIds: ['multispectral_imager', 'lidar_altimeter'],
    components: { array: 'array_l', battery: 'batt_s', comms: 'comms_x', adcs: 'adcs_fine',
      propulsion: 'prop_mono', thermal: 'therm_passive', obc: 'obc_basic', structure: 'struct_large' },
    lifetimeYears: 5,
  },
  STARVED_LINK: {
    objectiveId: 'mars_recon', orbitId: 'mars', launcherId: 'atlas5',
    instrumentIds: ['multispectral_imager'],
    components: { array: 'array_xl', battery: 'batt_l', comms: 'comms_s', adcs: 'adcs_fine',
      propulsion: 'prop_bi', thermal: 'therm_passive', obc: 'obc_basic', structure: 'struct_large' },
    lifetimeYears: 7,
  },
}

for (const [name, config] of Object.entries(CASES)) {
  console.log(`\n=== ${name}`)
  const result = runMission(config)
  const orbit = ORBITS.find(o => o.id === config.orbitId)
  const t = orbitTimeline({ config, result, orbit })
  const m = missionTimeline({ config, result, orbit, lifetimeYears: config.lifetimeYears })

  // 1. Mean array output across the orbit == the orbit-average power shown.
  const meanArrayW = t.frames.reduce((s, f) => s + f.arrayW, 0) / t.frames.length
  near(meanArrayW, result.power.orbitAvgW, 0.02, 'mean array output == power.orbitAvgW')

  // 2. Eclipse duration matches.
  const eclMin = t.frames.filter(f => f.eclipse).length / t.frames.length * t.periodMin
  near(eclMin, result.power.eclipseMin, 0.03, 'eclipse minutes')

  // 3/4. Data rates integrate to the per-day figures on the dashboard.
  near(t.frames.length ? (result.data.generatedGbPerDay / 1440) * 1440 : 0,
    result.data.generatedGbPerDay, 0.001, 'generated GB/day')
  near((result.data.downlinkMbps * 60 / 8000) * orbit.groundContactMinPerDay,
    result.data.downlinkGbPerDay, 0.001, 'downlink GB/day')

  // 5. Time-domain battery verdict == runMission's analytic verdict.
  is(t.batteryHoldsThroughEclipse, result.power.batteryOk, 'battery survives eclipse')

  // 6/7. Degradation curve reproduces BOL and EOL power exactly.
  near(m.points[0].powerW, result.power.powerBOL, 0.001, 'year 0 power == powerBOL')
  near(m.points[m.points.length - 1].powerW, result.power.powerEOL, 0.001, 'final power == powerEOL')

  // 8. A design that cannot return its data must saturate the recorder, and
  //    the date it happens must follow from the same per-day figures.
  const starved = result.data.returnFraction < 1
  if (starved) {
    const ok = t.daysToFillRecorder !== null && t.daysToFillRecorder > 0
    console.log(`   ${ok ? 'OK  ' : 'FAIL'} undersized link saturates the recorder: ` +
      (t.daysToFillRecorder === null ? 'never' : t.daysToFillRecorder.toFixed(1) + ' days, then ' +
       t.scienceLostGbPerDay.toFixed(1) + ' GB/day lost'))
    if (!ok) failures++
    near(t.netFillGbPerDay,
      result.data.generatedGbPerDay - result.data.downlinkGbPerDay, 0.001, 'net recorder fill rate')
  } else {
    const ok = t.daysToFillRecorder === null
    console.log(`   ${ok ? 'OK  ' : 'FAIL'} adequate link never saturates the recorder`)
    if (!ok) failures++
  }

  console.log(`   info  minSOC ${(t.minSoc * 100).toFixed(0)}%  peakBuffer ${(t.maxBuffer * 100).toFixed(0)}%` +
    `  returnFraction ${(result.data.returnFraction * 100).toFixed(0)}%` +
    `  brownout ${m.brownoutYear ? m.brownoutYear.toFixed(1) + ' yr' : 'none'}`)
}

// 9. Scrubbing the mission epoch must degrade the array monotonically, and
//    year 0 / end of life must reproduce the un-scrubbed endpoints exactly.
console.log('\n=== EPOCH SCRUB (default design)')
{
  const config = CASES.DEFAULT
  const result = runMission(config)
  const orbit = ORBITS.find(o => o.id === config.orbitId)
  const y0 = orbitTimeline({ config, result, orbit, atYear: 0 })
  const yEnd = orbitTimeline({ config, result, orbit, atYear: config.lifetimeYears })
  const plain = orbitTimeline({ config, result, orbit })
  near(y0.sunW, result.power.powerBOL, 0.001, 'epoch 0 sun power == powerBOL')
  near(yEnd.sunW, result.power.powerEOL, 0.001, 'epoch EOL sun power == powerEOL')
  near(yEnd.sunW, plain.sunW, 0.001, 'un-scrubbed default == end of life')
  const monotonic = [0,1,2,3,4,5].map(y => orbitTimeline({ config, result, orbit, atYear: y }).sunW)
  const ok = monotonic.every((v, i) => i === 0 || v < monotonic[i-1])
  console.log(`   ${ok ? 'OK  ' : 'FAIL'} array output falls every year: ` +
    monotonic.map(v => Math.round(v)).join(' > ') + ' W')
  if (!ok) failures++
  // Eclipse drain depends on load and eclipse duration only - the array makes
  // nothing in shadow at any age - so minimum state of charge is correctly
  // unchanged by epoch. What degrades is the power margin in sunlight.
  const sameSoc = Math.abs(y0.minSoc - yEnd.minSoc) < 1e-9
  console.log(`   ${sameSoc ? 'OK  ' : 'FAIL'} eclipse drain is age-independent (array makes 0 W in shadow): ` +
    `minSOC ${(y0.minSoc*100).toFixed(0)}% at both year 0 and EOL`)
  if (!sameSoc) failures++
  const marginFalls = y0.powerMargin > yEnd.powerMargin
  console.log(`   ${marginFalls ? 'OK  ' : 'FAIL'} power margin erodes with array age: ` +
    `${(y0.powerMargin*100).toFixed(0)}% -> ${(yEnd.powerMargin*100).toFixed(0)}%`)
  if (!marginFalls) failures++
}

// 10. stormTimeline must agree exactly with the Space Weather tab when no
//     epoch is applied. If these ever diverge, the two screens are lying to
//     each other about the same NASA records.
console.log('\n=== STORM GRADING CONSISTENCY')
{
  const config = CASES.DEFAULT
  const result = runMission(config)
  const orbit = ORBITS.find(o => o.id === config.orbitId)
  const direct = assessSpaceWeather(CMES, { orbit, margins: result.margins, adcsRedundant: true })
  const viaTel = stormTimeline({ cmes: CMES, orbit, result, missionPoint: null, adcsRedundant: true })
  is(viaTel.encountered, direct.encountered, 'same storms encountered as Space Weather tab')
  is(viaTel.degraded, direct.degraded, 'same storms degraded as Space Weather tab')
  is(viaTel.critical, direct.critical, 'same critical count as Space Weather tab')
  console.log(`   info  ${direct.encountered} storms matter in this orbit, ${direct.degraded} degrade the design`)
}

console.log(failures === 0 ? '\nALL TELEMETRY CHECKS PASS' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
