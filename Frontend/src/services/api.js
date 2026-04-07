const API_BASE = `${import.meta.env.VITE_API_BASE_URL || ''}/api/v1`

export async function apiFetch(path, options = {}, getToken) {
  const doFetch = async () => {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    })
  }

  let res = await doFetch()
  // Retry once on 401 — token may have expired, getToken() fetches fresh one
  if (res.status === 401) {
    res = await doFetch()
  }
  if (!res.ok) {
    const err = new Error(`API error: ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

export async function uploadDocument(file, getToken) {
  const token = await getToken()
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) {
    const err = new Error('Upload failed')
    err.status = res.status
    throw err
  }
  return res.json()
}

export function createChatSocket(documentId) {
  const wsBase = import.meta.env.VITE_WS_BASE_URL
  if (wsBase) {
    return new WebSocket(`${wsBase}/api/v1/chat/${documentId}`)
  }
  // Dev fallback: use Vite proxy via current host
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return new WebSocket(`${protocol}//${window.location.host}/api/v1/chat/${documentId}`)
}
