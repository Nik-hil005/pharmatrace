/**
 * API base URL: leave VITE_API_URL unset to use same-origin `/api` (Vite dev proxy).
 * In production, set e.g. VITE_API_URL=https://api.example.com
 */
export function apiUrl(path) {
  const base = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}

/** Skip Bearer for local mock tokens so optional future admin middleware does not reject. */
export function authHeadersJson(token) {
  const headers = { 'Content-Type': 'application/json' }
  const t = token && String(token).trim()
  if (t && !t.startsWith('mock-token')) {
    headers.Authorization = `Bearer ${t}`
  }
  return headers
}

/**
 * Fetch JSON; throws Error with message from body; logs status + body to console on failure.
 */
export async function apiJson(path, options = {}) {
  const url = apiUrl(path)
  const res = await fetch(url, options)
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { _parseError: true, raw: text?.slice(0, 800) }
  }

  if (!res.ok) {
    const errMsg =
      (data && typeof data === 'object' && (data.error || data.message)) ||
      text ||
      `Request failed (${res.status})`
    console.error('[apiJson]', res.status, res.statusText, url, errMsg, data)
    const err = new Error(errMsg)
    err.status = res.status
    err.body = data
    throw err
  }

  return data
}
