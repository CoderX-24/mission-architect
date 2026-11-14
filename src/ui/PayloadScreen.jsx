import INSTRUMENTS from '../data/instruments.json' with { type: 'json' }
import OBJECTIVES from '../data/objectives.json' with { type: 'json' }


export default function PayloadScreen({ config, setConfig }) {
  const objective = OBJECTIVES.find(o => o.id === config.objectiveId)
  const toggle = (id) => setConfig(c => ({
    ...c,
    instrumentIds: c.instrumentIds.includes(id)
      ? c.instrumentIds.filter(x => x !== id)
      : [...c.instrumentIds, id],
  }))


  return (
    <section className="panel">
      <h2>Science payload</h2>
      <p className="hint">
        Requires {objective.requiredMeasurements.join(' and ')}. Bonus for{' '}
        {objective.bonusMeasurements.join(' or ')}. Anything else adds mass, power and cost
        for zero science.
      </p>
      <div className="card-grid">
      {INSTRUMENTS.map(i => {
        const on = config.instrumentIds.includes(i.id)
        const req = objective.requiredMeasurements.includes(i.type)
        const bonus = objective.bonusMeasurements.includes(i.type)
        return (
          <button key={i.id} onClick={() => toggle(i.id)} className={'card' + (on ? ' on' : '')}>
            <span className="card-name">
              {i.name}
              {req && <em className="tag-req">required</em>}
              {bonus && <em className="tag-bonus">bonus</em>}
            </span>
            <span className="card-brief">{i.blurb}</span>
            <span className="card-stats">
              {i.massKg} kg &middot; {i.powerW} W &middot; ${i.costUsdM}M &middot;{' '}
              {i.dataRateMbps} Mbps at {Math.round(i.dutyCycle * 100)}% duty &middot;{' '}
              needs {i.pointingArcsec}&Prime; pointing
            </span>
          </button>
        )
      })}
      </div>
    </section>
  )
}
