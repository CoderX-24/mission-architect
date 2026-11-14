// ============================================================================
// telemetry.js - time-domain reconstruction of a mission.
//
// runMission() answers "does this design close?" in per-day averages.
// This module answers "what does a day in the life actually look like?"
//
// It adds NO new physics and introduces NO new constants. Every series here
// integrates back to a number runMission already reported - that consistency
// is asserted in tests/telemetry.mjs. If these curves disagreed with the
// margins on the dashboard, the animation would be decoration. It isn't.
// ============================================================================

import COMPONENTS from '../data/components.json' with { type: 'json' }
import { assessSpaceWeather } from './spaceWeather.js'

const pick = (group, id) => COMPONENTS[group].find(c => c.id === id)

// The spacecraft enters eclipse at this point in the orbit. Arbitrary but
// fixed, so a given design always produces the same trace.
const ECLIPSE_START_PHASE = 0.55

// Ground contact begins shortly after eclipse exit, which is when a real
// sun-synchronous spacecraft tends to see its polar station.
const CONTACT_START_PHASE = 0.08

/**
 * One full orbit, sampled. Returns the per-timestep state that the flight
 * console animates: array output, load, battery charge, data buffer.
 */
export function orbitTimeline({ config, result, orbit, samples = 240, atYear = null }) {
  const battery = pick('battery', config.components.battery)
  const obc = pick('obc', config.components.obc)
  const array = pick('array', config.components.array)

  const periodMin = orbit.periodMin
  const dtMin = periodMin / samples

  // Power in full sun. With no epoch given this is end-of-life, matching the
  // dashboard. With an epoch, the array has degraded for exactly that many
  // years - which is what lets the mission scrubber re-fly the same orbit
  // later in life and show the battery biting deeper.
  const degPerYear = array.degradationPerYear * (1 + orbit.radiationIndex)
  const sunW = atYear === null
    ? result.power.powerEOL
    : result.power.powerBOL * Math.pow(1 - degPerYear, atYear)
  const loadW = result.power.loadW

  // Usable battery energy, defined exactly as power.js defines it.
  const usableWh = battery.capacityWh * battery.depthOfDischarge * 0.9

  // Data. Rates per minute, derived from the same per-day figures the
  // dashboard shows, so they integrate back to them.
  const genPerMin = result.data.generatedGbPerDay / 1440
  const dlPerMin = result.data.downlinkMbps * 60 / 8000
  const bufferCapGb = obc.storageGb

  // Contact minutes allocated to THIS orbit, from the per-day budget.
  const orbitsPerDay = 1440 / periodMin
  const contactMinPerOrbit = orbit.groundContactMinPerDay / orbitsPerDay
  const contactPhaseLen = Math.min(1, contactMinPerOrbit / periodMin)

  const eclipseLen = orbit.eclipseFraction
  const inEclipse = ph => {
    const d = (ph - ECLIPSE_START_PHASE + 1) % 1
    return d < eclipseLen
  }
  const inContact = ph => {
    const d = (ph - CONTACT_START_PHASE + 1) % 1
    return d < contactPhaseLen
  }

  // Settle the battery and buffer over a few orbits so the trace we show is
  // the repeating steady state, not a transient from an arbitrary start.
  let soc = usableWh
  let buffer = 0
  for (let warm = 0; warm < 3; warm++) {
    for (let i = 0; i < samples; i++) {
      const ph = i / samples
      const arrayW = inEclipse(ph) ? 0 : sunW
      soc = stepBattery(soc, arrayW, loadW, dtMin, usableWh)
      buffer = stepBuffer(buffer, genPerMin, inContact(ph) ? dlPerMin : 0, dtMin, bufferCapGb)
    }
  }

  const frames = []
  let overflowedGb = 0
  for (let i = 0; i <= samples; i++) {
    const ph = (i % samples) / samples
    const ecl = inEclipse(ph)
    const con = inContact(ph)
    const arrayW = ecl ? 0 : sunW

    const before = buffer
    soc = stepBattery(soc, arrayW, loadW, dtMin, usableWh)
    buffer = stepBuffer(buffer, genPerMin, con ? dlPerMin : 0, dtMin, bufferCapGb)

    // Science generated that could not be stored is science lost for good.
    const wanted = before + genPerMin * dtMin - (con ? dlPerMin * dtMin : 0)
    if (wanted > bufferCapGb) overflowedGb += wanted - bufferCapGb

    frames.push({
      phase: ph,
      minute: i * dtMin,
      eclipse: ecl,
      contact: con,
      arrayW,
      loadW,
      netW: arrayW - loadW,
      socWh: soc,
      soc: usableWh > 0 ? soc / usableWh : 0,
      bufferGb: buffer,
      buffer: bufferCapGb > 0 ? buffer / bufferCapGb : 0,
    })
  }

  // A starved downlink does not overflow within one orbit - it fills the
  // recorder over days, and only then starts throwing science away. That date
  // is the number the player actually needs.
  const netFillGbPerDay = result.data.generatedGbPerDay - result.data.downlinkGbPerDay
  const daysToFillRecorder = netFillGbPerDay > 0 ? bufferCapGb / netFillGbPerDay : null

  return {
    frames,
    periodMin,
    dtMin,
    sunW,
    loadW,
    usableWh,
    atYear,
    orbitAvgW: sunW * (1 - orbit.eclipseFraction),
    powerMargin: (sunW * (1 - orbit.eclipseFraction) - loadW) / Math.max(sunW * (1 - orbit.eclipseFraction), 1),
    bufferCapGb,
    eclipseMin: periodMin * eclipseLen,
    contactMinPerOrbit,
    minSoc: Math.min(...frames.map(f => f.soc)),
    maxBuffer: Math.max(...frames.map(f => f.buffer)),
    // Science lost per day because the recorder filled up.
    overflowGbPerDay: overflowedGb * orbitsPerDay,
    netFillGbPerDay,
    // Days from launch until the recorder saturates, or null if the link
    // keeps up. After this, everything the instruments collect is lost.
    daysToFillRecorder,
    scienceLostGbPerDay: netFillGbPerDay > 0 ? netFillGbPerDay : 0,
    batteryHoldsThroughEclipse: Math.min(...frames.map(f => f.socWh)) > 0,
  }
}

function stepBattery(soc, arrayW, loadW, dtMin, usableWh) {
  const net = arrayW - loadW
  const next = soc + net * (dtMin / 60)
  return Math.max(0, Math.min(usableWh, next))
}

function stepBuffer(buf, genPerMin, dlPerMin, dtMin, capGb) {
  const next = buf + (genPerMin - dlPerMin) * dtMin
  return Math.max(0, Math.min(capGb, next))
}

/**
 * The whole mission, launch to end of life. The array degrades, so the same
 * spacecraft has less power every year - which is why a storm that is
 * survivable in year one may not be in year seven.
 */
export function missionTimeline({ config, result, orbit, lifetimeYears, samples = 180 }) {
  const array = pick('array', config.components.array)
  const degradationPerYear = array.degradationPerYear * (1 + orbit.radiationIndex)
  const loadW = result.power.loadW

  const points = []
  for (let i = 0; i <= samples; i++) {
    const year = (i / samples) * lifetimeYears
    const powerAtYear = result.power.powerBOL * Math.pow(1 - degradationPerYear, year)
    const orbitAvgW = powerAtYear * (1 - orbit.eclipseFraction)
    points.push({
      year,
      dayOfMission: year * 365.25,
      powerW: powerAtYear,
      orbitAvgW,
      loadW,
      margin: (orbitAvgW - loadW) / Math.max(orbitAvgW, 1),
      brownout: orbitAvgW < loadW,
    })
  }

  const firstBrownout = points.find(p => p.brownout)
  return {
    points,
    lifetimeYears,
    degradationPerYear,
    // The year the array can no longer carry the load. This is the single
    // most useful number the mission view produces.
    brownoutYear: firstBrownout ? firstBrownout.year : null,
  }
}

/**
 * Place real DONKI storm records against the design at a chosen point in the
 * mission.
 *
 * This DELEGATES to assessSpaceWeather - the same function the Space Weather
 * tab uses - rather than reimplementing its grading. That matters: storms fail
 * a design through three independent paths (power margin, data margin, and a
 * single-event upset with no redundant attitude control), and a reimplementation
 * here would silently drift from the tab beside it.
 *
 * The only thing added is the epoch: power margin is replaced with the value
 * for an array that has degraded for `missionPoint.year` years. The storms and
 * their dates are real; what is counterfactual - and labelled as such in the
 * UI - is asking what that recorded sequence would do to an older array.
 */
export function stormTimeline({ cmes, orbit, result, missionPoint, adcsRedundant }) {
  const margins = missionPoint
    ? { ...result.margins, power: missionPoint.margin }
    : result.margins
  return assessSpaceWeather(cmes, { orbit, margins, adcsRedundant })
}
