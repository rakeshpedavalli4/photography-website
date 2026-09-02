import React, { useEffect, useState } from 'react'

const BACKEND_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:4000'
  : 'https://backend-we97.onrender.com'

export default function AdminProfiles() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  // Auth guard: ensure user is authenticated before fetching profiles
  const [authChecking, setAuthChecking] = useState(true)
  useEffect(() => {
    let mounted = true
    fetch(`${BACKEND_URL}/api/auth/user`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return
        if (!d.user) {
          const redirect = encodeURIComponent(window.location.pathname || '/admin/profiles')
          window.location.href = `${BACKEND_URL}/auth/google?redirect=${redirect}`
        } else {
          setAuthChecking(false)
          // now fetch profiles
          fetch(`${BACKEND_URL}/api/admin/profiles`, { credentials: 'include' })
            .then((r) => r.json())
            .then((data) => setProfiles(data))
            .catch((err) => console.error(err))
            .finally(() => setLoading(false))
        }
      })
      .catch(() => {
        if (!mounted) return
        const redirect = encodeURIComponent(window.location.pathname || '/admin/profiles')
        window.location.href = `${BACKEND_URL}/auth/google?redirect=${redirect}`
      })
    return () => { mounted = false }
  }, [])

  if (authChecking) return <section className="admin-page"><p>Checking authentication...</p></section>

  return (
    <section className="admin-page">
      <div className="admin-header">
        <h1>Profiles</h1>
        <a className="ghost-btn" href="/admin">Back to dashboard</a>
      </div>

      {loading ? <p>Loading profiles...</p> : (
        <div className="profiles-grid admin-profiles-grid">
          {profiles.map((profile) => (
            <article key={profile.id} className="profile-card admin-profile-card">
              {profile.coverImage ? (
                <img src={profile.coverImage} alt={profile.name} />
              ) : (
                <div style={{ height: 180, background: '#f6f6f6' }} />
              )}

              <div className="profile-card-content admin-profile-content">
                <h3>{profile.name}</h3>
                <p>{profile.description || profile.category}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                  <span style={{ color: '#6b6b6b', fontSize: '0.9rem' }}>{profile.images ? profile.images.length : 0} photos</span>
                  <a className="ghost-btn" href={`/admin/profiles`}>Manage</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
