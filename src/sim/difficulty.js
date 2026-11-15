// ============================================================================
// DIFFICULTY - the same physics, a different amount of help and a different
// amount of forgiveness.
//
// This module does NOT modify runMission. It is applied on top of a finished
// result: extra constraint checks, a score multiplier, and a set of guidance
// flags the UI reads to decide how much it explains itself. A mission run
// without a difficulty is 'normal', which adds no checks and multiplies by 1,
// so the engine calibration in tests/sanity.mjs is untouched.
//
// Three levels, named for who is playing rather than for how hard it is:
//   cadet     - you have never sized a spacecraft before
//   engineer  - the default the project was calibrated on
//   director  - you know what a margin is and want to be held to it
// ============================================================================

export const LEVELS = [
  {
    id: 'cadet', name: 'Cadet', events: 'easy', multiplier: 0.85,
    blurb: 'For a first mission. Every screen explains itself, failures suggest the fix, and in-flight events are forgiving.',
    marginFloor: null, reserveFloor: null,
    guidance: { hints: true, fixes: true, worked: true, suggestions: true, tooltips: true },
  },
  {
    id: 'engineer', name: 'Engineer', events: 'normal', multiplier: 1,
    blurb: 'The calibrated mission. Hints stay, suggestions stay, nothing is softened and nothing is tightened.',
    marginFloor: null, reserveFloor: null,
    guidance: { hints: true, fixes: true, worked: false, suggestions: true, tooltips: true },
  },
  {
    id: 'director', name: 'Flight Director', events: 'hard', multiplier: 1.25,
    blurb: 'Hints off. Five in-flight events instead of three. Every margin must clear 10% and the budget must hold 15% reserve, as a real programme would be held to.',
    marginFloor: 0.10, reserveFloor: 0.15,
    guidance: { hints: false, fixes: false, worked: false, suggestions: false, tooltips: false },
  },
]

export const DEFAULT_LEVEL = 'engineer'

export function levelOf(config) {
  return LEVELS.find(l => l.id === (config && config.level)) ||
    LEVELS.find(l => l.id === DEFAULT_LEVEL)
}

// runEvents already takes 'easy' | 'normal' | 'hard'. This is the only place
// that mapping is made, so the level ids stay a UI concern.
export function eventsDifficulty(config) {
  return levelOf(config).events
}

// Applied to a finished result. Additive: it appends checks and recomputes the
// headline score, and never reaches back into the engine.
export function applyDifficulty({ config, result }) {
  const level = levelOf(config)
  const checks = []

  if (level.marginFloor !== null) {
    for (const [key, label] of [['mass', 'Mass'], ['power', 'Power'], ['data', 'Data']]) {
      const m = result.margins[key]
      checks.push({
        id: 'floor-' + key,
        passed: m >= level.marginFloor,
        message: label + ' margin is ' + Math.round(m * 100) + '%, and ' + level.name +
          ' requires at least ' + Math.round(level.marginFloor * 100) + '%.',
        fix: 'A programme review would not approve a design with no reserve on ' +
          label.toLowerCase() + '. Build the margin back in before flying.',
        fromLevel: true,
      })
    }
  }

  if (level.reserveFloor !== null) {
    const m = result.margins.budget
    checks.push({
      id: 'floor-budget',
      passed: m >= level.reserveFloor,
      message: 'Budget reserve is ' + Math.round(m * 100) + '%, and ' + level.name +
        ' requires at least ' + Math.round(level.reserveFloor * 100) + '%.',
      fix: 'Everything grows between design and launch. Hold the reserve or descope.',
      fromLevel: true,
    })
  }

  const extraFailed = checks.filter(c => !c.passed)
  const flies = result.flies && extraFailed.length === 0
  const base = result.score.final
  const score = flies ? Math.round(base * level.multiplier) : 0

  return {
    level,
    checks,                       // extra checks to append to result.checks
    extraFailed,
    flies,                        // flies under this level's rules
    score,                        // score after the difficulty multiplier
    baseScore: base,
    multiplier: level.multiplier,
    guidance: level.guidance,
    note: level.multiplier === 1 ? null
      : level.multiplier > 1
        ? 'Scores are multiplied by ' + level.multiplier + ' at this level, so a harder run is worth more.'
        : 'Scores are multiplied by ' + level.multiplier + ' at this level, because the events were softened.',
  }
}
