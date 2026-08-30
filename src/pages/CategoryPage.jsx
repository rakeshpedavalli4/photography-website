import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Gallery from '../components/Gallery'

export default function CategoryPage({ category }) {
  const [images, setImages] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  const categoryInfo = {
    portraits: { title: 'Portraits', desc: 'Individual portrait collections' },
    landscapes: { title: 'Landscapes', desc: 'Breathtaking landscape photography' },
    events: { title: 'Events', desc: 'Wedding, corporate, and special events' },
    nature: { title: 'Nature & Wildlife', desc: 'Nature and wildlife photography' }
  }

  useEffect(() => {
    if (category === 'portraits') {
      fetch(`/api/profiles?category=${category}`)
        .then((r) => r.json())
        .then((data) => setProfiles(data))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false))
      return
    }

    fetch(`/api/images?category=${category}`)
      .then((r) => r.json())
      .then((data) => setImages(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [category])

  const info = categoryInfo[category] || { title: 'Gallery', desc: '' }

  return (
    <section className="category-page">
      <div className="category-header">
        <h1>{info.title}</h1>
        <p>{info.desc}</p>
      </div>

      <div className="category-content">
        {loading ? (
          <p>Loading...</p>
        ) : category === 'portraits' ? (
          profiles.length === 0 ? (
            <p>No portrait profiles yet.</p>
          ) : (
            <div className="profiles-grid">
              {profiles.map((profile) => {
                const cover = profile.coverImage || (profile.images && profile.images[0] && profile.images[0].path)
                return (
                  <Link key={profile.id} to={`/gallery/${category}/${profile.id}`} className="profile-card">
                    <img src={/^https?:\/\//.test(cover || '') ? cover : `/images/${cover}`} alt={profile.name} />
                    <div className="profile-card-content">
                      <h3>{profile.name}</h3>
                      <p>{profile.description || `${(profile.images || []).length} photos`}</p>
                      <span>View gallery</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )
        ) : images.length === 0 ? (
          <p>No images in this category yet.</p>
        ) : (
          <Gallery items={images} />
        )}
      </div>
    </section>
  )
}
