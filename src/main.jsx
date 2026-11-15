import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Backdrop from './viz/Backdrop.jsx'
import { installClickFx } from './ui/clickFx.js'

installClickFx()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Backdrop />
    <App />
  </StrictMode>,
)
