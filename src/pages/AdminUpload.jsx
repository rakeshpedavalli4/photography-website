import React, { useState } from 'react'

const BACKEND_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:4000'
  : 'https://backend-we97.onrender.com'

export default function AdminUpload() {
  const [profileId, setProfileId] = useState('emma-johnson')
  const [imageUrls, setImageUrls] = useState('')
  const [status, setStatus] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const images = imageUrls.split('\n').map((line) => line.trim()).filter(Boolean)

    const payload = { profileId, images }

    const res = await fetch(`${BACKEND_URL}/api/admin/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    })

    if (res.status === 401) {
      window.location.href = `${BACKEND_URL}/auth/google`
      return
    }

    const data = await res.json()
    setStatus(data.message || 'Upload complete')
    setImageUrls('')
  }

  return (
    <section className="admin-page">
      <div className="admin-header">
        <h1>Upload Photos</h1>
        <a className="ghost-btn" href="/admin">Back to dashboard</a>
      </div>

      <form className="admin-form" onSubmit={handleSubmit}>
        <label>
          Profile ID
          <input value={profileId} onChange={(e) => setProfileId(e.target.value)} />
        </label>

        <label>
          Image URLs (one per line)
          <textarea rows="8" value={imageUrls} onChange={(e) => setImageUrls(e.target.value)} placeholder="https://...jpg" />
        </label>

        <button className="primary-btn" type="submit">Add photos</button>
      </form>

      {status && <div className="success-message">{status}</div>}
    </section>
  )
}
