import COMPONENTS from '../data/components.json' with { type: 'json' }
import INSTRUMENTS from '../data/instruments.json' with { type: 'json' }


const PXM = 13      // pixels per metre
const CHORD = 2.2   // solar wing chord in metres


const pick = (g, id) => COMPONENTS[g].find(c => c.id === id)


export default function SpacecraftView({ config }) {
  const array = pick('array', config.components.array)
  const comms = pick('comms', config.components.comms)
  const structure = pick('structure', config.components.structure)
  const propulsion = pick('propulsion', config.components.propulsion)
  const thermal = pick('thermal', config.components.thermal)
  const instruments = config.instrumentIds
    .map(id => INSTRUMENTS.find(i => i.id === id)).filter(Boolean)


  const W = 460, H = 230, cx = W / 2, cy = H / 2 - 4
  const busH = 34 + Math.min(72, Math.sqrt(structure.maxSupportedKg) * 1.6)
  const busW = busH * 0.72
  const wingLen = Math.max(4, (array.areaM2 / 2) / CHORD * PXM)
  const wingH = CHORD * PXM
  const dishR = Math.max(4, comms.antennaM * PXM / 2)
  const span = (wingLen * 2 + busW) / PXM
  const engineX = cx + busW / 2 - 13
  const nozzle = propulsion.ispS > 1000 ? '#7fd4e0' : '#c98a4b'


  // Instruments mount on the nadir face, sized by mass, stopping clear of the engine.
  const mounted = []
  let ix = cx - busW / 2 + 3
  for (const inst of instruments) {
    const w = Math.max(6, Math.sqrt(inst.massKg) * 1.5)
    const h = Math.max(5, Math.sqrt(inst.massKg) * 1.1)
    if (ix + w > engineX - 4) break
    mounted.push({ id: inst.id, x: ix, w, h, name: inst.name })
    ix += w + 3
  }


  const wing = dir => {
    const x = dir < 0 ? cx - busW / 2 - wingLen : cx + busW / 2
    const cells = Math.max(1, Math.round(wingLen / 9))
    return (
      <g key={dir}>
        <rect x={x} y={cy - wingH / 2} width={wingLen} height={wingH}
          fill="#13314f" stroke="#2f6fb3" />
        {Array.from({ length: cells - 1 }, (_, i) => (
          <line key={i} x1={x + (i + 1) * wingLen / cells} y1={cy - wingH / 2}
            x2={x + (i + 1) * wingLen / cells} y2={cy + wingH / 2}
            stroke="#2f6fb3" strokeWidth=".5" opacity=".5" />
        ))}
        <line x1={x} y1={cy} x2={x + wingLen} y2={cy} stroke="#2f6fb3" strokeWidth=".5" opacity=".5" />
        <rect x={dir < 0 ? cx - busW / 2 - 6 : cx + busW / 2} y={cy - 1.5}
          width="6" height="3" fill="#5b6673" />
      </g>
    )
  }


  return (
    <div className="craft">
      <svg viewBox={'0 0 ' + W + ' ' + H} className="craft-svg" role="img"
        aria-label={'Spacecraft schematic, ' + span.toFixed(1) + ' metre span'}>
        <rect width={W} height={H} fill="#070910" />
        {[-1, 1].map(wing)}


        {thermal.coolingCapable && (
          <g>
            <rect x={cx - busW / 2 - 2} y={cy - busH / 2 + 6} width="3" height={busH * 0.5} fill="#8ea4bd" />
            <rect x={cx + busW / 2 - 1} y={cy - busH / 2 + 6} width="3" height={busH * 0.5} fill="#8ea4bd" />
          </g>
        )}


        <rect x={cx - busW / 2} y={cy - busH / 2} width={busW} height={busH}
          fill="#1b2230" stroke="#515c6e" />
        <rect x={cx - busW / 2 + 4} y={cy - busH / 2 + 4} width={busW - 8} height={busH - 8}
          fill="none" stroke="#2b333d" strokeWidth=".6" />


        <path d={'M ' + (cx - dishR) + ' ' + (cy - busH / 2 - 11) + ' A ' + dishR + ' ' +
          (dishR * 0.5) + ' 0 0 1 ' + (cx + dishR) + ' ' + (cy - busH / 2 - 11) + ' Z'}
          fill="#243041" stroke="#8b95a8" />
        <line x1={cx} y1={cy - busH / 2 - 11} x2={cx} y2={cy - busH / 2}
          stroke="#8b95a8" strokeWidth="1.2" />


        <path d={'M ' + engineX + ' ' + (cy + busH / 2) + ' L ' + (engineX + 11) + ' ' +
          (cy + busH / 2) + ' L ' + (engineX + 14) + ' ' + (cy + busH / 2 + 12) + ' L ' +
          (engineX - 3) + ' ' + (cy + busH / 2 + 12) + ' Z'}
          fill="#1b2230" stroke={nozzle} />


        {mounted.map(m => (
          <rect key={m.id} x={m.x} y={cy + busH / 2} width={m.w} height={m.h}
            fill="#4a2f14" stroke="#f0914a">
            <title>{m.name}</title>
          </rect>
        ))}


        <line x1="24" y1={H - 20} x2={24 + 5 * PXM} y2={H - 20} stroke="#8b95a8" strokeWidth="1.5" />
        <text x="24" y={H - 26} fill="#8b95a8" fontSize="10" fontFamily="system-ui">5 m</text>
      </svg>


      <p className="craft-cap">
        Drawn to scale from your own design &middot; <b>{span.toFixed(1)} m span</b> &middot;{' '}
        <b>{array.areaM2} m&sup2;</b> of array &middot; <b>{comms.antennaM} m</b> dish &middot;{' '}
        {mounted.length} of {instruments.length} instruments shown on the nadir face
        {thermal.coolingCapable && ' \u00B7 radiators fitted'}
        {propulsion.ispS > 1000 && ' \u00B7 ion propulsion'}
      </p>
    </div>
  )
}
