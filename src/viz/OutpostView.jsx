import { useEffect, useRef, useState } from 'react'

// ============================================================================
// The site plan, drawn. Every metre on screen is a metre in sim/outpost.js -
// this file projects numbers, it does not invent them. The 1.8 m crew figure
// is the scale key: everything else is drawn against it.
//
// Isometric, painter-ordered by depth, with a sun that moves through the
// site's day and casts the shadows that follow from where it is. At night the
// panels go dark, the habitat windows light up, and the orbiter you designed
// passes overhead and drops a link to the ground terminal.
// ============================================================================

const ISO_X = Math.cos(Math.PI / 6)
const ISO_Y = Math.sin(Math.PI / 6)
const SOL_SECONDS = 26        // wall-clock seconds for one full day at the site
const PASS_SECONDS = 7        // wall-clock seconds for one orbiter pass

const PALETTE = {
  earth: {
    ground: '#2b3a33', groundLo: '#1d2823', grid: 'rgba(190,220,210,.10)',
    skyDay: ['#1d3a5c', '#4d7596'], skyNight: ['#050a13', '#0b1626'],
    dust: 'rgba(216,230,238,.5)', rock: '#39473f', stars: 0.35,
  },
  moon: {
    ground: '#5d5c58', groundLo: '#3e3d3a', grid: 'rgba(230,230,225,.10)',
    skyDay: ['#04060b', '#0a0d14'], skyNight: ['#03040a', '#05070e'],
    dust: 'rgba(225,225,215,.35)', rock: '#6a6964', stars: 1,
  },
  mars: {
    ground: '#6e4330', groundLo: '#4a2c1f', grid: 'rgba(255,215,190,.10)',
    skyDay: ['#4a2f23', '#8c5f45'], skyNight: ['#0a0705', '#140d08'],
    dust: 'rgba(230,180,140,.45)', rock: '#7d4e37', stars: 0.6,
  },
}

const MAT = {
  panel:      { top: '#1b3c60', left: '#102540', right: '#16304d', edge: '#3f7fc0' },
  habitat:    { top: '#cfd8e2', left: '#8e9aa8', right: '#aab6c4', edge: '#e6edf5' },
  battery:    { top: '#3a4452', left: '#232b36', right: '#2d3643', edge: '#5b6673' },
  dish:       { top: '#3d4654', left: '#242c38', right: '#2f3845', edge: '#9aa6b6' },
  instrument: { top: '#6b4420', left: '#3d2611', right: '#52331a', edge: '#f0914a' },
  radiator:   { top: '#8d9aa9', left: '#5b6673', right: '#6f7b8a', edge: '#c3ccd8' },
  isru:       { top: '#1f5248', left: '#12332c', right: '#17423a', edge: '#34d399' },
  pad:        { top: '#3b4048', left: '#272b31', right: '#30353c', edge: '#6b7789' },
  shelter:    { top: '#55534e', left: '#3a3936', right: '#464540', edge: '#7d7a73' },
  ops:        { top: '#434e5e', left: '#28303c', right: '#333c49', edge: '#7e8da1' },
  rover:      { top: '#4a5260', left: '#2b313b', right: '#373e49', edge: '#a9b5c7' },
  crew:       { top: '#ff9d4d', left: '#b96b2c', right: '#d9813a', edge: '#ffc48f' },
  marker:     { top: '#ff9d4d', left: '#b96b2c', right: '#d9813a', edge: '#ffc48f' },
}

export default function OutpostView({ outpost, orbit, relayFraction, playing = true, setPlaying }) {
  const ref = useRef(null)
  const wrap = useRef(null)
  const [t, setT] = useState(0.26)          // time of day, 0..1 (0.26 = mid-morning)
  const [hover, setHover] = useState(null)
  const raf = useRef(0)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!playing || reduce) return
    let last = performance.now()
    const tick = now => {
      const dt = (now - last) / 1000; last = now
      setT(v => (v + dt / SOL_SECONDS) % 1)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [playing])

  useEffect(() => {
    const cv = ref.current; if (!cv) return
    const ctx = cv.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const w = cv.clientWidth, h = cv.clientHeight
    if (!w || !h) return
    cv.width = w * dpr; cv.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const pal = PALETTE[outpost.site.id] || PALETTE.earth
    const items = outpost.structures

    // --- sun: one arc across the sky per site day ---------------------------
    // Elevation is a half-sine over the lit fraction, so night is genuinely
    // dark for the part of the day the site spends in shadow.
    const litFraction = outpost.site.illumination
    const dayT = t / Math.max(0.05, litFraction)
    const isNight = dayT > 1
    const elev = isNight ? -0.3 : Math.sin(dayT * Math.PI)       // 0..1
    const azim = (isNight ? 1.15 : dayT) * Math.PI               // sweeps E->W
    const sunX = Math.cos(azim), sunY = Math.sin(azim) * 0.55
    const light = isNight ? 0.16 : 0.35 + 0.65 * Math.max(0, elev)

    const horizonY = h * 0.34
    drawSky(ctx, w, h, horizonY, pal, isNight, elev, azim, outpost.site)
    drawTerrain(ctx, w, h, horizonY, pal, light)

    // --- fit the plan to its own projected bounds ---------------------------
    // Measured, not guessed: a site with a 45 m2 array and two landing pads is a
    // very different shape from a cubesat ground station, and both have to fit.
    const ext = Math.max(18, outpost.extentM)
    const fit = fitPlan(outpost.structures, ext, w, h, horizonY)
    const { s, ox, oy } = fit
    const P = (x, y, z = 0) => [ox + (x - y) * ISO_X * s, oy + (x + y) * ISO_Y * s - z * s]

    drawGround(ctx, P, ext, pal, light, s, horizonY, w, h)

    // Paths worn between the buildings people actually walk between.
    drawPaths(ctx, P, items, pal)

    // Painter's order: far structures first.
    const order = items.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y))
    const boxes = []
    for (const it of order) {
      drawShadow(ctx, P, it, sunX, sunY, elev, isNight)
      const bb = drawStructure(ctx, P, it, s, light, isNight)
      boxes.push({ it, bb })
    }

    // The orbiter you designed, passing over, dropping a link to the actual
    // ground terminal when it is in view.
    const dish = items.find(i => i.kind === 'dish')
    const target = dish ? P(dish.x, dish.y, dish.h) : [w * 0.5, h * 0.7]
    drawOrbiter(ctx, w, h, t, relayFraction, isNight, target)

    drawScaleBar(ctx, w, h, s, ext)
    drawTimeOfDay(ctx, w, h, isNight, elev, outpost, dayT)

    if (hover) {
      const found = boxes.slice().reverse()
        .find(b => hover.x >= b.bb[0] && hover.x <= b.bb[2] && hover.y >= b.bb[1] && hover.y <= b.bb[3])
      if (found) drawLabel(ctx, w, hover, found.it, outpost)
    }

    ctx.strokeStyle = 'rgba(140,160,190,.12)'
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1)
  }, [outpost, orbit, relayFraction, t, hover])

  return (
    <div className="outpost-stage" ref={wrap}>
      <canvas ref={ref} className="outpost-canvas"
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect()
          setHover({ x: e.clientX - r.left, y: e.clientY - r.top })
        }}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={outpost.site.name + ', ' + outpost.units +
          ' spacecraft-equivalents of hardware, ' + outpost.structures.length +
          ' structures drawn to scale across ' + Math.round(outpost.extentM * 2) + ' metres'} />
      <div className="outpost-scrub">
        <span>{(outpost.site.dayLabel || 'DAY').toUpperCase()}</span>
        <input className="scrub" type="range" min="0" max="0.999" step="0.005" value={t}
          aria-label="Time of day at the site"
          onChange={e => { if (setPlaying) setPlaying(false); setT(Number(e.target.value)) }} />
        <span>NIGHT</span>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------- sky ----

function drawSky(ctx, w, h, horizonY, pal, isNight, elev, azim, site) {
  const [a, b] = isNight ? pal.skyNight : pal.skyDay
  const g = ctx.createLinearGradient(0, 0, 0, horizonY)
  g.addColorStop(0, a); g.addColorStop(1, b)
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, horizonY)

  // Stars, where there is no atmosphere to wash them out.
  const density = isNight ? 1 : pal.stars
  if (density > 0.2) {
    for (let i = 0; i < 90; i++) {
      const x = ((i * 2654435761) % 1000) / 1000 * w
      const y = ((i * 40503) % 1000) / 1000 * horizonY
      const m = ((i * 97) % 100) / 100
      ctx.fillStyle = 'rgba(233,238,246,' + (0.10 + m * 0.35) * density + ')'
      ctx.fillRect(x, y, 1.2, 1.2)
    }
  }

  // The Sun, at the elevation and azimuth the shadows are drawn from.
  if (!isNight) {
    const sx = w * (0.5 + Math.cos(azim) * 0.42)
    const sy = horizonY - elev * horizonY * 0.80 + 6
    const gl = ctx.createRadialGradient(sx, sy, 2, sx, sy, 54)
    gl.addColorStop(0, 'rgba(255,236,190,.85)')
    gl.addColorStop(0.25, 'rgba(251,191,36,.30)')
    gl.addColorStop(1, 'rgba(251,191,36,0)')
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sx, sy, 54, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill()
  }

  // From the lunar south pole, Earth sits low and nearly fixed in the sky.
  if (site.id === 'moon') {
    const ex = w * 0.80, ey = horizonY * 0.42
    ctx.beginPath(); ctx.arc(ex, ey, 9, 0, Math.PI * 2)
    ctx.fillStyle = '#2f6fb3'; ctx.fill()
    ctx.beginPath(); ctx.arc(ex - 2.6, ey - 2.6, 9, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill()
    ctx.font = '600 9px ui-monospace, monospace'
    ctx.fillStyle = 'rgba(169,181,199,.75)'
    ctx.fillText('EARTH', ex + 14, ey + 3)
  }

  // Dusty haze gathering at the horizon.
  const hz = ctx.createLinearGradient(0, horizonY * 0.45, 0, horizonY)
  hz.addColorStop(0, 'rgba(0,0,0,0)')
  hz.addColorStop(1, isNight ? 'rgba(0,0,0,.5)' : pal.dust.replace(/[\d.]+\)$/, '0.22)'))
  ctx.fillStyle = hz; ctx.fillRect(0, horizonY * 0.45, w, horizonY * 0.55)
}

// The world past the fence: ground all the way to the horizon, so the site is
// standing on a surface instead of floating on a diamond.
function drawTerrain(ctx, w, h, horizonY, pal, light) {
  const g = ctx.createLinearGradient(0, horizonY, 0, h)
  g.addColorStop(0, shade(pal.groundLo, 0.40 + light * 0.30))
  g.addColorStop(0.30, shade(pal.ground, 0.48 + light * 0.42))
  g.addColorStop(1, shade(pal.ground, 0.62 + light * 0.46))
  ctx.fillStyle = g; ctx.fillRect(0, horizonY, w, h - horizonY)

  // Distant relief, just below the horizon line.
  ctx.beginPath(); ctx.moveTo(0, horizonY)
  for (let x = 0; x <= w; x += 24) {
    const n = Math.sin(x * 0.013) * 5 + Math.sin(x * 0.047) * 3 + Math.sin(x * 0.0031) * 9
    ctx.lineTo(x, horizonY - Math.max(0, n * 0.6))
  }
  ctx.lineTo(w, horizonY + 2); ctx.lineTo(0, horizonY + 2); ctx.closePath()
  ctx.fillStyle = shade(pal.groundLo, 0.36 + light * 0.26); ctx.fill()

  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, horizonY + .5); ctx.lineTo(w, horizonY + .5); ctx.stroke()
}

// Project every corner of every structure at unit scale, measure the result,
// and choose the scale and origin that put all of it on screen.
function fitPlan(items, ext, w, h, horizonY) {
  const top = horizonY + 14, bot = h - 20
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  const see = (x, y, z) => {
    const px = (x - y) * ISO_X, py = (x + y) * ISO_Y - z
    if (px < minX) minX = px
    if (px > maxX) maxX = px
    if (py < minY) minY = py
    if (py > maxY) maxY = py
  }
  for (const it of items) {
    const hw = it.w / 2, hd = it.d / 2
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      see(it.x + sx * hw, it.y + sy * hd, 0)
      see(it.x + sx * hw, it.y + sy * hd, it.h * 1.9)
    }
  }
  if (!Number.isFinite(minX)) { minX = -ext; maxX = ext; minY = -ext; maxY = ext }
  const spanX = Math.max(1, maxX - minX), spanY = Math.max(1, maxY - minY)
  const s = Math.min((w - 48) / spanX, (bot - top) / spanY)
  const ox = (w - (minX + maxX) * s) / 2
  const oy = top + (bot - top - spanY * s) / 2 - minY * s
  return { s, ox, oy }
}

// -------------------------------------------------------------- ground ----

function drawGround(ctx, P, ext, pal, light, s, horizonY, w, h) {
  // The graded site pad. Anything past the horizon belongs to the terrain, so
  // the pad is clipped there rather than floating up into the sky.
  ctx.save()
  ctx.beginPath(); ctx.rect(0, horizonY, w, h - horizonY); ctx.clip()
  const r = ext * 1.06
  const pts = [P(-r, -r), P(r, -r), P(r, r), P(-r, r)]
  const g = ctx.createLinearGradient(0, pts[0][1], 0, pts[2][1])
  g.addColorStop(0, shade(pal.ground, 0.55 + light * 0.45))
  g.addColorStop(1, shade(pal.groundLo, 0.55 + light * 0.45))
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
  ctx.fillStyle = g; ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1; ctx.stroke()

  // Survey grid, every 10 m, so the drawing is readable as a plan.
  ctx.save(); ctx.clip()
  ctx.strokeStyle = pal.grid; ctx.lineWidth = 1
  for (let v = -Math.floor(r / 10) * 10; v <= r; v += 10) {
    ctx.beginPath()
    let p = P(v, -r); ctx.moveTo(p[0], p[1])
    p = P(v, r); ctx.lineTo(p[0], p[1]); ctx.stroke()
    ctx.beginPath()
    p = P(-r, v); ctx.moveTo(p[0], p[1])
    p = P(r, v); ctx.lineTo(p[0], p[1]); ctx.stroke()
  }

  // Scattered rock and crater field, seeded off the site so it never crawls.
  for (let i = 0; i < 70; i++) {
    const a = ((i * 2654435761) % 997) / 997
    const b = ((i * 40503) % 991) / 991
    const x = (a * 2 - 1) * r, y = (b * 2 - 1) * r
    if (Math.abs(x) < ext * 0.75 && Math.abs(y) < ext * 0.75) continue
    const rr = (0.5 + ((i * 7) % 10) / 10 * 2.2) * s
    const p = P(x, y)
    ctx.beginPath(); ctx.ellipse(p[0], p[1], rr, rr * 0.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = i % 3 === 0 ? 'rgba(0,0,0,.22)' : shade(pal.rock, 0.5 + light * 0.5)
    ctx.fill()
  }
  ctx.restore()
  ctx.restore()
}

function drawPaths(ctx, P, items, pal) {
  const hubs = items.filter(i => ['ops', 'habitat', 'dish', 'pad', 'isru'].includes(i.kind))
  if (hubs.length < 2) return
  ctx.strokeStyle = pal.dust.replace(/[\d.]+\)$/, '0.10)')
  ctx.lineWidth = 4; ctx.lineCap = 'round'
  const ops = hubs.find(h => h.kind === 'ops') || hubs[0]
  const a = P(ops.x, ops.y)
  for (const hb of hubs) {
    if (hb === ops) continue
    const b = P(hb.x, hb.y)
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke()
  }
  ctx.lineCap = 'butt'
}

// ------------------------------------------------------------- shadows ----

function drawShadow(ctx, P, it, sunX, sunY, elev, isNight) {
  if (isNight || elev <= 0.04) return
  const len = Math.min(5, 0.6 / Math.max(0.12, elev)) * it.h
  const dx = -sunX * len, dy = -sunY * len
  const hw = it.w / 2, hd = it.d / 2
  const q = [
    P(it.x - hw, it.y - hd), P(it.x + hw, it.y - hd),
    P(it.x + hw + dx, it.y + hd + dy), P(it.x - hw + dx, it.y + hd + dy),
  ]
  ctx.beginPath()
  ctx.moveTo(q[0][0], q[0][1])
  for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1])
  ctx.closePath()
  ctx.fillStyle = 'rgba(0,0,0,' + (0.10 + 0.22 * Math.min(1, elev * 2)) + ')'
  ctx.fill()
}

// ---------------------------------------------------------- structures ----

function box(ctx, P, x, y, w, d, h, mat, light, z0 = 0) {
  const hw = w / 2, hd = d / 2
  const c = {
    tl: P(x - hw, y - hd, z0 + h), tr: P(x + hw, y - hd, z0 + h),
    br: P(x + hw, y + hd, z0 + h), bl: P(x - hw, y + hd, z0 + h),
    Bl: P(x - hw, y + hd, z0), Br: P(x + hw, y + hd, z0), Bb: P(x + hw, y - hd, z0),
  }
  const poly = (pts, fill) => {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill()
  }
  poly([c.bl, c.br, c.Br, c.Bl], shade(mat.left, 0.42 + light * 0.38))
  poly([c.br, c.tr, c.Bb, c.Br], shade(mat.right, 0.52 + light * 0.48))
  poly([c.tl, c.tr, c.br, c.bl], shade(mat.top, 0.60 + light * 0.55))
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(c.tl[0], c.tl[1]); ctx.lineTo(c.tr[0], c.tr[1])
  ctx.lineTo(c.br[0], c.br[1]); ctx.lineTo(c.bl[0], c.bl[1]); ctx.closePath(); ctx.stroke()
  return c
}

function drawStructure(ctx, P, it, s, light, isNight) {
  const mat = MAT[it.kind] || MAT.ops
  const pts = []
  const note = p => { pts.push(p); return p }

  if (it.kind === 'panel') {
    // A real panel on a real frame: legs, then the cell plane tilted to the Sun.
    const hw = it.w / 2, hd = it.d / 2, lift = it.h * 0.55
    const lo = 0.18 * it.h
    const a = note(P(it.x - hw, it.y - hd, lift)), b = note(P(it.x + hw, it.y - hd, lift))
    const c = note(P(it.x + hw, it.y + hd, lo)), d = note(P(it.x - hw, it.y + hd, lo))
    for (const [fx, fy] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) {
      const top = P(it.x + fx, it.y + fy, lift * 0.9), bot = P(it.x + fx, it.y + fy, 0)
      ctx.strokeStyle = 'rgba(120,132,150,.75)'; ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(bot[0], bot[1]); ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1])
    ctx.closePath()
    const lit = isNight ? 0.22 : 0.45 + light * 0.75
    const g = ctx.createLinearGradient(a[0], a[1], c[0], c[1])
    g.addColorStop(0, shade(mat.top, lit))
    g.addColorStop(1, shade(mat.left, lit * 0.8))
    ctx.fillStyle = g; ctx.fill()
    ctx.strokeStyle = shade(mat.edge, isNight ? 0.5 : 0.95); ctx.lineWidth = 1; ctx.stroke()
    const cells = Math.max(2, Math.round(it.w / 1.1))
    ctx.strokeStyle = 'rgba(0,0,0,.30)'; ctx.lineWidth = 0.6
    for (let i = 1; i < cells; i++) {
      const f = i / cells
      const p1 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
      const p2 = [d[0] + (c[0] - d[0]) * f, d[1] + (c[1] - d[1]) * f]
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke()
    }
    if (!isNight && light > 0.5) {
      ctx.fillStyle = 'rgba(255,236,190,' + (0.05 + light * 0.10) + ')'
      ctx.beginPath()
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1])
      ctx.closePath(); ctx.fill()
    }
  } else if (it.kind === 'habitat') {
    const c = box(ctx, P, it.x, it.y, it.w, it.d, it.h * 0.78, mat, light)
    pts.push(c.tl, c.tr, c.br, c.bl, c.Bl, c.Br, c.Bb)
    // Ribs along the module, and windows that only mean something after dark.
    const ribs = Math.max(2, Math.round(it.w / 2.6))
    for (let i = 1; i < ribs; i++) {
      const f = i / ribs
      const p1 = [c.tl[0] + (c.tr[0] - c.tl[0]) * f, c.tl[1] + (c.tr[1] - c.tl[1]) * f]
      const p2 = [c.bl[0] + (c.br[0] - c.bl[0]) * f, c.bl[1] + (c.br[1] - c.bl[1]) * f]
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke()
    }
    const wins = Math.max(1, Math.round(it.w / 3.6))
    for (let i = 0; i < wins; i++) {
      const f = (i + 0.5) / wins
      const p = [c.bl[0] + (c.br[0] - c.bl[0]) * f, c.bl[1] + (c.br[1] - c.bl[1]) * f]
      ctx.fillStyle = isNight ? 'rgba(255,214,140,.95)' : 'rgba(20,28,38,.75)'
      ctx.fillRect(p[0] - 2.2, p[1] + 2, 4.4, 3.2)
      if (isNight) {
        ctx.fillStyle = 'rgba(255,200,110,.16)'
        ctx.beginPath(); ctx.arc(p[0], p[1] + 3.6, 9, 0, Math.PI * 2); ctx.fill()
      }
    }
  } else if (it.kind === 'dish') {
    const base = box(ctx, P, it.x, it.y, it.w * 0.30, it.d * 0.30, it.h * 0.42, mat, light)
    pts.push(base.tl, base.br, base.Bl)
    const top = P(it.x, it.y, it.h * 0.98)
    const rx = it.w / 2 * s, ry = rx * 0.46
    ctx.save()
    ctx.translate(top[0], top[1])
    ctx.rotate(-0.22)
    const g = ctx.createLinearGradient(-rx, -ry, rx, ry)
    g.addColorStop(0, shade('#cfd8e2', 0.35 + light * 0.60))
    g.addColorStop(1, shade('#5b6673', 0.35 + light * 0.55))
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
    ctx.fillStyle = g; ctx.fill()
    ctx.strokeStyle = shade(mat.edge, 0.9); ctx.lineWidth = 1.2; ctx.stroke()
    ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.60, ry * 0.60, 0, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 0.8; ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -ry * 1.5)
    ctx.strokeStyle = 'rgba(200,210,225,.8)'; ctx.lineWidth = 1.4; ctx.stroke()
    ctx.restore()
    pts.push([top[0] - rx, top[1] - ry], [top[0] + rx, top[1] + ry])
  } else if (it.kind === 'pad') {
    const p = P(it.x, it.y, 0.06)
    const rx = it.w / 2 * s, ry = rx * 0.5
    ctx.beginPath(); ctx.ellipse(p[0], p[1], rx, ry, 0, 0, Math.PI * 2)
    ctx.fillStyle = shade('#2c3138', 0.55 + light * 0.45); ctx.fill()
    ctx.strokeStyle = 'rgba(255,157,77,.45)'; ctx.lineWidth = 1.4; ctx.stroke()
    ctx.beginPath(); ctx.ellipse(p[0], p[1], rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,157,77,.28)'; ctx.lineWidth = 1; ctx.stroke()
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(p[0] + Math.cos(a) * rx * 0.78, p[1] + Math.sin(a) * ry * 0.78)
      ctx.lineTo(p[0] + Math.cos(a) * rx * 0.96, p[1] + Math.sin(a) * ry * 0.96)
      ctx.strokeStyle = 'rgba(255,157,77,.35)'; ctx.lineWidth = 1; ctx.stroke()
    }
    pts.push([p[0] - rx, p[1] - ry], [p[0] + rx, p[1] + ry])
  } else if (it.kind === 'radiator') {
    for (let i = 0; i < 3; i++) {
      const c = box(ctx, P, it.x, it.y - it.d / 2 + i * (it.d / 2), it.w, it.d * 0.22,
        it.h * (0.5 + i * 0.1), mat, light)
      pts.push(c.tl, c.br)
    }
  } else if (it.kind === 'isru') {
    const c = box(ctx, P, it.x, it.y, it.w * 0.7, it.d * 0.7, it.h, mat, light)
    pts.push(c.tl, c.tr, c.br, c.bl, c.Bl, c.Br)
    const top = P(it.x, it.y, it.h * 1.08)
    ctx.beginPath(); ctx.ellipse(top[0], top[1], it.w * 0.34 * s, it.w * 0.17 * s, 0, 0, Math.PI * 2)
    ctx.fillStyle = shade(mat.edge, 0.45 + light * 0.4); ctx.fill()
    // Vapour plume: a plant that is actually running.
    for (let i = 0; i < 4; i++) {
      const p = P(it.x, it.y, it.h * (1.15 + i * 0.30))
      ctx.beginPath(); ctx.arc(p[0] + i * 2.2, p[1], 3.2 + i * 1.6, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(200,235,228,' + (0.11 - i * 0.022) + ')'; ctx.fill()
    }
  } else if (it.kind === 'shelter') {
    // Regolith piled over a module: the cheapest radiation shielding there is.
    const p = P(it.x, it.y, 0)
    const rx = it.w / 2 * s, ry = it.h * s
    ctx.beginPath()
    ctx.ellipse(p[0], p[1] - ry * 0.1, rx, ry * 0.95, 0, Math.PI, Math.PI * 2)
    ctx.ellipse(p[0], p[1] - ry * 0.1, rx, rx * 0.44, 0, 0, Math.PI)
    ctx.fillStyle = shade(mat.top, 0.5 + light * 0.45); ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.8; ctx.stroke()
    pts.push([p[0] - rx, p[1] - ry], [p[0] + rx, p[1] + rx * 0.44])
  } else if (it.kind === 'rover') {
    const c = box(ctx, P, it.x, it.y, it.w, it.d, it.h * 0.55, mat, light, it.h * 0.25)
    pts.push(c.tl, c.br, c.Bl)
    for (let i = 0; i < 3; i++) {
      const wx = it.x - it.w / 2 + (i + 0.5) * (it.w / 3)
      for (const wy of [it.y - it.d / 2, it.y + it.d / 2]) {
        const p = P(wx, wy, it.h * 0.14)
        ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(1.4, it.h * 0.16 * s), 0, Math.PI * 2)
        ctx.fillStyle = '#15191f'; ctx.fill()
      }
    }
  } else if (it.kind === 'crew') {
    // The scale key. 1.8 m, drawn from the same metres as everything else.
    const feet = P(it.x, it.y, 0), head = P(it.x, it.y, it.h)
    const hgt = feet[1] - head[1]
    ctx.strokeStyle = shade(mat.edge, 0.95); ctx.lineWidth = Math.max(1.6, hgt * 0.17)
    ctx.beginPath(); ctx.moveTo(feet[0], feet[1]); ctx.lineTo(head[0], head[1] + hgt * 0.26); ctx.stroke()
    ctx.beginPath(); ctx.arc(head[0], head[1] + hgt * 0.14, Math.max(1.4, hgt * 0.15), 0, Math.PI * 2)
    ctx.fillStyle = shade(mat.top, 1); ctx.fill()
    ctx.beginPath(); ctx.ellipse(feet[0], feet[1], hgt * 0.22, hgt * 0.07, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill()
    pts.push([head[0] - hgt * 0.3, head[1]], [feet[0] + hgt * 0.3, feet[1]])
  } else if (it.kind === 'marker') {
    const base = P(it.x, it.y, 0), top = P(it.x, it.y, it.h)
    ctx.strokeStyle = shade(mat.edge, 0.9); ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(top[0], top[1]); ctx.stroke()
    ctx.fillStyle = shade(mat.top, 0.9)
    ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(top[0] + 12, top[1] + 3)
    ctx.lineTo(top[0], top[1] + 7); ctx.closePath(); ctx.fill()
    pts.push([base[0] - 8, top[1]], [base[0] + 14, base[1]])
  } else {
    const c = box(ctx, P, it.x, it.y, it.w, it.d, it.h, mat, light)
    pts.push(c.tl, c.tr, c.br, c.bl, c.Bl, c.Br, c.Bb)
    if (it.kind === 'ops') {
      const m0 = P(it.x + it.w * 0.3, it.y, it.h), m1 = P(it.x + it.w * 0.3, it.y, it.h * 2.1)
      ctx.strokeStyle = 'rgba(169,181,199,.8)'; ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.moveTo(m0[0], m0[1]); ctx.lineTo(m1[0], m1[1]); ctx.stroke()
      ctx.fillStyle = isNight ? '#f43f5e' : 'rgba(244,63,94,.55)'
      ctx.beginPath(); ctx.arc(m1[0], m1[1], 2.2, 0, Math.PI * 2); ctx.fill()
      pts.push([m1[0] - 4, m1[1] - 4])
    }
    if (it.kind === 'battery') {
      for (let i = 1; i < 4; i++) {
        const f = i / 4
        const p1 = [c.bl[0] + (c.br[0] - c.bl[0]) * f, c.bl[1] + (c.br[1] - c.bl[1]) * f]
        const p2 = [c.Bl[0] + (c.Br[0] - c.Bl[0]) * f, c.Bl[1] + (c.Br[1] - c.Bl[1]) * f]
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke()
      }
    }
    if (it.kind === 'instrument') {
      const m0 = P(it.x, it.y, it.h), m1 = P(it.x, it.y, it.h * 1.8)
      ctx.strokeStyle = 'rgba(240,145,74,.85)'; ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.moveTo(m0[0], m0[1]); ctx.lineTo(m1[0], m1[1]); ctx.stroke()
      ctx.fillStyle = '#f0914a'
      ctx.beginPath(); ctx.arc(m1[0], m1[1], 2, 0, Math.PI * 2); ctx.fill()
      pts.push([m1[0] - 4, m1[1] - 4])
    }
  }

  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
  return [Math.min(...xs) - 3, Math.min(...ys) - 3, Math.max(...xs) + 3, Math.max(...ys) + 3]
}

// ------------------------------------------------------------- orbiter ----

function drawOrbiter(ctx, w, h, t, relayFraction, isNight, target) {
  const f = (t * (SOL_SECONDS / PASS_SECONDS)) % 1
  const x = w * (0.06 + f * 0.88)
  const y = h * 0.30 - Math.sin(f * Math.PI) * h * 0.17
  const inContact = f > 0.34 && f < 0.66

  ctx.setLineDash([2, 4])
  ctx.strokeStyle = 'rgba(140,160,190,.22)'; ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 0; i <= 40; i++) {
    const g = i / 40
    const px = w * (0.06 + g * 0.88), py = h * 0.30 - Math.sin(g * Math.PI) * h * 0.17
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py)
  }
  ctx.stroke(); ctx.setLineDash([])

  if (inContact) {
    // Green when the link carries most of what the site measures, amber when it
    // cannot. The colour is the data margin, not decoration.
    const strong = relayFraction >= 0.5
    const head = strong ? '52,211,153' : '251,191,36'
    const g = ctx.createLinearGradient(x, y, target[0], target[1])
    g.addColorStop(0, 'rgba(' + head + ',.65)')
    g.addColorStop(1, 'rgba(' + head + ',.05)')
    ctx.strokeStyle = g; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(target[0], target[1]); ctx.stroke()
    ctx.fillStyle = 'rgba(' + head + ',.14)'
    ctx.beginPath(); ctx.arc(target[0], target[1], 9, 0, Math.PI * 2); ctx.fill()
  }

  ctx.fillStyle = isNight ? '#ff9d4d' : '#e9eef6'
  ctx.fillRect(x - 3, y - 1.5, 6, 3)
  ctx.fillStyle = 'rgba(63,127,192,.9)'
  ctx.fillRect(x - 8, y - 0.8, 4, 1.6); ctx.fillRect(x + 4, y - 0.8, 4, 1.6)

  ctx.font = '600 9px ui-monospace, monospace'
  ctx.fillStyle = inContact ? 'rgba(52,211,153,.95)' : 'rgba(169,181,199,.7)'
  ctx.fillText(inContact ? 'YOUR ORBITER - RELAY LINK UP' : 'YOUR ORBITER', x + 12, y + 3)
}

// --------------------------------------------------------------- chrome ----

function drawScaleBar(ctx, w, h, s, ext) {
  const step = ext > 120 ? 50 : ext > 60 ? 20 : 10
  const px = step * s * ISO_X * 2
  const x0 = 16, y0 = h - 16
  ctx.strokeStyle = 'rgba(233,238,246,.65)'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + px, y0); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x0, y0 - 4); ctx.lineTo(x0, y0 + 4)
  ctx.moveTo(x0 + px, y0 - 4); ctx.lineTo(x0 + px, y0 + 4); ctx.stroke()
  ctx.font = '600 10px ui-monospace, monospace'
  ctx.fillStyle = 'rgba(233,238,246,.75)'
  ctx.fillText(step + ' m', x0 + px + 8, y0 + 4)
}

function drawTimeOfDay(ctx, w, h, isNight, elev, outpost, dayT) {
  ctx.font = '600 10px ui-monospace, monospace'
  ctx.fillStyle = isNight ? 'rgba(96,165,250,.95)' : 'rgba(251,191,36,.95)'
  ctx.fillText(isNight ? 'NIGHT' : (outpost.site.dayLabel || 'DAY') + ' +' +
    Math.round(Math.min(1, dayT) * 100) + '%', 16, 22)
  ctx.fillStyle = 'rgba(169,181,199,.78)'
  ctx.fillText(outpost.site.place.toUpperCase(), 16, 38)
  const right = outpost.units + ' UNITS - ' + outpost.structures.length + ' STRUCTURES'
  ctx.fillStyle = 'rgba(169,181,199,.6)'
  ctx.fillText(right, w - ctx.measureText(right).width - 16, 22)
}

function drawLabel(ctx, w, hover, it, outpost) {
  const lines = [it.name, it.w.toFixed(1) + ' x ' + it.d.toFixed(1) + ' m, ' + it.h.toFixed(1) + ' m high']
  if (it.kind === 'panel') lines.push('one of ' + outpost.units + ' - ' + outpost.power.farmAreaM2 + ' m2 total')
  if (it.kind === 'habitat') lines.push('one of ' + outpost.habitats + ' - ' + outpost.crew.crew + ' crew on site')
  if (it.kind === 'dish') lines.push(outpost.data.relayGbPerDay.toFixed(1) + ' GB/day home')
  ctx.font = '600 11px ui-monospace, monospace'
  const tw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 18
  const x = Math.min(hover.x + 12, w - tw - 8), y = hover.y + 12
  ctx.fillStyle = 'rgba(8,12,18,.94)'
  ctx.strokeStyle = 'rgba(255,157,77,.45)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.roundRect(x, y, tw, 16 + lines.length * 14, 6)
  ctx.fill(); ctx.stroke()
  lines.forEach((l, i) => {
    ctx.fillStyle = i === 0 ? '#e9eef6' : 'rgba(169,181,199,.85)'
    ctx.fillText(l, x + 9, y + 18 + i * 14)
  })
}

// ---------------------------------------------------------------- utils ----

// Multiply a hex colour by a brightness factor. Lighting in this scene is one
// number per face, so this is all the shading model there is.
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f))
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f))
  const b = Math.min(255, Math.round((n & 255) * f))
  return 'rgb(' + r + ',' + g + ',' + b + ')'
}
