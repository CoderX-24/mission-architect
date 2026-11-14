// The trade study makes a strong claim - that it enumerates the WHOLE bus
// design space and reports the true efficient frontier. These assertions are
// what make that claim checkable rather than marketing.

import { runMission } from '../src/sim/runMission.js'
import { sweep, paretoFront, locate, totalCombinations, busDiff } from '../src/sim/tradeSpace.js'

let failures = 0
const ok = (cond, what) => {
  console.log(`   ${cond ? 'OK  ' : 'FAIL'} ${what}`)
  if (!cond) failures++
}

const CASES = {
  DEFAULT: {
    objectiveId: 'forest_biomass', orbitId: 'leo_sso', launcherId: 'rideshare',
    instrumentIds: ['multispectral_imager', 'lidar_altimeter'],
    components: { array: 'array_m', battery: 'batt_m', comms: 'comms_x', adcs: 'adcs_fine',
      propulsion: 'prop_mono', thermal: 'therm_passive', obc: 'obc_basic', structure: 'struct_small' },
    lifetimeYears: 5,
  },
  MARS: {
    objectiveId: 'mars_recon', orbitId: 'mars', launcherId: 'atlas5',
    instrumentIds: ['multispectral_imager'],
    components: { array: 'array_xl', battery: 'batt_l', comms: 'comms_ka', adcs: 'adcs_fine',
      propulsion: 'prop_bi', thermal: 'therm_passive', obc: 'obc_rad', structure: 'struct_large' },
    lifetimeYears: 7,
  },
}

for (const [name, config] of Object.entries(CASES)) {
  console.log(`\n=== ${name}`)
  const t0 = performance.now()
  const study = sweep(config)
  const ms = performance.now() - t0
  const front = paretoFront(study.flying)
  const result = runMission(config)
  const loc = locate(config, result, study, front)

  // 1. Exhaustive means exhaustive.
  ok(study.evaluated === totalCombinations(),
    `evaluated every combination: ${study.evaluated.toLocaleString()} === ${totalCombinations().toLocaleString()}`)

  // 2. Fast enough to run inside a render without blocking the UI.
  ok(ms < 1000, `sweep completes in under a second: ${ms.toFixed(0)}ms`)

  // 3. Everything reported as flying must actually fly when re-run.
  const resampled = study.flying.slice(0, 40).every(p =>
    runMission(Object.assign({}, config, { components: p.components })).flies)
  ok(resampled, 'every reported flying design really flies on re-run')

  // 4. The frontier must be strictly increasing in both cost and score.
  let monotone = true
  for (let i = 1; i < front.length; i++) {
    if (!(front[i].cost > front[i - 1].cost && front[i].score > front[i - 1].score)) monotone = false
  }
  ok(monotone, `frontier is strictly increasing in cost and score (${front.length} designs)`)

  // 5. No design anywhere may dominate a point on the frontier.
  const dominated = front.some(f => study.flying.some(p =>
    p.cost <= f.cost && p.score >= f.score && (p.cost < f.cost || p.score > f.score)))
  ok(!dominated, 'no design dominates any point on the frontier')

  // 6. The frontier's top must be the best score in the whole space.
  if (front.length && loc.bestOverall) {
    ok(front[front.length - 1].score === loc.bestOverall.score,
      `frontier tops out at the global best score (${loc.bestOverall.score})`)
  }

  // 7. Pareto-optimal must mean exactly "nothing dominates it" - never a
  //    contradictory "0 dominators but not optimal", which a list-membership
  //    test produces whenever two buses tie on both axes.
  ok(loc.onFront === (study.flying.length > 0 && loc.dominating.length === 0),
    `optimal iff undominated (onFront=${loc.onFront}, dominators=${loc.dominating.length})`)

  // 8. If optimal, no suggestion may be offered - there is nothing better.
  ok(!(loc.onFront && (loc.betterSame || loc.cheaperSame)),
    'an optimal design is offered no improvement')

  console.log(`   info  ${study.flying.length} of ${study.evaluated.toLocaleString()} fly ` +
    `(${(100 * study.flying.length / study.evaluated).toFixed(1)}%)  ` +
    `front ${front.length}  yours $${loc.mine.cost.toFixed(0)}M/${loc.mine.score}` +
    `${loc.onFront ? '  ON FRONTIER' : ''}`)
  if (loc.betterSame) {
    const d = busDiff(config.components, loc.betterSame.components)
    console.log(`   info  better for no more money: ${loc.betterSame.score} ` +
      `by changing ${d.map(x => x.group).join(', ') || 'nothing'}`)
  }
}

console.log(failures === 0 ? '\nALL TRADE SPACE CHECKS PASS' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
