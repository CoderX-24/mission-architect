import { gradeMargin } from '../sim/score.js'


const GRADE_COLOR = {
  FAIL: '#e5484d', RISKY: '#f5a524', NOMINAL: '#3dd68c',
  GENEROUS: '#2aa3b8', OVERDESIGNED: '#7a8596',
}


function Bar({ label, margin, detail }) {
  const g = gradeMargin(margin)
  const pct = Math.max(0, Math.min(100, (margin + 0.2) / 1.2 * 100))
  return (
    <div className="bar">
      <div className="bar-head">
        <span className="bar-label">{label}</span>
        <span className="bar-pct" style={{ color: GRADE_COLOR[g.grade] }}>
          {Math.round(margin * 100)}%
        </span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: pct + '%', background: GRADE_COLOR[g.grade] }} />
      </div>
      <div className="bar-foot">
        <span style={{ color: GRADE_COLOR[g.grade] }}>{g.label}</span>
        {detail && <span className="bar-detail">{detail}</span>}
      </div>
    </div>
  )
}


export default function Dashboard({ result }) {
  const m = result.margins
  return (
    <aside className="dashboard">
      <h2>Margins</h2>
      <p className="hint">Real missions hold 10&ndash;35% reserve. Spend it all and events will end you.</p>
      <Bar label="Mass"   margin={m.mass}   detail={Math.round(result.mass.wetKg) + ' / ' + result.mass.capacityKg + ' kg'} />
      <Bar label="Power"  margin={m.power}  detail={Math.round(result.power.orbitAvgW) + ' / ' + Math.round(result.power.loadW) + ' W'} />
      <Bar label="Budget" margin={m.budget} detail={'$' + result.budget.totalUsdM.toFixed(0) + 'M / $' + result.budget.budgetUsdM + 'M'} />
      <Bar label="Data"   margin={m.data}   detail={Math.round(result.data.returnFraction * 100) + '% returned'} />
      <div className={'verdict ' + (result.flies ? 'ok' : 'bad')}>
        {result.flies ? 'FLIES' : 'DOES NOT FLY'}
        <span className="score">{result.score.final}</span>
      </div>
    </aside>
  )
}
