// A saved mission is a file that will come back from somewhere else - a USB
// stick, a teammate, an older build, a text editor somebody "improved". Every
// id in it reaches runMission, which throws on an id it does not know, so the
// loader is the boundary and these are its assertions.

import { runMission } from '../src/sim/runMission.js'
import { buildMissionFile, parseMissionFile, missionFileName, FILE_KIND, FILE_VERSION }
  from '../src/share/missionFile.js'

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
const rejects = (text, fragment, what) => {
  let msg = null
  try { parseMissionFile(typeof text === 'string' ? text : JSON.stringify(text)) }
  catch (e) { msg = e.message }
  const good = msg !== null && (!fragment || msg.toLowerCase().includes(fragment.toLowerCase()))
  console.log(`   ${good ? 'OK  ' : 'FAIL'} ${what}${msg ? ' -> "' + msg.slice(0, 64) + '"' : ' -> accepted!'}`)
  if (!good) failures++
}

const CONFIG = {
  objectiveId: 'mars_recon', orbitId: 'mars', launcherId: 'atlas5',
  instrumentIds: ['terrain_camera', 'hyperspectral'],
  components: { array: 'array_xl', battery: 'batt_l', comms: 'comms_ka', adcs: 'adcs_fine',
    propulsion: 'prop_bi', thermal: 'therm_active', obc: 'obc_rad', structure: 'struct_large' },
  lifetimeYears: 6, level: 'director',
}

console.log('\n=== A SAVED MISSION COMES BACK AS THE SAME MISSION')
{
  const result = runMission(CONFIG)
  const file = buildMissionFile({ config: CONFIG, result })
  const text = JSON.stringify(file, null, 2)
  const back = parseMissionFile(text)

  is(JSON.stringify(back.config), JSON.stringify(CONFIG), 'the config round trips exactly')
  is(file.kind, FILE_KIND, 'the file identifies itself')
  is(file.version, FILE_VERSION, 'and carries a version')
  ok(file.savedAt && file.name, 'it records when it was saved and what it is called')
  ok(file.snapshot && file.snapshot.score === result.score.final,
    'it carries a readable snapshot of the result')
  ok(text.length < 20000, 'the file stays small enough to paste into a message')

  const rerun = runMission(back.config)
  is(rerun.score.final, result.score.final, 'reloading reproduces the score exactly')
  is(rerun.flies, result.flies, 'and the verdict')
  ok(missionFileName(CONFIG).endsWith('.json'), 'the download has a .json name')
  ok(/mission-architect-mars-surface-reconnaissance-\d{4}-\d{2}-\d{2}\.json/.test(missionFileName(CONFIG)),
    'named after the objective and the date: ' + missionFileName(CONFIG))
}

console.log('\n=== THE SNAPSHOT IS FOR READING, NEVER FOR TRUSTING')
{
  const result = runMission(CONFIG)
  const file = buildMissionFile({ config: CONFIG, result })
  file.snapshot.score = 999999
  file.snapshot.flies = true
  const back = parseMissionFile(JSON.stringify(file))
  const rerun = runMission(back.config)
  is(rerun.score.final, result.score.final, 'a hand-edited score in the file changes nothing')
  ok(!('snapshot' in back), 'the loader does not even return the snapshot')
}

console.log('\n=== A FILE FROM ANYWHERE ELSE IS REFUSED WITH A REASON')
{
  rejects('{not json', 'valid json', 'truncated JSON')
  rejects('null', 'does not contain', 'a file containing null')
  rejects({ kind: 'something/else', config: CONFIG }, 'not a mission architect', 'another app’s file')
  rejects({ kind: FILE_KIND, version: 99, config: CONFIG }, 'newer version', 'a file from a future build')
  rejects({ config: { ...CONFIG, objectiveId: 'mine_the_moon' } }, 'unknown objective', 'an invented objective')
  rejects({ config: { ...CONFIG, orbitId: 'pluto' } }, 'unknown orbit', 'an invented orbit')
  rejects({ config: { ...CONFIG, launcherId: 'big_rocket' } }, 'unknown launch vehicle', 'an invented launcher')
  rejects({ config: { ...CONFIG, instrumentIds: ['death_ray'] } }, 'unknown instrument', 'an invented instrument')
  rejects({ config: { ...CONFIG, instrumentIds: 'multispectral_imager' } }, 'not a list',
    'an instrument list that is a string')
  rejects({ config: { ...CONFIG, components: { ...CONFIG.components, array: 'array_xxl' } } },
    'unknown array', 'an invented component')
  rejects({ config: { ...CONFIG, components: null } }, 'bus is missing', 'a missing bus')
  rejects({ config: { ...CONFIG, lifetimeYears: 400 } }, 'between 1 and 12', 'an absurd lifetime')
  rejects({ config: { ...CONFIG, lifetimeYears: 'five' } }, 'between 1 and 12', 'a lifetime that is a word')
  rejects({ config: { ...CONFIG, level: 'god' } }, 'unknown difficulty', 'an invented difficulty')
}

console.log('\n=== NOTHING ELSE IN THE FILE REACHES THE APPLICATION')
{
  const hostile = {
    kind: FILE_KIND, version: 1, name: 'x'.repeat(500),
    config: { ...CONFIG, evil: 'payload', __proto__: { polluted: true }, onLoad: 'alert(1)' },
  }
  const back = parseMissionFile(JSON.stringify(hostile))
  ok(!('evil' in back.config), 'an unknown field is dropped rather than carried into state')
  ok(!('onLoad' in back.config), 'and so is anything that looks like a handler')
  is(Object.keys(back.config).sort().join(),
    'components,instrumentIds,launcherId,level,lifetimeYears,objectiveId,orbitId',
    'the config is rebuilt field by field from a known list')
  is(({}).polluted, undefined, 'the object prototype is not polluted by a crafted file')
  ok(back.name.length <= 80, 'an over-long name is truncated')

  const bare = parseMissionFile(JSON.stringify(CONFIG))
  is(bare.config.objectiveId, CONFIG.objectiveId, 'a bare config with no wrapper still loads')
}

console.log(failures === 0 ? '\nALL MISSION FILE CHECKS PASS\n' : '\n' + failures + ' MISSION FILE CHECK(S) FAILED\n')
process.exit(failures === 0 ? 0 : 1)
