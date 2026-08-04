import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import './styles/theme.css'

// Offline is a requirement, not a nicety. The moment she most needs this app is
// standing at a hostess stand in a basement dining room with no signal.
registerSW({ immediate: true })

const container = document.getElementById('root')
if (container !== null) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
