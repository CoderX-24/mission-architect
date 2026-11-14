import OBJECTIVES from '../data/objectives.json' with { type: 'json' }
import FlightConsole from '../viz/FlightConsole.jsx'


export default function ResultScreen({ config, setConfig, result }) {
  const objective = OBJECTIVES.find(o => o.id === config.objectiveId)


  return (
    <section className="panel">
      <h2>Mission simulation</h2>


      <div className="life">
        <label htmlFor="life">
          Planned mission lifetime: <strong>{config.lifetimeYears} years</strong>
          <span className="group-hint"> (this objective needs {objective.minLifetimeYears})</span>
        </label>
        <input id="life" type="range" min="1" max="12" value={config.lifetimeYears}
          onChange={e => setConfig(c => ({ ...c, lifetimeYears: Number(e.target.value) }))} />
        <p className="group-hint">
          Longer missions return more science, but need more propellant for station-keeping,
          cost more to operate, and fly on an array that has degraded for more years.
        </p>
      </div>


      <div className={'big-verdict ' + (result.flies ? 'ok' : 'bad')}>
        <span className="bv-label">{result.flies ? 'MISSION FLIES' : 'MISSION DOES NOT FLY'}</span>
        <span className="bv-score">{result.score.final}</span>
      </div>
      <p className="summary">{result.summary}</p>


      {result.flies && (
        <>
          <FlightConsole config={config} result={result} />

          <h3>Score breakdown</h3>
          <div className="rows">
            <div><span>Science value per day</span><b>{result.score.sciencePerDay.toFixed(1)}</b></div>
            <div><span>Fraction of data returned</span><b>{Math.round(result.data.returnFraction * 100)}%</b></div>
            <div><span>Lifetime achieved</span><b>{Math.round(result.score.lifetimeFactor * 100)}%</b></div>
            <div><span>Base science score</span><b>{Math.round(result.score.scienceScore)}</b></div>
            <div><span>Margin discipline bonus</span><b>{result.score.marginBonus > 0 ? '+' : ''}{result.score.marginBonus}</b></div>
            <div><span>Cost efficiency bonus</span><b>+{result.score.efficiencyBonus}</b></div>
            <div><span>In-flight risk multiplier</span><b>&times;{result.score.riskMultiplier.toFixed(2)}</b></div>
          </div>


          <h3>Flight log</h3>
          <p className="group-hint">
            Events are drawn from your design, so the same spacecraft always meets the same
            trials. Margin is what you survive them with.
          </p>
          {result.events.map(e => (
            <div key={e.id} className={'event ' + (e.survived ? 'pass' : 'fail')}>
              <span className="event-head">
                <strong>{e.survived ? 'SURVIVED' : 'DEGRADED'}</strong>{e.name}
                <em>needed {e.required}</em>
              </span>
              <span className="card-brief">{e.narrative}</span>
              <span className="event-out">{e.outcome}</span>
            </div>
          ))}


          <h3>Closest real mission</h3>
          <p className="analogue">
            Your design resembles <a href={result.analogue.url} target="_blank" rel="noreferrer">
            {result.analogue.mission}</a>.
          </p>
        </>
      )}


      {!result.flies && (
        <p className="group-hint">
          Fix the failing checks below, then simulate again. Every failure names the numbers
          and the way out.
        </p>
      )}
    </section>
  )
}
