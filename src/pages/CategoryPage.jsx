import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Gallery from '../components/Gallery'

const BACKEND_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:4000'
  : 'https://backend-we97.onrender.com'

export default function CategoryPage({ category }) {
  const [images, setImages] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [adminLoggedIn, setAdminLoggedIn] = useState(false)
  const [deletingProfile, setDeletingProfile] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  const categoryInfo = {
    portraits: { title: 'Portraits', desc: 'Individual portrait collections' },
    landscapes: { title: 'Landscapes', desc: 'Breathtaking landscape photography' },
    events: { title: 'Events', desc: 'Wedding, corporate, and special events' },
    nature: { title: 'Nature & Wildlife', desc: 'Nature and wildlife photography' }
  }

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/auth/user`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setAdminLoggedIn(Boolean(data.user)))
      .catch(() => setAdminLoggedIn(false))

    fetch(`/api/profiles?category=${category}`)
      .then((r) => r.json())
      .then((data) => {
        setProfiles(data)
        if (Array.isArray(data) && data.length > 0) {
          setImages([])
          return
        }

        return fetch(`/api/images?category=${category}`)
          .then((imageRes) => imageRes.json())
          .then((imageData) => setImages(imageData))
      })
      .catch((err) => {
        console.error(err)
        fetch(`/api/images?category=${category}`)
          .then((r) => r.json())
          .then((data) => setImages(data))
          .catch((imageErr) => console.error(imageErr))
      })
      .finally(() => setLoading(false))
  }, [category])

  const info = categoryInfo[category] || { title: 'Gallery', desc: '' }
  const addButtonLabel = 'Add project'
  const addButtonHref = `/admin/add/${category}`

  const handleDeleteProfile = async (profile) => {
    const confirmed = window.confirm(`Delete "${profile.name}" and its uploaded photos?`)
    if (!confirmed) return

    setDeletingProfile(profile.id)
    setDeleteError('')
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/profiles/${encodeURIComponent(profile.id)}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Could not delete this project.')
      setProfiles((current) => current.filter((item) => item.id !== profile.id))
    } catch (error) {
      setDeleteError(error.message || 'Could not delete this project.')
    } finally {
      setDeletingProfile(null)
    }
  }

  return (
    <section className="category-page">
      <div className="category-header">
        <h1>{info.title}</h1>
        <p>{info.desc}</p>
        {adminLoggedIn && (
          <div className="category-actions">
            <Link className="primary-btn" to={addButtonHref}>{addButtonLabel}</Link>
          </div>
        )}
      </div>

      <div className="category-content">
        {loading ? (
          <p>Loading...</p>
        ) : profiles.length > 0 ? (
          <div className="profiles-grid">
            {profiles.map((profile) => {
              const cover = profile.coverImage || (profile.images && profile.images[0] && profile.images[0].path)
              const coverUrl = cover ? (/^https?:\/\//.test(cover) ? cover : `/images/${cover}`) : ''
              return (
                <article key={profile.id} className="profile-card">
                  <Link to={`/gallery/${category}/${profile.id}`} className="profile-card-link">
                    {coverUrl ? <img src={coverUrl} alt={profile.name} /> : <div className="profile-card-placeholder">No cover image</div>}
                    <div className="profile-card-content">
                      <h3>{profile.name}</h3>
                      <p>{profile.description || `${(profile.images || []).length} photos`}</p>
                      <span>View gallery</span>
                    </div>
                  </Link>
                  {adminLoggedIn && (
                    <div className="profile-card-actions">
                      <button
                        className="profile-delete-btn"
                        type="button"
                        disabled={deletingProfile === profile.id}
                        onClick={() => handleDeleteProfile(profile)}
                      >
                        {deletingProfile === profile.id ? 'Deleting...' : 'Delete project'}
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        ) : images.length === 0 ? (
          <p>No images in this category yet.</p>
        ) : (
          <Gallery items={images} />
        )}
        {deleteError && <p className="profile-delete-error" role="alert">{deleteError}</p>}
      </div>
    </section>
  )
}
