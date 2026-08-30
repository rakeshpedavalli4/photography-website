import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Gallery from '../components/Gallery'

export default function ProfilePage() {
  const { category, profileId } = useParams()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/profiles/${profileId}`)
      .then((r) => r.json())
      .then((data) => setProfile(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [profileId])

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
