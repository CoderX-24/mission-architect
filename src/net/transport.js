// ============================================================================
// TRANSPORT - two channels, both running at once.
//
//   local : BroadcastChannel. Same browser, different tabs. No network at all,
//           so it cannot fail and it is how the whole thing is demonstrated on
//           one laptop with four windows open.
//   peer  : WebRTC through PeerJS, using the free public broker. Real players
//           on real devices joining with a code.
//
// Both are used simultaneously and messages are de-duplicated by id, which
// means the fallback is not a decision anyone has to make: if the broker is
// unreachable the session keeps working for everyone on this machine, and the
// UI says so rather than pretending otherwise. peerjs is imported lazily, so a
// solo player never downloads it.
// ============================================================================

const PEER_PREFIX = 'ma-'
const CONNECT_TIMEOUT_MS = 9000

export function peerIdFor(code) { return PEER_PREFIX + String(code).toUpperCase() }

export function createTransport({ code, isHost, selfId, onMessage, onStatus }) {
  const seen = new Set()
  let counter = 0
  let closed = false

  const status = {
    local: false,
    peer: 'idle',            // idle | connecting | open | unavailable
    peers: 0,
    error: null,
  }
  const pushStatus = () => { if (!closed && onStatus) onStatus({ ...status }) }

  const accept = envelope => {
    if (closed || !envelope || seen.has(envelope.mid)) return
    if (envelope.from === selfId) return
    if (envelope.to && envelope.to !== selfId) return
    seen.add(envelope.mid)
    if (seen.size > 600) seen.clear()
    onMessage(envelope.msg, envelope.from)
  }

  // ----------------------------------------------------------- local ------
  let channel = null
  try {
    channel = new BroadcastChannel('mission-architect-' + code)
    channel.onmessage = e => accept(e.data)
    status.local = true
  } catch {
    status.local = false
  }

  // ------------------------------------------------------------ peer ------
  let peer = null
  let conns = []          // host: every client. client: the single host conn.

  const wire = conn => {
    conn.on('data', accept)
    conn.on('close', () => {
      conns = conns.filter(c => c !== conn)
      status.peers = conns.length
      pushStatus()
    })
    conn.on('error', () => {
      conns = conns.filter(c => c !== conn)
      status.peers = conns.length
      pushStatus()
    })
  }

  const startPeer = async () => {
    status.peer = 'connecting'
    pushStatus()
    let Peer
    try {
      ({ default: Peer } = await import('peerjs'))
    } catch {
      status.peer = 'unavailable'
      status.error = 'The peer library could not be loaded.'
      return pushStatus()
    }
    if (closed) return

    try {
      peer = isHost ? new Peer(peerIdFor(code)) : new Peer()
    } catch {
      status.peer = 'unavailable'
      status.error = 'This browser refused to open a peer connection.'
      return pushStatus()
    }

    const giveUp = setTimeout(() => {
      if (status.peer !== 'open') {
        status.peer = 'unavailable'
        status.error = status.error ||
          'The public matchmaking broker did not answer. Players on this device are still in sync.'
        pushStatus()
      }
    }, CONNECT_TIMEOUT_MS)

    peer.on('error', err => {
      const type = err && err.type
      // A taken id means somebody is already hosting this code.
      status.error = type === 'unavailable-id'
        ? 'That session code is already in use. Create a new session.'
        : type === 'peer-unavailable'
          ? 'No session is hosting that code right now.'
          : 'Peer connection failed (' + (type || 'unknown') + '). Players on this device are still in sync.'
      if (status.peer !== 'open') status.peer = 'unavailable'
      pushStatus()
    })

    if (isHost) {
      peer.on('open', () => {
        clearTimeout(giveUp)
        status.peer = 'open'
        status.error = null
        pushStatus()
      })
      peer.on('connection', conn => {
        conns.push(conn)
        wire(conn)
        conn.on('open', () => { status.peers = conns.length; pushStatus() })
      })
    } else {
      peer.on('open', () => {
        const conn = peer.connect(peerIdFor(code), { reliable: true })
        conns = [conn]
        wire(conn)
        conn.on('open', () => {
          clearTimeout(giveUp)
          status.peer = 'open'
          status.error = null
          status.peers = 1
          pushStatus()
        })
      })
    }
  }

  startPeer()

  // ------------------------------------------------------------ send ------
  const send = (msg, to = null) => {
    if (closed) return
    const envelope = { mid: selfId + ':' + (++counter), from: selfId, to, msg }
    seen.add(envelope.mid)
    try { if (channel) channel.postMessage(envelope) } catch { /* channel closed */ }
    for (const c of conns) {
      try { if (c.open) c.send(envelope) } catch { /* connection dropped */ }
    }
  }

  const close = () => {
    closed = true
    try { if (channel) channel.close() } catch { /* already closed */ }
    for (const c of conns) { try { c.close() } catch { /* already closed */ } }
    conns = []
    try { if (peer) peer.destroy() } catch { /* already destroyed */ }
  }

  return { send, close, getStatus: () => ({ ...status }) }
}
