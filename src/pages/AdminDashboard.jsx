import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BACKEND_URL } from '../backendUrl'

export default function AdminDashboard() {
  const [user, setUser] = useState(null)
  const [googleEnabled, setGoogleEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND_URL}/api/auth/config`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`${BACKEND_URL}/api/auth/user`, { credentials: 'include' }).then((r) => r.json())
    ])
      .then(([config, userData]) => {
        if (isLocalhost && !userData.user) {
          setUser({
            id: 'local-admin',
            email: 'local-admin@localhost',
            displayName: 'Local Admin'
          })
          setGoogleEnabled(false)
          setLoading(false)
          return
        }

        setGoogleEnabled(Boolean(config.googleEnabled))
        setUser(userData.user || null)
      })
      .catch(() => {
        if (isLocalhost) {
          setGoogleEnabled(false)
          setUser({
            id: 'local-admin',
            email: 'local-admin@localhost',
            displayName: 'Local Admin'
          })
          setLoading(false)
          return
        }

        setGoogleEnabled(false)
        setUser(null)
      })
      .finally(() => {
        if (!isLocalhost || user !== null) setLoading(false)
      })
  }, [isLocalhost])

  if (loading) return <section className="admin-page"><p>Loading admin...</p></section>

  if (!user) {
    return (
      <section className="admin-page admin-login-card">
        <h1>Admin access</h1>
        <p>Sign in with your Google account to manage gallery profiles.</p>
        {googleEnabled ? (
          <a
            className="primary-btn"
            href={`${BACKEND_URL}/auth/google?returnTo=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`}
          >
            Sign in with Google
          </a>
        ) : (
          <p className="admin-error">Google OIDC is not configured yet. Set valid GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your local environment before enabling admin login.</p>
        )}
      </section>
    )
  }

  return (
    <section className="admin-page">
      <div className="admin-header">
        <div>
          <h1>Admin Dashboard</h1>
          <div className="admin-sub">Manage clients and upload photos</div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="admin-user">Signed in as: <strong style={{ fontWeight: 600 }}>{user.displayName || user.email}</strong></div>
          <button
            className="ghost-btn"
            onClick={() => {
              fetch(`${BACKEND_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' })
                .then(() => window.location.href = '/')
            }}
          >
            Log out
          </button>
        </div>
      </div>

      <div className="admin-grid">
        <Link className="admin-card" to="/admin/profiles">
          <div className="card-content-inner">
            <div className="card-title">Profiles</div>
            <div className="card-desc">Create and edit client profiles, view photo counts.</div>
          </div>
          <div className="card-chevron">›</div>
        </Link>

        <Link className="admin-card" to="/admin/upload">
          <div className="card-content-inner">
            <div className="card-title">Upload</div>
            <div className="card-desc">Drag & drop photos to add images to a client gallery.</div>
          </div>
          <div className="card-chevron">›</div>
        </Link>
      </div>
    </section>
  )
}
