import { useState } from 'react'
import { shareUrl } from '../share/encode.js'


export default function ShareButton({ config }) {
  const [state, setState] = useState('idle')
  const url = shareUrl(config)


  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setState('copied')
    } catch {
      setState('manual')
    }
    setTimeout(() => setState('idle'), 4000)
  }


  return (
    <div className="share">
      <button className="share-btn" onClick={copy}>
        {state === 'copied' ? 'Link copied' : 'Share this mission'}
      </button>
      {state === 'manual' && <input className="share-url" readOnly value={url}
        onFocus={e => e.target.select()} />}
    </div>
  )
}
