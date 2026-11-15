import { ownerOfPhase } from '../net/protocol.js'

// `ownable` marks the phases a role can own in a team session. The rest are
// shared views nobody has to ask permission to open.
const PHASES = [
  { id: 'objective', label: 'Objective', ownable: true },
  { id: 'payload', label: 'Payload', ownable: true },
  { id: 'spacecraft', label: 'Spacecraft', ownable: true },
  { id: 'orbit', label: 'Orbit & Launch', ownable: true },
  { id: 'simulate', label: 'Simulate', ownable: true },
  { id: 'debrief', label: 'Debrief' },
  { id: 'trade', label: 'Trade Space' },
  { id: 'outpost', label: 'Surface Segment' },
  { id: 'weather', label: 'Space Weather' },
  { id: 'sources', label: 'Sources' },
]


export { PHASES }


export default function PhaseNav({ phase, setPhase, scope = null, peek = false }) {
  // Solo: every tab. In a session: your own phases and the shared views, plus
  // your teammates' phases only while you are explicitly peeking at them.
  const visible = PHASES.filter(p => {
    if (!scope) return true
    if (!p.ownable) return true
    if (scope.owned.includes(p.id)) return true
    return peek
  })

  return (
    <nav className="phases">
      {visible.map(p => {
        const mine = !scope || !p.ownable || scope.owned.includes(p.id)
        const owner = mine ? null : ownerOfPhase(p.id)
        const n = PHASES.findIndex(x => x.id === p.id) + 1
        return (
          <button key={p.id}
            className={'phase' + (p.id === phase ? ' on' : '') + (mine ? '' : ' not-mine') +
              (scope && mine && p.ownable ? ' yours' : '')}
            title={owner ? owner.name + ' controls this screen' : undefined}
            onClick={() => setPhase(p.id)}>
            <span className="phase-n">{n}</span>{p.label}
            {!mine && <em className="phase-lock" aria-label="controlled by another player">
              {owner ? owner.tag : 'LOCKED'}</em>}
          </button>
        )
      })}
    </nav>
  )
}
