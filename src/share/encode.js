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
