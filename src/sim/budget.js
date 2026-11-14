import { INTEGRATION_FACTOR, OPS_COST_PER_YEAR_USDM } from './constants.js'


export function computeBudget({ instruments, components, launcher, lifetimeYears, objective }) {
  const instrumentCost = instruments.reduce((s, i) => s + i.costUsdM, 0)
  const busCost = Object.values(components).reduce((s, c) => s + (c.costUsdM || 0), 0)
  const devCost = (instrumentCost + busCost) * INTEGRATION_FACTOR
  const opsCost = OPS_COST_PER_YEAR_USDM * lifetimeYears
  const totalUsdM = devCost + launcher.costUsdM + opsCost
  return {
    instrumentCost, busCost, devCost, opsCost, launchCost: launcher.costUsdM, totalUsdM,
    budgetUsdM: objective.budgetUsdM,
    margin: (objective.budgetUsdM - totalUsdM) / objective.budgetUsdM,
  }
}
