export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? 'http://localhost:4000' : 'https://backend-we97.onrender.com')).replace(/\/$/, '')

export async function apiFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return fetch(url, options)
  if (new URL(url, window.location.origin).origin !== new URL(BACKEND_URL).origin) {
    throw new Error('Admin requests must use the configured backend')
  }
  const response = await fetch(`${BACKEND_URL}/api/auth/csrf`, { credentials: 'include', cache: 'no-store' })
  if (!response.ok) throw new Error('Could not secure the request. Please sign in again.')
  const { csrfToken } = await response.json()
  const headers = new Headers(options.headers)
  headers.set('X-CSRF-Token', csrfToken)
  return fetch(url, { ...options, headers, credentials: 'include' })
}
