// ============================================================================
// ArchitectX - the in-app mission assistant.
//
// It is NOT a language model and the UI says so plainly. It matches a question
// against a curated set of topics, then computes the specifics from the
// player's actual mission by calling the same engine every screen uses. That
// is the whole trick, and it is why it cannot invent a number: every figure it
// quotes came out of runMission a millisecond earlier.
//
// Everything here is pure, so tests/architectx.mjs can ask it questions in
// Node and check the answers contain the right numbers.
// ============================================================================

import COMPONENTS from '../data/components.json' with { type: 'json' }
import OBJECTIVES from '../data/objectives.json' with { type: 'json' }
import ORBITS from '../data/orbits.json' with { type: 'json' }
import { runMission } from '../sim/runMission.js'
import { gradeMargin } from '../sim/score.js'
import { LEVELS, levelOf } from '../sim/difficulty.js'

export const ASSISTANT_NAME = 'ArchitectX'

export const GROUPS = [
  'Getting started', 'Your design right now', 'The margin mechanic',
  'The physics and the data', 'Playing as a team', 'Score and difficulty',
  'Saving and sharing', 'About',
]

const pct = v => Math.round(v * 100) + '%'
const money = v => '$' + Math.round(v) + 'M'

// What a changed subsystem actually costs, computed rather than claimed.
function tryComponent(config, group, id) {
  const next = { ...config, components: { ...config.components, [group]: id } }
  const before = runMission(config)
  const after = runMission(next)
  const part = COMPONENTS[group].find(c => c.id === id)
  return { part, before, after, next }
}

// Walk up a catalog from whatever is fitted now.
function nextUp(config, group, key) {
  const list = COMPONENTS[group]
  const at = list.findIndex(c => c.id === config.components[group])
  for (let i = at + 1; i < list.length; i++) {
    if (!key || list[i][key] > list[at][key]) return list[i]
  }
  return null
}

// --------------------------------------------------------------- topics ----
// `keywords` are matched token by token; `phrases` score higher because a
// phrase match is much stronger evidence of intent than a shared word.

export const TOPICS = [
  {
    id: 'what-is-this', group: 'Getting started',
    q: 'What is Mission Architect?',
    phrases: ['what is this', 'what is mission architect', 'what does this do', 'how does this work'],
    keywords: ['what', 'this', 'about', 'purpose', 'point', 'explain'],
    answer: () => ({
      lines: [
        'Mission Architect is a mission design and validation platform. You choose a science objective, select instruments, build a spacecraft bus, pick an orbit and a launch vehicle, and then fly the result.',
        'Every choice has a real engineering consequence computed from real physics, and every failure tells you the numbers and the way out instead of just saying no.',
      ],
      bullets: [
        'Nothing is scripted: one engine computes mass, power, cost, data and delta-v from your choices.',
        'Designs are flown against real coronal mass ejections recorded by NASA DONKI.',
        'All 10,368 possible spacecraft buses are enumerated so you can see where yours sits.',
      ],
    }),
  },
  {
    id: 'first-steps', group: 'Getting started',
    q: 'What should I do first?',
    phrases: ['what do i do', 'where do i start', 'how do i start', 'first step', 'getting started', 'how to play'],
    keywords: ['start', 'begin', 'first', 'new', 'beginner', 'play', 'tutorial'],
    answer: ctx => ({
      lines: [
        'Work left to right along the tabs. The default design already flies, so the fastest way in is to break it on purpose and watch what happens.',
      ],
      bullets: [
        'Objective: what the mission is for. It sets your budget and which orbits are legal.',
        'Payload: the instruments. Each one adds mass, power draw, cost and data.',
        'Spacecraft: the bus that has to carry and power all of that.',
        'Orbit & Launch: where you fly and what lifts you there.',
        'Simulate: fly it, then read the Debrief.',
        'Try this now: on Spacecraft, drop the solar array one size and watch the Power bar on the right go red.',
      ],
      link: { label: 'Open the Spacecraft tab', phase: 'spacecraft' },
      ctxNote: ctx.result.flies
        ? 'Your current design flies, with a score of ' + ctx.diffScore + '.'
        : 'Your current design does not fly yet. Ask me "why does my mission not fly" and I will go through it.',
    }),
  },
  {
    id: 'dashboard', group: 'Getting started',
    q: 'What are the bars on the right?',
    phrases: ['bars on the right', 'what are the margins', 'what is the dashboard', 'right hand side'],
    keywords: ['bars', 'dashboard', 'right', 'sidebar', 'percentage', 'green', 'colour', 'color'],
    answer: () => ({
      lines: [
        'Those are your margins: mass, power, budget and data, plus a delta-v figure the engine holds constant. A margin is how much of each resource you have left over after the design is paid for.',
        'The band drawn into every bar is 10 to 35 percent. Land inside it and you are rewarded; spend it all or hoard it and you are penalised.',
      ],
      bullets: [
        'Below 0%: the mission does not fly.',
        '0 to 10%: RISKY. The first in-flight event will break you.',
        '10 to 35%: NOMINAL. What a real review board wants.',
        '35 to 50%: GENEROUS.',
        'Above 50%: OVERDESIGNED. Capability you paid for and never used.',
      ],
    }),
  },

  // ---------------------------------------------------- live design ------
  {
    id: 'why-not-fly', group: 'Your design right now',
    q: 'Why does my mission not fly?',
    phrases: ['why does my mission not fly', 'why doesnt it fly', 'why does it fail', 'what is wrong',
      'why is it red', 'mission does not fly', 'what is broken', 'why did i fail',
      'whats wrong', 'wrong with my', 'what is wrong with', 'not working'],
    keywords: ['fly', 'fail', 'failing', 'broken', 'wrong', 'red', 'error', 'problem', 'fix'],
    answer: ctx => {
      const failed = [...ctx.result.checks, ...(ctx.diff ? ctx.diff.checks : [])].filter(c => !c.passed)
      if (!failed.length) {
        return {
          lines: ['Nothing is failing. This design flies, and scores ' + ctx.diffScore + '.'],
          bullets: ctx.weakest
            ? ['Your thinnest margin is ' + ctx.weakest.label.toLowerCase() + ' at ' +
               pct(ctx.weakest.margin) + ' (' + ctx.weakest.grade + '). That is what an in-flight event will go after first.']
            : [],
          link: { label: 'Read the full debrief', phase: 'debrief' },
        }
      }
      return {
        lines: [failed.length === 1
          ? 'One constraint is failing.'
          : failed.length + ' constraints are failing. The mission flies when all of them pass.'],
        bullets: failed.map(c => c.message + ' ' + c.fix),
        link: { label: 'Open the debrief for ranked actions', phase: 'debrief' },
      }
    },
  },
  {
    id: 'weakest', group: 'Your design right now',
    q: 'What is my weakest margin?',
    phrases: ['weakest margin', 'thinnest margin', 'what is closest to failing', 'what should i worry about',
      'biggest risk', 'what is my worst'],
    keywords: ['weakest', 'thinnest', 'worst', 'closest', 'risk', 'risky', 'worry', 'danger'],
    answer: ctx => {
      const w = ctx.weakest
      if (!w) return { lines: ['I could not read your margins.'] }
      const fat = ctx.margins.filter(m => m.grade === 'OVERDESIGNED')
      return {
        lines: [
          'Your thinnest margin is ' + w.label.toLowerCase() + ' at ' + pct(w.margin) + ', graded ' + w.grade + '.',
          w.margin < 0
            ? 'That is below zero, so the mission does not fly until you fix it.'
            : w.grade === 'RISKY'
              ? 'There is almost nothing in reserve. An ordinary in-flight event will end this mission.'
              : 'That is inside the healthy band, which is where you want it.',
        ],
        bullets: fat.length
          ? ['You are carrying too much on ' + fat.map(f => f.label.toLowerCase()).join(' and ') +
             ' (' + fat.map(f => pct(f.margin)).join(', ') + '). Trading some of that back would buy reserve where you actually need it.']
          : [],
      }
    },
  },
  {
    id: 'more-power', group: 'Your design right now',
    q: 'How do I get more power?',
    phrases: ['more power', 'power margin', 'not enough power', 'power is negative', 'bigger array',
      'brownout', 'power failing'],
    keywords: ['power', 'array', 'solar', 'watts', 'watt', 'energy', 'brownout', 'small',
      'bigger', 'larger', 'insufficient'],
    answer: ctx => {
      const up = nextUp(ctx.config, 'array', 'areaM2')
      const lines = [
        'Right now your array delivers ' + Math.round(ctx.result.power.orbitAvgW) +
        ' W orbit-average at end of life and the spacecraft draws ' + Math.round(ctx.result.power.loadW) +
        ' W, which is ' + pct(ctx.result.margins.power) + ' margin.',
      ]
      if (!up) {
        lines.push('You already have the largest array in the catalog, so the other direction is to shed load: a smaller instrument, a cheaper link, or a less hungry propulsion choice.')
        return { lines, link: { label: 'Open the Spacecraft tab', phase: 'spacecraft' } }
      }
      const t = tryComponent(ctx.config, 'array', up.id)
      return {
        lines,
        bullets: [
          'Fitting the ' + up.name + ': power margin goes ' + pct(t.before.margins.power) + ' to ' +
            pct(t.after.margins.power) + '.',
          'It costs you ' + Math.round(up.massKg - COMPONENTS.array.find(a => a.id === ctx.config.components.array).massKg) +
            ' kg and ' + money(up.costUsdM - COMPONENTS.array.find(a => a.id === ctx.config.components.array).costUsdM) +
            ', so mass margin moves to ' + pct(t.after.margins.mass) + ' and budget to ' + pct(t.after.margins.budget) + '.',
          t.after.flies ? 'That design flies, scoring ' + t.after.score.final + '.'
            : 'Careful: that change alone does not make the mission fly.',
        ],
        link: { label: 'Open the Spacecraft tab', phase: 'spacecraft' },
      }
    },
  },
  {
    id: 'more-data', group: 'Your design right now',
    q: 'My downlink cannot keep up. What do I do?',
    phrases: ['downlink', 'data margin', 'not enough data', 'cannot downlink', 'losing science',
      'data is negative', 'antenna', 'bandwidth'],
    keywords: ['data', 'downlink', 'link', 'antenna', 'comms', 'gb', 'mbps', 'bandwidth', 'recorder'],
    answer: ctx => {
      const d = ctx.result.data
      const up = nextUp(ctx.config, 'comms', 'baseRateMbps')
      const lines = [
        'Your instruments generate ' + d.generatedGbPerDay.toFixed(1) + ' GB/day and the link returns ' +
        d.downlinkGbPerDay.toFixed(1) + ' GB/day, so ' + Math.round(d.returnFraction * 100) +
        '% of your science reaches the ground.',
      ]
      const bullets = []
      if (up) {
        const t = tryComponent(ctx.config, 'comms', up.id)
        bullets.push('Fitting the ' + up.name + ' takes data margin from ' + pct(t.before.margins.data) +
          ' to ' + pct(t.after.margins.data) + ', at ' + up.powerW + ' W and ' + money(up.costUsdM) + '.')
        if (t.after.margins.power < 0) {
          bullets.push('Watch out: that link draws enough power to push your power margin to ' +
            pct(t.after.margins.power) + '. This is the trade the game is about.')
        }
      }
      bullets.push('The other direction is to generate less: drop the highest rate instrument, or accept a lower duty cycle.')
      bullets.push('Orbit matters too. Range loss is folded into every orbit’s link factor, which is why Mars returns so little.')
      return { lines, bullets, link: { label: 'Open the Spacecraft tab', phase: 'spacecraft' } }
    },
  },
  {
    id: 'over-budget', group: 'Your design right now',
    q: 'Am I over budget?',
    phrases: ['over budget', 'too expensive', 'how much does it cost', 'cost', 'money', 'budget margin'],
    keywords: ['budget', 'cost', 'money', 'expensive', 'cheap', 'dollars', 'afford'],
    answer: ctx => {
      const b = ctx.result.budget
      return {
        lines: [
          'This mission costs ' + money(b.totalUsdM) + ' against a ' + money(b.budgetUsdM) +
          ' budget, which is ' + pct(b.margin) + ' reserve.',
          b.margin < 0
            ? 'You are over. Something has to come out.'
            : b.margin > 0.5
              ? 'That is a lot of unspent money. The scoring treats hoarding as a failure of ambition, not a virtue.'
              : 'That is inside the band a real programme would be comfortable with.',
        ],
        bullets: [
          'Instruments: ' + money(b.instrumentCost) + '. Bus: ' + money(b.busCost) + '.',
          'Development carries a 1.35x integration and test wrap, which is where ' +
            money(b.devCost - b.instrumentCost - b.busCost) + ' of it goes.',
          'Launch: ' + money(b.launchCost) + '. Operations: ' + money(b.opsCost) + ' over ' +
            ctx.config.lifetimeYears + ' years.',
        ],
      }
    },
  },
  {
    id: 'is-it-good', group: 'Your design right now',
    q: 'Is my design any good?',
    phrases: ['is my design good', 'is this optimal', 'can i do better', 'best design', 'how good is my score',
      'am i on the frontier'],
    keywords: ['good', 'better', 'optimal', 'best', 'improve', 'frontier', 'compare', 'score'],
    answer: ctx => {
      const lines = ['Your design scores ' + ctx.diffScore + ' and costs ' + money(ctx.result.budget.totalUsdM) + '.']
      const study = ctx.getStudy ? ctx.getStudy() : null
      if (!study) {
        return { lines, bullets: ['Open the Trade Space tab and I can compare you against every other possible bus.'],
          link: { label: 'Open the Trade Space tab', phase: 'trade' } }
      }
      const cost = ctx.result.budget.totalUsdM
      const better = study.flying.filter(d => d.score > ctx.diffScore && d.cost <= cost)
      const best = better.sort((a, b) => b.score - a.score)[0]
      lines.push(better.length === 0
        ? 'Nothing in the ' + study.total.toLocaleString('en-US') + ' possible buses is both cheaper and better. You are on the efficient frontier.'
        : better.length + ' of ' + study.total.toLocaleString('en-US') + ' possible buses beat you without costing more.')
      return {
        lines,
        bullets: best
          ? ['The best of them scores ' + best.score + ' for ' + money(best.cost) +
             ' - that is ' + (best.score - ctx.diffScore) + ' points you are leaving on the table.']
          : [],
        link: { label: 'See it on the Trade Space tab', phase: 'trade' },
      }
    },
  },
  {
    id: 'mars', group: 'Your design right now',
    q: 'Why is everything harder at Mars?',
    phrases: ['why is mars hard', 'mars', 'why is power lower at mars', 'deep space'],
    keywords: ['mars', 'far', 'distance', 'sun', 'inverse', 'square', 'au'],
    answer: ctx => {
      const mars = ORBITS.find(o => o.id === 'mars')
      return {
        lines: [
          'Sunlight falls off with the inverse square of distance. At ' + mars.solarDistanceAu +
          ' AU the Sun gives about 586 W/m2, which is 43% of what the same array collects at Earth.',
          'So an array sized for Earth browns out at Mars, and a link sized for Earth returns almost nothing: the Mars link factor is ' +
          mars.linkFactor + ' against 1.0 in low Earth orbit.',
        ],
        bullets: [
          'Your current orbit is ' + (ORBITS.find(o => o.id === ctx.config.orbitId) || {}).name + '.',
          'Mars insertion assumes aerobraking at 1800 m/s, as Mars Reconnaissance Orbiter did.',
        ],
      }
    },
  },

  // -------------------------------------------------------- the mechanic --
  {
    id: 'what-is-margin', group: 'The margin mechanic',
    q: 'What is margin, and why does it matter?',
    phrases: ['what is margin', 'why margin', 'what does margin mean', 'reserve'],
    keywords: ['margin', 'reserve', 'headroom', 'spare'],
    answer: () => ({
      lines: [
        'Margin is the resource you deliberately do not spend. Real missions hold 10 to 35 percent of their mass, power, budget and data capacity in reserve, because everything grows between design and launch: instruments get heavier, software gets hungrier, schedules slip and cost money.',
        'This platform makes that the scoring mechanic rather than a hidden rule, which is the one thing it teaches that no other tool does.',
      ],
    }),
  },
  {
    id: 'overdesign', group: 'The margin mechanic',
    q: 'Why am I penalised for having too much margin?',
    phrases: ['why am i penalised', 'overdesigned', 'too much margin', 'why lose points for margin',
      'capability you never used'],
    keywords: ['overdesigned', 'penalty', 'penalised', 'penalized', 'wasted', 'hoard', 'unused', 'spare'],
    answer: () => ({
      lines: [
        'Because unused capability is not free. Every spare watt is an array you paid to build, launch and carry for the life of the mission, and every unspent dollar is science somebody else did not get to do.',
        'A design with 70% power margin did not win. It overbought, and a review board would ask why that money was not spent on another instrument.',
      ],
      bullets: ['Above 50% margin the score takes a small penalty, the same way it does for spending everything.'],
    }),
  },

  // ---------------------------------------------------- physics and data --
  {
    id: 'real-numbers', group: 'The physics and the data',
    q: 'Are these numbers real?',
    phrases: ['are the numbers real', 'is this real', 'where do the numbers come from', 'is this accurate',
      'did you make this up', 'sources'],
    keywords: ['real', 'accurate', 'source', 'sources', 'cited', 'nasa', 'true', 'made'],
    answer: () => ({
      lines: [
        'Yes, and every entry carries its source inside the app on the Sources tab.',
        'The physics is standard: inverse-square solar flux from 1361 W/m2, array degradation per year against a radiation index, the Tsiolkovsky rocket equation for propellant, a link budget scaled by transmit power and antenna aperture, and a cost model with a 1.35x integration wrap.',
      ],
      bullets: [
        'Spacecraft and mission practice come from NASA’s Design and Develop Science Missions and CubeSat 101.',
        'Catalog entries are anchored to flown missions: Landsat 9, Mars Reconnaissance Orbiter, LRO, SPHEREx and DSCOVR.',
        'The space weather is real recorded data, not a simulation.',
      ],
      link: { label: 'Open the Sources tab', phase: 'sources' },
    }),
  },
  {
    id: 'donki', group: 'The physics and the data',
    q: 'Are the solar storms real?',
    phrases: ['are the storms real', 'what is donki', 'space weather', 'solar storm', 'cme'],
    keywords: ['storm', 'storms', 'donki', 'cme', 'solar', 'weather', 'flare', 'radiation'],
    answer: () => ({
      lines: [
        'They are real. The app validates your design against 433 actual coronal mass ejections recorded in NASA’s DONKI database, each with its measured speed and the spacecraft that observed it.',
        'A storm can end a mission three independent ways: it can degrade array output below your load, it can interrupt the downlink until onboard storage overflows, or a single-event upset can trip attitude control when there is no redundant unit to take over.',
      ],
      bullets: [
        'The app calls the NASA API live from your browser, and falls back to a bundled snapshot of the same real records if the API is unreachable, so validation never breaks.',
        'Orbit changes your exposure by roughly five times, because Earth’s magnetosphere shields low orbits and nothing shields a lunar or Mars trajectory.',
      ],
      link: { label: 'Open the Space Weather tab', phase: 'weather' },
    }),
  },
  {
    id: 'eclipse', group: 'The physics and the data',
    q: 'Why does the battery matter so much?',
    phrases: ['why does the battery matter', 'what is eclipse', 'battery', 'night side'],
    keywords: ['battery', 'eclipse', 'dark', 'night', 'discharge', 'wh'],
    answer: ctx => ({
      lines: [
        'Because the array produces nothing in eclipse and the spacecraft still has to run.',
        'Your orbit spends ' + ctx.result.power.eclipseMin.toFixed(1) + ' minutes of every pass in shadow, which needs ' +
        Math.round(ctx.result.power.energyNeededWh) + ' Wh. Your pack provides ' + ctx.result.power.batteryCapacityWh + ' Wh.',
      ],
      bullets: [
        'Only part of a battery is usable: depth of discharge is capped so the cells survive thousands of cycles.',
        'The surface segment makes the same point at a different scale: a pack sized for a 35 minute eclipse cannot carry a base through a 72 hour lunar night.',
      ],
    }),
  },
  {
    id: 'deltav', group: 'The physics and the data',
    q: 'What is delta-v?',
    phrases: ['what is delta v', 'delta-v', 'tsiolkovsky', 'propellant', 'fuel'],
    keywords: ['delta', 'deltav', 'propellant', 'fuel', 'tsiolkovsky', 'thrust', 'isp', 'impulse'],
    answer: ctx => ({
      lines: [
        'Delta-v is the change in velocity a mission needs: orbit insertion, station-keeping for every year of the mission, and a disposal burn at the end.',
        'Propellant mass follows the Tsiolkovsky rocket equation, so it grows exponentially with delta-v and shrinks with specific impulse. Your mission needs ' +
        Math.round(ctx.result.deltaV.totalMs) + ' m/s and carries ' + Math.round(ctx.result.mass.propKg) + ' kg of propellant.',
      ],
      bullets: [
        'An ion thruster has roughly ten times the specific impulse of hydrazine, which is why it carries so much less propellant - and why it eats power your instruments wanted.',
      ],
    }),
  },

  // --------------------------------------------------------------- team ---
  {
    id: 'multiplayer', group: 'Playing as a team',
    q: 'How do I play with other people?',
    phrases: ['play with friends', 'multiplayer', 'how do i invite', 'join a session', 'play together',
      'with my team', 'co-op', 'coop'],
    keywords: ['multiplayer', 'friends', 'team', 'together', 'session', 'join', 'code', 'invite', 'online'],
    answer: () => ({
      lines: [
        'Up to four people can share one spacecraft in real time. Use Play as a team in the toolbar, create a session, and read out the five character code or send the invite link.',
        'Each player takes one role and controls only that part of the spacecraft. Everyone sees the same margins move.',
      ],
      bullets: [
        'Mission Planner: the objective, the orbit and the launch vehicle.',
        'Science Lead: which instruments fly.',
        'Spacecraft Engineer: the bus that has to carry and power them.',
        'Operations: mission lifetime, and when to fly.',
        'Head to head mode instead gives everyone their own copy of the same objective and ranks them at the end.',
        'It works between tabs on one computer with no network at all, and across devices through a free public broker.',
      ],
    }),
  },
  {
    id: 'cant-change', group: 'Playing as a team',
    q: 'Why can I not change the spacecraft?',
    phrases: ['why can i not change', 'cannot edit', 'greyed out', 'locked', 'view only', 'read only',
      'why is it disabled'],
    keywords: ['locked', 'disabled', 'greyed', 'grey', 'cannot', 'edit', 'change', 'readonly', 'permission'],
    answer: ctx => ({
      lines: [
        ctx.roleName
          ? 'You are ' + ctx.roleName + ' in this session, so you control your own screens and nothing else.'
          : 'In a team session each player controls only their own subsystem. That is deliberate: nobody can overrule anybody, so the trade has to be argued out loud.',
        'Use Peek at teammates’ screens to watch what they are doing, read only.',
      ],
      bullets: ['Every change anyone makes shows up in your margin dashboard immediately, because it is one spacecraft.'],
    }),
  },

  // ------------------------------------------------- score and difficulty -
  {
    id: 'levels', group: 'Score and difficulty',
    q: 'What do the difficulty levels change?',
    phrases: ['difficulty', 'what are the levels', 'cadet', 'flight director', 'how hard'],
    keywords: ['difficulty', 'level', 'levels', 'cadet', 'engineer', 'director', 'hard', 'easy', 'expert'],
    answer: ctx => ({
      lines: ['The physics is identical at every level. What changes is how much the platform explains, how rough the in-flight events are, and how much reserve you are held to.'],
      bullets: LEVELS.map(l => l.name + ': ' + l.blurb + ' Scores x' + l.multiplier + '.'),
      ctxNote: 'You are playing at ' + levelOf(ctx.config).name + '.',
    }),
  },
  {
    id: 'scoring', group: 'Score and difficulty',
    q: 'How is my score calculated?',
    phrases: ['how is the score calculated', 'how does scoring work', 'what is my score made of',
      'how do i score higher'],
    keywords: ['score', 'scoring', 'points', 'calculated', 'bonus', 'multiplier'],
    answer: ctx => ({
      lines: [
        'Science per day times the fraction of it that actually reaches the ground, times a lifetime factor, gives your science score. Then margin and efficiency bonuses are added and a risk multiplier is applied for in-flight events you did not survive.',
      ],
      bullets: [
        'Science only counts if the instrument measures what the objective asked for: 1.0 for a required measurement, 0.25 for a bonus one, nothing otherwise.',
        'Your current science score is ' + Math.round(ctx.result.score.scienceScore) + ', margin bonus ' +
          ctx.result.score.marginBonus + ', efficiency bonus ' + ctx.result.score.efficiencyBonus +
          ', risk multiplier x' + ctx.result.score.riskMultiplier.toFixed(2) + '.',
      ],
      link: { label: 'See the full breakdown in the Debrief', phase: 'debrief' },
    }),
  },

  // ------------------------------------------------------ save and share --
  {
    id: 'save', group: 'Saving and sharing',
    q: 'How do I save or share my design?',
    phrases: ['how do i save', 'save my design', 'share', 'send it to someone', 'export', 'download',
      'load a design'],
    keywords: ['save', 'load', 'share', 'export', 'import', 'download', 'file', 'link', 'json'],
    answer: () => ({
      lines: [
        'Three ways, all in the toolbar at the top.',
      ],
      bullets: [
        'Share this mission copies a link. The whole design is encoded in the URL, so anyone who opens it sees exactly your spacecraft.',
        'Save design writes a readable JSON file to your computer, which keeps working whatever happens to this site.',
        'Load design reads one back, and refuses anything it does not recognise with a reason rather than crashing.',
        'Links can also point at a specific tab, for example ?phase=outpost.',
      ],
    }),
  },
  {
    id: 'outpost', group: 'Getting started',
    q: 'What is the surface segment?',
    phrases: ['what is the surface segment', 'what is the outpost', 'the base', 'settlement', 'moon base'],
    keywords: ['surface', 'outpost', 'base', 'settlement', 'ground', 'colony', 'habitat'],
    answer: ctx => ({
      lines: [
        'An orbiter is the first element of a programme, not the whole of it. The surface segment takes your array, battery, link, launch vehicle and instruments down to the body you flew to and draws, to scale, the installation they buy.',
        ctx.outpost
          ? 'Your current design builds a ' + ctx.outpost.cls.label.toLowerCase() + ' at ' + ctx.outpost.site.name +
            ': ' + ctx.outpost.units + ' spacecraft-equivalents landed and ' + ctx.outpost.crew.crew + ' crew supported.'
          : 'Open the Surface Segment tab to see yours.',
      ],
      bullets: [
        'Every structure is dimensioned from a number the engine already reported, and the table under the drawing prints the arithmetic.',
        'It is where the hardest lesson lands: you can land twenty copies of your instrument suite and still have only one orbiter to carry the data home.',
      ],
      link: { label: 'Open the Surface Segment tab', phase: 'outpost' },
    }),
  },

  // -------------------------------------------------------------- about ---
  {
    id: 'who', group: 'About',
    q: 'Who made this?',
    phrases: ['who made this', 'who built this', 'who are you', 'team', 'credits', 'doon dev'],
    keywords: ['who', 'made', 'built', 'team', 'credits', 'authors', 'doon', 'dev', 'ranveer', 'vibhor'],
    answer: () => ({
      lines: [
        'Mission Architect was built by Team Doon-Dev - designed by Ranveer and Vibhor - for the NASA Space Apps Challenge 2026.',
        'The challenge was Space Mission Design Game, under the theme The Next Frontier.',
      ],
      bullets: [
        'It is a static site: no backend, no database, no accounts. Playing solo it calls one service, NASA\u2019s own API; a team session also uses a public broker to introduce players to each other.',
        'Claude was used as a coding assistant, which the competition rules permit and which we declare rather than hide. Every constant, source and calibration target was chosen and checked by the team.',
      ],
    }),
  },
  {
    id: 'what-am-i', group: 'About',
    q: 'Are you a real AI?',
    phrases: ['are you ai', 'are you a chatbot', 'are you chatgpt', 'what are you', 'how do you work'],
    keywords: ['ai', 'chatbot', 'bot', 'gpt', 'llm', 'model', 'architectx', 'intelligent'],
    answer: () => ({
      lines: [
        'No, and it matters that I say so. I am not a language model. I match your question against a curated set of topics written by the team, and then compute the specifics by calling the same mission engine the rest of the app uses.',
        'That means I run entirely in your browser with no API key and no network, I work offline, and I cannot invent a number: every figure I quote came out of the engine a moment ago.',
      ],
    }),
  },
  {
    id: 'official', group: 'About',
    q: 'Is this an official NASA tool?',
    phrases: ['is this nasa', 'official', 'endorsed', 'is this real nasa software'],
    keywords: ['official', 'endorsed', 'affiliated', 'nasa'],
    answer: () => ({
      lines: [
        'No. This is a student project built for the NASA Space Apps Challenge, which is a public hackathon. It uses NASA’s open data and published guidance, and it is not NASA software and carries no NASA endorsement.',
      ],
    }),
  },
]

// ------------------------------------------------------------- matching ----

const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'do', 'does', 'did', 'i', 'my', 'me', 'it',
  'to', 'of', 'in', 'on', 'for', 'and', 'or', 'how', 'what', 'why', 'can', 'should', 'this',
  'that', 'be', 'was', 'with', 'you', 'your', 'about', 'so', 'if', 'at', 'am', 'have', 'has'])

export function tokenise(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/).filter(w => w.length > 1 && !STOP.has(w))
}

export function scoreTopic(topic, query, tokens) {
  let score = 0
  for (const phrase of topic.phrases || []) {
    if (query.includes(phrase)) score += 10
  }
  const kw = new Set((topic.keywords || []).map(k => k.toLowerCase()))
  for (const t of tokens) {
    if (kw.has(t)) score += 3
    else if ([...kw].some(k => k.length > 4 && (t.startsWith(k) || k.startsWith(t)))) score += 1.5
  }
  const qTokens = tokenise(topic.q)
  for (const t of tokens) if (qTokens.includes(t)) score += 1
  return score
}

// ctx is the player's live mission. Answers are built against it, so the same
// question gives a different (correct) answer for a different design.
export function buildContext({ config, result, diff, outpost = null, study = null, roleName = null }) {
  const margins = Object.entries(result.margins)
    .map(([key, m]) => {
      const g = gradeMargin(m)
      const label = { mass: 'Mass', power: 'Power', budget: 'Budget', data: 'Data', deltaV: 'Delta-v' }[key] || key
      return { key, label, margin: m, grade: g.grade }
    })
    .sort((a, b) => a.margin - b.margin)
  return {
    config, result, diff, outpost, roleName,
    margins,
    weakest: margins[0] || null,
    diffScore: diff ? diff.score : result.score.final,
    objective: OBJECTIVES.find(o => o.id === config.objectiveId),
    getStudy: () => study,
  }
}

export function ask(query, ctx, { min = 4 } = {}) {
  const q = String(query || '').toLowerCase().trim()
  const tokens = tokenise(q)
  if (!q) return { kind: 'empty', suggestions: suggestionsFor(ctx) }

  const ranked = TOPICS
    .map(t => ({ topic: t, score: scoreTopic(t, q, tokens) }))
    .sort((a, b) => b.score - a.score)

  const best = ranked[0]
  if (!best || best.score < min) {
    return {
      kind: 'unknown',
      suggestions: ranked.slice(0, 4).map(r => r.topic),
      message: 'I do not have an answer written for that one. I am a keyword assistant, not a language ' +
        'model, so I only know the topics the team wrote. These are the closest:',
    }
  }

  return {
    kind: 'answer',
    topic: best.topic,
    confidence: best.score,
    answer: best.topic.answer(ctx),
    related: ranked.slice(1, 4).filter(r => r.score >= min / 2).map(r => r.topic),
  }
}

// What to offer before anything has been typed: whatever is most useful for
// the design actually on screen.
export function suggestionsFor(ctx) {
  const byId = id => TOPICS.find(t => t.id === id)
  const out = []
  if (ctx && ctx.result && !ctx.result.flies) out.push(byId('why-not-fly'))
  if (ctx && ctx.weakest && ctx.weakest.margin >= 0 && ctx.weakest.grade === 'RISKY') out.push(byId('weakest'))
  if (ctx && ctx.result && ctx.result.margins.data < 0) out.push(byId('more-data'))
  if (ctx && ctx.result && ctx.result.margins.power < 0.1) out.push(byId('more-power'))
  if (ctx && ctx.roleName) out.push(byId('cant-change'))
  for (const id of ['first-steps', 'what-is-margin', 'donki', 'is-it-good', 'multiplayer', 'who']) {
    if (out.length >= 6) break
    const t = byId(id)
    if (t && !out.includes(t)) out.push(t)
  }
  return out.filter(Boolean).slice(0, 6)
}
