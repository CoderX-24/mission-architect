// The corner lockups: the game's name top left, who made it and for what top
// right. In normal flow, so they scroll away with the page and can never sit
// on top of content. `as` lets the app screen make the wordmark its <h1>.
//
// The wordmark is also the way home: every screen has it, so there is always
// one obvious click back to the front page. On the front page itself it is
// inert, because a link to where you already are is a dead end.

export default function TopBar({ as: Name = 'div', onHome = null }) {
  const Mark = onHome ? 'button' : 'div'
  return (
    <div className="topbar">
      <Mark className={'wordmark' + (onHome ? ' is-link' : '')}
        {...(onHome ? { onClick: onHome, type: 'button', title: 'Back to the home page' } : {})}>
        <svg className="wm-glyph" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
          <defs>
            <radialGradient id="wm-planet" cx="35%" cy="30%" r="80%">
              <stop offset="0" stopColor="#e9eef6" />
              <stop offset="1" stopColor="#4d607c" />
            </radialGradient>
          </defs>
          <g transform="rotate(-24 20 20) translate(20 20)">
            <ellipse className="wm-ring" rx="17" ry="7.5" />
            <circle r="6" fill="url(#wm-planet)" />
            <g className="wm-sat-x">
              <g className="wm-sat-y">
                <circle className="wm-sat-glow" r="4.5" />
                <circle className="wm-sat" r="2.1" />
              </g>
            </g>
          </g>
        </svg>
        <div className="wm-text">
          <Name className="wm-name">Mission <span>Architect</span></Name>
          <span className="wm-sub">Design &middot; Fly &middot; Debrief</span>
        </div>
      </Mark>

      <div className="mission-badge">
        <span className="mb-dot" />
        <span className="mb-team">Doon-Dev</span>
        <span className="mb-event">NASA Space Apps 2026</span>
      </div>
    </div>
  )
}
