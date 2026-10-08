import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AuthSuccess() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate('/', { replace: true }), 600)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <section className="admin-page">
      <div className="admin-header">
        <h1>Signed in</h1>
      </div>
      <p style={{ color: '#6b6b6b' }}>Authentication successful — redirecting you now...</p>
    </section>
  )
}
