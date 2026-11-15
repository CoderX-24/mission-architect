import { useEffect, useMemo, useRef, useState } from 'react'
import { ask, buildContext, suggestionsFor, TOPICS, GROUPS, ASSISTANT_NAME } from '../help/architectx.js'
import { sweep } from '../sim/tradeSpace.js'

// ============================================================================
// The help drawer: one question mark, four sections.
//
// Intro for somebody who has never seen the app, a searchable FAQ, ArchitectX
// for a direct question, and the credits. It floats above the app rather than
// taking a column from it, so nothing else on the page has to move.
// ============================================================================

const TABS = [
  { id: 'intro', label: 'Intro' },
  { id: 'faq', label: 'FAQ' },
  { id: 'ask', label: 'Ask ' + ASSISTANT_NAME },
  { id: 'about', label: 'About' },
]

export default function HelpDrawer({ config, result, diff, outpost = null, roleName = null, onPhase }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('intro')
  const [query, setQuery] = useState('')
  const [asked, setAsked] = useState(null)
  const [history, setHistory] = useState([])
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open && tab === 'ask' && inputRef.current) inputRef.current.focus()
  }, [open, tab])

  // The trade study costs about 100 ms, so it is only run when the assistant
  // is actually open on the tab that can use it.
  const study = useMemo(
    () => (open && tab === 'ask' ? sweep(config) : null),
    [open, tab, config])

  const ctx = useMemo(
    () => buildContext({ config, result, diff, outpost, study, roleName }),
    [config, result, diff, outpost, study, roleName])

  const suggestions = useMemo(() => suggestionsFor(ctx), [ctx])

  const submit = text => {
    const q = (text === undefined ? query : text).trim()
    if (!q) return
    const res = ask(q, ctx)
    setAsked({ q, res })
    setHistory(h => [q, ...h.filter(x => x !== q)].slice(0, 6))
    setQuery('')
  }

  const go = phase => { if (onPhase) onPhase(phase); setOpen(false) }

  return (
    <>
      <button className={'help-fab' + (open ? ' open' : '')}
        aria-expanded={open}
        aria-label={open ? 'Close help' : 'Help, FAQ and ' + ASSISTANT_NAME}
        onClick={() => setOpen(o => !o)}>
        {open ? '×' : '?'}
      </button>

      {open && <div className="help-scrim" onClick={() => setOpen(false)} />}

      <aside className={'help-drawer' + (open ? ' open' : '')} aria-hidden={!open}>
        <header className="help-head">
          <div>
            <span className="help-kicker">Mission Architect</span>
            <strong>Help &amp; {ASSISTANT_NAME}</strong>
          </div>
          <button className="help-close" aria-label="Close help" onClick={() => setOpen(false)}>
            {'×'}
          </button>
        </header>

        <nav className="help-tabs">
          {TABS.map(t => (
            <button key={t.id} className={'lt' + (tab === t.id ? ' on' : '')}
              onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>

        <div className="help-body">
          {tab === 'intro' && <Intro ctx={ctx} go={go} />}
          {tab === 'faq' && <Faq ctx={ctx} go={go} />}
          {tab === 'ask' && (
            <Ask query={query} setQuery={setQuery} submit={submit} asked={asked}
              suggestions={suggestions} history={history} go={go} inputRef={inputRef} />
          )}
          {tab === 'about' && <About />}
        </div>

        <footer className="help-foot">
          <span><b>Doon-Dev</b> &middot; designed by Ranveer and Vibhor</span>
          <span>NASA Space Apps Challenge 2026 &middot; Satna</span>
        </footer>
      </aside>
    </>
  )
}

// ----------------------------------------------------------------- intro ---

function Intro({ ctx, go }) {
  return (
    <div className="help-sec">
      <h3>You are designing a space mission</h3>
      <p>
        Pick what the mission is for, choose instruments, build the spacecraft that has to carry
        them, choose an orbit and a rocket. Then fly it. Every number you see is computed from
        your choices by one engine, and every failure tells you the figures and the way out.
      </p>

      <ol className="help-steps">
        <li><b>Objective</b> &mdash; sets your budget and which orbits are legal.</li>
        <li><b>Payload</b> &mdash; instruments. Mass, power, cost and data, all at once.</li>
        <li><b>Spacecraft</b> &mdash; the bus. It has to carry and power everything above.</li>
        <li><b>Orbit &amp; Launch</b> &mdash; where you fly, and what lifts you.</li>
        <li><b>Simulate</b> &mdash; fly it, then read the <b>Debrief</b>.</li>
      </ol>

      <h3>The one idea worth taking away</h3>
      <p>
        Real missions do not spend 100% of their budget. They hold <b>10 to 35 percent</b> in
        reserve, because everything grows between design and launch. That band is drawn into
        every bar on the right. Spend it all and the first solar storm ends you; hoard it and you
        bought capability nobody used. Both lose points.
      </p>

      <p className="help-note">
        {ctx.result.flies
          ? 'The design on screen right now flies, scoring ' + ctx.diffScore + '.'
          : 'The design on screen right now does not fly. Ask ' + ASSISTANT_NAME + ' why.'}
      </p>

      <div className="help-ctas">
        <button className="share-btn" onClick={() => go('spacecraft')}>Go build a spacecraft</button>
        <button className="share-btn" onClick={() => go('outpost')}>See what it builds on the ground</button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------- faq ---

function Faq({ ctx, go }) {
  const [filter, setFilter] = useState('')
  const f = filter.toLowerCase().trim()
  const shown = TOPICS.filter(t => !f ||
    t.q.toLowerCase().includes(f) ||
    (t.keywords || []).some(k => k.includes(f)) ||
    (t.phrases || []).some(p => p.includes(f)))

  return (
    <div className="help-sec">
      <input className="help-input" placeholder="Filter the questions" value={filter}
        onChange={e => setFilter(e.target.value)} />
      {GROUPS.map(group => {
        const items = shown.filter(t => t.group === group)
        if (!items.length) return null
        return (
          <div key={group} className="faq-group">
            <h4>{group}</h4>
            {items.map(t => (
              <details key={t.id} className="faq-item">
                <summary>{t.q}</summary>
                <Answer answer={t.answer(ctx)} go={go} />
              </details>
            ))}
          </div>
        )
      })}
      {!shown.length && <p className="help-note">Nothing matches that. Try the {ASSISTANT_NAME} tab.</p>}
    </div>
  )
}

// ------------------------------------------------------------------- ask ---

function Ask({ query, setQuery, submit, asked, suggestions, history, go, inputRef }) {
  return (
    <div className="help-sec">
      <form className="ask-form" onSubmit={e => { e.preventDefault(); submit() }}>
        <input ref={inputRef} className="help-input" value={query}
          placeholder={'Ask ' + ASSISTANT_NAME + ' about your mission'}
          onChange={e => setQuery(e.target.value)} />
        <button className="share-btn" type="submit">Ask</button>
      </form>

      <p className="help-disclaimer">
        {ASSISTANT_NAME} runs entirely in your browser. <b>It is not a language model.</b> It
        matches your question to answers written by the team, then computes the specifics from
        your current design using the same engine as the rest of the app &mdash; so it cannot
        invent a number, and it works with no network.
      </p>

      {!asked && (
        <>
          <h4>Try one of these</h4>
          <div className="chips">
            {suggestions.map(t => (
              <button key={t.id} className="chip" onClick={() => submit(t.q)}>{t.q}</button>
            ))}
          </div>
        </>
      )}

      {asked && (
        <div className="ask-answer">
          <p className="asked-q">{asked.q}</p>
          {asked.res.kind === 'answer' ? (
            <>
              <h4>{asked.res.topic.q}</h4>
              <Answer answer={asked.res.answer} go={go} />
              {asked.res.related.length > 0 && (
                <>
                  <h4>Related</h4>
                  <div className="chips">
                    {asked.res.related.map(t => (
                      <button key={t.id} className="chip" onClick={() => submit(t.q)}>{t.q}</button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <p className="help-note">{asked.res.message}</p>
              <div className="chips">
                {asked.res.suggestions.map(t => (
                  <button key={t.id} className="chip" onClick={() => submit(t.q)}>{t.q}</button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {history.length > 1 && (
        <>
          <h4>You asked</h4>
          <div className="chips">
            {history.slice(1).map(q => (
              <button key={q} className="chip ghost" onClick={() => submit(q)}>{q}</button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Answer({ answer, go }) {
  if (!answer) return null
  return (
    <div className="answer">
      {answer.lines.map((l, i) => <p key={i}>{l}</p>)}
      {answer.bullets && answer.bullets.length > 0 && (
        <ul>{answer.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
      )}
      {answer.ctxNote && <p className="help-note">{answer.ctxNote}</p>}
      {answer.link && (
        <button className="share-btn" onClick={() => go(answer.link.phase)}>{answer.link.label}</button>
      )}
    </div>
  )
}

// ----------------------------------------------------------------- about ---

function About() {
  return (
    <div className="help-sec">
      <h3>Mission Architect</h3>
      <p>
        An interactive mission design and validation platform, built for the{' '}
        <b>NASA Space Apps Challenge 2026</b> under the theme <i>The Next Frontier</i>, for the
        challenge <i>Space Mission Design Game</i>, at the Satna virtual event.
      </p>

      <h3>Team Doon-Dev</h3>
      <p className="credit">
        Designed and built by <b>Ranveer</b> and <b>Vibhor</b>.
      </p>

      <h3>What it is built on</h3>
      <ul>
        <li>React and Vite. A static site: no backend, no database, no accounts.</li>
        <li>The only network call at runtime is to NASA&rsquo;s own DONKI API.</li>
        <li>Self-hosted open-licence typefaces, so nothing third party loads while you use it.</li>
        <li>Seven test suites gate every change to the engine.</li>
      </ul>

      <h3>NASA data and sources</h3>
      <p>
        Engineering practice from <i>Design and Develop Science Missions</i> and{' '}
        <i>CubeSat 101</i>; space weather from the DONKI database through NASA Open APIs; catalog
        anchors from Landsat 9, Mars Reconnaissance Orbiter, Lunar Reconnaissance Orbiter,
        SPHEREx and DSCOVR. Every entry carries its source inside the app, on the Sources tab.
      </p>

      <h3>Honesty notes</h3>
      <ul>
        <li>This is a student hackathon project. It is <b>not</b> NASA software and carries no NASA endorsement.</li>
        <li>{ASSISTANT_NAME} is a keyword assistant, not a language model.</li>
        <li>Claude was used as a coding assistant, which the competition rules permit and which we declare rather than hide.</li>
      </ul>

      <div className="help-ctas">
        <a className="share-btn" href="https://github.com/CoderX-24/mission-architect"
          target="_blank" rel="noreferrer">Source on GitHub</a>
        <a className="share-btn" href="https://api.nasa.gov/" target="_blank" rel="noreferrer">
          NASA Open APIs
        </a>
      </div>
    </div>
  )
}
