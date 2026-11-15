// ArchitectX claims two things on screen: that it is not a language model, and
// that the numbers it quotes come from the engine rather than from prose
// somebody wrote. The second claim is the one that can rot, so these tests
// check the answers against a freshly run mission every time.

import { runMission } from '../src/sim/runMission.js'
import { applyDifficulty } from '../src/sim/difficulty.js'
import { designOutpost } from '../src/sim/outpost.js'
import {
  TOPICS, GROUPS, ask, buildContext, suggestionsFor, tokenise, ASSISTANT_NAME,
} from '../src/help/architectx.js'

let failures = 0
const is = (a, b, what) => {
  const ok = Object.is(a, b)
  console.log(`   ${ok ? 'OK  ' : 'FAIL'} ${what}: ${JSON.stringify(a)} === ${JSON.stringify(b)}`)
  if (!ok) failures++
}
const ok = (cond, what) => {
  console.log(`   ${cond ? 'OK  ' : 'FAIL'} ${what}`)
  if (!cond) failures++
}

const CONFIGS = {
  DEFAULT: {
    objectiveId: 'forest_biomass', orbitId: 'leo_sso', launcherId: 'rideshare',
    instrumentIds: ['multispectral_imager', 'lidar_altimeter'],
    components: { array: 'array_m', battery: 'batt_m', comms: 'comms_x', adcs: 'adcs_fine',
      propulsion: 'prop_mono', thermal: 'therm_passive', obc: 'obc_basic', structure: 'struct_small' },
    lifetimeYears: 5,
  },
  STARVED: {
    objectiveId: 'forest_biomass', orbitId: 'leo_sso', launcherId: 'rideshare',
    instrumentIds: ['multispectral_imager', 'lidar_altimeter'],
    components: { array: 'array_s', battery: 'batt_s', comms: 'comms_s', adcs: 'adcs_coarse',
      propulsion: 'prop_cold', thermal: 'therm_passive', obc: 'obc_basic', structure: 'struct_cubesat' },
    lifetimeYears: 5,
  },
  MARS: {
    objectiveId: 'mars_recon', orbitId: 'mars', launcherId: 'atlas5',
    instrumentIds: ['terrain_camera', 'hyperspectral'],
    components: { array: 'array_xl', battery: 'batt_l', comms: 'comms_ka', adcs: 'adcs_fine',
      propulsion: 'prop_bi', thermal: 'therm_active', obc: 'obc_rad', structure: 'struct_large' },
    lifetimeYears: 6, level: 'director',
  },
  MAXED: {
    objectiveId: 'deep_sky_survey', orbitId: 'geo', launcherId: 'falcon9',
    instrumentIds: ['wide_field_camera', 'nir_spectrograph'],
    components: { array: 'array_xl', battery: 'batt_l', comms: 'comms_laser', adcs: 'adcs_fine',
      propulsion: 'prop_ion', thermal: 'therm_cryo', obc: 'obc_rad', structure: 'struct_large' },
    lifetimeYears: 7, level: 'cadet',
  },
}

const ctxFor = config => {
  const result = runMission(config)
  const diff = applyDifficulty({ config, result })
  return buildContext({ config, result, diff, outpost: designOutpost({ config, result }) })
}

console.log('\n=== EVERY TOPIC IS WELL FORMED')
{
  const ids = new Set()
  for (const t of TOPICS) {
    if (ids.has(t.id)) { failures++; console.log('   FAIL duplicate topic id ' + t.id) }
    ids.add(t.id)
    if (!t.q || !t.q.endsWith('?')) { failures++; console.log('   FAIL topic ' + t.id + ' has no question') }
    if (!GROUPS.includes(t.group)) { failures++; console.log('   FAIL topic ' + t.id + ' has an unknown group') }
    if (!(t.phrases || []).length && !(t.keywords || []).length) {
      failures++; console.log('   FAIL topic ' + t.id + ' can never be matched')
    }
  }
  ok(TOPICS.length >= 20, TOPICS.length + ' topics written')
  ok(ids.size === TOPICS.length, 'every topic id is unique')
}

console.log('\n=== NO ANSWER THROWS, OR LEAKS AN undefined, FOR ANY DESIGN')
for (const [name, config] of Object.entries(CONFIGS)) {
  const ctx = ctxFor(config)
  let bad = 0
  for (const t of TOPICS) {
    let a
    try { a = t.answer(ctx) }
    catch (e) { bad++; console.log('   FAIL ' + t.id + ' threw on ' + name + ': ' + e.message); continue }
    const text = [...(a.lines || []), ...(a.bullets || []), a.ctxNote || ''].join(' ')
    if (!a.lines || !a.lines.length) { bad++; console.log('   FAIL ' + t.id + ' produced no prose') }
    if (/undefined|NaN|\[object/.test(text)) {
      bad++; console.log('   FAIL ' + t.id + ' leaked a broken value on ' + name)
    }
  }
  failures += bad
  ok(bad === 0, name + ': all ' + TOPICS.length + ' answers built cleanly')
}

console.log('\n=== QUESTIONS REACH THE TOPIC A PERSON MEANT')
{
  const ctx = ctxFor(CONFIGS.STARVED)
  const expect = [
    ['why does my mission not fly', 'why-not-fly'],
    ['whats wrong with my design', 'why-not-fly'],
    ['how do I get more power', 'more-power'],
    ['my array is too small', 'more-power'],
    ['I am losing science, downlink is bad', 'more-data'],
    ['what is margin', 'what-is-margin'],
    ['why am I penalised for too much margin', 'overdesign'],
    ['are the solar storms real', 'donki'],
    ['what is donki', 'donki'],
    ['how do I play with friends', 'multiplayer'],
    ['can I play multiplayer', 'multiplayer'],
    ['who made this', 'who'],
    ['are you chatgpt', 'what-am-i'],
    ['how do I save my design', 'save'],
    ['what is the surface segment', 'outpost'],
    ['how is the score calculated', 'scoring'],
    ['what are the difficulty levels', 'levels'],
    ['am I over budget', 'over-budget'],
    ['why is mars so hard', 'mars'],
    ['is this an official nasa tool', 'official'],
  ]
  let hits = 0
  for (const [q, id] of expect) {
    const res = ask(q, ctx)
    const got = res.topic ? res.topic.id : res.kind
    if (got === id) hits++
    else console.log(`   FAIL "${q}" -> ${got}, expected ${id}`)
  }
  is(hits, expect.length, hits + ' of ' + expect.length + ' questions routed correctly')
}

console.log('\n=== IT SAYS SO WHEN IT DOES NOT KNOW')
{
  const ctx = ctxFor(CONFIGS.DEFAULT)
  for (const q of ['banana sandwich', 'what is the weather in london', 'sing me a song']) {
    const res = ask(q, ctx)
    ok(res.kind === 'unknown', '"' + q + '" is refused rather than guessed at')
    ok(res.suggestions.length > 0, '  and it offers the closest topics instead')
  }
  const empty = ask('', ctx)
  is(empty.kind, 'empty', 'an empty question is handled')
}

console.log('\n=== THE NUMBERS COME FROM THE ENGINE, NOT FROM THE PROSE')
{
  const config = CONFIGS.STARVED
  const result = runMission(config)
  const ctx = ctxFor(config)

  const why = ask('why does my mission not fly', ctx)
  const failed = result.checks.filter(c => !c.passed)
  ok(failed.length > 0, 'this test design genuinely fails ' + failed.length + ' checks')
  ok(why.answer.bullets.length === failed.length,
    'the answer lists exactly the failing checks, not a canned list')
  ok(why.answer.bullets[0].includes(failed[0].message),
    'and quotes the engine’s own wording for the first one')

  const power = ask('how do I get more power', ctx)
  const text = power.answer.lines.join(' ')
  ok(text.includes(String(Math.round(result.power.orbitAvgW))),
    'the power answer quotes the real orbit-average wattage (' + Math.round(result.power.orbitAvgW) + ' W)')
  ok(text.includes(String(Math.round(result.power.loadW))),
    'and the real load (' + Math.round(result.power.loadW) + ' W)')

  // The upgrade it recommends must match what the engine says that upgrade does.
  const upgraded = runMission({ ...config, components: { ...config.components, array: 'array_m' } })
  ok(power.answer.bullets.some(b => b.includes(Math.round(upgraded.margins.power * 100) + '%')),
    'the suggested upgrade quotes the margin the engine computes for it (' +
      Math.round(upgraded.margins.power * 100) + '%)')

  const weak = ask('what is my weakest margin', ctx)
  const thinnest = Object.entries(result.margins).sort((a, b) => a[1] - b[1])[0]
  ok(weak.answer.lines[0].toLowerCase().includes(thinnest[0] === 'deltaV' ? 'delta' : thinnest[0]),
    'the weakest margin answer names the actually thinnest margin (' + thinnest[0] + ')')
}

console.log('\n=== SUGGESTIONS FOLLOW THE DESIGN ON SCREEN')
{
  const broken = suggestionsFor(ctxFor(CONFIGS.STARVED)).map(t => t.id)
  const fine = suggestionsFor(ctxFor(CONFIGS.DEFAULT)).map(t => t.id)
  ok(broken.includes('why-not-fly'), 'a failing design is offered "why does my mission not fly" first')
  ok(!fine.includes('why-not-fly'), 'a working design is not')
  ok(fine.length >= 4 && fine.length <= 6, 'a sensible number of suggestions is offered')
  ok(new Set(broken).size === broken.length, 'suggestions are not repeated')
}

console.log('\n=== HOUSEKEEPING')
{
  is(ASSISTANT_NAME, 'ArchitectX', 'the assistant has a name')
  is(tokenise('How do I get more POWER?!').join(','), 'get,more,power', 'stop words are dropped')
  const credit = TOPICS.find(t => t.id === 'who').answer({}).lines.join(' ')
  ok(credit.includes('Doon-Dev') && credit.includes('Ranveer') && credit.includes('Vibhor'),
    'the team is credited in the assistant')
  const honest = TOPICS.find(t => t.id === 'what-am-i').answer({}).lines.join(' ')
  ok(/not a language model/i.test(honest), 'it states plainly that it is not a language model')
  const official = TOPICS.find(t => t.id === 'official').answer({}).lines.join(' ')
  ok(/not NASA software/i.test(official), 'and that this is not NASA software')
}

console.log(failures === 0 ? '\nALL ARCHITECTX CHECKS PASS\n' : '\n' + failures + ' ARCHITECTX CHECK(S) FAILED\n')
process.exit(failures === 0 ? 0 : 1)
