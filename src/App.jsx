import { useMemo, useState } from 'react'
import INSTRUMENTS from './data/instruments.json' with { type: 'json' }
import OBJECTIVES from './data/objectives.json' with { type: 'json' }
import { runMission } from './sim/runMission.js'
import Dashboard from './ui/Dashboard.jsx'
import './App.css'


const INITIAL = {
  objectiveId: 'forest_biomass',
  orbitId: 'leo_sso',
  launcherId: 'falcon9',
  instrumentIds: ['multispectral_imager'],
  components: {
    array: 'array_m', battery: 'batt_m', comms: 'comms_x', adcs: 'adcs_wheels',
    propulsion: 'prop_mono', thermal: 'therm_passive', obc: 'obc_basic', structure: 'struct_small',
  },
  lifetimeYears: 5,
}


export default function App() {
  const [config, setConfig] = useState(INITIAL)
  const result = useMemo(() => runMission(config), [config])
  const objective = OBJECTIVES.find(o => o.id === config.objectiveId)


  const toggle = (id) => setConfig(c => ({
    ...c,
    instrumentIds: c.instrumentIds.includes(id)
      ? c.instrumentIds.filter(x => x !== id)
      : [...c.instrumentIds, id],
  }))


  return (
    <div className="app">
      <header>
        <h1>Mission Architect</h1>
        <p>{objective.name} &mdash; {objective.brief}</p>
      </header>


      <main>
        <section className="picker">
          <h2>Payload</h2>
          <p className="hint">
            Requires: {objective.requiredMeasurements.join(', ')}. Anything else scores nothing.
          </p>
          {INSTRUMENTS.map(i => {
            const on = config.instrumentIds.includes(i.id)
            const useful = objective.requiredMeasurements.includes(i.type)
            return (
              <button key={i.id} onClick={() => toggle(i.id)} className={'inst' + (on ? ' on' : '')}>
                <span className="inst-name">{i.name}{useful && <em> required</em>}</span>
                <span className="inst-stats">
                  {i.massKg} kg &middot; {i.powerW} W &middot; ${i.costUsdM}M &middot; {i.dataRateMbps} Mbps
                </span>
              </button>
            )
          })}
        </section>


        <Dashboard result={result} />
      </main>


      <section className="checks">
        <h2>Engineering review</h2>
        {result.checks.map(c => (
          <div key={c.id} className={'check ' + (c.passed ? 'pass' : 'fail')}>
            <strong>{c.passed ? 'PASS' : 'FAIL'}</strong>
            <span>{c.message}</span>
            {!c.passed && <em>{c.fix}</em>}
          </div>
        ))}
      </section>
    </div>
  )
}
