import OBJECTIVES from '../data/objectives.json' with { type: 'json' }


export default function ObjectiveScreen({ config, setConfig }) {
  return (
    <section className="panel">
      <h2>Mission objective</h2>
      <p className="hint">
        Everything downstream follows from this. The objective sets which measurements
        count, which orbits are legal, how long you must survive, and how much you may spend.
      </p>
      {OBJECTIVES.map(o => (
        <button key={o.id}
          className={'card' + (o.id === config.objectiveId ? ' on' : '')}
          onClick={() => setConfig(c => ({ ...c, objectiveId: o.id, orbitId: o.allowedOrbits[0] }))}>
          <span className="card-name">{o.name}</span>
          <span className="card-brief">{o.brief}</span>
          <span className="card-stats">
            needs {o.requiredMeasurements.join(' + ')} &middot; {o.minLifetimeYears} yr minimum
            &middot; ${o.budgetUsdM}M budget
          </span>
        </button>
      ))}
    </section>
  )
}
