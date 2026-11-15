import OBJECTIVES from '../data/objectives.json' with { type: 'json' }
import FlightConsole from '../viz/FlightConsole.jsx'


export default function ResultScreen({ config, setConfig, result, diff = null }) {
  const objective = OBJECTIVES.find(o => o.id === config.objectiveId)
  const flies = diff ? diff.flies : result.flies
  const score = diff ? diff.score : result.score.final
  const groundedByLevel = diff && result.flies && !diff.flies
  const summary = groundedByLevel
    ? 'The engine passes this design, but ' + diff.level.name + ' holds it to a higher bar: ' +
      diff.extraFailed.length + ' level rule(s) are not met, so it does not fly at this level.'
    : result.summary


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


      {/* The difficulty layer can ground a design the engine passed, and
          multiplies the score. Read it from the same place the dashboard does,
          or the two halves of the screen contradict each other. */}
      <div className={'big-verdict ' + (flies ? 'ok' : 'bad')}>
        <span className="bv-label">{flies ? 'MISSION FLIES' : 'MISSION DOES NOT FLY'}</span>
        <span className="bv-score">{score}</span>
      </div>
      <p className="summary">{summary}</p>


      {flies && (
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
