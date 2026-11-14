import { useMemo, useState } from 'react'
import OBJECTIVES from './data/objectives.json' with { type: 'json' }
import { runMission } from './sim/runMission.js'
import Dashboard from './ui/Dashboard.jsx'
import PhaseNav from './ui/PhaseNav.jsx'
import ObjectiveScreen from './ui/ObjectiveScreen.jsx'
import PayloadScreen from './ui/PayloadScreen.jsx'
import SpacecraftScreen from './ui/SpacecraftScreen.jsx'
import OrbitScreen from './ui/OrbitScreen.jsx'
import ResultScreen from './ui/ResultScreen.jsx'
import './App.css'


const INITIAL = {
  objectiveId: 'forest_biomass',
  orbitId: 'leo_sso',
  launcherId: 'rideshare',
  instrumentIds: ['multispectral_imager'],
  components: {
    array: 'array_m', battery: 'batt_m', comms: 'comms_x', adcs: 'adcs_wheels',
    propulsion: 'prop_mono', thermal: 'therm_passive', obc: 'obc_basic', structure: 'struct_small',
  },
  lifetimeYears: 5,
}


export default function App() {
  const [config, setConfig] = useState(INITIAL)
  const [phase, setPhase] = useState('objective')
  const result = useMemo(() => runMission(config), [config])
  const objective = OBJECTIVES.find(o => o.id === config.objectiveId)
  const props = { config, setConfig, result }


  return (
    <div className="app">
      <header>
        <h1>Mission Architect</h1>
        <p>{objective.name} &mdash; {objective.brief}</p>
      </header>


      <PhaseNav phase={phase} setPhase={setPhase} />


      <main>
        <div className="stage">
          {phase === 'objective' && <ObjectiveScreen {...props} />}
          {phase === 'payload' && <PayloadScreen {...props} />}
          {phase === 'spacecraft' && <SpacecraftScreen {...props} />}
          {phase === 'orbit' && <OrbitScreen {...props} />}
          {phase === 'simulate' && <ResultScreen {...props} />}


          <section className="panel checks">
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


        <Dashboard result={result} />
      </main>
    </div>
  )
}
