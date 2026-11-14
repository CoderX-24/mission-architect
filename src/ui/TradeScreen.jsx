import { useMemo, useRef, useEffect, useState } from 'react'
import { sweep, paretoFront, locate, busDiff, totalCombinations } from '../sim/tradeSpace.js'

const GROUP_LABEL = {
  array: 'Solar array', battery: 'Battery', comms: 'Communications',
  adcs: 'Attitude control', propulsion: 'Propulsion', thermal: 'Thermal control',
  obc: 'Flight computer', structure: 'Structure',
}

export default function TradeScreen({ config, setConfig, result }) {
  // The sweep varies only the bus, so it is keyed on everything EXCEPT the
  // components - changing a component moves the marker, it does not redo the
  // study.
  const key = [config.objectiveId, config.orbitId, config.launcherId,
    config.instrumentIds.join(','), config.lifetimeYears].join('|')

  const study = useMemo(() => sweep(config), [key])        // eslint-disable-line react-hooks/exhaustive-deps
  const front = useMemo(() => paretoFront(study.flying), [study])
  const loc = useMemo(() => locate(config, result, study, front), [config, result, study, front])

  const adopt = comps => setConfig(c => ({ ...c, components: { ...comps } }))

  return (
    <section className="panel">
      <h2>Trade space</h2>
      <p className="hint">
        Real missions are not designed by building one spacecraft and checking it. They are
        designed by trade study: enumerate the options, find the efficient frontier, then argue
        about where on it to sit. Every one of the{' '}
        <b>{totalCombinations().toLocaleString()} possible spacecraft buses</b> for this payload,
        orbit and launcher has been flown. Nothing here is sampled.
      </p>

      <div className="wx-stats">
        <div>
          <b>{study.evaluated.toLocaleString()}</b>
          <span>configurations evaluated</span>
        </div>
        <div>
          <b className={study.flying.length ? 'ok' : 'bad'}>{study.flying.length}</b>
          <span>that actually fly ({(100 * study.flying.length / study.evaluated).toFixed(1)}%)</span>
        </div>
        <div>
          <b>{front.length}</b>
          <span>on the efficient frontier</span>
        </div>
        <div>
          <b className={loc.onFront ? 'ok' : 'bad'}>{loc.onFront ? 'YES' : String(loc.dominating.length)}</b>
          <span>{loc.onFront ? 'your design is optimal' : 'designs beat yours outright'}</span>
        </div>
      </div>

      {study.flying.length > 0 && (
        <>
          <TradeChart study={study} front={front} loc={loc} />
          <div className="trade-legend">
            <span><i className="sw fly" />flies</span>
            <span><i className="sw front" />efficient frontier</span>
            <span><i className="sw you" />your design</span>
          </div>
        </>
      )}

      {study.flying.length > 0 && (loc.onFront ? (
        <p className="analogue trade-verdict ok">
          Your design sits on the efficient frontier. Nothing in the entire space is both
          cheaper and better. To score higher you must spend more &mdash; that is a real
          engineering trade, not a mistake.
        </p>
      ) : (
        <p className="console-warn">
          <b>{loc.dominating.length}</b> configurations are at least as good as yours on both
          axes and strictly better on one. Your design is not on the frontier.
        </p>
      ))}

      {loc.betterSame && (
        <Suggestion
          title="Higher science for no more money"
          detail={`Scores ${loc.betterSame.score} against your ${loc.mine.score}, at $${loc.betterSame.cost.toFixed(0)}M against your $${loc.mine.cost.toFixed(0)}M.`}
          diff={busDiff(config.components, loc.betterSame.components)}
          onAdopt={() => adopt(loc.betterSame.components)} />
      )}

      {loc.cheaperSame && (
        <Suggestion
          title="Same science, less money"
          detail={`Scores ${loc.cheaperSame.score} for $${loc.cheaperSame.cost.toFixed(0)}M, saving $${(loc.mine.cost - loc.cheaperSame.cost).toFixed(0)}M.`}
          diff={busDiff(config.components, loc.cheaperSame.components)}
          onAdopt={() => adopt(loc.cheaperSame.components)} />
      )}

      {!loc.betterSame && !loc.cheaperSame && study.flying.length > 0 && (
        <p className="group-hint">
          No configuration in the space beats yours on either axis without giving something up.
        </p>
      )}

      {study.flying.length === 0 && (
        <p className="console-warn">
          No spacecraft bus can fly this payload to this orbit on this launch vehicle. The
          problem is not the bus &mdash; go back and change the payload, the orbit or the
          launcher.
        </p>
      )}
    </section>
  )
}

function Suggestion({ title, detail, diff, onAdopt }) {
  const [done, setDone] = useState(false)
  if (!diff.length) return null
  return (
    <div className="suggest">
      <div className="suggest-head">
        <h3>{title}</h3>
        <button className="share-btn" onClick={() => { onAdopt(); setDone(true) }}>
          {done ? 'Adopted' : 'Adopt this design'}
        </button>
      </div>
      <p className="card-brief">{detail}</p>
      <ul className="suggest-diff">
        {diff.map(d => (
          <li key={d.group}>
            <span className="sd-group">{GROUP_LABEL[d.group] || d.group}</span>
            <span className="sd-from">{d.from}</span>
            <span className="sd-arrow">&rarr;</span>
            <span className="sd-to">{d.to}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TradeChart({ study, front, loc }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const w = cv.clientWidth, h = cv.clientHeight
    cv.width = w * dpr; cv.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const pts = study.flying
    if (!pts.length) {
      ctx.font = '11px ui-monospace, monospace'
      ctx.fillStyle = 'rgba(169,181,199,.6)'
      ctx.fillText('No flying configurations to plot.', 14, h / 2)
      return
    }

    const padL = 52, padR = 14, padT = 14, padB = 30
    const plotW = w - padL - padR, plotH = h - padT - padB

    const all = pts.concat([loc.mine])
    let cMin = Math.min.apply(null, all.map(p => p.cost))
    let cMax = Math.max.apply(null, all.map(p => p.cost))
    let sMin = Math.min.apply(null, all.map(p => p.score))
    let sMax = Math.max.apply(null, all.map(p => p.score))
    const cPad = (cMax - cMin) * 0.08 || 1
    const sPad = (sMax - sMin) * 0.08 || 1
    cMin -= cPad; cMax += cPad; sMin -= sPad; sMax += sPad

    const X = c => padL + ((c - cMin) / (cMax - cMin)) * plotW
    const Y = s => padT + plotH - ((s - sMin) / (sMax - sMin)) * plotH

    // Grid
    ctx.strokeStyle = 'rgba(140,160,190,.10)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = padT + (i / 4) * plotH
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke()
      const x = padL + (i / 4) * plotW
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke()
    }

    // Axis labels
    ctx.font = '9px ui-monospace, monospace'
    ctx.fillStyle = 'rgba(169,181,199,.6)'
    for (let i = 0; i <= 4; i++) {
      const s = sMin + (1 - i / 4) * (sMax - sMin)
      ctx.fillText(Math.round(s).toString(), 6, padT + (i / 4) * plotH + 3)
      const c = cMin + (i / 4) * (cMax - cMin)
      const t = '$' + Math.round(c) + 'M'
      ctx.fillText(t, padL + (i / 4) * plotW - ctx.measureText(t).width / 2, h - 14)
    }
    ctx.fillStyle = 'rgba(169,181,199,.8)'
    ctx.fillText('SCIENCE SCORE', 6, padT - 4)
    const xl = 'MISSION COST'
    ctx.fillText(xl, w - padR - ctx.measureText(xl).width, h - 3)

    // All flying designs
    for (const p of pts) {
      ctx.beginPath(); ctx.arc(X(p.cost), Y(p.score), 2.6, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(56,189,248,.34)'; ctx.fill()
    }

    // Efficient frontier
    if (front.length > 1) {
      ctx.beginPath()
      front.forEach((p, i) => (i ? ctx.lineTo(X(p.cost), Y(p.score)) : ctx.moveTo(X(p.cost), Y(p.score))))
      ctx.strokeStyle = 'rgba(52,211,153,.85)'; ctx.lineWidth = 1.6; ctx.stroke()
    }
    for (const p of front) {
      ctx.beginPath(); ctx.arc(X(p.cost), Y(p.score), 4, 0, Math.PI * 2)
      ctx.fillStyle = '#34d399'; ctx.fill()
    }

    // The player's design
    const mx = X(loc.mine.cost), my = Y(loc.mine.score)
    ctx.beginPath(); ctx.arc(mx, my, 11, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,157,77,.16)'; ctx.fill()
    ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2)
    ctx.strokeStyle = '#ff9d4d'; ctx.lineWidth = 2; ctx.stroke()
    ctx.beginPath(); ctx.arc(mx, my, 2.2, 0, Math.PI * 2)
    ctx.fillStyle = '#ff9d4d'; ctx.fill()
  }, [study, front, loc])

  return <canvas ref={ref} className="trade-canvas" />
}
