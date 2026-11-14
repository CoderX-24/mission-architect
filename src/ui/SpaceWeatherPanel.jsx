import { useEffect, useState } from 'react'
import ORBITS from '../data/orbits.json' with { type: 'json' }
import COMPONENTS from '../data/components.json' with { type: 'json' }
import { fetchCMEs, assessSpaceWeather } from '../sim/spaceWeather.js'


const fmt = s => (s || '').slice(0, 10)


export default function SpaceWeatherPanel({ config, result }) {
  const [feed, setFeed] = useState(null)
  const orbit = ORBITS.find(o => o.id === config.orbitId)
  const adcs = COMPONENTS.adcs.find(a => a.id === config.components.adcs)


  useEffect(() => { let live = true
    fetchCMEs().then(f => { if (live) setFeed(f) })
    return () => { live = false }
  }, [])


  if (!feed) return (
    <section className="panel">
      <h2>Space weather validation</h2>
      <p className="hint">Retrieving coronal mass ejection records from NASA DONKI&hellip;</p>
    </section>
  )


  const a = assessSpaceWeather(feed.cmes, {
    orbit, margins: result.margins, adcsRedundant: Boolean(adcs && adcs.redundant),
  })
  const worstFails = a.threats.filter(t => !t.survived)
    .sort((x, y) => y.stress - x.stress).slice(0, 5)


  return (
    <section className="panel">
      <h2>Space weather validation</h2>
      <p className="hint">
        Your spacecraft was flown against <b>{a.total} real coronal mass ejections</b> recorded
        by NASA between {fmt(a.dateFrom)} and {fmt(a.dateTo)}. These are not simulated events.
        <span className={'feed ' + feed.source}>
          {feed.source === 'live' ? 'live from NASA DONKI' : 'bundled NASA DONKI snapshot'}
        </span>
      </p>


      <div className="wx-stats">
        <div><b>{a.encountered}</b><span>storms strong enough to matter in {orbit.name.split(',')[0]}</span></div>
        <div><b className={a.degraded ? 'bad' : 'ok'}>{a.degraded}</b><span>would have degraded this design</span></div>
        <div><b className={a.critical ? 'bad' : 'ok'}>{a.critical}</b><span>would have ended the mission</span></div>
        <div><b>{Math.round(a.survivalRate * 100)}%</b><span>survival rate</span></div>
      </div>


      <p className="group-hint">
        Exposure scales with the orbit. Earth&rsquo;s magnetosphere shields low orbits;
        geostationary, lunar and interplanetary spacecraft take the full dose. This orbit
        carries a radiation index of {orbit.radiationIndex}.
      </p>


      {a.worst && (
        <>
          <h3>Strongest storm encountered</h3>
          <div className={'wx-event ' + (a.worst.survived ? 'pass' : 'fail')}>
            <span className="event-head">
              <strong>{a.worst.band}</strong>{a.worst.id}
              <em>{a.worst.speed} km/s &middot; {a.worst.type}-type</em>
            </span>
            <span className="card-brief">
              Observed {fmt(a.worst.start)} by {a.worst.instruments.join(', ') || 'DONKI'}.
            </span>
            <span className="event-out">
              {a.worst.survived
                ? 'Your margins absorbed it. No loss of science.'
                : a.worst.reasons.join('; ') + '.'}
            </span>
          </div>
        </>
      )}


      {worstFails.length > 0 && (
        <>
          <h3>Storms this design did not survive</h3>
          {worstFails.map(t => (
            <div key={t.id} className="wx-event fail">
              <span className="event-head">
                <strong>{t.band}</strong>{fmt(t.start)}
                <em>{t.speed} km/s</em>
              </span>
              <span className="event-out">{t.reasons.join('; ')}.</span>
            </div>
          ))}
        </>
      )}


      {a.degraded === 0 && (
        <p className="analogue">
          This design survived every storm in the record. That is what margin buys.
        </p>
      )}


      <p className="group-hint" style={{ marginTop: 18 }}>
        Source: <a href="https://ccmc.gsfc.nasa.gov/tools/DONKI/" target="_blank" rel="noreferrer">
        NASA Space Weather Database Of Notifications, Knowledge, Information (DONKI)</a>,
        via the NASA Open API. Observing instruments include SOHO LASCO, STEREO SECCHI and GOES.
      </p>
    </section>
  )
}
