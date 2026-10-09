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
  const [isAdmin, setIsAdmin] = useState(false)
  const [coverSavingPath, setCoverSavingPath] = useState('')
  const [coverMessage, setCoverMessage] = useState('')
  const [coverMessageType, setCoverMessageType] = useState('')

  useEffect(() => {
    let mounted = true
    console.info('[profile] admin session check started', { category })
    fetch(`${BACKEND_URL}/api/auth/user`, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Session request failed')
        return response.json()
      })
      .then((data) => {
        const authenticated = Boolean(data.user)
        console.info('[profile] admin session check completed', { category, authenticated })
        if (mounted) setIsAdmin(authenticated)
      })
      .catch((error) => {
        console.warn('[profile] admin session check failed', { category, errorName: error.name })
        if (mounted) setIsAdmin(false)
      })
    return () => { mounted = false }
  }, [category])

  useEffect(() => {
    console.info('[profile] load started', { category })
    fetch(`${BACKEND_URL}/api/profiles/${encodeURIComponent(profileId)}`)
      .then(async (response) => {
        console.info('[profile] response received', { category, status: response.status })
        if (response.ok) {
          const payload = await response.json()
          return payload.profile || payload
        }
        if (response.status !== 404 && response.status !== 405) return null

        console.warn('[profile] detail route unavailable; falling back to category list', { category })
        const listResponse = await fetch(`${BACKEND_URL}/api/profiles?category=${encodeURIComponent(category)}`)
        console.info('[profile] fallback list response received', { category, status: listResponse.status })
        if (!listResponse.ok) return null
        const listPayload = await listResponse.json()
        const profiles = Array.isArray(listPayload)
          ? listPayload
          : Array.isArray(listPayload.profiles) ? listPayload.profiles : []
        const requestedId = profileId.toLowerCase().replace(/[^a-z0-9_-]/g, '')
        return profiles.find((item) => String(item.id).toLowerCase().replace(/[^a-z0-9_-]/g, '') === requestedId) || null
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

  const handleSetCover = async (image) => {
    if (!image?.path || image.path === profile?.coverImage) return
    setCoverSavingPath(image.path)
    setCoverMessage('')
    setCoverMessageType('')
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/profiles/${encodeURIComponent(profile.id)}/cover`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePath: image.path })
      })
      if (!response.ok) throw new Error('Could not update the cover photo.')
      setProfile((current) => current ? { ...current, coverImage: image.path } : current)
      setCoverMessage('Cover photo updated.')
      setCoverMessageType('success')
    } catch (error) {
      console.error('[profile] cover update failed', { category, errorName: error.name })
      setCoverMessage(error.message || 'Could not update the cover photo.')
      setCoverMessageType('error')
    } finally {
      setCoverSavingPath('')
    }
  }

  if (loading) return <section className="profile-page"><p>Loading profile...</p></section>
  if (!profile) return <section className="profile-page"><p>Profile not found.</p></section>

  const cover = profile.coverImage || profile.images?.[0]?.path
  const coverUrl = cover ? (/^https?:\/\//.test(cover) ? cover : `/images/${cover}`) : ''
  const profileHeader = (
    <div className="profile-header">
      <Link to={`/gallery/${category}`} className="back-link">← Back to portraits</Link>
      <h1>{profile.name}</h1>
      <p>{profile.description || 'Portrait collection'}</p>
      {isAdmin && (
        <div className="profile-header-actions">
          <Link
            className="primary-btn profile-add-photos-btn"
            to={`/admin/upload?profileId=${encodeURIComponent(profile.id)}&category=${encodeURIComponent(category)}`}
          >
            Add photos
          </Link>
        </div>
      )}
    </div>
  )

  return (
    <section className="profile-page">
      {coverUrl ? (
        <section className="profile-cover" aria-label={`${profile.name} cover photo`}>
          <img src={coverUrl} alt="" />
          {profileHeader}
        </section>
      ) : profileHeader}

      {coverMessage && <p className={`profile-cover-message ${coverMessageType}`} role="status">{coverMessage}</p>}

      <div className="profile-gallery-wrap">
        {profile.images && profile.images.length ? (
          <Gallery
            items={profile.images}
            showCoverControls={isAdmin}
            coverImage={profile.coverImage || profile.images[0]?.path}
            coverSavingPath={coverSavingPath}
            onSetCover={handleSetCover}
          />
        ) : (
          <p>No photos available for this profile yet.</p>
        )}
      </div>
    </section>
  )
}
