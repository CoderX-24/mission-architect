import { useCallback, useEffect, useRef, useState } from 'react'
import { createTransport } from './transport.js'
import { createState, reduce, makeCode, scopeFor, playerById } from './protocol.js'

// ============================================================================
// useSession - the host is the authority, so this hook is two programs.
//
// As host: receive intents, run them through reduce(), broadcast the whole
// state. As client: send intents, render whatever state arrives. Both halves
// are small because every rule lives in protocol.js.
// ============================================================================

const newId = () => 'p' + Math.random().toString(36).slice(2, 9)

export function useSession() {
  const [state, setState] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [joining, setJoining] = useState(false)

  // A value, not a ref: it is read during render and never changes after mount.
  const [selfId] = useState(newId)
  const transport = useRef(null)
  const isHost = useRef(false)
  const canon = useRef(null)          // host's authoritative copy
  const nameRef = useRef('Player')

  const stop = useCallback(() => {
    if (transport.current) { transport.current.close(); transport.current = null }
    canon.current = null
    isHost.current = false
    setState(null); setStatus(null); setJoining(false)
  }, [])

  useEffect(() => () => { if (transport.current) transport.current.close() }, [])

  const broadcast = useCallback(next => {
    const clean = { ...next }
    delete clean._reject
    canon.current = clean
    setState(clean)
    if (transport.current) transport.current.send({ t: 'state', state: clean })
  }, [])

  const handle = useCallback((msg, from) => {
    if (isHost.current) {
      if (msg.t === 'state' || msg.t === 'reject') return
      if (!canon.current) return
      const next = reduce(canon.current, msg, from)
      if (next._reject && transport.current) {
        transport.current.send({ t: 'reject', reason: next._reject }, from)
      }
      broadcast(next)
    } else {
      if (msg.t === 'state') {
        canon.current = msg.state
        setState(msg.state)
        setJoining(false)
        setError(null)
      } else if (msg.t === 'reject') {
        setError(msg.reason)
      }
    }
  }, [broadcast])

  // An intent: applied directly when we are the host, sent upstream when not.
  const act = useCallback(msg => {
    if (isHost.current) {
      if (!canon.current) return
      const next = reduce(canon.current, msg, selfId)
      if (next._reject) setError(next._reject)
      broadcast(next)
    } else if (transport.current) {
      transport.current.send(msg)
    }
  }, [broadcast, selfId])

  const open = useCallback((code, host) => {
    if (transport.current) transport.current.close()
    isHost.current = host
    transport.current = createTransport({
      code, isHost: host, selfId,
      onMessage: handle,
      onStatus: s => {
        setStatus(s)
        // The broker may come up after we already announced ourselves locally.
        if (!host && s.peer === 'open' && transport.current) {
          transport.current.send({ t: 'join', name: nameRef.current })
        }
        // A client that connects later needs the current state immediately.
        if (host && s.peer === 'open' && canon.current && transport.current) {
          transport.current.send({ t: 'state', state: canon.current })
        }
      },
    })
    setStatus(transport.current.getStatus())
  }, [handle, selfId])

  const create = useCallback(({ mode, maxPlayers, level, config, name }) => {
    const code = makeCode()
    nameRef.current = (name || 'Host').slice(0, 18)
    const s = createState({
      code, mode, maxPlayers, level,
      hostId: selfId, hostName: nameRef.current,
      config: { ...config, level },
    })
    open(code, true)
    broadcast(s)
    setError(null)
    return code
  }, [open, broadcast, selfId])

  const join = useCallback((code, name) => {
    nameRef.current = (name || 'Player').slice(0, 18)
    setJoining(true)
    setError(null)
    open(code, false)
    // The local channel is instant; the peer channel announces again on open.
    setTimeout(() => {
      if (transport.current) transport.current.send({ t: 'join', name: nameRef.current })
    }, 60)
    setTimeout(() => {
      setJoining(j => {
        if (j) setError('No session answered that code. Check the code, or ask the host whether ' +
          'their broker connection came up.')
        return false
      })
    }, 11000)
  }, [open])

  const leave = useCallback(() => {
    act({ t: 'leave' })
    stop()
  }, [act, stop])

  const me = state ? playerById(state, selfId) : null
  const scope = state ? scopeFor(state, selfId) : null

  return {
    state, status, error, joining, me, scope,
    selfId,
    isHost: Boolean(state && state.hostId === selfId),
    create, join, leave, stop,
    clearError: () => setError(null),
    claimRole: roleId => act({ t: 'claimRole', roleId }),
    setReady: ready => act({ t: 'ready', ready }),
    start: () => act({ t: 'start' }),
    setLevel: level => act({ t: 'level', level }),
    patch: p => act({ t: 'patch', patch: p }),
    reportResult: (score, flies) => act({ t: 'result', score, flies }),
    sendFeedback: (rating, note) => act({ t: 'feedback', rating, note }),
  }
}
