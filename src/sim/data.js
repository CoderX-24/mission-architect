export function computeData({ instruments, comms, orbit }) {
  const generatedGbPerDay =
    instruments.reduce((s, i) => s + i.dataRateMbps * i.dutyCycle, 0) * 86400 / 8000


  // linkFactor folds range loss and ground-station aperture into one calibrated term.
  const downlinkMbps =
    comms.baseRateMbps * (comms.txPowerW / 50) * Math.pow(comms.antennaM / 1.0, 2) * orbit.linkFactor
  const downlinkGbPerDay = downlinkMbps * orbit.groundContactMinPerDay * 60 / 8000


  const returnFraction = generatedGbPerDay > 0 ? Math.min(1, downlinkGbPerDay / generatedGbPerDay) : 1


  return {
    generatedGbPerDay, downlinkMbps, downlinkGbPerDay, returnFraction,
    margin: Math.max(-1, Math.min(2,
      (downlinkGbPerDay - generatedGbPerDay) / Math.max(generatedGbPerDay, 0.001))),
  }
}
