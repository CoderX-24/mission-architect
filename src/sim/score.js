// Real missions are not designed to spend 100% of their budget. They hold reserve,
// because everything grows between design and launch. This function is where that
// idea becomes a game mechanic.
export function gradeMargin(m) {
  if (m < 0)     return { grade: 'FAIL',         label: 'Over budget',                  bonus: 0,  risk: 1.00 }
  if (m < 0.10)  return { grade: 'RISKY',        label: 'No reserve',                   bonus: 0,  risk: 0.55 }
  if (m <= 0.35) return { grade: 'NOMINAL',      label: 'Healthy reserve',              bonus: 10, risk: 0.08 }
  if (m <= 0.50) return { grade: 'GENEROUS',     label: 'Comfortable',                  bonus: 5,  risk: 0.04 }
  return           { grade: 'OVERDESIGNED', label: 'Capability you never used',    bonus: -4, risk: 0.02 }
}


// Science only counts if the instrument measures what the objective asked for.
export function matchValue(instrument, objective) {
  if (objective.requiredMeasurements.includes(instrument.type)) return 1.0
  if (objective.bonusMeasurements.includes(instrument.type)) return 0.25
  return 0
}


export function computeScore({ instruments, objective, dataResult, lifetimeYears, margins, budget }) {
  const sciencePerDay = instruments.reduce((s, i) => s + i.scienceValue * matchValue(i, objective), 0)
  const lifetimeFactor = Math.min(1, lifetimeYears / objective.minLifetimeYears)
  const scienceScore = sciencePerDay * dataResult.returnFraction * lifetimeFactor * 100


  const grades = {}
  let marginBonus = 0
  for (const [k, v] of Object.entries(margins)) {
    grades[k] = gradeMargin(v)
    marginBonus += grades[k].bonus
  }


  const efficiency = budget.totalUsdM > 0 ? scienceScore / budget.totalUsdM : 0
  const efficiencyBonus = Math.round(efficiency * 20)


  return { sciencePerDay, lifetimeFactor, scienceScore, grades, marginBonus, efficiency, efficiencyBonus }
}
