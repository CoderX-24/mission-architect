// Click feedback. The press itself is CSS (:active, see App.css). This adds a
// short ring at the pointer, drawn on <body> so it never touches a
// component's own styles: one element, transform and opacity only, removed
// when its animation ends. Nothing is drawn under prefers-reduced-motion.

const TARGETS = '.cta, .share-btn, .card, .inst, .phase, .chip, .help-fab'

export function installClickFx() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  document.addEventListener('pointerdown', e => {
    if (reduce.matches || e.button > 0 || !(e.target instanceof Element)) return
    const el = e.target.closest(TARGETS)
    if (!el || el.disabled || el.closest('fieldset:disabled')) return
    const ring = document.createElement('span')
    ring.className = 'click-ring'
    ring.style.left = e.clientX + 'px'
    ring.style.top = e.clientY + 'px'
    ring.addEventListener('animationend', () => ring.remove())
    document.body.appendChild(ring)
  }, { passive: true })
}
