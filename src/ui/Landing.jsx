import INSTRUMENTS from '../data/instruments.json' with { type: 'json' }
import ORBITS from '../data/orbits.json' with { type: 'json' }
import OBJECTIVES from '../data/objectives.json' with { type: 'json' }
import LAUNCHERS from '../data/launchers.json' with { type: 'json' }
import CMES from '../data/spaceweather-fallback.json' with { type: 'json' }
import OrbitCanvas from '../viz/OrbitCanvas.jsx'

const SSO = ORBITS.find(o => o.id === 'leo_sso')

export default function Landing({ onStart }) {
  return (
    <div className="landing">
      <div className="landing-hero">
        <div>
          <p className="kicker">NASA Space Apps 2026 &middot; Space Mission Design</p>
          <h1>Design a space mission.<br /><span className="acc">Find out what you got wrong.</span></h1>
          <p className="lede">
            Choose a science objective, select instruments, build a spacecraft, pick an orbit
            and a launch vehicle. Then fly it. Every decision has a consequence drawn from
            real engineering, and every failure explains itself in plain language.
          </p>
          <div className="cta-row">
            <button className="cta" onClick={onStart}>Start designing</button>
          </div>
        </div>

        <div className="hero-viz">
          <OrbitCanvas orbit={SSO} />
          <div className="hero-viz-cap">
            <span>Sun-synchronous &middot; <b>705 km</b></span>
            <span><b>{Math.round(SSO.periodMin)} min</b> period</span>
            <span><b>{Math.round(SSO.eclipseFraction * 100)}%</b> in eclipse</span>
          </div>
        </div>
      </div>

      <div className="features">
        <div className="feature">
          <span className="feature-n">01 / CONSTRAINTS</span>
          <h3>Real physics, not scoring rules</h3>
          <p>
            Solar flux falls off as the inverse square of distance from the Sun, so an array
            sized for Earth browns out at Mars. Propellant follows the Tsiolkovsky equation.
            Instruments generate more data than your link can carry home.
          </p>
        </div>
        <div className="feature">
          <span className="feature-n">02 / THE MECHANIC</span>
          <h3>Margin is the lesson</h3>
          <p>
            Real missions do not spend 100% of their budget. They hold 10 to 35 percent in
            reserve, because everything grows between design and launch. Spend it all and the
            first solar array shortfall ends your mission.
          </p>
        </div>
        <div className="feature">
          <span className="feature-n">03 / VALIDATION</span>
          <h3>Flown against real solar storms</h3>
          <p>
            Your design is tested against {CMES.length} coronal mass ejections actually recorded
            by NASA&rsquo;s DONKI database. Not simulated events &mdash; real ones, with the
            spacecraft that observed them named.
          </p>
        </div>
      </div>

      <div className="stats">
        <div><b>{OBJECTIVES.length}</b><span>mission objectives</span></div>
        <div><b>{INSTRUMENTS.length}</b><span>science instruments</span></div>
        <div><b>{ORBITS.length}</b><span>orbits, Earth to Mars</span></div>
        <div><b>{LAUNCHERS.length}</b><span>launch vehicles</span></div>
        <div><b>{CMES.length}</b><span>real NASA solar storms</span></div>
      </div>
    </div>
  )
}
