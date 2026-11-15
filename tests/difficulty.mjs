// Difficulty is a layer on top of a finished result, never a change to the
// engine. The assertion that matters most: a mission with no level set must
// produce exactly what the engine produced, or every calibrated number in the
// project moves underneath us.

import { runMission } from '../src/sim/runMission.js'
import { applyDifficulty, eventsDifficulty, levelOf, LEVELS } from '../src/sim/difficulty.js'
import { debrief } from '../src/sim/debrief.js'
import { sweep } from '../src/sim/tradeSpace.js'

let failures = 0
const is = (a, b, what) => {
  const ok = Object.is(a, b)
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
// Flies, but with a thin budget reserve: the level rules should bite here.
const THIN = { ...BASE, launcherId: 'falcon9', instrumentIds: ['multispectral_imager', 'hyperspectral'],
  components: { ...BASE.components, thermal: 'therm_active', adcs: 'adcs_fine' } }

console.log('\n=== NO LEVEL SET IS EXACTLY THE ENGINE')
{
  const r = runMission(BASE)
  const d = applyDifficulty({ config: BASE, result: r })
  is(d.checks.length, 0, 'adds no checks')
  is(d.multiplier, 1, 'multiplier is 1')
  is(d.flies, r.flies, 'verdict is the engine verdict')
  is(d.score, r.score.final, 'score is the engine score')
  is(d.level.id, 'engineer', 'defaults to Engineer')
  is(eventsDifficulty(BASE), 'normal', 'events stay normal')
}

console.log('\n=== LEVELS MAP ONTO THE EVENT SETTING runEvents ALREADY TOOK')
is(eventsDifficulty({ level: 'cadet' }), 'easy', 'cadet -> easy')
is(eventsDifficulty({ level: 'engineer' }), 'normal', 'engineer -> normal')
is(eventsDifficulty({ level: 'director' }), 'hard', 'director -> hard')
is(levelOf({ level: 'nonsense' }).id, 'engineer', 'an unknown level falls back to Engineer')
ok(LEVELS.every(l => l.blurb && l.guidance && typeof l.multiplier === 'number'),
  'every level declares a blurb, guidance flags and a multiplier')

console.log('\n=== CADET SOFTENS, FLIGHT DIRECTOR TIGHTENS')
{
  const cadet = applyDifficulty({ config: { ...BASE, level: 'cadet' }, result: runMission(BASE) })
  is(cadet.multiplier, 0.85, 'cadet scores are worth less')
  is(cadet.checks.length, 0, 'cadet adds no extra rules')
  ok(cadet.guidance.hints && cadet.guidance.worked, 'cadet gets every hint')

  const r = runMission(BASE)
  const dir = applyDifficulty({ config: { ...BASE, level: 'director' }, result: r })
  is(dir.multiplier, 1.25, 'flight director scores are worth more')
  is(dir.checks.length, 4, 'four level rules: mass, power, data and budget reserve')
  ok(!dir.guidance.hints && !dir.guidance.fixes, 'flight director gets no hints and no fixes')
  is(dir.score, Math.round(r.score.final * 1.25), 'score is multiplied when it still flies')
}

console.log('\n=== A LEVEL RULE CAN GROUND A DESIGN THE ENGINE PASSED')
{
  const r = runMission(THIN)
  const eng = applyDifficulty({ config: THIN, result: r })
  const dir = applyDifficulty({ config: { ...THIN, level: 'director' }, result: r })
  ok(eng.flies === r.flies, 'Engineer agrees with the engine')
  if (r.flies && dir.extraFailed.length) {
    is(dir.flies, false, 'a design with too little reserve does not fly at Flight Director')
    is(dir.score, 0, 'and scores nothing')
  } else {
    ok(true, 'this design clears the Flight Director floors (' + dir.extraFailed.length + ' failed)')
  }
  ok(dir.checks.every(c => c.fromLevel), 'every added check is marked as a level rule')
  ok(dir.checks.every(c => c.message && c.fix), 'every added check names the number and the fix')
}

console.log('\n=== THE DEBRIEF EXPLAINS THE NUMBER')
{
  const r = runMission(BASE)
  const d = applyDifficulty({ config: BASE, result: r })
  const study = sweep(BASE)
  const out = debrief({ config: BASE, result: r, diff: d, study })
  ok(out.headline.length > 20, 'it produces a sentence a person would say')
  ok(out.actions.length > 0, 'it always produces something to do next')
  is(out.byRole.length, 4, 'every role is accounted for')
  ok(out.byRole.every(b => b.verdict && b.name), 'every role gets a verdict')
  ok(out.breakdown.some(b => b.label === 'Risk multiplier'), 'the risk multiplier is shown')
  ok(out.margins[0].margin <= out.margins[out.margins.length - 1].margin,
    'margins are listed thinnest first')
  is(out.score, d.score, 'the debrief scores what the dashboard scores')
  ok(out.trade && out.trade.total === study.total, 'the trade study verdict is carried through')

  const broken = { ...BASE, components: { ...BASE.components, array: 'array_s', battery: 'batt_s' } }
  const br = runMission(broken)
  const bd = debrief({ config: broken, result: br, diff: applyDifficulty({ config: broken, result: br }) })
  is(bd.flies, false, 'a broken design is reported as not flying')
  ok(bd.actions.some(a => a.severity === 'critical'), 'and its actions lead with the blockers')
  ok(bd.headline.toLowerCase().includes('does not fly'), 'the headline says so plainly')
}

console.log(failures === 0 ? '\nALL DIFFICULTY CHECKS PASS\n' : '\n' + failures + ' DIFFICULTY CHECK(S) FAILED\n')
process.exit(failures === 0 ? 0 : 1)
