import ROLES from '../data/roles.json' with { type: 'json' }
import { gradeMargin } from '../sim/score.js'


export default function RoleBar({ role, setRole, result }) {
  const active = ROLES.find(r => r.id === role)


  return (
    <div className="rolebar">
      <div className="role-pick">
        <span className="role-label">Team mode</span>
        {ROLES.map(r => (
          <button key={r.id}
            className={'role' + (r.id === role ? ' on' : '')}
            onClick={() => setRole(r.id === role ? null : r.id)}>
            {r.name}
          </button>
        ))}
      </div>


      {active && (
        <div className="role-brief">
          <p><strong>You decide:</strong> {active.decides}</p>
          <p><strong>You want:</strong> {active.wants}</p>
          <p className="role-tension">{active.tension}</p>
          <p className="role-metric">
            You are accountable for <b>{active.metric} margin</b>, currently{' '}
            <b>{Math.round(result.margins[active.metric] * 100)}%</b>
            {' \u2014 '}{gradeMargin(result.margins[active.metric]).label.toLowerCase()}.
          </p>
          <p className="role-hand">
            Done with your decisions? Share the mission link and hand it to the next role.
          </p>
        </div>
      )}
    </div>
  )
}
