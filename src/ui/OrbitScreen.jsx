import OrbitCanvas from '../viz/OrbitCanvas.jsx'
import ORBITS from '../data/orbits.json' with { type: 'json' }
import LAUNCHERS from '../data/launchers.json' with { type: 'json' }
import OBJECTIVES from '../data/objectives.json' with { type: 'json' }


export default function OrbitScreen({ config, setConfig, result }) {
  const objective = OBJECTIVES.find(o => o.id === config.objectiveId)


  return (
    <section className="panel">
      <h2>Orbit</h2>
      <OrbitCanvas orbit={ORBITS.find(o => o.id === config.orbitId)} />
      <p className="hint">
        The orbit sets your sunlight, your eclipse time, your contact time with the ground,
        your radiation dose, and how much propellant you must carry.
      </p>
      {ORBITS.map(o => {
        const legal = objective.allowedOrbits.includes(o.id)
        return (
          <button key={o.id} disabled={!legal}
            className={'card' + (o.id === config.orbitId ? ' on' : '') + (legal ? '' : ' off')}
            onClick={() => setConfig(c => ({ ...c, orbitId: o.id }))}>
            <span className="card-name">
              {o.name}{!legal && <em className="tag-off">not valid for this objective</em>}
            </span>
            <span className="card-brief">{o.notes}</span>
            <span className="card-stats">
              {o.solarDistanceAu} AU &middot; {Math.round(o.eclipseFraction * 100)}% eclipse
              &middot; {o.insertionDeltaVMs} m/s insertion &middot;{' '}
              {o.groundContactMinPerDay} min/day contact
            </span>
          </button>
        )
      })}


      <h2 style={{ marginTop: 26 }}>Launch vehicle</h2>
      <p className="hint">
        Your spacecraft currently masses {Math.round(result.mass.wetKg)} kg fuelled.
      </p>
      {LAUNCHERS.map(l => {
        const cap = l.capacityKg[config.orbitId] || 0
        const fits = cap >= result.mass.wetKg
        return (
          <button key={l.id} disabled={cap === 0}
            className={'card' + (l.id === config.launcherId ? ' on' : '') + (cap === 0 ? ' off' : '')}
            onClick={() => setConfig(c => ({ ...c, launcherId: l.id }))}>
            <span className="card-name">
              {l.name}
              {cap === 0
                ? <em className="tag-off">cannot reach this orbit</em>
                : <em className={fits ? 'tag-bonus' : 'tag-off'}>
                    {fits ? 'fits' : 'too small'}
                  </em>}
            </span>
            <span className="card-brief">{l.notes}</span>
            <span className="card-stats">
              {cap ? cap + ' kg to this orbit' : 'no capability'} &middot; ${l.costUsdM}M
              &middot; {Math.round(l.reliability * 100)}% reliability
            </span>
          </button>
        )
      })}
    </section>
  )
}
