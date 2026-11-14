const PHASES = [
  { id: 'objective', label: 'Objective' },
  { id: 'payload', label: 'Payload' },
  { id: 'spacecraft', label: 'Spacecraft' },
  { id: 'orbit', label: 'Orbit & Launch' },
  { id: 'simulate', label: 'Simulate' },
]


export { PHASES }


export default function PhaseNav({ phase, setPhase }) {
  return (
    <nav className="phases">
      {PHASES.map((p, n) => (
        <button key={p.id}
          className={'phase' + (p.id === phase ? ' on' : '')}
          onClick={() => setPhase(p.id)}>
          <span className="phase-n">{n + 1}</span>{p.label}
        </button>
      ))}
    </nav>
  )
}
