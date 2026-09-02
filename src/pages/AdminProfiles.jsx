import React, { useEffect, useState } from 'react'

const BACKEND_URL = 'https://backend-we97.onrender.com'

export default function AdminProfiles() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/admin/profiles`, { credentials: 'include' })
      .then((r) => {
        if (r.status === 401) window.location.href = `${BACKEND_URL}/auth/google`
        return r.json()
      })
      .then((data) => setProfiles(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="admin-page">
      <div className="admin-header">
        <h1>Profiles</h1>
        <a className="ghost-btn" href="/admin">Back to dashboard</a>
      </div>

      {loading ? <p>Loading profiles...</p> : (
        <div className="admin-list">
          {profiles.map((profile) => (
            <div key={profile.id} className="admin-row">
              <div>
                <strong>{profile.name}</strong>
                <div>{profile.category}</div>
              </div>
              <div>{profile.images ? profile.images.length : 0} photos</div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
