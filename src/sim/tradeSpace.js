// ============================================================================
// tradeSpace.js - exhaustive trade study.
//
// Real mission design is not "build one spacecraft and check it". It is a
// trade study: enumerate the options, find the efficient frontier, and argue
// about where on that frontier to sit. runMission is pure and costs about
// 0.013 ms, so the entire bus design space - every combination of array,
// battery, comms, attitude control, propulsion, thermal, computer and
// structure - can be enumerated exhaustively in well under a second.
//
// Nothing is sampled, approximated or randomised. This is the whole space.
// ============================================================================

import COMPONENTS from '../data/components.json' with { type: 'json' }
import { runMission } from './runMission.js'

const GROUPS = Object.keys(COMPONENTS)

export function totalCombinations() {
  return GROUPS.reduce((n, g) => n * COMPONENTS[g].length, 1)
}

/**
 * Enumerate every bus configuration for the player's current payload, orbit,
 * launcher and lifetime. Those are held fixed because they are decided on
 * other tabs; this is the Spacecraft tab's decision space.
 */
export function sweep(config) {
  const idx = GROUPS.map(() => 0)
  const flying = []
  let evaluated = 0
  let done = false

  while (!done) {
    const components = {}
    for (let i = 0; i < GROUPS.length; i++) {
      components[GROUPS[i]] = COMPONENTS[GROUPS[i]][idx[i]].id
    }

    const r = runMission(Object.assign({}, config, { components }))
    evaluated++

    if (r.flies) {
      flying.push({
        components,
        cost: r.budget.totalUsdM,
        score: r.score.final,
        margins: r.margins,
        massKg: r.mass.wetKg,
      })
    }

    let k = GROUPS.length - 1
    while (k >= 0) {
      idx[k]++
      if (idx[k] < COMPONENTS[GROUPS[k]].length) break
      idx[k] = 0
      k--
    }
    if (k < 0) done = true
  }

  return { evaluated, flying }
}

/**
 * The efficient frontier: designs where nothing else is both cheaper and
 * higher scoring. Walking up in cost, keep each design that beats everything
 * cheaper than it.
 */
export function paretoFront(flying) {
  const sorted = flying.slice().sort((a, b) => a.cost - b.cost || b.score - a.score)
  const front = []
  let best = -Infinity
  for (const p of sorted) {
    if (p.score > best) { front.push(p); best = p.score }
  }
  return front
}

const sameBus = (a, b) => GROUPS.every(g => a[g] === b[g])

/**
 * Where the player's own design sits in the space, and what the trade study
 * has to say about it.
 */
export function locate(config, result, study, front) {
  const mine = { cost: result.budget.totalUsdM, score: result.score.final }

  // Designs that are at least as good on BOTH axes and strictly better on one.
  const dominating = study.flying.filter(p =>
    !sameBus(p.components, config.components) &&
    p.score >= mine.score && p.cost <= mine.cost &&
    (p.score > mine.score || p.cost < mine.cost))

  // Pareto-optimal means nothing dominates it. Matching against the drawn
  // frontier list is NOT equivalent: where several buses tie on both cost and
  // score, the list keeps one of them, and the others are just as optimal.
  const onFront = study.flying.length > 0 && dominating.length === 0

  // Cheapest design that scores at least as well.
  const cheaperSame = study.flying
    .filter(p => p.score >= mine.score && p.cost < mine.cost)
    .sort((a, b) => a.cost - b.cost)[0] || null

  // Best score reachable without spending more than the player already does.
  const betterSame = study.flying
    .filter(p => p.cost <= mine.cost && p.score > mine.score)
    .sort((a, b) => b.score - a.score)[0] || null

  const bestOverall = study.flying.slice().sort((a, b) => b.score - a.score)[0] || null

  return { mine, onFront, dominating, cheaperSame, betterSame, bestOverall }
}

/** Human-readable diff between two buses, for explaining a suggestion. */
export function busDiff(from, to) {
  const out = []
  for (const g of GROUPS) {
    if (from[g] === to[g]) continue
    const a = COMPONENTS[g].find(c => c.id === from[g])
    const b = COMPONENTS[g].find(c => c.id === to[g])
    if (a && b) out.push({ group: g, from: a.name, to: b.name })
  }
  return out
}
