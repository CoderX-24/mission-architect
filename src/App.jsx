import { useCallback, useMemo, useRef, useState } from 'react'
import OBJECTIVES from './data/objectives.json' with { type: 'json' }
import ROLES from './data/roles.json' with { type: 'json' }
import { runMission } from './sim/runMission.js'
import { applyDifficulty, eventsDifficulty, LEVELS, levelOf } from './sim/difficulty.js'
import Dashboard from './ui/Dashboard.jsx'
import PhaseNav, { PHASES } from './ui/PhaseNav.jsx'
import Landing from './ui/Landing.jsx'
import ShareButton from './ui/ShareButton.jsx'
import RoleBar from './ui/RoleBar.jsx'
import SpaceWeatherPanel from './ui/SpaceWeatherPanel.jsx'
import { readHash, readPhase, writePhase, readJoinCode } from './share/encode.js'
import { downloadMission, readMissionFile } from './share/missionFile.js'
import SourcesPanel from './ui/SourcesPanel.jsx'
import ObjectiveScreen from './ui/ObjectiveScreen.jsx'
import PayloadScreen from './ui/PayloadScreen.jsx'
import SpacecraftScreen from './ui/SpacecraftScreen.jsx'
import OrbitScreen from './ui/OrbitScreen.jsx'
import ResultScreen from './ui/ResultScreen.jsx'
import TradeScreen from './ui/TradeScreen.jsx'
import OutpostScreen from './ui/OutpostScreen.jsx'
import DebriefScreen from './ui/DebriefScreen.jsx'
import Lobby, { ConnectionLine } from './ui/Lobby.jsx'
import ErrorBoundary from './ui/ErrorBoundary.jsx'
import { useSession } from './net/useSession.js'
import { ownerOfPhase } from './net/protocol.js'
import HelpDrawer from './ui/HelpDrawer.jsx'
import TopBar from './ui/TopBar.jsx'
import { INITIAL_CONFIG as INITIAL } from './share/initialConfig.js'
import ROLES_FOR_HELP from './data/roles.json' with { type: 'json' }
import './App.css'


export default function App() {
  const [localConfig, setLocalConfig] = useState(() => readHash() || INITIAL)
  const [phase, setPhase] = useState(() => readPhase() || 'objective')
  const [screen, setScreen] = useState(() =>
    (readHash() || readPhase()) ? 'app' : readJoinCode() ? 'lobby' : 'landing')
  const [role, setRole] = useState(null)
  const [peek, setPeek] = useState(false)
  const session = useSession()

  const st = session.state
  const inSession = Boolean(st && st.started)
  const scope = inSession ? session.scope : null

  // In a session the mission lives in the session: shared in collaborative
  // mode, one per player head to head. Solo, it lives in this component.
  const config = inSession
    ? (st.mode === 'versus' ? (st.configs[session.selfId] || st.config) : st.config)
    : localConfig

  // Screens still call setConfig(c => next). Outside a session that is state.
  // Inside one it becomes a patch of only the fields that actually changed,
  // which the host validates against the role that sent it.
  const setConfig = useCallback(updater => {
    const next = typeof updater === 'function' ? updater(config) : updater
    if (!inSession) { setLocalConfig(next); return }
    const patch = {}
    for (const k of Object.keys(next)) if (next[k] !== config[k]) patch[k] = next[k]
    if (Object.keys(patch).length) session.patch(patch)
  }, [config, inSession, session])

  // Difficulty reaches the engine only as the in-flight event setting it has
  // always taken. A config with no level is byte-identical to what the engine
  // was calibrated against.
  const simConfig = useMemo(() => {
    const d = eventsDifficulty(config)
    return (d === 'normal' && !config.level) ? config : { ...config, difficulty: d }
  }, [config])
  const result = useMemo(() => runMission(simConfig), [simConfig])
  const diff = useMemo(() => applyDifficulty({ config, result }), [config, result])

  const objective = OBJECTIVES.find(o => o.id === config.objectiveId)
  const props = { config, setConfig, result, diff }
  const checks = [...result.checks, ...diff.checks]

  const goPhase = p => { setPhase(p); writePhase(p) }

  // The wordmark is the way home from anywhere. A running team session is left
  // running - the hook stays mounted, so the player can walk back into it.
  const goHome = () => { setScreen('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  if (screen === 'landing') {
    return (
      <>
        <TopBar />
        <Landing
          onStart={(cfg, ph) => {
            if (cfg) setLocalConfig(cfg)
            if (ph) goPhase(ph)
            setScreen('app')
          }}
          onTeam={() => setScreen('lobby')} />
      </>
    )
  }

  if (screen === 'lobby' && !inSession) {
    return (
      <>
        <TopBar onHome={goHome} />
        <Lobby session={session} config={localConfig} onSolo={() => setScreen('app')} />
      </>
    )
  }

  // A tab you do not own is only reachable while peeking. Rather than store a
  // corrected phase - which would mean setting state from an effect every time
  // a session starts - the shown phase is derived here: if the session moved
  // under you, you land on a screen you actually control.
  const ownable = PHASES.some(p => p.id === phase && p.ownable)
  const notMine = Boolean(scope) && ownable && !scope.owned.includes(phase)
  const shownPhase = notMine && !peek ? (scope.owned[0] || 'debrief') : phase
  const locked = notMine && peek

  return (
    <>
    <TopBar as="h1" onHome={goHome} />
    <div className={'app level-' + levelOf(config).id + (diff.guidance.hints ? '' : ' no-hints') +
      (diff.guidance.fixes ? '' : ' no-fixes')}>
      <header>
        <p>{objective.name} &mdash; {objective.brief}</p>

        <div className="toolbar">
          <ShareButton config={config} />
          <MissionFile config={config} result={result}
            canLoad={!inSession || st.mode === 'versus'}
            onLoad={cfg => setConfig(() => cfg)} />
          <LevelPicker config={config} setConfig={setConfig} session={session} inSession={inSession} />
          {!inSession && (
            <button className="share-btn" onClick={() => setScreen('lobby')}>Play as a team</button>
          )}
        </div>

        {inSession
          ? <SessionBar session={session} peek={peek} setPeek={setPeek} />
          : <RoleBar role={role} setRole={setRole} result={result} />}
      </header>

      <PhaseNav phase={shownPhase} setPhase={goPhase} scope={scope} peek={peek} />

      <main>
        <div className="stage">
          {(
            <ErrorBoundary key={shownPhase}>
            <fieldset className={'screen-wrap' + (locked ? ' read-only' : '')} disabled={locked}>
              {locked && <p className="readonly-flag">
                VIEW ONLY &middot; {ownerOfPhase(shownPhase)
                  ? ownerOfPhase(shownPhase).name : 'another player'} controls this screen
              </p>}
              {shownPhase === 'objective' && <ObjectiveScreen {...props} />}
              {shownPhase === 'payload' && <PayloadScreen {...props} />}
              {shownPhase === 'spacecraft' && <SpacecraftScreen {...props} />}
              {shownPhase === 'orbit' && <OrbitScreen {...props} />}
              {shownPhase === 'simulate' && <ResultScreen {...props} />}
              {shownPhase === 'debrief' && <DebriefScreen {...props} session={session} />}
              {shownPhase === 'trade' && <TradeScreen {...props} />}
              {shownPhase === 'outpost' && <OutpostScreen {...props} />}
              {shownPhase === 'weather' && <SpaceWeatherPanel {...props} />}
              {shownPhase === 'sources' && <SourcesPanel />}
            </fieldset>
            </ErrorBoundary>
          )}

          <section className="panel checks">
            <h2>Engineering review</h2>
            {checks.map(c => (
              <div key={c.id} className={'check ' + (c.passed ? 'pass' : 'fail') +
                (c.fromLevel ? ' from-level' : '')}>
                <strong>{c.passed ? 'PASS' : 'FAIL'}</strong>
                <span>{c.message}</span>
                {!c.passed && <em>{c.fix}</em>}
              </div>
            ))}
          </section>
        </div>

        <Dashboard result={result} diff={diff} />
      </main>

      <HelpDrawer config={config} result={result} diff={diff} onPhase={goPhase}
        roleName={inSession && session.me && session.me.roleId
          ? (ROLES_FOR_HELP.find(r => r.id === session.me.roleId) || {}).name : null} />
    </div>
    </>
  )
}


// --------------------------------------------------------------- pieces ----

function SessionBar({ session, peek, setPeek }) {
  const st = session.state
  const me = session.me
  const myRole = me && me.roleId ? ROLES.find(r => r.id === me.roleId) : null
  const owned = session.scope ? session.scope.owned : []

  return (
    <div className="sessionbar">
      <div className="sb-main">
        <span className="sb-code">{st.code}</span>
        <div>
          <strong>
            {st.mode === 'versus'
              ? 'Head to head — your own spacecraft, everyone else’s too'
              : myRole ? 'You are ' + myRole.name : 'You have no role'}
          </strong>
          <span className="sb-owns">
            {st.mode === 'versus'
              ? 'The objective and difficulty are fixed by the host so the scores compare'
              : owned.length
                ? 'You control the ' + owned.join(' and ') + ' screen' + (owned.length > 1 ? 's' : '') +
                  '. Everything else is your teammates’.'
                : 'Watching'}
          </span>
        </div>
      </div>

      <div className="sb-players">
        {st.players.map(p => (
          <span key={p.id} className={'sb-player' + (p.id === session.selfId ? ' you' : '') +
            (p.connected ? '' : ' gone')}>
            {p.name}
            {p.roleId && <em>{ROLES.find(r => r.id === p.roleId).tag}</em>}
          </span>
        ))}
      </div>

      <div className="sb-actions">
        <button className={'share-btn' + (peek ? ' on' : '')} onClick={() => setPeek(!peek)}>
          {peek ? 'Hide teammates’ screens' : 'Peek at teammates’ screens'}
        </button>
        <button className="link-btn" onClick={() => session.leave()}>Leave</button>
      </div>

      <ConnectionLine status={session.status} />
      {session.error && (
        <p className="lobby-error" onClick={session.clearError}>{session.error}</p>
      )}
    </div>
  )
}

function LevelPicker({ config, setConfig, session, inSession }) {
  const level = levelOf(config)
  const hostOnly = inSession && !session.isHost
  return (
    <div className="levelpick">
      <span className="role-label">Level</span>
      {LEVELS.map(l => (
        <button key={l.id} disabled={hostOnly}
          title={hostOnly ? 'The host sets the difficulty for the session' : l.blurb}
          className={'phase' + (l.id === level.id ? ' on' : '')}
          onClick={() => inSession
            ? session.setLevel(l.id)
            : setConfig(c => ({ ...c, level: l.id }))}>
          {l.name}
        </button>
      ))}
    </div>
  )
}

function MissionFile({ config, result, canLoad, onLoad }) {
  const input = useRef(null)
  const [msg, setMsg] = useState(null)

  const load = async file => {
    if (!file) return
    try {
      const { config: cfg, name } = await readMissionFile(file)
      onLoad(cfg)
      setMsg({ ok: true, text: 'Loaded ' + (name || 'mission') + '.' })
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    }
    setTimeout(() => setMsg(null), 6000)
  }

  return (
    <div className="missionfile">
      <button className="share-btn" onClick={() => {
        downloadMission({ config, result })
        setMsg({ ok: true, text: 'Saved to your downloads.' })
        setTimeout(() => setMsg(null), 4000)
      }}>Save design</button>

      <button className="share-btn" disabled={!canLoad}
        title={canLoad ? 'Load a .json mission from your computer'
          : 'In a collaborative session the mission belongs to the team'}
        onClick={() => input.current && input.current.click()}>Load design</button>

      <input ref={input} type="file" accept="application/json,.json" hidden
        onChange={e => { load(e.target.files[0]); e.target.value = '' }} />

      {msg && <span className={'file-msg ' + (msg.ok ? 'ok' : 'bad')}>{msg.text}</span>}
    </div>
  )
}
