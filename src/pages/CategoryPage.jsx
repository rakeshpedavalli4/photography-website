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
    let mounted = true

    console.info('[gallery] session check started', { category })
    fetch(`${BACKEND_URL}/api/auth/user`, { credentials: 'include' })
      .then((response) => {
        console.info('[gallery] session response received', { category, status: response.status })
        if (!response.ok) throw new Error('Session request failed')
        return response.json()
      })
      .then((data) => {
        const authenticated = Boolean(data.user)
        console.info('[gallery] session check completed', { category, authenticated })
        if (mounted) setAdminLoggedIn(authenticated)
      })
      .catch((error) => {
        console.warn('[gallery] session check failed', { category, errorName: error.name })
        if (mounted) setAdminLoggedIn(false)
      })

    console.info('[gallery] project request started', { category })
    fetch(`${BACKEND_URL}/api/profiles?category=${encodeURIComponent(category)}`)
      .then(async (response) => {
        console.info('[gallery] project response received', { category, status: response.status })
        if (!response.ok) throw new Error('Could not load projects.')
        return response.json()
      })
      .then((payload) => {
        const categoryProfiles = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.profiles) ? payload.profiles : []
        console.info('[gallery] projects loaded', {
          category,
          count: categoryProfiles.length,
          responseShape: Array.isArray(payload) ? 'array' : Array.isArray(payload.profiles) ? 'wrapped-array' : 'unknown'
        })
        if (!mounted) return
        setProfiles(categoryProfiles)
        if (categoryProfiles.length > 0) {
          setImages([])
          return
        }

        console.info('[gallery] fallback image request started', { category })
        return fetch(`${BACKEND_URL}/api/images?category=${encodeURIComponent(category)}`)
          .then(async (imageResponse) => {
            console.info('[gallery] fallback image response received', { category, status: imageResponse.status })
            if (imageResponse.status === 404) return []
            if (!imageResponse.ok) throw new Error('Could not load images.')
            const imagePayload = await imageResponse.json()
            return Array.isArray(imagePayload) ? imagePayload : []
          })
          .then((imageData) => {
            console.info('[gallery] fallback images loaded', { category, count: imageData.length })
            if (mounted) setImages(imageData)
          })
      })
      .catch((err) => {
        console.error('[gallery] project loading failed', { category, errorName: err.name, message: err.message })
        if (mounted) {
          setProfiles([])
          setImages([])
        }
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => { mounted = false }
  }, [category])

  const info = categoryInfo[category] || { title: 'Gallery', desc: '' }
  const addButtonLabel = 'Add project'
  const addButtonHref = `/admin/add/${category}`

  const handleDeleteProfile = async (profile) => {
    const confirmed = window.confirm(`Delete "${profile.name}" and its uploaded photos?`)
    if (!confirmed) {
      console.info('[gallery] project deletion cancelled', { category })
      return
    }

    console.info('[gallery] project deletion started', { category })
    setDeletingProfile(profile.id)
    setDeleteError('')
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/profiles/${encodeURIComponent(profile.id)}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      console.info('[gallery] project deletion response received', { category, status: response.status })
      if (!response.ok) throw new Error('Could not delete this project.')
      setProfiles((current) => current.filter((item) => item.id !== profile.id))
      console.info('[gallery] project deletion completed', { category })
    } catch (error) {
      console.error('[gallery] project deletion failed', { category, errorName: error.name, message: error.message })
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
