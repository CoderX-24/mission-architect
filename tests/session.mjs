// The session protocol is the only thing standing between four people and one
// config object. These assertions are about authority: who may change what,
// what happens when two people want the same role, and whether a player can
// reach a field that is not theirs.

import {
  createState, reduce, scopeFor, standings, freeRoles, makeCode, isValidCode,
  normaliseCode, phasesOwnedBy, fieldsOwnedBy, ownerOfPhase, MODES, PHASE_FIELDS,
} from '../src/net/protocol.js'
import ROLES from '../src/data/roles.json' with { type: 'json' }

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

const CONFIG = {
  objectiveId: 'forest_biomass', orbitId: 'leo_sso', launcherId: 'rideshare',
  instrumentIds: ['multispectral_imager'],
  components: { array: 'array_m', battery: 'batt_m', comms: 'comms_x', adcs: 'adcs_fine',
    propulsion: 'prop_mono', thermal: 'therm_passive', obc: 'obc_basic', structure: 'struct_small' },
  lifetimeYears: 5,
}
const fresh = (mode = 'coop', maxPlayers = 4) => createState({
  code: 'ABC12', mode, maxPlayers, level: 'engineer',
  hostId: 'host', hostName: 'Flight', config: CONFIG,
})

console.log('\n=== CODES ARE READ OUT LOUD, SO THEY AVOID AMBIGUOUS CHARACTERS')
{
  for (let i = 0; i < 200; i++) {
    const c = makeCode()
    if (!/^[A-HJ-NP-Z2-9]{5}$/.test(c)) { failures++; console.log('   FAIL bad code ' + c); break }
  }
  ok(true, '200 generated codes contain no O, 0, I or 1')
  is(isValidCode('ABC12'), true, 'a five character code is valid')
  is(isValidCode('ABC1'), false, 'a short code is not')
  is(normaliseCode(' ab-c12xx '), 'ABC12', 'typed input is cleaned up to five characters')
}

console.log('\n=== OWNERSHIP COMES FROM roles.json, NOT FROM A SECOND LIST')
{
  ok(ROLES.every(r => r.owns.every(p => PHASE_FIELDS[p])),
    'every phase a role owns has fields mapped to it')
  is(phasesOwnedBy('engineer').join(','), 'spacecraft', 'the engineer owns the spacecraft screen')
  is(fieldsOwnedBy('planner').sort().join(','), 'launcherId,objectiveId,orbitId',
    'the planner owns objective, orbit and launcher')
  is(ownerOfPhase('payload').id, 'science', 'the payload screen belongs to Science')
  is(ownerOfPhase('trade'), null, 'shared screens belong to nobody')
}

console.log('\n=== JOINING, AND THE LIMITS ON IT')
{
  let s = fresh('coop', 2)
  s = reduce(s, { t: 'join', name: 'Dev' }, 'p2')
  is(s.players.length, 2, 'a second player joins')
  const full = reduce(s, { t: 'join', name: 'Third' }, 'p3')
  is(full._reject, 'This session is full.', 'a third is turned away from a two-player session')
  is(full.players.length, 2, 'and is not added')

  let t = fresh()
  t = reduce(t, { t: 'join', name: 'Dev' }, 'p2')
  t = reduce(t, { t: 'claimRole', roleId: 'science' }, 'p2')
  const clash = reduce(t, { t: 'claimRole', roleId: 'science' }, 'host')
  ok(String(clash._reject).includes('already has that role'), 'two players cannot share a role')
  is(freeRoles(t).length, 3, 'three roles are still free')
  const released = reduce(t, { t: 'claimRole', roleId: null }, 'p2')
  is(released.players.find(p => p.id === 'p2').roleId, null, 'a role can be released')
}

console.log('\n=== ONLY THE HOST STARTS THE MISSION OR SETS THE LEVEL')
{
  let s = reduce(fresh(), { t: 'join', name: 'Dev' }, 'p2')
  is(reduce(s, { t: 'start' }, 'p2').started, false, 'a player cannot start the session')
  is(reduce(s, { t: 'start' }, 'host').started, true, 'the host can')
  is(reduce(s, { t: 'level', level: 'director' }, 'p2').level, 'engineer', 'a player cannot change the level')
  const lifted = reduce(s, { t: 'level', level: 'director' }, 'host')
  is(lifted.level, 'director', 'the host can')
  is(lifted.config.level, 'director', 'and it reaches the mission config')
}

console.log('\n=== A PLAYER CANNOT TOUCH A FIELD THAT IS NOT THEIRS')
{
  let s = fresh()
  s = reduce(s, { t: 'join', name: 'Dev' }, 'p2')
  s = reduce(s, { t: 'claimRole', roleId: 'science' }, 'p2')
  s = reduce(s, { t: 'claimRole', roleId: 'engineer' }, 'host')
  s = reduce(s, { t: 'start' }, 'host')

  const legal = reduce(s, { t: 'patch', patch: { instrumentIds: ['sar'] } }, 'p2')
  is(legal.config.instrumentIds.join(), 'sar', 'Science may change the payload')

  const illegal = reduce(s, { t: 'patch', patch: { components: { array: 'array_xl' } } }, 'p2')
  ok(String(illegal._reject).includes('do not control'), 'Science may not rebuild the bus')
  is(illegal.config.components.array, 'array_m', 'and the bus is untouched')

  const sneaky = reduce(s, { t: 'patch', patch: { instrumentIds: ['sar'], orbitId: 'mars' } }, 'p2')
  ok(Boolean(sneaky._reject), 'a patch mixing a legal and an illegal field is refused')
  is(sneaky.config.orbitId, 'leo_sso', 'the whole patch is refused, not half applied')

  const beforeStart = reduce(fresh(), { t: 'patch', patch: { orbitId: 'mars' } }, 'host')
  is(beforeStart.config.orbitId, 'leo_sso', 'nothing can be patched before the mission starts')
}

console.log('\n=== SCOPES MATCH THE OWNERSHIP THE PROTOCOL ENFORCES')
{
  let s = fresh()
  s = reduce(s, { t: 'join', name: 'Dev' }, 'p2')
  s = reduce(s, { t: 'claimRole', roleId: 'science' }, 'p2')
  const sc = scopeFor(s, 'p2')
  is(sc.owned.join(), 'payload', 'Science sees the payload screen as theirs')
  ok(sc.locked.includes('spacecraft') && sc.locked.includes('orbit'), 'the rest are locked')
  ok(sc.shared.includes('trade') && sc.shared.includes('debrief'), 'shared views stay open')
  ok(sc.owned.every(p => fieldsOwnedBy('science').some(f => PHASE_FIELDS[p].includes(f))),
    'what you can see matches what you can change')
}

console.log('\n=== HEAD TO HEAD: YOUR OWN MISSION, THE HOST’S OBJECTIVE')
{
  let s = fresh('versus')
  s = reduce(s, { t: 'join', name: 'Dev' }, 'p2')
  s = reduce(s, { t: 'start' }, 'host')
  is(Object.keys(s.configs).length, 2, 'every player gets their own copy of the mission')

  s = reduce(s, { t: 'patch', patch: { components: { array: 'array_xl' } } }, 'p2')
  is(s.configs.p2.components.array, 'array_xl', 'a player may change anything in their own design')
  is(s.configs.host.components.array, 'array_m', 'and it does not touch anyone else’s')

  const sc = scopeFor(s, 'p2')
  ok(!sc.owned.includes('objective'), 'nobody owns the objective in a contest')
  ok(sc.locked.includes('objective'), 'the objective is locked so the scores compare')
}

console.log('\n=== RESULTS, STANDINGS AND NOTES')
{
  let s = fresh('versus')
  s = reduce(s, { t: 'join', name: 'Dev' }, 'p2')
  s = reduce(s, { t: 'start' }, 'host')
  s = reduce(s, { t: 'result', score: 900, flies: true }, 'p2')
  s = reduce(s, { t: 'result', score: 1400, flies: true }, 'host')
  const table = standings(s)
  is(table[0].score, 1400, 'the leaderboard is sorted by score')
  is(table[0].name, 'Flight', 'and names the player')
  is(s.finished, true, 'a reported result finishes the session')

  s = reduce(s, { t: 'feedback', rating: 9, note: 'x'.repeat(900) }, 'p2')
  is(s.feedback.p2.rating, 5, 'a rating is clamped to five')
  is(s.feedback.p2.note.length, 500, 'a note is truncated rather than stored whole')

  const gone = reduce(s, { t: 'leave' }, 'p2')
  is(gone.players.length, 1, 'leaving removes the player')
  ok(s.log.length > 0 && s.log.every(l => l.text), 'the session keeps a readable activity log')
}

console.log('\n=== UNKNOWN MESSAGES ARE IGNORED, NOT CRASHED ON')
{
  const s = fresh()
  is(reduce(s, { t: 'nonsense' }, 'host').players.length, 1, 'an unknown message changes nothing')
  is(reduce(s, { t: 'claimRole', roleId: 'wizard' }, 'host').players[0].roleId, null,
    'an invented role is refused')
  ok(MODES.length >= 2 && MODES.every(m => m.blurb), 'every mode explains itself')
}

console.log(failures === 0 ? '\nALL SESSION CHECKS PASS\n' : '\n' + failures + ' SESSION CHECK(S) FAILED\n')
process.exit(failures === 0 ? 0 : 1)
