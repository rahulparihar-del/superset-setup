/* eslint-env node */
import process from 'node:process'
import express from 'express'
import axios from 'axios'
import dotenv from 'dotenv'

// Load env from .env.local first (development), then fallback to .env
dotenv.config({ path: '.env.local' })
dotenv.config()

const app = express()
app.use(express.json())

const SUP_URL = process.env.SUPERSET_URL || 'https://superset.lockated.com/superset'
const SUP_API = SUP_URL + '/api/v1/security'
const SUP_USER = process.env.SUPERSET_USERNAME
const SUP_PASS = process.env.SUPERSET_PASSWORD

app.post('/api/guest-token', async (req, res) => {
  try {
    const { dashboardId, rls = [], user = { username: 'report-viewer', first_name: 'report-viewer', last_name: 'report-viewer' } } = req.body || {}
    if (!dashboardId) {
      return res.status(400).json({ error: 'dashboardId is required' })
    }
    if (!SUP_USER || !SUP_PASS) {
      return res.status(500).json({ error: 'Server missing SUPERSET_USERNAME / SUPERSET_PASSWORD' })
    }

    // Login
    const loginResp = await axios.post(
      SUP_API + '/login',
      { username: SUP_USER, password: SUP_PASS, provider: 'db', refresh: true },
      {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      },
    )
    const accessToken = loginResp.data?.access_token
    if (!accessToken) return res.status(401).json({ error: 'Login failed' })

    // CSRF token (some setups require it)
    let csrfToken
    try {
      const csrf = await axios.get(SUP_API + '/csrf_token/', {
        headers: {
          Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          Origin: new URL(SUP_URL).origin,
          Referer: SUP_URL,
        },
      })
      csrfToken = csrf.data?.result
  } catch {
      // Ignore if endpoint not available; we'll try cookie or proceed without
      // console.debug('CSRF fetch failed', err?.response?.status)
    }

    // Guest token
    const guestResp = await axios.post(
      SUP_API + '/guest_token/',
      {
        resources: [{ type: 'dashboard', id: dashboardId }],
        rls,
        user,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer ' + accessToken,
          ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
          'X-Requested-With': 'XMLHttpRequest',
          Origin: new URL(SUP_URL).origin,
          Referer: SUP_URL,
        },
      },
    )

    return res.json({ token: guestResp.data?.token })
  } catch (err) {
    const status = err?.response?.status || 500
    return res.status(status).json({ error: err?.response?.data || String(err) })
  }
})

const port = process.env.PORT || 3001
app.listen(port, () => {
  console.log(`Superset token server listening on http://localhost:${port}`)
})
