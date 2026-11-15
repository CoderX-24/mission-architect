// ============================================================================
// POST-MISSION ANALYSIS
//
// A score is a number. A debrief is the reason for the number, and the three
// things you would do differently. Everything here is derived from results
// that already exist - the engine, the difficulty layer, the trade study, the
// DONKI assessment and the surface segment - and nothing here re-derives
// physics of its own.
//
// In a team session it also attributes outcomes to the role that owned the
// decision, using the same roles.json ownership the screens are scoped by, so
// a player sees the consequence of their own choices rather than the team's
// average.
// ============================================================================

import ROLES from '../data/roles.json' with { type: 'json' }
import OBJECTIVES from '../data/objectives.json' with { type: 'json' }
import { gradeMargin } from './score.js'

const pct = v => Math.round(v * 100) + '%'
const usd = v => '$' + Math.round(v) + 'M'

const MARGIN_LABEL = {
  mass: 'Mass', power: 'Power', budget: 'Budget', data: 'Data', deltaV: 'Delta-v',
}

// Which role's decisions move which margin. Taken from roles.json so the
// debrief and the screen scoping can never drift apart.
const ROLE_OWNS = Object.fromEntries(ROLES.map(r => [r.metric, r]))

export function debrief({ config, result, diff, study = null, wx = null, outpost = null }) {
  const objective = OBJECTIVES.find(o => o.id === config.objectiveId)
  const flies = diff ? diff.flies : result.flies
  const score = diff ? diff.score : result.score.final

  // ---- why the score is the score ---------------------------------------
  const s = result.score
  const breakdown = [
    { label: 'Science per day', value: s.sciencePerDay.toFixed(1),
      note: 'instrument value that matches what this objective asked for' },
    { label: 'Data actually returned', value: pct(result.data.returnFraction),
      note: 'science that reaches the ground is the only science that counts' },
    { label: 'Lifetime factor', value: s.lifetimeFactor.toFixed(2),
      note: config.lifetimeYears + ' years against a ' + objective.minLifetimeYears + ' year requirement' },
    { label: 'Science score', value: Math.round(s.scienceScore),
      note: 'science per day x data returned x lifetime' },
    { label: 'Margin bonus', value: (s.marginBonus >= 0 ? '+' : '') + s.marginBonus,
      note: 'reward for holding 10-35%, penalty for overdesign' },
    { label: 'Efficiency bonus', value: (s.efficiencyBonus >= 0 ? '+' : '') + s.efficiencyBonus,
      note: 'science returned per dollar spent' },
    { label: 'Risk multiplier', value: 'x' + s.riskMultiplier.toFixed(2),
      note: result.events.filter(e => !e.survived).length + ' of ' + result.events.length +
        ' in-flight events degraded the mission' },
  ]
  if (diff && diff.multiplier !== 1) {
    breakdown.push({ label: 'Difficulty multiplier', value: 'x' + diff.multiplier,
      note: diff.level.name + ' level' })
  }

  // ---- margins: what nearly killed it, and what you paid for twice ------
  // gradeMargin returns its own 'label' ("Healthy reserve"), which is a
  // different thing from the margin's name. Keep them apart.
  const margins = Object.entries(result.margins)
    .map(([key, m]) => {
      const g = gradeMargin(m)
      return { key, label: MARGIN_LABEL[key] || key, margin: m,
        grade: g.grade, gradeLabel: g.label, bonus: g.bonus }
    })
    .sort((a, b) => a.margin - b.margin)

  const tightest = margins[0]
  const wasted = margins.filter(m => m.grade === 'OVERDESIGNED')
  const failing = margins.filter(m => m.margin < 0)

  // ---- the trade study's verdict on this design -------------------------
  let trade = null
  if (study && study.flying && study.flying.length) {
    const cost = result.budget.totalUsdM
    const betterSameMoney = study.flying
      .filter(d => d.cost <= cost + 1 && d.score > score)
      .sort((a, b) => b.score - a.score)[0] || null
    const cheaperSameScore = study.flying
      .filter(d => d.score >= score && d.cost < cost - 1)
      .sort((a, b) => a.cost - b.cost)[0] || null
    const dominating = study.flying.filter(d => d.score > score && d.cost <= cost).length
    trade = {
      total: study.total, flying: study.flying.length, dominating,
      betterSameMoney, cheaperSameScore,
      onFront: dominating === 0,
      headroom: betterSameMoney ? betterSameMoney.score - score : 0,
      saving: cheaperSameScore ? cost - cheaperSameScore.cost : 0,
    }
  }

  // ---- the storm that would have ended it -------------------------------
  let storms = null
  if (wx) {
    const worst = wx.threats.filter(t => !t.survived)
      .sort((a, b) => b.stress - a.stress)[0] || null
    storms = {
      total: wx.total, encountered: wx.encountered, degraded: wx.degraded,
      survivalRate: wx.survivalRate, worst,
    }
  }

  // ---- role attribution --------------------------------------------------
  const byRole = ROLES.map(role => {
    const m = margins.find(x => x.key === role.metric)
    return {
      roleId: role.id, name: role.name, owns: role.owns, metric: role.metric,
      label: m ? m.label : role.metric,
      margin: m ? m.margin : null,
      grade: m ? m.grade : null,
      verdict: !m ? 'no margin tracked'
        : m.margin < 0 ? 'answers for ' + m.label.toLowerCase() + ', and it ended at ' + pct(m.margin)
        : m.grade === 'NOMINAL' ? 'held a healthy ' + pct(m.margin) + ' on ' + m.label.toLowerCase()
        : m.grade === 'RISKY' ? 'left almost nothing in reserve (' + pct(m.margin) + ')'
        : m.grade === 'OVERDESIGNED' ? 'bought ' + pct(m.margin) + ' of capability the mission never used'
        : 'comfortable at ' + pct(m.margin),
      decides: role.decides,
    }
  })

  // ---- what to do next ---------------------------------------------------
  const actions = []
  for (const f of failing) {
    const owner = ROLE_OWNS[f.key]
    actions.push({
      severity: 'critical',
      text: f.label + ' margin is ' + pct(f.margin) + '. The mission does not fly until that is positive.',
      who: owner ? owner.name : null,
    })
  }
  for (const c of result.checks.filter(c => !c.passed)) {
    actions.push({ severity: 'critical', text: c.message + ' ' + c.fix, who: null })
  }
  if (diff && diff.extraFailed.length) {
    for (const c of diff.extraFailed) {
      actions.push({ severity: 'level', text: c.message + ' ' + c.fix, who: null })
    }
  }
  if (tightest && tightest.margin >= 0 && tightest.grade === 'RISKY') {
    const owner = ROLE_OWNS[tightest.key]
    actions.push({
      severity: 'risk',
      text: tightest.label + ' is the thinnest margin at ' + pct(tightest.margin) +
        '. It is the first thing an in-flight event will break.',
      who: owner ? owner.name : null,
    })
  }
  for (const w of wasted) {
    const owner = ROLE_OWNS[w.key]
    actions.push({
      severity: 'waste',
      text: w.label + ' margin is ' + pct(w.margin) + '. That is capability you paid for and never used' +
        (w.key === 'power' && outpost && outpost.crew.crew > 0
          ? ' in orbit - though it is what supports ' + outpost.crew.crew + ' crew on the surface.'
          : '.'),
      who: owner ? owner.name : null,
    })
  }
  if (trade && trade.betterSameMoney) {
    actions.push({
      severity: 'trade',
      text: 'The trade study found a bus scoring ' + trade.betterSameMoney.score + ' for ' +
        usd(trade.betterSameMoney.cost) + ', against your ' + score + ' for ' + usd(result.budget.totalUsdM) +
        '. That is ' + trade.headroom + ' points reachable for no more money.',
      who: 'Spacecraft Engineer',
    })
  }
  if (trade && trade.cheaperSameScore) {
    actions.push({
      severity: 'trade',
      text: 'The same science was available for ' + usd(trade.cheaperSameScore.cost) + ', saving ' +
        usd(trade.saving) + '.',
      who: 'Mission Planner',
    })
  }
  if (storms && storms.worst) {
    actions.push({
      severity: 'storm',
      text: 'A real coronal mass ejection on ' + String(storms.worst.start).slice(0, 10) +
        ' at ' + Math.round(storms.worst.speed) + ' km/s would have degraded this design: ' +
        storms.worst.reasons[0] + '.',
      who: 'Operations',
    })
  }
  if (!actions.length) {
    actions.push({
      severity: 'ok',
      text: 'Nothing in the engine, the trade study or the DONKI record breaks this design. ' +
        'Raise the difficulty, or take on a harder objective.',
      who: null,
    })
  }

  // ---- one sentence a person would actually say --------------------------
  const headline = !flies
    ? 'This design does not fly. ' + (failing.length
        ? failing[0].label + ' margin is ' + pct(failing[0].margin) + '.'
        : result.checks.filter(c => !c.passed).length + ' constraints are violated.')
    : wasted.length && tightest.grade === 'NOMINAL'
      ? 'It flies and the margins are healthy, but you overbought ' +
        wasted.map(w => w.label.toLowerCase()).join(' and ') + '.'
      : tightest.grade === 'RISKY'
        ? 'It flies, but ' + tightest.label.toLowerCase() + ' has almost no reserve left.'
        : 'It flies with healthy reserve on every margin. This is what a review board wants to see.'

  return {
    flies, score, headline, objective: objective.name,
    level: diff ? diff.level : null,
    breakdown, margins, tightest, wasted, failing,
    events: result.events, trade, storms, byRole,
    outpost: outpost ? {
      site: outpost.site.name, cls: outpost.cls.label, units: outpost.units,
      crew: outpost.crew.crew, lostGbPerDay: outpost.data.lostGbPerDay,
    } : null,
    actions: actions.slice(0, 6),
  }
}
