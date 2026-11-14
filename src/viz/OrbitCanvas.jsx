import { useEffect, useRef } from 'react'


export default function OrbitCanvas({ orbit }) {
  const ref = useRef(null)


  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf, t = 0


    const resize = () => {
      const w = cv.clientWidth, h = cv.clientHeight
      cv.width = w * dpr; cv.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)


    const isMars = orbit.solarDistanceAu > 1.2
    const bodyColor = isMars ? '#c1593a' : '#2f6fb3'
    const bodyName = isMars ? 'Mars' : 'Earth'


    const draw = () => {
      const w = cv.clientWidth, h = cv.clientHeight
      const cx = w / 2, cy = h / 2
      ctx.clearRect(0, 0, w, h)


      const bodyR = 24
      const maxR = Math.min(w / 2, h / 2) - 22
      const norm = Math.min(1, Math.log10(1 + orbit.altitudeKm / 200) / Math.log10(1 + 36000 / 200))
      const rx = bodyR + 14 + (maxR - bodyR - 14) * norm
      const ry = rx * 0.34


      // Sunlight comes from the left. Everything to the right of the body is shadow.
      const grad = ctx.createLinearGradient(cx, 0, w, 0)
      grad.addColorStop(0, 'rgba(10,12,18,0.85)')
      grad.addColorStop(1, 'rgba(10,12,18,0)')
      ctx.fillStyle = grad
      ctx.fillRect(cx, cy - bodyR, w - cx, bodyR * 2)


      // Orbit path
      ctx.strokeStyle = 'rgba(139,149,168,0.45)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke()


      // Central body
      ctx.beginPath(); ctx.arc(cx, cy, bodyR, 0, Math.PI * 2)
      ctx.fillStyle = bodyColor; ctx.fill()
      ctx.beginPath(); ctx.arc(cx - 6, cy - 6, bodyR, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill()


      // Sun marker
      ctx.beginPath(); ctx.arc(14, cy, 7, 0, Math.PI * 2)
      ctx.fillStyle = '#f0b44a'; ctx.fill()


      // Spacecraft
      const a = t
      const sx = cx + rx * Math.cos(a)
      const sy = cy + ry * Math.sin(a)
      const inShadow = Math.cos(a) > 0 && Math.abs(ry * Math.sin(a)) < bodyR
      ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, Math.PI * 2)
      ctx.fillStyle = inShadow ? '#5b6673' : '#f0914a'; ctx.fill()
      if (!inShadow) {
        ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(240,145,74,0.18)'; ctx.fill()
      }


      ctx.font = '11px -apple-system, system-ui, sans-serif'
      ctx.fillStyle = 'rgba(230,234,242,0.75)'
      ctx.fillText(bodyName, cx - ctx.measureText(bodyName).width / 2, cy + bodyR + 15)
      ctx.fillStyle = 'rgba(139,149,168,0.9)'
      ctx.fillText(Math.round(orbit.eclipseFraction * 100) + '% of each orbit in eclipse', 12, h - 10)
      const per = Math.round(orbit.periodMin) + ' min period'
      ctx.fillText(per, w - ctx.measureText(per).width - 12, h - 10)


      if (!reduce) { t += 0.012; raf = requestAnimationFrame(draw) }
    }
    draw()


    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [orbit])


  return <canvas ref={ref} className="orbit-canvas" />
}
