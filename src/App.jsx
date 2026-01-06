import { useEffect, useRef } from 'react'
import axios from 'axios'
import { embedDashboard } from '@superset-ui/embedded-sdk'
import './App.css'

// Configure your Superset details
const supersetUrl = 'https://superset.lockated.com/superset'
// For development, use the Vite proxy to avoid CORS: '/superset-api/superset'
// The proxy in vite.config.js forwards '/superset-api' to 'https://superset.lockated.com'
const supersetApiUrl =
  import.meta.env.DEV
  ? '/superset-api/api/v1/security'
    : supersetUrl + '/api/v1/security'
const dashboardId = '76aa6dae-0d13-4cd3-a8a3-0af3f3ce09e6'

async function getToken() {
  // calling login to get access token
  const login_body = {
    password: import.meta.env.VITE_SUPERSET_PASSWORD,
    provider: 'db',
    refresh: true,
    username: import.meta.env.VITE_SUPERSET_USERNAME,
  }

  const login_headers = {
    headers: {
      'Content-Type': 'application/json',
    },
  }

  console.log(supersetApiUrl + '/login')
  await axios.post(
    supersetApiUrl + '/login',
    login_body,
    login_headers,
  )
  // access_token not used on client; backend fetches guest token

  // Fetch CSRF token (required on some Superset setups for POSTing guest_token)
  // CSRF now handled by the backend token endpoint

  // Calling guest token
  const guest_token_body = {
    resources: [
      {
        type: 'dashboard',
        id: dashboardId,
      },
    ],
    rls: [],
    user: {
      username: 'report-viewer',
      first_name: 'report-viewer',
      last_name: 'report-viewer',
    },
  }

  // Headers for direct call kept here for reference; backend call used instead

  // Prefer server-side token generation to satisfy referrer/CSRF checks
  console.log('/api/guest-token')
  const dt = await axios.post(
    '/api/guest-token',
    { dashboardId, rls: guest_token_body.rls, user: guest_token_body.user },
    { headers: { 'Content-Type': 'application/json' } },
  )
  return dt.data['token']
}

function App() {
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    ;(async () => {
      try {
        const token = await getToken()
        await embedDashboard({
          id: dashboardId, // given by the Superset embedding UI
          supersetDomain: supersetUrl,
          mountPoint: document.getElementById('superset-container'), // html element in which iframe renders
          fetchGuestToken: () => token,
          dashboardUiConfig: { hideTitle: true },
        })

        const iframe =
          document.querySelector('#superset-container iframe') ||
          document.querySelector('iframe')
        if (iframe) {
          iframe.style.width = '100%'
          iframe.style.minHeight = '100vh'
          iframe.style.border = '0'
        }
      } catch (err) {
        console.error('Failed to embed Superset dashboard:', err)
      }
    })()
  }, [])

  return (
    <div className="App">
      <div id="superset-container"></div>
      {/* Superset will be embedded here */}
    </div>
  )
}

export default App
