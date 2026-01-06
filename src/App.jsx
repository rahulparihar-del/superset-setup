import { useEffect, useRef, useState } from 'react'
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

// Client-only auth: login, fetch CSRF via proxy, then request guest token
async function supersetAuth() {
  const loginBody = {
    password: import.meta.env.VITE_SUPERSET_PASSWORD,
    provider: 'db',
    refresh: true,
    username: import.meta.env.VITE_SUPERSET_USERNAME,
  }

  const loginResp = await axios.post(
    supersetApiUrl + '/login',
    loginBody,
    { headers: { 'Content-Type': 'application/json' }, withCredentials: true },
  )
  const accessToken = loginResp?.data?.access_token
  if (!accessToken) throw new Error('No access_token from Superset login')
  return { accessToken }
}

async function getSupersetEmbed({ client_id } = {}) {
  const { accessToken } = await supersetAuth()

  // Fetch CSRF (proxy will rewrite cookies to localhost)
  const csrfResp = await axios.get(supersetApiUrl + '/csrf_token/', {
    headers: { Authorization: `Bearer ${accessToken}` },
    withCredentials: true,
  })
  const csrf = csrfResp?.data?.result || csrfResp?.data?.csrf_token || csrfResp?.data?.token
  if (!csrf) console.warn('No CSRF token returned; server may still accept request')

  const rls = []
  if (client_id !== undefined && client_id !== null && `${client_id}` !== '') {
    rls.push({ clause: `client_id IN ('${client_id}')` })
  }

  const postData = {
    resources: [{ type: 'dashboard', id: dashboardId }],
    rls,
    user: {
      username: import.meta.env.VITE_SUPERSET_USERNAME || 'report-viewer',
      first_name: 'report-viewer',
      last_name: 'report-viewer',
    },
  }

  const guestResp = await axios.post(
    // Use proxy so requests are same-origin and headers are set server-side by Vite
    '/superset-api/api/v1/security/guest_token/',
    postData,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(csrf ? { 'X-CSRFToken': csrf, 'X-CSRF-Token': csrf } : {}),
      },
      withCredentials: true,
    },
  )

  const guestToken = guestResp?.data?.token
  if (!guestToken) throw new Error('Superset did not return a guest token')
  return guestToken
}

function App() {
  const [supersetGuestToken, setSupersetGuestToken] = useState(null)
  const initializedRef = useRef(false)

  // Fetch guest token (optionally from URL ?client_id=...)
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    ;(async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const client_id = urlParams.get('client_id')
        const token = await getSupersetEmbed({ client_id })
        setSupersetGuestToken(token)
      } catch (err) {
        console.error('Failed to obtain Superset guest token:', err)
      }
    })()
  }, [])

  // Embed once we have a token
  useEffect(() => {
    if (!supersetGuestToken) return

    ;(async () => {
      try {
        await embedDashboard({
          id: dashboardId,
          supersetDomain: supersetUrl,
          mountPoint: document.getElementById('superset-container'),
          fetchGuestToken: () => supersetGuestToken,
          dashboardUiConfig: {
            hideTitle: true,
            hideChartControls: true,
            hideTab: true,
            filters: { visible: false, expanded: false },
          },
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
  }, [supersetGuestToken])

  return (
    <div className="App">
      <div id="superset-container"></div>
      {/* Superset will be embedded here */}
    </div>
  )
}

export default App
