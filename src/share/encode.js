// The whole mission lives in the URL. No backend, no accounts, no database.
export function encodeConfig(config) {
  try { return encodeURIComponent(btoa(JSON.stringify(config))) }
  catch { return '' }
}


export function decodeConfig(str) {
  try { return JSON.parse(atob(decodeURIComponent(str))) }
  catch { return null }
}


export function readHash() {
  const h = window.location.hash.replace(/^#m=/, '')
  return h ? decodeConfig(h) : null
}


export function shareUrl(config) {
  return window.location.origin + window.location.pathname + '#m=' + encodeConfig(config)
}


// Phases are deep-linkable: ?phase=outpost opens straight on the surface
// segment, and sharing a mission keeps the tab you were looking at. A judge
// following a link should land on the thing you wanted to show them.
const PHASE_IDS = ['objective', 'payload', 'spacecraft', 'orbit', 'simulate',
  'trade', 'outpost', 'weather', 'sources']

export function readPhase() {
  try {
    const p = new URLSearchParams(window.location.search).get('phase')
    return p && PHASE_IDS.includes(p) ? p : null
  } catch { return null }
}

export function writePhase(phase) {
  try {
    const u = new URL(window.location.href)
    if (phase && phase !== 'objective') u.searchParams.set('phase', phase)
    else u.searchParams.delete('phase')
    window.history.replaceState(null, '', u)
  } catch { /* history is not available in every embedding */ }
}
