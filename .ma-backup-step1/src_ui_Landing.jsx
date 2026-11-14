import INSTRUMENTS from '../data/instruments.json' with { type: 'json' }
import ORBITS from '../data/orbits.json' with { type: 'json' }
import OBJECTIVES from '../data/objectives.json' with { type: 'json' }
import LAUNCHERS from '../data/launchers.json' with { type: 'json' }


export default function Landing({ onStart }) {
  return (
    <div className="landing">
      <p className="kicker">NASA Space Apps Challenge 2026 &middot; Space Mission Design Game</p>
      <h1>Design a space mission.<br />Find out what you got wrong.</h1>
      <p className="lede">
        Choose a science objective, select instruments, build a spacecraft, pick an orbit
        and a launch vehicle. Then simulate it. Every decision has a consequence drawn
        from real engineering, and the game explains every failure in plain language.
      </p>
      <button className="cta" onClick={onStart}>Start designing</button>


      <div className="features">
        <div className="feature">
          <h3>Real constraints</h3>
          <p>
            Solar flux falls off as the inverse square of distance from the Sun, so an array
            sized for Earth browns out at Mars. Propellant follows the Tsiolkovsky equation.
            Instruments generate more data than your link can carry home.
          </p>
        </div>
        <div className="feature">
          <h3>Margin is the lesson</h3>
          <p>
            Real missions do not spend 100% of their budget. They hold 10 to 35 percent in
            reserve, because everything grows between design and launch. Spend it all and
            the first solar array shortfall ends your mission.
          </p>
        </div>
        <div className="feature">
          <h3>Every number cited</h3>
          <p>
            Launch vehicle capacities, instrument power budgets and orbital parameters all
            come from NASA mission design resources. The Sources tab lists every entry with
            the document it came from.
          </p>
        </div>
      </div>


      <div className="stats">
        <div><b>{OBJECTIVES.length}</b><span>mission objectives</span></div>
        <div><b>{INSTRUMENTS.length}</b><span>science instruments</span></div>
        <div><b>{ORBITS.length}</b><span>orbits, Earth to Mars</span></div>
        <div><b>{LAUNCHERS.length}</b><span>launch vehicles</span></div>
      </div>
    </div>
  )
}
