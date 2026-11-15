// ============================================================================
// SESSION PROTOCOL - pure, so it can be tested without a browser or a network.
//
// The host is the authority. Clients send intents; the host validates them
// against the sender's role, applies them to one canonical state, and
// broadcasts the whole state back. State is a few kilobytes, so there is no
// reason to be clever about diffs, and "the host owns the truth" removes every
// merge conflict a shared mission could otherwise produce.
//
// Role ownership comes from roles.json, the same file the screens are scoped
// by, so what you can see and what you can change can never disagree.
// ============================================================================

import ROLES from '../data/roles.json' with { type: 'json' }

export const MODES = [
  { id: 'coop', name: 'Collaborative', max: 4,
    blurb: 'One mission, four roles. Each player controls their own phase and nobody can overrule anyone else - you have to argue it out, which is the point.' },
  { id: 'versus', name: 'Head to head', max: 4,
    blurb: 'Same objective, same budget, same difficulty. Everyone designs their own spacecraft and the debrief ranks them.' },
]

// Which config fields each phase owns. The screens are scoped by phase; the
// protocol is enforced by field. This is the one mapping between them.
export const PHASE_FIELDS = {
  objective: ['objectiveId'],
  payload: ['instrumentIds'],
  spacecraft: ['components'],
  orbit: ['orbitId', 'launcherId'],
  simulate: ['lifetimeYears'],
}

// Phases nobody owns: shared read-only views every player can open.
export const SHARED_PHASES = ['trade', 'outpost', 'weather', 'sources', 'debrief']

export const ROLE_IDS = ROLES.map(r => r.id)

export function roleById(id) { return ROLES.find(r => r.id === id) || null }

export function phasesOwnedBy(roleId) {
  const r = roleById(roleId)
  return r ? r.owns.slice() : []
}

export function fieldsOwnedBy(roleId) {
  return phasesOwnedBy(roleId).flatMap(p => PHASE_FIELDS[p] || [])
}

export function ownerOfPhase(phase) {
  return ROLES.find(r => r.owns.includes(phase)) || null
}

// Codes a person reads aloud across a room: no O/0, no I/1.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function makeCode(rand = Math.random) {
  let out = ''
  for (let i = 0; i < 5; i++) out += ALPHABET[Math.floor(rand() * ALPHABET.length)]
  return out
}
export function normaliseCode(input) {
  // The alphabet deliberately contains no O, 0, I or 1, so anything a player
  // mistypes from those is simply dropped rather than silently remapped.
  return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
}
export function isValidCode(code) {
  return /^[A-Z0-9]{5}$/.test(String(code || ''))
}

// ------------------------------------------------------------- the state ---

export function createState({ code, mode = 'coop', maxPlayers = 4, level = 'engineer',
  hostId, hostName, config }) {
  const m = MODES.find(x => x.id === mode) || MODES[0]
  return {
    v: 1,
    code,
    mode: m.id,
    maxPlayers: Math.max(2, Math.min(m.max, maxPlayers)),
    level,
    hostId,
    started: false,
    finished: false,
    players: [{
      id: hostId, name: hostName || 'Host', roleId: null, ready: false, host: true,
      joinedAt: Date.now(), connected: true,
    }],
    config,                 // coop: the one shared mission
    configs: {},            // versus: one per player
    results: {},            // playerId -> { score, flies, at }
    feedback: {},           // playerId -> { rating, note, at }
    log: [],                // short human-readable activity feed
  }
}

const clone = s => JSON.parse(JSON.stringify(s))

function note(state, text) {
  state.log = [...(state.log || []), { at: Date.now(), text }].slice(-40)
}

export function playerById(state, id) {
  return (state.players || []).find(p => p.id === id) || null
}

export function freeRoles(state) {
  const taken = new Set(state.players.map(p => p.roleId).filter(Boolean))
  return ROLES.filter(r => !taken.has(r.id))
}

// Every state change in one place, so the host's behaviour is one function and
// the tests can drive it like a state machine.
export function reduce(state, msg, fromId) {
  const s = clone(state)
  const me = playerById(s, fromId)

  switch (msg.t) {
    case 'join': {
      if (me) { me.connected = true; me.name = msg.name || me.name; return s }
      if (s.players.length >= s.maxPlayers) return { ...s, _reject: 'This session is full.' }
      if (s.started && s.mode === 'versus') return { ...s, _reject: 'This session has already started.' }
      s.players.push({
        id: fromId, name: (msg.name || 'Player').slice(0, 18), roleId: null,
        ready: false, host: false, joinedAt: Date.now(), connected: true,
      })
      note(s, (msg.name || 'A player') + ' joined')
      return s
    }

    case 'leave': {
      s.players = s.players.filter(p => p.id !== fromId)
      if (me) note(s, me.name + ' left')
      return s
    }

    case 'presence': {
      if (me) me.connected = Boolean(msg.connected)
      return s
    }

    case 'claimRole': {
      if (!me) return s
      if (msg.roleId && !ROLE_IDS.includes(msg.roleId)) return s
      if (msg.roleId && s.players.some(p => p.id !== fromId && p.roleId === msg.roleId)) {
        return { ...s, _reject: 'Another player already has that role.' }
      }
      me.roleId = msg.roleId || null
      note(s, me.name + (msg.roleId ? ' took ' + roleById(msg.roleId).name : ' released their role'))
      return s
    }

    case 'ready': {
      if (me) me.ready = Boolean(msg.ready)
      return s
    }

    case 'start': {
      if (fromId !== s.hostId) return s
      s.started = true
      if (s.mode === 'versus') {
        for (const p of s.players) s.configs[p.id] = clone(s.config)
      }
      note(s, 'Mission started')
      return s
    }

    case 'patch': {
      if (!me || !s.started) return s
      const patch = msg.patch || {}
      if (s.mode === 'versus') {
        // Your own mission, so you own every field of it.
        s.configs[fromId] = { ...(s.configs[fromId] || s.config), ...patch }
        return s
      }
      const allowed = new Set(fieldsOwnedBy(me.roleId))
      const illegal = Object.keys(patch).filter(k => !allowed.has(k))
      if (illegal.length) {
        return { ...s, _reject: 'You do not control ' + illegal.join(', ') + '.' }
      }
      s.config = { ...s.config, ...patch }
      return s
    }

    case 'level': {
      if (fromId !== s.hostId) return s
      s.level = msg.level
      s.config = { ...s.config, level: msg.level }
      note(s, 'Difficulty set to ' + msg.level)
      return s
    }

    case 'result': {
      if (!me) return s
      s.results[fromId] = { score: Number(msg.score) || 0, flies: Boolean(msg.flies), at: Date.now() }
      s.finished = true
      note(s, me.name + ' flew the mission: ' + (msg.flies ? 'score ' + msg.score : 'did not fly'))
      return s
    }

    case 'feedback': {
      if (!me) return s
      s.feedback[fromId] = {
        rating: Math.max(1, Math.min(5, Number(msg.rating) || 0)),
        note: String(msg.note || '').slice(0, 500),
        at: Date.now(),
      }
      note(s, me.name + ' left a debrief note')
      return s
    }

    default:
      return s
  }
}

// The leaderboard for a head-to-head session.
export function standings(state) {
  return state.players
    .map(p => ({
      ...p,
      result: state.results[p.id] || null,
      score: state.results[p.id] ? state.results[p.id].score : null,
    }))
    .sort((a, b) => (b.score === null ? -1 : b.score) - (a.score === null ? -1 : a.score))
}

// What this player is allowed to see and touch, used by the screens.
export function scopeFor(state, playerId) {
  const me = playerById(state, playerId)
  if (!state || !me) {
    return { owned: [], shared: SHARED_PHASES, all: true, locked: [], roleId: null }
  }
  if (state.mode === 'versus') {
    // Everyone designs their own spacecraft, but the objective and the
    // difficulty are the host's and stay fixed, or the scores would not be
    // comparable and the contest would mean nothing.
    return {
      owned: ['payload', 'spacecraft', 'orbit', 'simulate'],
      shared: [...SHARED_PHASES, 'objective'],
      all: false, locked: ['objective'], roleId: me.roleId,
    }
  }
  return {
    owned: phasesOwnedBy(me.roleId),
    shared: SHARED_PHASES,
    all: false,
    locked: Object.keys(PHASE_FIELDS).filter(p => !phasesOwnedBy(me.roleId).includes(p)),
    roleId: me.roleId,
  }
}
