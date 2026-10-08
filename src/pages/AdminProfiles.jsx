import React, { useEffect, useState } from 'react'
import { BACKEND_URL } from '../backendUrl'

export default function AdminProfiles() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  // Auth guard: ensure user is authenticated before fetching profiles
  const [authChecking, setAuthChecking] = useState(true)
  useEffect(() => {
    let mounted = true
    console.info('[admin-profiles] session check started')
    fetch(`${BACKEND_URL}/api/auth/user`, { credentials: 'include' })
      .then((response) => {
        console.info('[admin-profiles] session response received', { status: response.status })
        if (!response.ok) throw new Error('Session request failed')
        return response.json()
      })
      .then((d) => {
        if (!mounted) return
        if (!d.user) {
          console.warn('[admin-profiles] session required; redirecting to sign in')
          const returnTo = encodeURIComponent(window.location.pathname || '/admin/profiles')
          window.location.href = `${BACKEND_URL}/auth/google?returnTo=${returnTo}`
        } else {
          console.info('[admin-profiles] session confirmed')
          setAuthChecking(false)
          console.info('[admin-profiles] profile request started')
          fetch(`${BACKEND_URL}/api/admin/profiles`, { credentials: 'include' })
            .then(async (response) => {
              console.info('[admin-profiles] profile response received', { status: response.status })
              if (!response.ok) throw new Error('Could not load admin profiles.')
              return response.json()
            })
            .then((data) => {
              const profileList = Array.isArray(data) ? data : Array.isArray(data.profiles) ? data.profiles : []
              console.info('[admin-profiles] profiles loaded', { count: profileList.length })
              setProfiles(profileList)
            })
            .catch((error) => console.error('[admin-profiles] profile request failed', { errorName: error.name }))
            .finally(() => {
              console.info('[admin-profiles] loading state cleared')
              setLoading(false)
            })
        }
      })
      .catch((error) => {
        if (!mounted) return
        console.error('[admin-profiles] session check failed', { errorName: error.name })
        const returnTo = encodeURIComponent(window.location.pathname || '/admin/profiles')
        window.location.href = `${BACKEND_URL}/auth/google?returnTo=${returnTo}`
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
