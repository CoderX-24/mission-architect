import { G0 } from './constants.js'


export function computeDeltaV({ orbit, lifetimeYears }) {
  const insertion = orbit.insertionDeltaVMs
  const stationKeeping = orbit.stationKeepingMsPerYear * lifetimeYears
  const disposal = 0.05 * (insertion + stationKeeping) + 30
  return { insertion, stationKeeping, disposal, totalMs: insertion + stationKeeping + disposal }
}


// Tsiolkovsky rocket equation.
export function propellantMass(dryKg, deltaVMs, ispS) {
  return dryKg * (Math.exp(deltaVMs / (ispS * G0)) - 1)
}
