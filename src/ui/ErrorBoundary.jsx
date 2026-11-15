import { Component } from 'react'

// A screen that throws should cost you that screen, not the whole application.
//
// This exists because one undefined value in the debrief made React unmount the
// entire tree: no nav, no dashboard, no way back, just a white page in front of
// whoever was looking. The margins and the tab bar live outside this boundary,
// so even a total failure of one screen leaves the mission on screen and the
// rest of the app usable.
//
// The parent keys it by phase, so moving to another tab and back remounts it
// and clears the error - no lifecycle hook needed to reset it.

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Keep it in the console for whoever is debugging, and nowhere else: there
    // is no backend to report to and nothing here should leave the browser.
    console.error('Screen failed:', error, info && info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <section className="panel screen-error">
        <h2>This screen stopped</h2>
        <p className="hint">
          Something in this view failed, so it has been taken out rather than taking the rest of
          the app with it. Your mission is intact &mdash; the margins on the right are still live,
          and every other tab still works.
        </p>
        <p className="screen-error-detail">{String(this.state.error && this.state.error.message)}</p>
        <button className="share-btn" onClick={() => this.setState({ error: null })}>
          Try this screen again
        </button>
      </section>
    )
  }
}
