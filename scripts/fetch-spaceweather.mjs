// Pulls real coronal mass ejection records from NASA's DONKI database and bundles
// them as an offline fallback, so the app still validates missions against real
// space weather when the API is unreachable.
// Usage: source .env && node scripts/fetch-spaceweather.mjs
import { writeFileSync } from 'node:fs'


const KEY = process.env.VITE_NASA_API_KEY || 'DEMO_KEY'
const WINDOWS = [
  ['2026-07-16', '2026-09-13'],
  ['2026-09-14', '2026-11-13'],
]


const all = []
for (const [start, end] of WINDOWS) {
  const url = 'https://api.nasa.gov/DONKI/CME?startDate=' + start +
              '&endDate=' + end + '&api_key=' + KEY
  const res = await fetch(url)
  const text = await res.text()
  if (!text.trimStart().startsWith('[')) {
    console.log('window ' + start + ' failed: ' + text.slice(0, 140))
    continue
  }
  const data = JSON.parse(text)
  console.log('window ' + start + ' to ' + end + ' -> ' + data.length + ' CMEs')
  all.push(...data)
}


const out = all
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


writeFileSync('src/data/spaceweather-fallback.json', JSON.stringify(out, null, 1) + '\n')
console.log('BUNDLED ' + out.length + ' CMEs, ' +
  (out[0] && out[0].start) + ' to ' + (out[out.length - 1] && out[out.length - 1].start))
