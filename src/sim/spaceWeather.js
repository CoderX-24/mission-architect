import FALLBACK from '../data/spaceweather-fallback.json' with { type: 'json' }


const API = 'https://api.nasa.gov/DONKI/CME'


function normalise(raw) {
  return raw
    .filter(c => c.cmeAnalyses && c.cmeAnalyses.length && c.cmeAnalyses[0].speed)
    .map(c => ({
      id: c.activityID,
      start: c.startTime,
      speed: c.cmeAnalyses[0].speed,
      type: c.cmeAnalyses[0].type,
      halfAngle: c.cmeAnalyses[0].halfAngle,
      instruments: (c.instruments || []).map(i => i.displayName),
    }))
    .sort((a, b) => (a.start < b.start ? -1 : 1))
}


// Live where possible, bundled where not. The app must never fail to validate.
//
// Four screens want this data and each used to fetch on mount. With DEMO_KEY
// that burns the ten-request allowance in a few tab clicks, and the record
// count would change under the user mid-session as later screens fell back to
// the snapshot. One promise is shared by every caller for the life of the page,
// so the whole session agrees on one set of storms.
let inflight = null

export function fetchCMEs(days = 60) {
  if (!inflight) inflight = loadCMEs(days)
  return inflight
}

async function loadCMEs(days) {
  const key = import.meta.env.VITE_NASA_API_KEY || 'DEMO_KEY'
  const fmt = d => d.toISOString().slice(0, 10)
  const end = new Date()
  const start = new Date(Date.now() - days * 86400000)
  // A hung endpoint must not leave "Retrieving..." on screen forever.
  const ctl = typeof AbortController === 'function' ? new AbortController() : null
  const timer = ctl ? setTimeout(() => ctl.abort(), 6000) : null
  try {
    const res = await fetch(API + '?startDate=' + fmt(start) + '&endDate=' + fmt(end) +
      '&api_key=' + key, ctl ? { signal: ctl.signal } : undefined)
    const text = await res.text()
    if (!text.trimStart().startsWith('[')) throw new Error('not json')
    const out = normalise(JSON.parse(text))
    if (!out.length) throw new Error('empty')
    return { source: 'live', cmes: out }
  } catch {
    return { source: 'bundled', cmes: FALLBACK }
  } finally {
    if (timer) clearTimeout(timer)
  }
}


// A CME's effect on a spacecraft depends on its speed and on how exposed the orbit is.
// Earth's magnetosphere shields low orbits; geostationary, lunar and interplanetary
// spacecraft take a far larger dose. radiationIndex carries that exposure.
export function stressOf(cme, orbit) {
  return (cme.speed / 1000) * (0.30 + orbit.radiationIndex)
}


const BANDS = [
  { min: 0.95, label: 'Extreme',  power: 0.20, data: 0.10, needsRedundantAdcs: true },
  { min: 0.65, label: 'Severe',   power: 0.12, data: 0.05, needsRedundantAdcs: false },
  { min: 0.40, label: 'Moderate', power: 0.06, data: 0.00, needsRedundantAdcs: false },
]


export function bandFor(stress) {
  return BANDS.find(b => stress >= b.min) || null
}


export function assessSpaceWeather(cmes, { orbit, margins, adcsRedundant }) {
  const threats = []
  for (const cme of cmes) {
    const stress = stressOf(cme, orbit)
    const band = bandFor(stress)
    if (!band) continue


    const reasons = []
    if (margins.power < band.power) {
      reasons.push('particle flux degraded array output below the instrument load (needed ' +
        Math.round(band.power * 100) + '% power margin, had ' + Math.round(margins.power * 100) + '%)')
    }
    if (band.data > 0 && margins.data < band.data) {
      reasons.push('ionospheric disturbance interrupted downlink and onboard storage overflowed (needed ' +
        Math.round(band.data * 100) + '% data margin, had ' + Math.round(margins.data * 100) + '%)')
    }
    if (band.needsRedundantAdcs && !adcsRedundant) {
      reasons.push('a single-event upset tripped the attitude control system with no redundant unit to take over')
    }


    threats.push({
      ...cme, stress, band: band.label, survived: reasons.length === 0, reasons,
      critical: reasons.length >= 2,
    })
  }


  const hits = threats.filter(t => !t.survived)
  return {
    total: cmes.length,
    dateFrom: cmes.length ? cmes[0].start : null,
    dateTo: cmes.length ? cmes[cmes.length - 1].start : null,
    threats,
    encountered: threats.length,
    degraded: hits.length,
    critical: hits.filter(t => t.critical).length,
    worst: threats.slice().sort((a, b) => b.stress - a.stress)[0] || null,
    survivalRate: threats.length ? 1 - hits.length / threats.length : 1,
  }
}
