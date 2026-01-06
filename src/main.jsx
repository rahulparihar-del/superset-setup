import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Dev-only: clean up any stale Service Workers and caches from previous apps on this origin
if (
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {});
  if ('caches' in window) {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .catch(() => {});
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
