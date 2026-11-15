import { useEffect, useMemo, useState } from 'react'
import ORBITS from '../data/orbits.json' with { type: 'json' }
import COMPONENTS from '../data/components.json' with { type: 'json' }
import ROLES from '../data/roles.json' with { type: 'json' }
import { debrief as analyse } from '../sim/debrief.js'
import { sweep } from '../sim/tradeSpace.js'
import { designOutpost } from '../sim/outpost.js'
import { fetchCMEs, assessSpaceWeather } from '../sim/spaceWeather.js'
import { standings } from '../net/protocol.js'

// ============================================================================
// POST-MISSION DEBRIEF
//
// Three kinds of feedback meet here, and they are deliberately different
// things. The app tells you what your design did and what to do next. Your
// team tells each other how the mission went, inside the session. And you can
// tell us, which with no backend means we hand you a filled-in message to send
// rather than pretending to submit it.
// ============================================================================

const REPO = 'https://github.com/CoderX-24/mission-architect'
const SEVERITY = {
  critical: { label: 'BLOCKER', tone: 'bad' },
  level: { label: 'LEVEL RULE', tone: 'bad' },
  risk: { label: 'THIN MARGIN', tone: 'warn' },
  waste: { label: 'OVERBOUGHT', tone: 'dim' },
  trade: { label: 'TRADE STUDY', tone: 'info' },
  storm: { label: 'SPACE WEATHER', tone: 'warn' },
  ok: { label: 'CLEAN', tone: 'ok' },
}

export default function DebriefScreen({ config, result, diff, session }) {
  const [feed, setFeed] = useState(null)
  const orbit = ORBITS.find(o => o.id === config.orbitId)
  const adcs = COMPONENTS.adcs.find(a => a.id === config.components.adcs)

  useEffect(() => {
    let live = true
    fetchCMEs().then(f => { if (live) setFeed(f) })
    return () => { live = false }
  }, [])

  const study = useMemo(() => sweep(config), [config])
  const outpost = useMemo(() => designOutpost({ config, result }), [config, result])
  const wx = useMemo(() => feed ? assessSpaceWeather(feed.cmes, {
    orbit, margins: result.margins, adcsRedundant: Boolean(adcs && adcs.redundant),
  }) : null, [feed, orbit, result, adcs])

  const d = useMemo(
    () => analyse({ config, result, diff, study, wx, outpost }),
    [config, result, diff, study, wx, outpost])

  // Report the run into the session so a head-to-head can be ranked.
  const st = session && session.state
  useEffect(() => {
    if (!st || !st.started) return
    session.reportResult(d.score, d.flies)
    // One report per scored design, not one per render.
  }, [st && st.started, d.score, d.flies]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="panel debrief">
      <h2>Mission debrief</h2>

      <div className={'big-verdict ' + (d.flies ? 'ok' : 'bad')}>
        <span className="bv-label">{d.flies ? 'MISSION FLEW' : 'MISSION DID NOT FLY'}</span>
        <span className="bv-score">{d.score}</span>
      </div>

      <p className="debrief-headline">{d.headline}</p>
      {d.level && d.level.multiplier !== 1 && (
        <p className="group-hint">
          {d.level.name} level: base score {d.breakdown.length && diff ? diff.baseScore : ''} &times;{' '}
          {d.level.multiplier}. {diff && diff.note}
        </p>
      )}

      <h3>What to do next</h3>
      <div className="actions">
        {d.actions.map((a, i) => {
          const s = SEVERITY[a.severity] || SEVERITY.ok
          return (
            <div className={'action ' + s.tone} key={i}>
              <span className="act-tag">{s.label}</span>
              <span className="act-text">{a.text}</span>
              {a.who && <span className="act-who">{a.who}</span>}
            </div>
          )
        })}
      </div>

      <h3>Where the score came from</h3>
      <div className="prov">
        {d.breakdown.map(b => (
          <div className="prov-row" key={b.label}>
            <span className="prov-label">{b.label}</span>
            <span className="prov-value">{b.value}</span>
            <span className="prov-from">{b.note}</span>
          </div>
        ))}
      </div>

      <h3>Margins, thinnest first</h3>
      <div className="prov">
        {d.margins.map(m => (
          <div className="prov-row" key={m.key}>
            <span className="prov-label">{m.label}</span>
            <span className={'prov-value ' + (m.margin < 0 ? 'bad-text' : '')}>
              {Math.round(m.margin * 100)}%
            </span>
            <span className="prov-from">{m.grade} &middot; {m.gradeLabel}</span>
          </div>
        ))}
      </div>

      <h3>By role</h3>
      <p className="group-hint">
        Every role answers for one margin &mdash; the one their decisions move most. This is where
        each of them finished. Nobody owns a failure alone on a spacecraft this tightly coupled,
        but somebody has to be watching each number.
      </p>
      <div className="prov">
        {d.byRole.map(r => (
          <div className="prov-row" key={r.roleId}>
            <span className="prov-label">{r.name}</span>
            <span className="prov-value">{r.margin === null ? '--' : Math.round(r.margin * 100) + '%'}</span>
            <span className="prov-from">{r.verdict}</span>
          </div>
        ))}
      </div>

      {d.trade && (
        <>
          <h3>What the trade study says</h3>
          <p className="outpost-note">
            {d.trade.onFront
              ? <>Nothing in the {d.trade.total.toLocaleString('en-US')} configurations enumerated is both
                cheaper and better than this design. It sits on the efficient frontier.</>
              : <><b>{d.trade.dominating}</b> of {d.trade.total.toLocaleString('en-US')} possible buses beat this
                design without costing more.{d.trade.headroom > 0 &&
                  <> The best of them scores <b>{d.trade.headroom}</b> points higher for the same money.</>}</>}
          </p>
        </>
      )}

      {d.storms && (
        <p className="outpost-note">
          Flown against <b>{d.storms.total}</b> real NASA DONKI coronal mass ejections:{' '}
          <b>{d.storms.encountered}</b> were strong enough to matter and <b>{d.storms.degraded}</b> would
          have degraded this design.
          {d.storms.worst && <> The worst was {String(d.storms.worst.start).slice(0, 10)} at{' '}
            <b>{Math.round(d.storms.worst.speed)} km/s</b>.</>}
        </p>
      )}

      {d.outpost && (
        <p className="outpost-note">
          On the ground this design builds a <b>{d.outpost.cls.toLowerCase()}</b> at{' '}
          {d.outpost.site} &mdash; {d.outpost.units} spacecraft-equivalents landed, {d.outpost.crew} crew
          supported{d.outpost.lostGbPerDay > 0 && <>, losing <b>{Math.round(d.outpost.lostGbPerDay)} GB/day</b> that
            the one orbiter cannot carry home</>}.
        </p>
      )}

      {st && st.started && <TeamDebrief session={session} />}

      <SendFeedback config={config} score={d.score} flies={d.flies} level={d.level} />
    </section>
  )
}

// --------------------------------------------------- feedback to the team ---

function TeamDebrief({ session }) {
  const st = session.state
  const me = session.me
  const mine = (st.feedback || {})[session.selfId] || null
  const [rating, setRating] = useState(mine ? mine.rating : 0)
  const [note, setNote] = useState(mine ? mine.note : '')
  const table = standings(st)
  const notes = st.players
    .map(p => ({ p, f: (st.feedback || {})[p.id] }))
    .filter(x => x.f)

  return (
    <div className="team-debrief">
      <h3>{st.mode === 'versus' ? 'Standings' : 'The team'}</h3>
      <div className="prov">
        {table.map(p => (
          <div className="prov-row" key={p.id}>
            <span className="prov-label">
              {p.name}{p.id === session.selfId ? ' (you)' : ''}
            </span>
            <span className="prov-value">{p.score === null ? 'no run yet' : p.score}</span>
            <span className="prov-from">
              {p.roleId ? ROLES.find(r => r.id === p.roleId).name : 'no role'}
              {p.result && !p.result.flies && ' · design did not fly'}
            </span>
          </div>
        ))}
      </div>

      <h3>Your note to the team</h3>
      <p className="group-hint">
        Stays inside this session, visible to everyone in it. Nothing leaves the browser.
      </p>
      <div className="rating">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} className={'star' + (n <= rating ? ' on' : '')}
            aria-label={n + ' out of 5'} onClick={() => setRating(n)}>{'◆'}</button>
        ))}
        <span className="group-hint">{rating ? rating + ' / 5' : 'rate the mission'}</span>
      </div>
      <textarea className="note" rows={3} maxLength={500} value={note}
        placeholder={me && me.roleId
          ? 'What would you do differently with the ' +
            ROLES.find(r => r.id === me.roleId).metric + ' margin?'
          : 'What would you do differently?'}
        onChange={e => setNote(e.target.value)} />
      <button className="share-btn" disabled={!rating}
        onClick={() => session.sendFeedback(rating, note)}>
        {mine ? 'Update my note' : 'Post to the team'}
      </button>

      {notes.length > 0 && (
        <div className="notes">
          {notes.map(({ p, f }) => (
            <div className="note-card" key={p.id}>
              <span className="nc-head">
                {p.name}
                {p.roleId && <em>{ROLES.find(r => r.id === p.roleId).name}</em>}
                <b>{'◆'.repeat(f.rating)}</b>
              </span>
              {f.note && <p>{f.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------- feedback to us ----

function SendFeedback({ config, score, flies, level }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('idea')
  const [text, setText] = useState('')

  const title = 'Mission Architect feedback: ' + kind
  const body = [
    text || '(what happened, or what you would change)',
    '',
    '---',
    'Objective: ' + config.objectiveId,
    'Orbit: ' + config.orbitId + ' / launcher: ' + config.launcherId,
    'Level: ' + (level ? level.name : 'Engineer'),
    'Result: ' + (flies ? 'flew, score ' + score : 'did not fly'),
    'Mission: ' + (typeof window !== 'undefined' ? window.location.href : ''),
  ].join('\n')

  const issue = REPO + '/issues/new?title=' + encodeURIComponent(title) +
    '&body=' + encodeURIComponent(body)
  const mail = 'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body)

  return (
    <div className="send-feedback">
      <h3>Tell us what you think</h3>
      {!open ? (
        <button className="share-btn" onClick={() => setOpen(true)}>Send feedback on this mission</button>
      ) : (
        <>
          <p className="group-hint">
            This site has no backend and never sends anything on your behalf. Write it here and
            we will hand you a filled-in message &mdash; you choose whether to send it.
          </p>
          <div className="fb-kinds">
            {['idea', 'confusing', 'bug', 'liked it'].map(k => (
              <button key={k} className={'phase' + (kind === k ? ' on' : '')}
                onClick={() => setKind(k)}>{k}</button>
            ))}
          </div>
          <textarea className="note" rows={4} maxLength={1200} value={text}
            placeholder="What was confusing, what was missing, what you would change"
            onChange={e => setText(e.target.value)} />
          <div className="cta-row">
            <a className="share-btn" href={issue} target="_blank" rel="noreferrer">
              Open a GitHub issue
            </a>
            <a className="share-btn" href={mail}>Send as email</a>
          </div>
          <p className="group-hint">
            Your mission settings and result are attached to the draft so we can reproduce what
            you saw. Nothing else about you is included.
          </p>
        </>
      )}
    </div>
  )
}
