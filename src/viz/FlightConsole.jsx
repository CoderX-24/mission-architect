import { useEffect, useMemo, useRef, useState } from 'react'
import ORBITS from '../data/orbits.json' with { type: 'json' }
import { orbitTimeline, missionTimeline, stormTimeline } from '../sim/telemetry.js'
import { fetchCMEs } from '../sim/spaceWeather.js'
import COMPONENTS from '../data/components.json' with { type: 'json' }

const ORBIT_SECONDS = 12      // wall-clock seconds for one full orbit
const C = {
  ecl: 'rgba(80,110,160,.17)', con: 'rgba(52,211,153,.14)',
  grid: 'rgba(140,160,190,.10)', axis: 'rgba(140,160,190,.28)',
  power: '#fbbf24', load: '#f43f5e', soc: '#34d399', buf: '#38bdf8',
  text: 'rgba(233,238,246,.72)', dim: 'rgba(169,181,199,.55)',
}

const fmtDate = s => (s || '').slice(0, 10)

export default function FlightConsole({ config, result }) {
  const orbit = ORBITS.find(o => o.id === config.orbitId)
  const [year, setYear] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [phase, setPhase] = useState(0)
  const [feed, setFeed] = useState(null)

  useEffect(() => {
    let live = true
    fetchCMEs().then(f => { if (live) setFeed(f) })
    return () => { live = false }
  }, [])

  const maxYear = config.lifetimeYears
  const atYear = Math.min(year, maxYear)

  const tel = useMemo(
    () => orbitTimeline({ config, result, orbit, atYear }),
    [config, result, orbit, atYear])
  const mission = useMemo(
    () => missionTimeline({ config, result, orbit, lifetimeYears: maxYear }),
    [config, result, orbit, maxYear])
  const epochPoint = useMemo(() => {
    const i = Math.round((atYear / maxYear) * (mission.points.length - 1))
    return mission.points[Math.max(0, Math.min(mission.points.length - 1, i))]
  }, [mission, atYear, maxYear])

  const adcs = COMPONENTS.adcs.find(a => a.id === config.components.adcs)
  const assess = useMemo(() => {
    if (!feed) return null
    return stormTimeline({ cmes: feed.cmes, orbit, result, missionPoint: epochPoint,
      adcsRedundant: Boolean(adcs && adcs.redundant) })
  }, [feed, orbit, result, epochPoint, adcs])

  // The same record graded at launch, so the console can say honestly whether
  // ageing actually changes the outcome for THIS design, instead of claiming
  // it always does.
  const assessLaunch = useMemo(() => {
    if (!feed) return null
    return stormTimeline({ cmes: feed.cmes, orbit, result, missionPoint: mission.points[0],
      adcsRedundant: Boolean(adcs && adcs.redundant) })
  }, [feed, orbit, result, mission, adcs])

  const storms = assess ? assess.threats : []
  const stormsLost = storms.filter(s => !s.survived)
  const lostAtLaunch = assessLaunch ? assessLaunch.degraded : 0
  const ageMatters = assess && assessLaunch && assess.degraded !== assessLaunch.degraded

  // ---- animation loop -------------------------------------------------
  const raf = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!playing || reduce) return
    let last = performance.now()
    const tick = now => {
      const dt = (now - last) / 1000; last = now
      setPhase(p => (p + dt / ORBIT_SECONDS) % 1)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [playing])

  const frame = tel.frames[Math.floor(phase * (tel.frames.length - 1))] || tel.frames[0]

  return (
    <section className="panel console">
      <h2>Flight console</h2>
      <p className="hint">
        Your spacecraft, flown from your own numbers. One orbit every {ORBIT_SECONDS} seconds
        &mdash; <b>1 second &asymp; {Math.round(orbit.periodMin / ORBIT_SECONDS)} minutes</b> of
        mission time. Nothing here is a stock animation: every curve is computed from the design
        on the other tabs.
      </p>

      <div className="console-top">
        <OrbitView orbit={orbit} frame={frame} tel={tel} />
        <div className="readouts">
          <Readout label="Array output" value={Math.round(frame.arrayW)} unit="W"
            tone={frame.eclipse ? 'bad' : 'warn'}
            note={frame.eclipse ? 'IN ECLIPSE — array dark' : 'in sunlight'} />
          <Readout label="Spacecraft load" value={Math.round(frame.loadW)} unit="W" tone="dim"
            note={frame.netW >= 0 ? 'surplus ' + Math.round(frame.netW) + ' W' : 'deficit ' + Math.round(-frame.netW) + ' W'} />
          <Readout label="Battery" value={Math.round(frame.soc * 100)} unit="%"
            tone={frame.soc < 0.15 ? 'bad' : frame.soc < 0.4 ? 'warn' : 'ok'}
            note={frame.eclipse ? 'discharging' : frame.netW > 0 ? 'recharging' : 'holding'} />
          <Readout label="Recorder" value={Math.round(frame.buffer * 100)} unit="%"
            tone={frame.buffer > 0.9 ? 'bad' : frame.buffer > 0.6 ? 'warn' : 'ok'}
            note={frame.contact ? 'GROUND PASS — dumping' : 'filling, no station in view'} />
        </div>
      </div>

      <TelemetryChart tel={tel} phase={phase} />

      <div className="console-ctl">
        <button className="share-btn" onClick={() => setPlaying(p => !p)}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <span className="ctl-note">
          Eclipse <b>{tel.eclipseMin.toFixed(0)} min</b> &middot; ground contact{' '}
          <b>{tel.contactMinPerOrbit.toFixed(0)} min</b> per orbit &middot; recorder{' '}
          <b>{tel.bufferCapGb} GB</b>
        </span>
      </div>

      {tel.daysToFillRecorder !== null && (
        <p className="console-warn">
          Your downlink cannot keep up. The recorder fills in{' '}
          <b>{tel.daysToFillRecorder.toFixed(1)} days</b>, and after that you lose{' '}
          <b>{tel.scienceLostGbPerDay.toFixed(0)} GB of science every day</b> because there is
          nowhere to put it.
        </p>
      )}

      <h3>Mission timeline</h3>
      <p className="group-hint">
        Drag to any point in the mission. The array degrades at{' '}
        {(mission.degradationPerYear * 100).toFixed(1)}% a year in this orbit, so the same
        spacecraft has less power every year &mdash; and the orbit above re-flies at that age.
      </p>

      <MissionTrack mission={mission} atYear={atYear} storms={storms} maxYear={maxYear}
        windowFrom={feed && feed.cmes.length ? fmtDate(feed.cmes[0].start) : ''}
        windowTo={feed && feed.cmes.length ? fmtDate(feed.cmes[feed.cmes.length - 1].start) : ''} />

      <input className="scrub" type="range" min="0" max={maxYear} step="0.1" value={atYear}
        onChange={e => setYear(Number(e.target.value))}
        aria-label="Mission year" />

      <div className="epoch-row">
        <span>Year <b>{atYear.toFixed(1)}</b> of {maxYear}</span>
        <span>Array <b>{Math.round(epochPoint.powerW)} W</b> in sun</span>
        <span>Power margin <b className={epochPoint.margin < 0 ? 'bad' : ''}>
          {Math.round(epochPoint.margin * 100)}%</b></span>
      </div>

      {mission.brownoutYear !== null && (
        <p className="console-warn">
          At year <b>{mission.brownoutYear.toFixed(1)}</b> the degraded array can no longer
          carry the load. Everything after that point is a brownout.
        </p>
      )}

      <h3>
        Real solar storms at this point in the mission
        {feed && <span className={'feed ' + feed.source}>
          {feed.source === 'live' ? 'live from NASA DONKI' : 'bundled NASA DONKI snapshot'}
        </span>}
      </h3>
      {!feed && <p className="group-hint">Retrieving records from NASA DONKI&hellip;</p>}
      {feed && (
        <>
          <p className="group-hint">
            {storms.length} recorded coronal mass ejections were strong enough to matter in{' '}
            {orbit.name.split(',')[0]}. Flown against this design as it stands at year{' '}
            {atYear.toFixed(1)}, <b className={stormsLost.length ? 'bad-text' : ''}>
            {stormsLost.length} would degrade this mission</b>
            {ageMatters
              ? <> &mdash; against <b>{lostAtLaunch}</b> at launch. Ageing changed the outcome:
                  a storm this design survives new, it does not survive old.</>
              : <> &mdash; the same as at launch. For this design, ageing does not change the
                  verdict; the margins are either deep enough for the whole record or they
                  are not.</>}
          </p>
          {stormsLost.slice(0, 3).map(s => (
            <div key={s.id} className="wx-event fail">
              <span className="event-head">
                <strong>{s.band}</strong>{fmtDate(s.start)}
                <em>{s.speed} km/s &middot; {s.type}-type</em>
              </span>
              <span className="event-out">
                Needed {Math.round(s.powerNeeded * 100)}% power margin, had{' '}
                {Math.round(s.powerHad * 100)}%.
                {s.instruments && s.instruments.length
                  ? ' Observed by ' + s.instruments.join(', ') + '.' : ''}
              </span>
            </div>
          ))}
          {stormsLost.length === 0 && (
            <p className="analogue">
              This design survived every recorded storm at this point in its life. That is what
              margin buys.
            </p>
          )}
        </>
      )}
    </section>
  )
}

function Readout({ label, value, unit, tone, note }) {
  return (
    <div className={'readout ' + (tone || '')}>
      <span className="ro-label">{label}</span>
      <span className="ro-value">{value}<i>{unit}</i></span>
      <span className="ro-note">{note}</span>
    </div>
  )
}

// --------------------------------------------------------------- orbit ----
function OrbitView({ orbit, frame, tel }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current; if (!cv) return
    const ctx = cv.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const w = cv.clientWidth, h = cv.clientHeight
    cv.width = w * dpr; cv.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const cx = w / 2, cy = h / 2
    const isMars = orbit.solarDistanceAu > 1.2
    const bodyR = Math.min(w, h) * 0.13
    const rx = Math.min(w / 2 - 18, bodyR + 20 + Math.min(1,
      Math.log10(1 + orbit.altitudeKm / 200) / Math.log10(1 + 36000 / 200)) * (w / 2 - bodyR - 40))
    const ry = rx * 0.36

    // Sun from the left; the shadow cone falls to the right of the body.
    const g = ctx.createLinearGradient(cx, 0, w, 0)
    g.addColorStop(0, 'rgba(6,9,15,.92)'); g.addColorStop(1, 'rgba(6,9,15,0)')
    ctx.fillStyle = g; ctx.fillRect(cx, cy - bodyR * 1.5, w - cx, bodyR * 3)

    ctx.strokeStyle = 'rgba(140,160,190,.35)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke()

    ctx.beginPath(); ctx.arc(16, cy, 8, 0, Math.PI * 2)
    ctx.fillStyle = '#fbbf24'; ctx.fill()
    ctx.beginPath(); ctx.arc(16, cy, 15, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(251,191,36,.18)'; ctx.fill()

    const a = frame.phase * Math.PI * 2
    const sx = cx + rx * Math.cos(a), sy = cy + ry * Math.sin(a)
    const behind = Math.sin(a) < 0

    const drawCraft = () => {
      const col = frame.eclipse ? '#5b6673' : '#ff9d4d'
      if (!frame.eclipse && !behind) {
        ctx.beginPath(); ctx.arc(sx, sy, 13, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,157,77,.16)'; ctx.fill()
      }
      ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2)
      ctx.fillStyle = col; ctx.globalAlpha = behind ? 0.45 : 1; ctx.fill(); ctx.globalAlpha = 1
    }

    // Far side of the orbit: the spacecraft passes behind the body.
    if (behind) drawCraft()

    // Body, drawn between the far-side and near-side spacecraft passes.
    ctx.beginPath(); ctx.arc(cx, cy, bodyR, 0, Math.PI * 2)
    ctx.fillStyle = isMars ? '#b8512f' : '#2f6fb3'; ctx.fill()
    ctx.beginPath(); ctx.arc(cx - bodyR * .28, cy - bodyR * .28, bodyR, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill()

    if (frame.contact) {
      ctx.strokeStyle = 'rgba(52,211,153,.75)'; ctx.lineWidth = 1.4
      ctx.setLineDash([3, 3])
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(cx, cy + bodyR * .5); ctx.stroke()
      ctx.setLineDash([])
    }

    if (!behind) drawCraft()

    ctx.font = '600 10px ui-monospace, monospace'
    ctx.fillStyle = C.dim
    const tag = frame.eclipse ? 'ECLIPSE' : frame.contact ? 'GROUND PASS' : 'SUNLIT'
    ctx.fillText(tag, 12, 18)
    ctx.fillStyle = C.text
    ctx.fillText('T+' + frame.minute.toFixed(0) + ' min', 12, h - 12)
    const yr = tel.atYear === null ? '' : 'YEAR ' + tel.atYear.toFixed(1)
    ctx.fillText(yr, w - ctx.measureText(yr).width - 12, h - 12)
  }, [orbit, frame, tel])

  return <canvas ref={ref} className="orbit-canvas console-orbit" />
}

// ----------------------------------------------------------- strip chart --
function TelemetryChart({ tel, phase }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current; if (!cv) return
    const ctx = cv.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const w = cv.clientWidth, h = cv.clientHeight
    cv.width = w * dpr; cv.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const padL = 42, padR = 8, padT = 10, padB = 16
    const plotW = w - padL - padR
    const lanes = 3
    const gap = 8
    const laneH = (h - padT - padB - gap * (lanes - 1)) / lanes
    const F = tel.frames
    const x = i => padL + (i / (F.length - 1)) * plotW

    // Eclipse and contact bands run across every lane, so the eye ties an
    // event in one trace to the same instant in the others.
    const band = (test, colour) => {
      let start = null
      for (let i = 0; i < F.length; i++) {
        const on = test(F[i])
        if (on && start === null) start = i
        if ((!on || i === F.length - 1) && start !== null) {
          ctx.fillStyle = colour
          ctx.fillRect(x(start), padT, x(i) - x(start), h - padT - padB)
          start = null
        }
      }
    }
    band(f => f.eclipse, C.ecl)
    band(f => f.contact, C.con)

    const maxW = Math.max(tel.sunW, tel.loadW) * 1.12 || 1
    const laneTop = n => padT + n * (laneH + gap)

    const drawLane = (n, label, pick, colour, max, fill) => {
      const top = laneTop(n), bot = top + laneH
      ctx.strokeStyle = C.axis; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(padL, bot); ctx.lineTo(w - padR, bot); ctx.stroke()
      ctx.strokeStyle = C.grid
      ctx.beginPath(); ctx.moveTo(padL, top); ctx.lineTo(w - padR, top); ctx.stroke()

      ctx.beginPath()
      F.forEach((f, i) => {
        const v = Math.max(0, Math.min(max, pick(f)))
        const y = bot - (v / max) * laneH
        i ? ctx.lineTo(x(i), y) : ctx.moveTo(x(i), y)
      })
      if (fill) {
        const grad = ctx.createLinearGradient(0, top, 0, bot)
        grad.addColorStop(0, colour + '44'); grad.addColorStop(1, colour + '05')
        ctx.lineTo(x(F.length - 1), bot); ctx.lineTo(x(0), bot); ctx.closePath()
        ctx.fillStyle = grad; ctx.fill()
        ctx.beginPath()
        F.forEach((f, i) => {
          const v = Math.max(0, Math.min(max, pick(f)))
          const y = bot - (v / max) * laneH
          i ? ctx.lineTo(x(i), y) : ctx.moveTo(x(i), y)
        })
      }
      ctx.strokeStyle = colour; ctx.lineWidth = 1.6; ctx.stroke()

      ctx.font = '600 9px ui-monospace, monospace'
      ctx.fillStyle = C.dim
      ctx.fillText(label, 4, top + 9)
    }

    drawLane(0, 'ARRAY W', f => f.arrayW, C.power, maxW, true)
    // Load line sits in the power lane so the crossing point is visible.
    {
      const top = laneTop(0), bot = top + laneH
      const y = bot - (tel.loadW / maxW) * laneH
      ctx.strokeStyle = C.load; ctx.lineWidth = 1; ctx.setLineDash([4, 3])
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = C.load; ctx.font = '600 8.5px ui-monospace, monospace'
      ctx.fillText('LOAD', w - padR - 26, y - 3)
    }
    drawLane(1, 'BATT %', f => f.soc * 100, C.soc, 100, true)
    drawLane(2, 'REC %', f => f.buffer * 100, C.buf, 100, true)

    // Playhead
    const px = padL + phase * plotW
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(px, padT); ctx.lineTo(px, h - padB); ctx.stroke()

    ctx.font = '9px ui-monospace, monospace'; ctx.fillStyle = C.dim
    ctx.fillText('0', padL, h - 4)
    const end = tel.periodMin.toFixed(0) + ' min'
    ctx.fillText(end, w - padR - ctx.measureText(end).width, h - 4)
  }, [tel, phase])

  return <canvas ref={ref} className="telemetry-canvas" />
}

// -------------------------------------------------------- mission track --
// Two stacked lanes with DIFFERENT time axes, separated and labelled, because
// conflating them would be dishonest: the degradation curve spans the whole
// mission, while the DONKI record is a real 120-day window. The storms are
// re-flown against the array as it stands at the scrubbed epoch.
function MissionTrack({ mission, atYear, storms, maxYear, windowFrom, windowTo }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current; if (!cv) return
    const ctx = cv.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const w = cv.clientWidth, h = cv.clientHeight
    cv.width = w * dpr; cv.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const padL = 6, padR = 6, padT = 9
    const plotW = w - padL - padR
    const plotH = h * 0.52
    const stripTop = plotH + 24
    const stripH = 13
    const P = mission.points

    // Scale to the power curve's own range so a 15% decline is legible rather
    // than a flat line squashed against the top of a zero-based axis.
    const pMax = P[0].powerW
    const pMin = P[P.length - 1].powerW
    const lo = pMin - (pMax - pMin) * 0.55 || pMin * 0.9
    const hi = pMax + (pMax - pMin) * 0.12
    const yOf = v => padT + plotH - ((v - lo) / Math.max(1e-6, hi - lo)) * plotH

    ctx.strokeStyle = C.grid; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(padL, padT + plotH); ctx.lineTo(w - padR, padT + plotH); ctx.stroke()

    const curve = () => {
      ctx.beginPath()
      P.forEach((p, i) => {
        const px = padL + (i / (P.length - 1)) * plotW
        i ? ctx.lineTo(px, yOf(p.powerW)) : ctx.moveTo(px, yOf(p.powerW))
      })
    }
    curve()
    ctx.lineTo(w - padR, padT + plotH); ctx.lineTo(padL, padT + plotH); ctx.closePath()
    const g = ctx.createLinearGradient(0, padT, 0, padT + plotH)
    g.addColorStop(0, 'rgba(251,191,36,.3)'); g.addColorStop(1, 'rgba(251,191,36,.03)')
    ctx.fillStyle = g; ctx.fill()
    curve(); ctx.strokeStyle = C.power; ctx.lineWidth = 1.8; ctx.stroke()

    // Load line if it falls inside the zoomed window; otherwise say so.
    const loadW = P[0].loadW
    ctx.font = '600 8.5px ui-monospace, monospace'
    if (loadW >= lo && loadW <= hi) {
      const ly = yOf(loadW)
      ctx.strokeStyle = C.load; ctx.setLineDash([4, 3]); ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(padL, ly); ctx.lineTo(w - padR, ly); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = C.load; ctx.fillText('LOAD', w - padR - 26, ly - 3)
    } else {
      ctx.fillStyle = C.dim
      ctx.fillText('LOAD ' + Math.round(loadW) + ' W (below scale)', padL + 2, padT + plotH - 4)
    }

    ctx.fillStyle = C.dim; ctx.font = '9px ui-monospace, monospace'
    ctx.fillText(Math.round(pMax) + ' W', padL + 2, padT + 8)
    ctx.fillText(Math.round(pMin) + ' W', w - padR - 42, padT + plotH - 4)

    // Playhead across the mission lane
    const hx = padL + (atYear / maxYear) * plotW
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(hx, padT - 3); ctx.lineTo(hx, padT + plotH + 3); ctx.stroke()
    ctx.beginPath(); ctx.arc(hx, padT - 4, 3, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill()

    ctx.font = '9px ui-monospace, monospace'; ctx.fillStyle = C.dim
    ctx.fillText('LAUNCH', padL, padT + plotH + 13)
    const e = maxYear + ' YR'
    ctx.fillText(e, w - padR - ctx.measureText(e).width, padT + plotH + 13)

    // ---- separate lane: the real DONKI record, on its own axis ----------
    if (storms.length) {
      ctx.fillStyle = 'rgba(0,0,0,.35)'
      ctx.fillRect(padL, stripTop, plotW, stripH)
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1
      ctx.strokeRect(padL + .5, stripTop + .5, plotW - 1, stripH - 1)

      storms.forEach((s, i) => {
        const px = padL + 1 + (i / Math.max(1, storms.length - 1)) * (plotW - 2)
        ctx.strokeStyle = s.survived ? 'rgba(52,211,153,.5)' : '#f43f5e'
        ctx.lineWidth = s.survived ? 1 : 1.6
        ctx.beginPath()
        ctx.moveTo(px, stripTop + stripH - 1)
        ctx.lineTo(px, stripTop + 1 + (s.survived ? stripH * 0.45 : 0))
        ctx.stroke()
      })

      ctx.font = '8.5px ui-monospace, monospace'; ctx.fillStyle = C.dim
      ctx.fillText(windowFrom || '', padL, stripTop + stripH + 10)
      const wt = windowTo || ''
      ctx.fillText(wt, w - padR - ctx.measureText(wt).width, stripTop + stripH + 10)
      const mid = storms.length + ' NASA DONKI RECORDS'
      ctx.fillStyle = 'rgba(169,181,199,.75)'
      ctx.fillText(mid, padL + plotW / 2 - ctx.measureText(mid).width / 2, stripTop + stripH + 10)
    }
  }, [mission, atYear, storms, maxYear, windowFrom, windowTo])

  return <canvas ref={ref} className="mission-canvas" />
}
