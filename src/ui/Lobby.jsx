import { useState } from 'react'
import ROLES from '../data/roles.json' with { type: 'json' }
import OBJECTIVES from '../data/objectives.json' with { type: 'json' }
import { MODES, normaliseCode, isValidCode, freeRoles } from '../net/protocol.js'
import { readJoinCode } from '../share/encode.js'
import { LEVELS } from '../sim/difficulty.js'

// ============================================================================
// The lobby. Create a session and read the code out, or type the code in.
//
// It also tells the truth about the connection: a session always works between
// tabs on this machine, and works across devices when the public broker
// answers. Saying which one you have is better than a spinner that lies.
// ============================================================================

export default function Lobby({ session, config, onSolo }) {
  const [tab, setTab] = useState(() => (readJoinCode() ? 'join' : 'create'))
  const [name, setName] = useState('')
  const [mode, setMode] = useState('coop')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [level, setLevel] = useState(config.level || 'engineer')
  const [objectiveId, setObjectiveId] = useState(config.objectiveId)
  const [code, setCode] = useState(() => readJoinCode() || '')

  const st = session.state

  if (st && !st.started) return <WaitingRoom session={session} onSolo={onSolo} />
  if (st && st.started) return null

  return (
    <div className="lobby">
      <div className="lobby-card">
        <h2>Fly it as a team</h2>
        <p className="hint">
          Up to four people, each holding one role of a real mission team, arguing over one
          spacecraft in real time. Everyone sees the same margins move. Nobody can overrule
          anyone else, because nobody can touch anyone else&rsquo;s subsystem.
        </p>

        <div className="lobby-tabs">
          <button className={'lt' + (tab === 'create' ? ' on' : '')}
            onClick={() => setTab('create')}>Create a session</button>
          <button className={'lt' + (tab === 'join' ? ' on' : '')}
            onClick={() => setTab('join')}>Join with a code</button>
        </div>

        {session.error && <p className="lobby-error">{session.error}</p>}

        {tab === 'create' ? (
          <div className="lobby-form">
            <label>
              <span>Your name</span>
              <input value={name} maxLength={18} placeholder="Flight"
                onChange={e => setName(e.target.value)} />
            </label>

            <fieldset>
              <legend>Mode</legend>
              {MODES.map(m => (
                <button key={m.id} className={'card' + (mode === m.id ? ' on' : '')}
                  onClick={() => setMode(m.id)}>
                  <span className="card-name">{m.name}</span>
                  <span className="card-brief">{m.blurb}</span>
                </button>
              ))}
            </fieldset>

            <label>
              <span>Players: <b>{maxPlayers}</b></span>
              <input type="range" className="scrub" min="2" max="4" value={maxPlayers}
                onChange={e => setMaxPlayers(Number(e.target.value))} />
            </label>

            <fieldset>
              <legend>Difficulty</legend>
              {LEVELS.map(l => (
                <button key={l.id} className={'card' + (level === l.id ? ' on' : '')}
                  onClick={() => setLevel(l.id)}>
                  <span className="card-name">{l.name}</span>
                  <span className="card-brief">{l.blurb}</span>
                </button>
              ))}
            </fieldset>

            {mode === 'versus' && (
              <label>
                <span>Objective everyone designs for</span>
                <select value={objectiveId} onChange={e => setObjectiveId(e.target.value)}>
                  {OBJECTIVES.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
            )}

            <button className="cta" onClick={() => session.create({
              mode, maxPlayers, level, name: name || 'Flight',
              config: { ...config, objectiveId: mode === 'versus' ? objectiveId : config.objectiveId },
            })}>Create session</button>
          </div>
        ) : (
          <div className="lobby-form">
            <label>
              <span>Session code</span>
              <input className="code-input" value={code} maxLength={5} placeholder="A1B2C"
                onChange={e => setCode(normaliseCode(e.target.value))} />
            </label>
            <label>
              <span>Your name</span>
              <input value={name} maxLength={18} placeholder="Science"
                onChange={e => setName(e.target.value)} />
            </label>
            <button className="cta" disabled={!isValidCode(code) || session.joining}
              onClick={() => session.join(code, name || 'Player')}>
              {session.joining ? 'Looking for that session…' : 'Join session'}
            </button>
            <p className="group-hint">
              A session reaches other tabs on this computer with no network at all, and other
              devices through a free public matchmaking broker. If the broker is down, players
              on the same machine still play together.
            </p>
          </div>
        )}

        <button className="link-btn lobby-solo" onClick={onSolo}>
          Design on my own instead
        </button>
      </div>
    </div>
  )
}

function WaitingRoom({ session, onSolo }) {
  const st = session.state
  const me = session.me
  const [copied, setCopied] = useState(false)
  const open = freeRoles(st)
  const mode = MODES.find(m => m.id === st.mode)
  const needRoles = st.mode === 'coop'
  const everyoneReady = st.players.length >= 2 &&
    st.players.every(p => p.ready && (!needRoles || p.roleId))

  const invite = () => {
    const u = new URL(window.location.href)
    u.searchParams.set('join', st.code)
    u.hash = ''
    navigator.clipboard.writeText(u.toString()).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 3000) },
      () => { /* clipboard refused; the code itself is on screen */ })
  }

  return (
    <div className="lobby">
      <div className="lobby-card">
        <h2>Session {st.code}</h2>

        <div className="code-hero">
          <span className="code-big">{st.code}</span>
          <div>
            <p>Read this out, or send the link. {mode.name} &middot; up to {st.maxPlayers} players
              &middot; {LEVELS.find(l => l.id === st.level).name}</p>
            <button className="share-btn" onClick={invite}>
              {copied ? 'Invite link copied' : 'Copy invite link'}
            </button>
          </div>
        </div>

        <ConnectionLine status={session.status} />

        <h3>Players</h3>
        <div className="player-list">
          {st.players.map(p => (
            <div key={p.id} className={'player' + (p.id === session.selfId ? ' you' : '')}>
              <span className="pl-name">
                {p.name}{p.host && <em className="tag-bonus">host</em>}
                {p.id === session.selfId && <em className="tag-req">you</em>}
              </span>
              <span className="pl-role">
                {p.roleId ? ROLES.find(r => r.id === p.roleId).name
                  : needRoles ? 'choosing a role…' : 'ready to fly'}
              </span>
              <span className={'pl-ready ' + (p.ready ? 'ok' : 'dim')}>
                {p.ready ? 'READY' : 'NOT READY'}
              </span>
            </div>
          ))}
          {Array.from({ length: Math.max(0, st.maxPlayers - st.players.length) }, (_, i) => (
            <div className="player empty" key={'e' + i}><span className="pl-name">waiting for a player</span></div>
          ))}
        </div>

        {needRoles && (
          <>
            <h3>Your role</h3>
            <p className="group-hint">
              You will control this part of the spacecraft and nothing else. Everyone sees the
              margins; only you can move yours.
            </p>
            <div className="card-grid">
              {ROLES.map(r => {
                const taken = st.players.find(p => p.roleId === r.id)
                const mine = me && me.roleId === r.id
                return (
                  <button key={r.id} className={'card' + (mine ? ' on' : '') + (taken && !mine ? ' off' : '')}
                    disabled={Boolean(taken) && !mine}
                    onClick={() => session.claimRole(mine ? null : r.id)}>
                    <span className="card-name">
                      {r.name}
                      {taken && <em className={mine ? 'tag-req' : 'tag-off'}>
                        {mine ? 'yours' : taken.name}</em>}
                    </span>
                    <span className="card-brief">{r.decides}</span>
                    <span className="card-stats">owns the {r.owns.join(' and ')} screen</span>
                  </button>
                )
              })}
            </div>
            {open.length === 0 && <p className="group-hint">Every role is taken.</p>}
          </>
        )}

        <div className="lobby-actions">
          <button className={'cta' + (me && me.ready ? ' ghost' : '')}
            disabled={needRoles && me && !me.roleId}
            onClick={() => session.setReady(!(me && me.ready))}>
            {me && me.ready ? 'Not ready' : 'I am ready'}
          </button>
          {session.isHost && (
            <button className="cta" disabled={!everyoneReady} onClick={() => session.start()}>
              {everyoneReady ? 'Start the mission' : 'Waiting for everyone to be ready'}
            </button>
          )}
          <button className="link-btn" onClick={() => { session.leave(); onSolo() }}>Leave session</button>
        </div>
      </div>
    </div>
  )
}

export function ConnectionLine({ status }) {
  if (!status) return null
  const peer = status.peer
  const tone = peer === 'open' ? 'ok' : peer === 'connecting' ? 'warn' : 'dim'
  const text = peer === 'open'
    ? 'Connected through the public broker — players on other devices can join'
    : peer === 'connecting'
      ? 'Reaching the public matchmaking broker…'
      : 'Broker unavailable — this session is live between tabs on this computer'
  return (
    <p className={'conn ' + tone}>
      <span className="conn-dot" />
      {text}
      {status.peers > 0 && <b> &middot; {status.peers} peer connection{status.peers > 1 ? 's' : ''}</b>}
      {status.error && peer !== 'open' && <em>{status.error}</em>}
    </p>
  )
}
