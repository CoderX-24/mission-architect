import { useEffect, useMemo, useState } from 'react'
import ORBITS from '../data/orbits.json' with { type: 'json' }
import COMPONENTS from '../data/components.json' with { type: 'json' }
import { designOutpost, SURFACE_ASSUMPTIONS } from '../sim/outpost.js'
import { fetchCMEs, assessSpaceWeather } from '../sim/spaceWeather.js'
import OutpostView from '../viz/OutpostView.jsx'

const n1 = v => (Math.round(v * 10) / 10).toLocaleString('en-US')
const n0 = v => Math.round(v).toLocaleString('en-US')

export default function OutpostScreen({ config, setConfig, result }) {
  const orbit = ORBITS.find(o => o.id === config.orbitId)
  const adcs = COMPONENTS.adcs.find(a => a.id === config.components.adcs)
  const [playing, setPlaying] = useState(true)
  const [feed, setFeed] = useState(null)

  useEffect(() => {
    let live = true
    fetchCMEs().then(f => { if (live) setFeed(f) })
    return () => { live = false }
  }, [])

  const o = useMemo(() => designOutpost({ config, result }), [config, result])

  // Storm grading goes through assessSpaceWeather, the same function the Space
  // Weather tab uses. The surface does not get its own storm model.
  const wx = useMemo(() => {
    if (!feed) return null
    return assessSpaceWeather(feed.cmes, {
      orbit, margins: result.margins, adcsRedundant: Boolean(adcs && adcs.redundant),
    })
  }, [feed, orbit, result, adcs])

  const pm = o.power.margin
  const pmTone = pm < 0 ? 'bad' : pm < 0.10 ? 'warn' : pm <= 0.50 ? 'ok' : 'dim'
  const relayTone = o.data.relayFraction >= 0.9 ? 'ok' : o.data.relayFraction >= 0.5 ? 'warn' : 'bad'

  return (
    <section className="panel outpost">
      <h2>Surface segment</h2>

      <p className="hint">
        An orbiter is the first element of a programme, not the whole of it. This is the
        installation your design puts on <b>{o.site.body}</b> &mdash; drawn to scale, every
        structure dimensioned from a number the mission engine already reported. The array you
        chose sets the size of the solar farm. The battery you chose decides whether the site
        survives the night. The one link you chose has to carry everything home.
        <b> Nothing here is decoration: hover any structure for its dimensions.</b>
      </p>

      <div className={'outpost-verdict ' + o.cls.id}>
        <div>
          <span className="ov-label">{o.cls.label}</span>
          <span className="ov-sub">{o.cls.sub}</span>
        </div>
        <div className="ov-site">
          <b>{o.site.name}</b>
          <span>{o.site.place}</span>
        </div>
      </div>

      <OutpostView outpost={o} orbit={orbit} relayFraction={o.data.relayFraction}
        playing={playing} setPlaying={setPlaying} />

      <div className="console-ctl">
        <button className="share-btn" onClick={() => setPlaying(p => !p)}>
          {playing ? 'Pause day cycle' : 'Play day cycle'}
        </button>
        <span className="ctl-note">
          One site day every 26 seconds, or drag the slider &middot; the site is lit{' '}
          <b>{Math.round(o.site.illumination * 100)}%</b> of the time &middot; shadows follow the
          Sun &middot; your orbiter passes overhead every{' '}
          <b>{Math.round(orbit.periodMin)} min</b> of mission time
        </span>
      </div>

      <div className="readouts outpost-readouts">
        <Readout label="Hardware landed" value={o.units} unit="units"
          tone={o.units > 0 ? 'ok' : 'bad'}
          note={o.deliverable
            ? o.modulesPerLanding + ' per flight x ' + o.landings + ' years'
            : 'launch vehicle cannot deliver'} />
        <Readout label="Power available" value={n1(o.power.availKw)} unit="kW" tone="warn"
          note={n0(o.power.surfaceFlux) + ' W/m2 on ' + o.power.farmAreaM2 + ' m2 of array'} />
        <Readout label="Power margin" value={Math.round(pm * 100)} unit="%" tone={pmTone}
          note={n1(o.power.loadKw) + ' kW drawn of ' + n1(o.power.availKw) + ' kW'} />
        <Readout label="Crew supported" value={o.crew.crew} unit=""
          tone={o.crew.crew > 0 ? 'ok' : 'dim'}
          note={o.crew.crew > 0
            ? o.habitats + ' module(s), limited by ' + o.crew.limit
            : 'no power left after the instruments'} />
        <Readout label="Science home" value={Math.round(o.data.relayFraction * 100)} unit="%"
          tone={relayTone}
          note={n1(o.data.relayGbPerDay) + ' of ' + n1(o.data.generatedGbPerDay) + ' GB/day'} />
        <Readout label="Night survival" value={n1(o.night.survivalH)} unit="h"
          tone={o.night.survives ? 'ok' : 'bad'}
          note={'the dark lasts ' + o.night.nightHours + ' h here'} />
      </div>

      {o.data.lostGbPerDay > 0 && (
        <p className="console-warn">
          <b>One orbiter, {o.units} instrument suites.</b> The outpost measures{' '}
          {n1(o.data.generatedGbPerDay)} GB/day and the spacecraft you designed can carry{' '}
          {n1(o.data.relayGbPerDay)} GB/day of it home, so{' '}
          <b>{n1(o.data.lostGbPerDay)} GB/day never leaves {o.site.body}</b>
          {o.data.backlogDays !== null && <> &mdash; the site&rsquo;s {n0(o.data.storageGb)} GB of
            storage fills in {n1(o.data.backlogDays)} days</>}. Landing more hardware multiplies
          what you can measure. It does not multiply the link.
        </p>
      )}

      {!o.night.survives && o.units > 0 && (
        <p className="console-warn alt">
          <b>The batteries do not make it through the night.</b> The pack you specified carries an
          orbiter through a {n1(result.power.eclipseMin)} minute eclipse; here it is being asked to
          carry {n1(o.power.loadKw)} kW through <b>{o.night.nightHours} hours</b> of darkness. It
          lasts {n1(o.night.survivalH)} h. Riding out the dark on cells alone would need{' '}
          {n0(o.night.needKwh)} kWh &mdash; <b>{n0(o.night.multiple)}x</b> the bank you have. This
          is the reason surface power studies reach for a fission reactor instead of more battery.
        </p>
      )}

      {o.water.kgPerDay > 0 && (
        <p className="outpost-note">
          <b>{n1(o.water.kgPerDay)} kg of water a day</b> from {o.water.kind}, using the{' '}
          {n1(o.water.isruKw)} kW the site has spare &mdash; enough for{' '}
          <b>{o.water.crewSupported} people</b>
          {o.crew.crew === 0 && ' once there is power to house any'}.
        </p>
      )}

      {o.site.id !== 'earth' && wx && (
        <p className="outpost-note">
          <b>{wx.degraded} of {wx.total} real coronal mass ejections</b> in the NASA DONKI record
          would have degraded this programme, graded by the same function the Space Weather tab
          uses &mdash; which is why the plan includes a regolith-shielded shelter. {o.site.body} has
          no magnetosphere to do that job for you.
        </p>
      )}

      {o.site.id === 'earth' && (
        <p className="outpost-note">
          This design flies in Earth orbit, so its surface segment is a ground station: dish,
          power, operations, data. <button className="link-btn" onClick={() => setConfig(c => ({
            ...c, objectiveId: 'lunar_south_pole', orbitId: 'lunar', launcherId: 'falcon9',
            instrumentIds: ['thermal_imager', 'dust_analyzer'],
            components: { ...c.components, array: 'array_l', battery: 'batt_l',
              propulsion: 'prop_bi', thermal: 'therm_active', obc: 'obc_rad' },
          }))}>Send this programme to the lunar south pole</button> and the same derivation builds
          a crewed base instead.
        </p>
      )}

      <h3>What sized this</h3>
      <p className="group-hint">
        Every headline figure on this screen, and the mission number it came from. If a dimension
        is not in this table, it is not on the drawing.
      </p>
      <div className="prov">
        {o.provenance.map(p => (
          <div className="prov-row" key={p.label}>
            <span className="prov-label">{p.label}</span>
            <span className="prov-value">{p.value}</span>
            <span className="prov-from">{p.from}</span>
          </div>
        ))}
      </div>

      <details className="assume">
        <summary>
          Surface assumptions &mdash; {SURFACE_ASSUMPTIONS.length} figures the mission numbers
          cannot supply
        </summary>
        <p className="group-hint">
          The mission engine knows nothing about habitats or regolith, so these are declared here
          rather than buried. Disagree with one and the whole screen moves.
        </p>
        <div className="prov">
          {SURFACE_ASSUMPTIONS.map(a => (
            <div className="prov-row" key={a.k}>
              <span className="prov-label">{a.k.toLowerCase().replace(/_/g, ' ')}</span>
              <span className="prov-value">{a.v} {a.unit}</span>
              <span className="prov-from">{a.why}</span>
            </div>
          ))}
        </div>
        <p className="group-hint">
          Site conditions &mdash; {o.site.body}: {Math.round(o.site.transmission * 100)}% of
          sunlight reaches the ground, the site is lit{' '}
          {Math.round(o.site.illumination * 100)}% of the time, dust costs{' '}
          {Math.round((1 - o.site.dust) * 100)}% of panel output, and the longest dark period is{' '}
          {o.site.nightHours} hours. {o.site.note}
        </p>
      </details>
    </section>
  )
}

function Readout({ label, value, unit, tone, note }) {
  return (
    <div className={'readout ' + tone}>
      <span className="ro-label">{label}</span>
      <span className="ro-value">{value}{unit && <i>{unit}</i>}</span>
      <span className="ro-note">{note}</span>
    </div>
  )
}
