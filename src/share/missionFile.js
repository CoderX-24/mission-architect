// ============================================================================
// SAVING A MISSION TO DISK
//
// A shared link carries a mission between people. A file carries it between
// sessions, laptops and years, and does not depend on this site existing. The
// format is plain JSON a human can read and a spreadsheet can eat.
//
// Loading is the dangerous direction: the file came from somewhere else, so
// every id is validated against the catalogs before it is allowed near
// runMission, which crashes on an id it does not know (see HANDOVER gotchas).
// ============================================================================

import OBJECTIVES from '../data/objectives.json' with { type: 'json' }
import ORBITS from '../data/orbits.json' with { type: 'json' }
import LAUNCHERS from '../data/launchers.json' with { type: 'json' }
import INSTRUMENTS from '../data/instruments.json' with { type: 'json' }
import COMPONENTS from '../data/components.json' with { type: 'json' }
import { LEVELS } from '../sim/difficulty.js'

export const FILE_VERSION = 1
export const FILE_KIND = 'mission-architect/mission'

const GROUPS = ['array', 'battery', 'comms', 'adcs', 'propulsion', 'thermal', 'obc', 'structure']

const slug = s => String(s || 'mission').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

// What the file says, beyond the config itself: enough for a person opening it
// in a text editor a year from now to know what they are looking at.
export function buildMissionFile({ config, result, outpost = null, name = null }) {
  const objective = OBJECTIVES.find(o => o.id === config.objectiveId)
  const orbit = ORBITS.find(o => o.id === config.orbitId)
  return {
    kind: FILE_KIND,
    version: FILE_VERSION,
    savedAt: new Date().toISOString(),
    name: name || (objective ? objective.name : 'Mission'),
    app: 'Mission Architect - NASA Space Apps 2026',
    config,
    // A snapshot, for reading. Never read back in: the engine recomputes
    // everything from config on load, so a hand-edited snapshot cannot lie.
    snapshot: result ? {
      flies: result.flies,
      score: result.score.final,
      orbit: orbit ? orbit.name : null,
      margins: result.margins,
      wetMassKg: Math.round(result.mass.wetKg),
      powerEolW: Math.round(result.power.powerEOL),
      costUsdM: Math.round(result.budget.totalUsdM),
      dataReturnedFraction: result.data.returnFraction,
      failedChecks: result.checks.filter(c => !c.passed).map(c => c.message),
      outpost: outpost ? {
        site: outpost.site.name, class: outpost.cls.label,
        units: outpost.units, crew: outpost.crew.crew,
      } : null,
    } : null,
  }
}

export function missionFileName(config, name = null) {
  const objective = OBJECTIVES.find(o => o.id === config.objectiveId)
  const date = new Date().toISOString().slice(0, 10)
  return 'mission-architect-' + slug(name || (objective && objective.name)) + '-' + date + '.json'
}

// Browser-only: hand the file to the user's download folder.
export function downloadMission({ config, result, outpost = null, name = null }) {
  const data = buildMissionFile({ config, result, outpost, name })
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = missionFileName(config, name)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return data
}

// ---------------------------------------------------------------- loading ---

class LoadError extends Error {}
const fail = msg => { throw new LoadError(msg) }

// Validates hard, and says exactly what is wrong in a sentence a person can
// act on. An unknown component id reaches mass.js and throws there otherwise.
export function parseMissionFile(text) {
  let raw
  try { raw = JSON.parse(text) }
  catch { fail('That file is not valid JSON. It may have been edited or truncated.') }

  if (!raw || typeof raw !== 'object') fail('That file does not contain a mission.')
  if (raw.kind && raw.kind !== FILE_KIND) fail('That file is not a Mission Architect mission.')
  if (raw.version && Number(raw.version) > FILE_VERSION) {
    fail('That mission was saved by a newer version of Mission Architect (file version ' +
      raw.version + ', this build reads ' + FILE_VERSION + ').')
  }

  const c = raw.config || raw
  if (!c || typeof c !== 'object') fail('That file has no mission configuration in it.')

  if (!OBJECTIVES.some(o => o.id === c.objectiveId)) {
    fail('Unknown objective "' + c.objectiveId + '". This file may come from a different build.')
  }
  if (!ORBITS.some(o => o.id === c.orbitId)) fail('Unknown orbit "' + c.orbitId + '".')
  if (!LAUNCHERS.some(l => l.id === c.launcherId)) fail('Unknown launch vehicle "' + c.launcherId + '".')

  if (!Array.isArray(c.instrumentIds)) fail('The instrument list is missing or is not a list.')
  const badInstrument = c.instrumentIds.find(id => !INSTRUMENTS.some(i => i.id === id))
  if (badInstrument) fail('Unknown instrument "' + badInstrument + '".')

  if (!c.components || typeof c.components !== 'object') fail('The spacecraft bus is missing.')
  for (const g of GROUPS) {
    const id = c.components[g]
    if (!COMPONENTS[g].some(x => x.id === id)) {
      fail('Unknown ' + g + ' "' + id + '". Every subsystem must be one this build knows.')
    }
  }

  const years = Number(c.lifetimeYears)
  if (!Number.isFinite(years) || years < 1 || years > 12) {
    fail('Mission lifetime must be a whole number of years between 1 and 12.')
  }

  if (c.level && !LEVELS.some(l => l.id === c.level)) fail('Unknown difficulty level "' + c.level + '".')

  // Rebuilt field by field: nothing else from the file is trusted into state.
  const config = {
    objectiveId: c.objectiveId,
    orbitId: c.orbitId,
    launcherId: c.launcherId,
    instrumentIds: c.instrumentIds.slice(),
    components: Object.fromEntries(GROUPS.map(g => [g, c.components[g]])),
    lifetimeYears: Math.round(years),
  }
  if (c.level) config.level = c.level

  return { config, name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : null,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : null }
}

export function readMissionFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('That file could not be read.'))
    reader.onload = () => {
      try { resolve(parseMissionFile(String(reader.result))) }
      catch (e) { reject(e) }
    }
    reader.readAsText(file)
  })
}
