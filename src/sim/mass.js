export function computeMass({ instruments, components }) {
  const payloadKg = instruments.reduce((s, i) => s + i.massKg, 0)
  const busKg = Object.values(components).reduce((s, c) => s + (c.massKg || 0), 0)
  return { payloadKg, busKg, dryKg: payloadKg + busKg }
}
