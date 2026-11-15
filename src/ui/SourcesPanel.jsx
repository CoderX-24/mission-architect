import ORBITS from '../data/orbits.json' with { type: 'json' }
import LAUNCHERS from '../data/launchers.json' with { type: 'json' }
import INSTRUMENTS from '../data/instruments.json' with { type: 'json' }
import COMPONENTS from '../data/components.json' with { type: 'json' }


const ALL = [
  ['Orbits', ORBITS],
  ['Launch vehicles', LAUNCHERS],
  ['Instruments', INSTRUMENTS],
  ['Spacecraft components', Object.values(COMPONENTS).flat()],
]


// A raw filename is not a citation a reader can judge. Name the document.
const TITLES = {
  'nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf':
    'NASA \u2014 Design and Develop Science Missions',
  'nasa_csli_cubesat_101_508.pdf': 'NASA \u2014 CubeSat 101',
  'science.nasa.gov/mission/webb/game-build-it-yourself/':
    'NASA \u2014 Build It Yourself: Space Telescope',
  'nasa.github.io/mission-viz/': 'NASA \u2014 Mission Viz',
  'ccmc.gsfc.nasa.gov/tools/DONKI/': 'NASA \u2014 DONKI space weather database',
  'science.nasa.gov/mission/landsat-9/': 'NASA \u2014 Landsat 9',
  'science.nasa.gov/mission/mars-reconnaissance-orbiter/':
    'NASA \u2014 Mars Reconnaissance Orbiter',
  'science.nasa.gov/mission/lro/': 'NASA \u2014 Lunar Reconnaissance Orbiter',
  'science.nasa.gov/mission/spherex/': 'NASA \u2014 SPHEREx',
  'science.nasa.gov/mission/dscovr/': 'NASA \u2014 DSCOVR',
}

function titleFor(url) {
  for (const [frag, title] of Object.entries(TITLES)) if (url.includes(frag)) return title
  // Never fall back to split('/').pop(): a URL ending in a slash renders blank,
  // which is how two of these links became invisible.
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

export default function SourcesPanel() {
  const seen = new Map()
  for (const [, items] of ALL) {
    for (const it of items) {
      if (!it.source) continue
      if (!seen.has(it.source)) seen.set(it.source, [])
      seen.get(it.source).push(it.name)
    }
  }
  const count = ALL.reduce((s, [, items]) => s + items.filter(i => i.source).length, 0)


  return (
    <section className="panel">
      <h2>Where these numbers come from</h2>
      <p className="hint">
        All {count} catalog entries are derived from NASA documentation and flown missions,
        and each one links the document it came from. The values are representative rather
        than copied from a datasheet &mdash; a real solar array is not a catalog item &mdash;
        and they are calibrated so that the trades between mass, power, cost and data behave
        the way they do on a real programme.
      </p>
      {[...seen.entries()].map(([url, names]) => (
        <div key={url} className="source">
          <a href={url} target="_blank" rel="noreferrer">{titleFor(url)}</a>
          <span className="card-stats">{names.length} entries: {names.slice(0, 6).join(', ')}
            {names.length > 6 ? ' and ' + (names.length - 6) + ' more' : ''}</span>
        </div>
      ))}
    </section>
  )
}
