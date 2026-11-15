import EVENTS from '../data/events.json' with { type: 'json' }


// Seeded from the mission config, so the same design always meets the same events.
// Fair, debuggable, and a shared mission link reproduces exactly.
function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}


export function runEvents({ config, margins, adcsRedundant, difficulty = 'normal' }) {
  // Seeded from the DESIGN, not from how it is being played. Difficulty changes
  // how many events are drawn; it must not change which spacecraft meets which
  // trial, or a player toggling the level would see the same bus score
  // differently for no reason they could see.
  const { level: _lvl, difficulty: _dif, ...design } = config
  const rng = mulberry32(hashString(JSON.stringify(design)))
  const count = difficulty === 'easy' ? 2 : difficulty === 'hard' ? 5 : 3
  const pool = [...EVENTS].sort(() => rng() - 0.5).slice(0, count)


  return pool.map(ev => {
    const survived = ev.tests === 'adcs_redundancy'
      ? adcsRedundant
      : (margins[ev.tests] ?? 0) >= ev.threshold
    return {
      id: ev.id, name: ev.name, narrative: ev.narrative, tests: ev.tests,
      required: ev.tests === 'adcs_redundancy'
        ? 'redundant wheels'
        : Math.round(ev.threshold * 100) + '% ' + ev.tests + ' margin',
      survived,
      outcome: survived ? ev.survived : ev.failed,
    }
  })
}
