import { useEffect, useRef } from 'react'

// The deep-space field behind every screen. Three things, cheapest first:
//   - two nebula washes and a spacecraft silhouette, animated in CSS on the
//     compositor (transform and opacity only, see App.css)
//   - ONE canvas carrying the stars (three parallax depths), four real
//     constellations, a few tumbling asteroids and the odd meteor, capped at
//     30 frames a
//     second, stopped while the tab is hidden and never started under
//     prefers-reduced-motion (one still frame is drawn instead)
// It is fixed, sits behind all content and takes no pointer events.

const FRAME_MS = 1000 / 30
const TINTS = ['#ffffff', '#bcd4ff', '#ffe9cf']
// drift in px/s and scroll parallax factor, far to near
const DEPTHS = [
  { drift: 1.2, scroll: 0.015, size: 0.8, alpha: 0.6 },
  { drift: 3.0, scroll: 0.04, size: 1.1, alpha: 0.8 },
  { drift: 6.5, scroll: 0.09, size: 1.7, alpha: 1 },
]

// Deterministic, so the sky is the same sky on every load.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Four real asterisms, drawn faintly so they read as sky rather than as
// decoration. Points are normalised inside each constellation's own box;
// `links` are index pairs. Keeping them real is free and more interesting
// than inventing shapes.
const CONSTELLATIONS = [
  { name: 'Orion',
    at: [0.03, 0.09], scale: 0.14,
    pts: [[0.18, 0.06], [0.74, 0.12], [0.38, 0.50], [0.50, 0.53], [0.62, 0.56],
      [0.22, 0.96], [0.84, 0.92]],
    links: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [5, 6]] },
  { name: 'Cassiopeia',
    at: [0.78, 0.05], scale: 0.13,
    pts: [[0, 0.12], [0.26, 0.62], [0.52, 0.18], [0.76, 0.66], [1, 0.14]],
    links: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { name: 'Ursa Major',
    at: [0.70, 0.70], scale: 0.17,
    pts: [[0, 0.55], [0.18, 0.64], [0.36, 0.58], [0.53, 0.44], [0.67, 0.60],
      [0.84, 0.74], [1, 0.52]],
    links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
  { name: 'Crux',
    at: [0.06, 0.74], scale: 0.09,
    pts: [[0.5, 0], [0.5, 1], [0.12, 0.56], [0.88, 0.44]],
    links: [[0, 1], [2, 3]] },
]

// A handful of rocks tumbling through, far enough away to be slow. Irregular
// outlines are generated once from the same seed, so they never crawl.
function makeAsteroids(count) {
  const rnd = mulberry32(90210)
  const rocks = []
  for (let i = 0; i < count; i++) {
    const verts = 8 + Math.floor(rnd() * 4)
    const shape = []
    for (let v = 0; v < verts; v++) shape.push(0.62 + rnd() * 0.55)
    rocks.push({
      x: rnd(), y: 0.08 + rnd() * 0.84,
      r: 4 + rnd() * 9,
      shape,
      spin: (rnd() - 0.5) * 0.34,
      drift: 2.4 + rnd() * 5,
      tilt: rnd() * Math.PI,
      lit: rnd() * Math.PI * 2,
    })
  }
  return rocks
}

function makeStars(count) {
  const rnd = mulberry32(20261115)
  const stars = []
  for (let i = 0; i < count; i++) {
    const r = rnd()
    const depth = r < 0.55 ? 0 : r < 0.88 ? 1 : 2
    stars.push({
      x: rnd(), y: rnd(), depth,
      size: DEPTHS[depth].size * (0.6 + rnd() * 0.8),
      alpha: DEPTHS[depth].alpha * (0.5 + rnd() * 0.5),
      phase: rnd() * Math.PI * 2,
      speed: 0.4 + rnd() * 1.6,
      tint: rnd() < 0.62 ? 0 : rnd() < 0.7 ? 1 : 2,
      glint: depth === 2 && rnd() < 0.3,
    })
  }
  // Grouped by tint so the fill style changes three times a frame, not 200.
  return stars.sort((a, b) => a.tint - b.tint)
}

export default function Backdrop() {
  const ref = useRef(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let raf = 0, last = 0, t = 0
    let w = 0, h = 0, stars = [], rocks = makeAsteroids(5)
    let meteor = null, nextMeteor = 2.5
    const rnd = mulberry32(7)

    const resize = () => {
      // Stars are soft points; 1.5x is indistinguishable from 2x and is
      // nearly half the pixels to clear.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      w = window.innerWidth; h = window.innerHeight
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      stars = makeStars(Math.max(90, Math.min(320, Math.round(w * h / 4200))))
    }

    // Faint lines first so every star sits on top of them.
    const drawConstellations = (sy) => {
      const d = DEPTHS[0]
      for (const c of CONSTELLATIONS) {
        const box = Math.min(w, h) * c.scale * 2.1
        const ox = (((c.at[0] * w - t * d.drift) % w) + w) % w
        const oy = (((c.at[1] * h - sy * d.scroll) % h) + h) % h
        const pt = i => [ox + c.pts[i][0] * box, oy + c.pts[i][1] * box * 0.9]
        // A constellation that straddles the wrap would draw a line across the
        // whole screen, so skip it for that one frame instead.
        if (ox + box > w || oy + box * 0.9 > h) continue

        // Fade toward the middle of the screen. The corners are where the user
        // wanted something to look at; the centre is where the words are, and
        // a line through a headline is just noise.
        const cx = (ox + box / 2) / w - 0.5
        const cy = (oy + box * 0.45) / h - 0.5
        const away = Math.min(1, Math.hypot(cx * 1.15, cy) / 0.5)
        const edge = Math.max(0, Math.min(1, (away - 0.52) / 0.33))
        if (edge <= 0.02) continue

        ctx.globalAlpha = (0.17 + 0.05 * Math.sin(t * 0.35 + c.at[0] * 6)) * edge
        ctx.strokeStyle = '#9db4d8'
        ctx.lineWidth = 0.7
        ctx.beginPath()
        for (const [a, b] of c.links) {
          const p = pt(a), q = pt(b)
          ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1])
        }
        ctx.stroke()

        ctx.fillStyle = '#dce8ff'
        for (let i = 0; i < c.pts.length; i++) {
          const p = pt(i)
          ctx.globalAlpha = (0.5 + 0.3 * Math.sin(t * 0.9 + i * 1.7)) * edge
          ctx.beginPath(); ctx.arc(p[0], p[1], 1.5, 0, Math.PI * 2); ctx.fill()
        }
      }
    }

    const drawAsteroids = (sy) => {
      const d = DEPTHS[1]
      for (const a of rocks) {
        const x = (((a.x * w - t * a.drift) % (w + 120)) + w + 120) % (w + 120) - 60
        const y = (((a.y * h - sy * d.scroll) % h) + h) % h
        const spin = a.tilt + t * a.spin
        ctx.save()
        ctx.translate(x, y); ctx.rotate(spin)
        ctx.beginPath()
        for (let v = 0; v < a.shape.length; v++) {
          const ang = (v / a.shape.length) * Math.PI * 2
          const rr = a.r * a.shape[v]
          const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr
          if (v) ctx.lineTo(px, py); else ctx.moveTo(px, py)
        }
        ctx.closePath()
        ctx.globalAlpha = 0.5
        ctx.fillStyle = '#39414e'
        ctx.fill()
        // One lit limb, so it reads as a solid body and not a grey blob.
        ctx.globalAlpha = 0.5
        ctx.strokeStyle = '#8c9bb3'
        ctx.lineWidth = 0.8
        ctx.stroke()
        ctx.globalAlpha = 0.30
        ctx.beginPath()
        ctx.arc(-a.r * 0.22, -a.r * 0.22, a.r * 0.42, 0, Math.PI * 2)
        ctx.fillStyle = '#aab6c8'
        ctx.fill()
        ctx.restore()
      }
      ctx.globalAlpha = 1
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      const sy = window.scrollY || 0
      drawConstellations(sy)
      drawAsteroids(sy)
      let tint = -1
      for (const s of stars) {
        const d = DEPTHS[s.depth]
        const x = (((s.x * w - t * d.drift) % w) + w) % w
        const y = (((s.y * h - sy * d.scroll) % h) + h) % h
        if (s.tint !== tint) { tint = s.tint; ctx.fillStyle = ctx.strokeStyle = TINTS[tint] }
        ctx.globalAlpha = s.alpha * (0.62 + 0.38 * Math.sin(t * s.speed + s.phase))
        if (s.size < 1.1) {
          ctx.fillRect(x, y, s.size, s.size)
        } else {
          ctx.beginPath(); ctx.arc(x, y, s.size * 0.62, 0, Math.PI * 2); ctx.fill()
        }
        if (s.glint) {
          const g = s.size * 3.2
          ctx.globalAlpha *= 0.45
          ctx.lineWidth = 0.6
          ctx.beginPath()
          ctx.moveTo(x - g, y); ctx.lineTo(x + g, y)
          ctx.moveTo(x, y - g); ctx.lineTo(x, y + g)
          ctx.stroke()
        }
      }

      if (meteor) {
        const p = (t - meteor.t0) / meteor.life
        if (p >= 1) { meteor = null } else {
          const hx = meteor.x + meteor.vx * p, hy = meteor.y + meteor.vy * p
          const tx = hx - meteor.vx * 0.16, ty = hy - meteor.vy * 0.16
          const g = ctx.createLinearGradient(hx, hy, tx, ty)
          g.addColorStop(0, 'rgba(255,255,255,0.9)')
          g.addColorStop(1, 'rgba(188,212,255,0)')
          ctx.globalAlpha = Math.sin(p * Math.PI)
          ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.lineCap = 'round'
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
    }

    const frame = now => {
      raf = requestAnimationFrame(frame)
      if (now - last < FRAME_MS - 1) return
      // A long gap means the tab was away. Do not jump the sky forward.
      t += Math.min(0.1, (now - last) / 1000)
      last = now
      if (!meteor && t > nextMeteor) {
        const dir = rnd() < 0.5 ? 1 : -1
        meteor = {
          t0: t, life: 0.75 + rnd() * 0.4,
          x: w * (0.15 + rnd() * 0.7), y: h * rnd() * 0.45,
          vx: dir * (260 + rnd() * 260), vy: 120 + rnd() * 140,
        }
        nextMeteor = t + 7 + rnd() * 9
      }
      draw()
    }

    const stop = () => { cancelAnimationFrame(raf); raf = 0 }
    const start = () => {
      stop()
      if (motion.matches || document.visibilityState === 'hidden') { draw(); return }
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    const onResize = () => { resize(); if (!raf) draw() }

    resize()
    start()
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', start)
    motion.addEventListener('change', start)

    return () => {
      stop()
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', start)
      motion.removeEventListener('change', start)
    }
  }, [])

  return (
    <div className="backdrop" aria-hidden="true">
      <div className="bd-nebula bd-nebula-a" />
      <div className="bd-nebula bd-nebula-b" />
      <canvas ref={ref} className="bd-stars" />
      <div className="bd-craft-path">
        <svg className="bd-craft" viewBox="0 0 200 90" width="170" height="77">
          {/* solar wings */}
          <g fill="#3d5273" stroke="#8ea6c8" strokeWidth="1">
            <rect x="4" y="33" width="62" height="24" rx="1.5" />
            <rect x="134" y="33" width="62" height="24" rx="1.5" />
          </g>
          <g stroke="#8ea6c8" strokeWidth="0.7" opacity="0.7">
            <path d="M19.5 33v24M35 33v24M50.500 33v24M4 45h62" />
            <path d="M149.5 33v24M165 33v24M180.500 33v24M134 45h62" />
          </g>
          {/* booms */}
          <path d="M66 45h16M118 45h16" stroke="#8ea6c8" strokeWidth="1.6" />
          {/* bus */}
          <rect x="82" y="27" width="36" height="36" rx="4" fill="#5b7092" stroke="#b9c9e0" strokeWidth="1" />
          <path d="M82 39h36M82 51h36" stroke="#b9c9e0" strokeWidth="0.7" opacity="0.6" />
          {/* high-gain dish */}
          <path d="M100 27v-9" stroke="#b9c9e0" strokeWidth="1.4" />
          <path d="M86 12q14 12 28 0z" fill="#7d93b5" stroke="#b9c9e0" strokeWidth="1" />
          <circle cx="100" cy="9" r="1.6" fill="#dfe8f5" />
          {/* instrument aperture and nadir antenna */}
          <circle cx="100" cy="45" r="5" fill="#1f2c40" stroke="#b9c9e0" strokeWidth="0.8" />
          <path d="M100 63v10M95 73h10" stroke="#b9c9e0" strokeWidth="1.2" />
          <circle className="bd-craft-light" cx="113" cy="32" r="1.5" fill="#ffffff" />
        </svg>
      </div>
    </div>
  )
}
