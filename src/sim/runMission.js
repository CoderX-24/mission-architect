import ORBITS from '../data/orbits.json' with { type: 'json' }
import LAUNCHERS from '../data/launchers.json' with { type: 'json' }
import INSTRUMENTS from '../data/instruments.json' with { type: 'json' }
import OBJECTIVES from '../data/objectives.json' with { type: 'json' }
import COMPONENTS from '../data/components.json' with { type: 'json' }


import { computeMass } from './mass.js'
import { computeDeltaV, propellantMass } from './deltaV.js'
import { computePower } from './power.js'
import { computeData } from './data.js'
import { computeBudget } from './budget.js'
import { computeScore, matchValue } from './score.js'
import { runEvents } from './events.js'


const byId = (arr, id) => arr.find(x => x.id === id)
const pick = (group, id) => COMPONENTS[group].find(x => x.id === id)


export function resolveConfig(config) {
  return {
    objective: byId(OBJECTIVES, config.objectiveId),
    orbit: byId(ORBITS, config.orbitId),
    launcher: byId(LAUNCHERS, config.launcherId),
    instruments: config.instrumentIds.map(id => byId(INSTRUMENTS, id)).filter(Boolean),
    components: {
      array: pick('array', config.components.array),
      battery: pick('battery', config.components.battery),
      comms: pick('comms', config.components.comms),
      adcs: pick('adcs', config.components.adcs),
      propulsion: pick('propulsion', config.components.propulsion),
      thermal: pick('thermal', config.components.thermal),
      obc: pick('obc', config.components.obc),
      structure: pick('structure', config.components.structure),
    },
  }
}


export function runMission(config) {
  const { objective, orbit, launcher, instruments, components } = resolveConfig(config)
  const lifetimeYears = config.lifetimeYears
  const checks = []


  const mass = computeMass({ instruments, components })
  const dv = computeDeltaV({ orbit, lifetimeYears })
  const propKg = propellantMass(mass.dryKg, dv.totalMs, components.propulsion.ispS)
  const wetKg = mass.dryKg + propKg
  const capacityKg = launcher.capacityKg[orbit.id] || 0


  const loadW =
    instruments.reduce((s, i) => s + i.powerW, 0) +
    Object.values(components).reduce((s, c) => s + (c.powerW || 0), 0)


  const power = computePower({ array: components.array, battery: components.battery, orbit, loadW, lifetimeYears })
  const dataR = computeData({ instruments, comms: components.comms, orbit })
  const budget = computeBudget({ instruments, components, launcher, lifetimeYears, objective })


  const massMargin = capacityKg > 0 ? (capacityKg - wetKg) / capacityKg : -1
  const margins = {
    mass: massMargin, power: power.margin, budget: budget.margin,
    data: dataR.margin, deltaV: 0.25,
  }


  // Every check names the numbers and the fix. Never just "MISSION FAILED".
  const orbitOk = objective.allowedOrbits.includes(orbit.id)
  checks.push({ id: 'orbit-allowed', passed: orbitOk,
    message: orbitOk ? orbit.name + ' suits this objective.'
      : objective.name + ' cannot be done from ' + orbit.name + '.',
    fix: 'Allowed orbits: ' + objective.allowedOrbits.join(', ') + '.' })


  checks.push({ id: 'launcher-capacity', passed: wetKg <= capacityKg && capacityKg > 0,
    message: capacityKg === 0
      ? launcher.name + ' cannot reach ' + orbit.name + ' at all.'
      : 'Wet mass ' + Math.round(wetKg) + ' kg against ' + launcher.name + ' capacity ' +
        capacityKg + ' kg to this orbit (' + Math.round(massMargin * 100) + '% margin).',
    fix: 'Choose a larger launch vehicle, a lighter structure, or remove an instrument.' })


  checks.push({ id: 'structure-support', passed: mass.payloadKg <= components.structure.maxSupportedKg,
    message: 'Structure carries ' + Math.round(mass.payloadKg) + ' kg of payload, rated for ' +
      components.structure.maxSupportedKg + ' kg.',
    fix: 'Upgrade the bus structure or reduce payload mass.' })


  checks.push({ id: 'power-balance', passed: power.margin >= 0,
    message: 'Array delivers ' + Math.round(power.orbitAvgW) + ' W orbit-average at end of life; ' +
      'the spacecraft draws ' + Math.round(loadW) + ' W (' + Math.round(power.margin * 100) + '% margin).',
    fix: 'At ' + orbit.solarDistanceAu + ' AU the Sun gives ' + Math.round(power.fluxWm2) +
      ' W/m2. Fit a larger array, or shed load.' })


  checks.push({ id: 'battery-eclipse', passed: power.batteryOk,
    message: 'Eclipse lasts ' + power.eclipseMin.toFixed(1) + ' min and needs ' +
      Math.round(power.energyNeededWh) + ' Wh; the battery provides ' + power.batteryCapacityWh + ' Wh.',
    fix: 'Fit a larger battery or reduce load during eclipse.' })


  const cooled = instruments.some(i => i.needsCooling)
  checks.push({ id: 'thermal-cooling', passed: !cooled || components.thermal.coolingCapable,
    message: cooled
      ? (components.thermal.coolingCapable
        ? 'Cooled instruments are supported by the thermal system.'
        : 'Instruments requiring cooling are fitted, but the thermal system cannot cool them.')
      : 'No instruments require active cooling.',
    fix: 'Fit an active loop or a cryocooler.' })


  const finest = instruments.length ? Math.min.apply(null, instruments.map(i => i.pointingArcsec)) : null
  checks.push({ id: 'pointing', passed: finest === null || components.adcs.pointingArcsec <= finest,
    message: 'Tightest instrument requirement is ' + (finest === null ? 'n/a' : finest + ' arcsec') +
      '; attitude control delivers ' + components.adcs.pointingArcsec + ' arcsec.',
    fix: 'Upgrade attitude control, or drop the instrument that needs fine pointing.' })


  checks.push({ id: 'downlink', passed: dataR.returnFraction >= 0.5,
    message: 'Instruments generate ' + dataR.generatedGbPerDay.toFixed(1) + ' GB/day; the link returns ' +
      dataR.downlinkGbPerDay.toFixed(1) + ' GB/day (' + Math.round(dataR.returnFraction * 100) +
      '% of science reaches the ground).',
    fix: 'Fit a higher-rate link, reduce duty cycle, or choose an orbit with more contact time.' })


  checks.push({ id: 'budget', passed: budget.margin >= 0,
    message: 'Mission costs $' + budget.totalUsdM.toFixed(0) + 'M against a $' + objective.budgetUsdM +
      'M budget (' + Math.round(budget.margin * 100) + '% margin).',
    fix: 'Choose a cheaper launcher or descope an instrument.' })


  const relevant = instruments.filter(i => matchValue(i, objective) > 0)
  const hasRequired = objective.requiredMeasurements.some(m => instruments.some(i => i.type === m))
  checks.push({ id: 'science-relevance', passed: relevant.length > 0 && hasRequired,
    message: relevant.length === 0
      ? 'None of your instruments measure anything this objective asked for.'
      : relevant.length + ' of ' + instruments.length + ' instruments contribute to this objective.',
    fix: 'This objective requires: ' + objective.requiredMeasurements.join(', ') + '.' })


  const hardFail = checks.some(c => !c.passed)
  const score = computeScore({ instruments, objective, dataResult: dataR, lifetimeYears, margins, budget })
  const events = hardFail ? []
    : runEvents({ config, margins, adcsRedundant: components.adcs.redundant, difficulty: config.difficulty })
  const eventsFailed = events.filter(e => !e.survived).length
  const riskMultiplier = hardFail ? 0 : Math.max(0.2, 1 - eventsFailed * 0.22)
  const finalScore = Math.max(0,
    Math.round(score.scienceScore * riskMultiplier + score.marginBonus + score.efficiencyBonus))


  return {
    flies: !hardFail,
    checks, margins, events,
    mass: Object.assign({}, mass, { propKg, wetKg, capacityKg }),
    deltaV: dv, power, data: dataR, budget,
    score: Object.assign({}, score, { riskMultiplier, final: finalScore }),
    analogue: objective.analogue,
    summary: hardFail
      ? 'This design does not fly. ' + checks.filter(c => !c.passed).length + ' constraint(s) violated.'
      : 'Mission flies. ' + (eventsFailed === 0
        ? 'All in-flight events survived.'
        : eventsFailed + ' event(s) degraded the mission.') + ' Final score ' + finalScore + '.',
  }
}
