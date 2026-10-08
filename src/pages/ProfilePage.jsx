import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Gallery from '../components/Gallery'

const BACKEND_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:4000'
  : 'https://backend-we97.onrender.com'

export default function ProfilePage() {
  const { category, profileId } = useParams()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.info('[profile] load started', { category })
    fetch(`${BACKEND_URL}/api/profiles/${encodeURIComponent(profileId)}`)
      .then(async (response) => {
        console.info('[profile] response received', { category, status: response.status })
        if (!response.ok) return null
        const payload = await response.json()
        return payload.profile || payload
      })
      .then((data) => {
        console.info('[profile] load completed', { category, found: Boolean(data), imageCount: data?.images?.length || 0 })
        setProfile(data)
      })
      .catch((error) => console.error('[profile] load failed', { category, errorName: error.name }))
      .finally(() => {
        console.info('[profile] loading state cleared', { category })
        setLoading(false)
      })
  }, [category, profileId])

  if (loading) return <section className="profile-page"><p>Loading profile...</p></section>
  if (!profile) return <section className="profile-page"><p>Profile not found.</p></section>

  return (
    <section className="profile-page">
      <div className="profile-header">
        <Link to={`/gallery/${category}`} className="back-link">← Back to portraits</Link>
        <h1>{profile.name}</h1>
        <p>{profile.description || 'Portrait collection'}</p>
      </div>

      <div className="profile-gallery-wrap">
        {profile.images && profile.images.length ? (
          <Gallery items={profile.images} />
        ) : (
          <p>No photos available for this profile yet.</p>
        )}
      </div>
    </section>
  )
}
