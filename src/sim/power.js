import { SOLAR_CONSTANT, PACKING_COSINE_LOSS } from './constants.js'


export function computePower({ array, battery, orbit, loadW, lifetimeYears }) {
  // Solar flux falls off with the inverse square of distance from the Sun.
  const flux = SOLAR_CONSTANT / Math.pow(orbit.solarDistanceAu, 2)
  const powerBOL = flux * array.areaM2 * array.efficiency * PACKING_COSINE_LOSS


  // Radiation accelerates cell degradation, so high-radiation orbits age the array faster.
  const degradation = array.degradationPerYear * (1 + orbit.radiationIndex)
  const powerEOL = powerBOL * Math.pow(1 - degradation, lifetimeYears)
  const orbitAvgW = powerEOL * (1 - orbit.eclipseFraction)


  // The battery has to carry the full load through every eclipse.
  const eclipseMin = orbit.periodMin * orbit.eclipseFraction
  const energyNeededWh = (loadW * eclipseMin / 60) / (battery.depthOfDischarge * 0.9)


  return {
    fluxWm2: flux, powerBOL, powerEOL, orbitAvgW, loadW,
    eclipseMin, energyNeededWh, batteryCapacityWh: battery.capacityWh,
    batteryOk: battery.capacityWh >= energyNeededWh,
    margin: (orbitAvgW - loadW) / Math.max(orbitAvgW, 1),
  }
}
