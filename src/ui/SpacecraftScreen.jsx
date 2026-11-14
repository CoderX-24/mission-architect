import COMPONENTS from '../data/components.json' with { type: 'json' }


const GROUPS = [
  { key:'array',      label:'Solar array',      hint:'Output falls with the square of distance from the Sun, and degrades every year in orbit.' },
  { key:'battery',    label:'Battery',          hint:'Must carry the entire spacecraft load through every eclipse, without discharging too deeply.' },
  { key:'comms',      label:'Communications',   hint:'Decides how much of the science you collect actually reaches the ground.' },
  { key:'adcs',       label:'Attitude control', hint:'Must be at least as precise as your tightest instrument. Only the redundant option survives a wheel failure.' },
  { key:'propulsion', label:'Propulsion',       hint:'Higher specific impulse means far less propellant for the same delta-v.' },
  { key:'thermal',    label:'Thermal control',  hint:'Instruments that need cooling will not function without an active system.' },
  { key:'obc',        label:'Flight computer',  hint:'Radiation-hardened parts are slower, and survive orbits that would kill a commercial chip.' },
  { key:'structure',  label:'Structure',        hint:'Must be rated to carry your payload mass.' },
]


function describe(key, c) {
  const base = c.massKg + ' kg \u00B7 ' + (c.powerW ? c.powerW + ' W \u00B7 ' : '') + '$' + c.costUsdM + 'M'
  if (key === 'array')      return c.areaM2 + ' m\u00B2 at ' + Math.round(c.efficiency * 100) + '% \u00B7 ' + base
  if (key === 'battery')    return c.capacityWh + ' Wh \u00B7 ' + Math.round(c.depthOfDischarge * 100) + '% usable \u00B7 ' + base
  if (key === 'comms')      return c.band + '-band \u00B7 ' + c.antennaM + ' m antenna \u00B7 ' + c.txPowerW + ' W transmit \u00B7 ' + base
  if (key === 'adcs')       return c.pointingArcsec + '\u2033 pointing \u00B7 ' + (c.redundant ? 'redundant' : 'single string') + ' \u00B7 ' + base
  if (key === 'propulsion') return c.ispS + ' s specific impulse \u00B7 ' + base
  if (key === 'thermal')    return (c.coolingCapable ? 'can cool instruments' : 'passive only') + ' \u00B7 ' + base
  if (key === 'obc')        return c.storageGb + ' GB storage \u00B7 ' + (c.redundant ? 'rad-hard' : 'commercial') + ' \u00B7 ' + base
  if (key === 'structure')  return 'carries ' + c.maxSupportedKg + ' kg \u00B7 ' + base
  return base
}


export default function SpacecraftScreen({ config, setConfig }) {
  const choose = (group, id) => setConfig(c => ({
    ...c, components: { ...c.components, [group]: id },
  }))


  return (
    <section className="panel">
      <h2>Spacecraft bus</h2>
      <p className="hint">
        Every subsystem adds mass, draws power and costs money. Watch the margin bars move
        as you choose.
      </p>
      {GROUPS.map(g => (
        <div key={g.key} className="group">
          <h3>{g.label}</h3>
          <p className="group-hint">{g.hint}</p>
          {COMPONENTS[g.key].map(c => (
            <button key={c.id}
              className={'card' + (config.components[g.key] === c.id ? ' on' : '')}
              onClick={() => choose(g.key, c.id)}>
              <span className="card-name">{c.name}</span>
              {c.blurb && <span className="card-brief">{c.blurb}</span>}
              <span className="card-stats">{describe(g.key, c)}</span>
            </button>
          ))}
        </div>
      ))}
    </section>
  )
}
