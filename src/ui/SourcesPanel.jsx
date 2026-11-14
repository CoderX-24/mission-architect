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
        Every one of the {count} entries in this game carries a citation to a NASA
        resource. Nothing here is invented to make the game easier.
      </p>
      {[...seen.entries()].map(([url, names]) => (
        <div key={url} className="source">
          <a href={url} target="_blank" rel="noreferrer">{url.split('/').pop()}</a>
          <span className="card-stats">{names.length} entries: {names.slice(0, 6).join(', ')}
            {names.length > 6 ? ' and ' + (names.length - 6) + ' more' : ''}</span>
        </div>
      ))}
    </section>
  )
}
