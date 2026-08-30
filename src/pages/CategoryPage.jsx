import React, { useEffect, useState } from 'react'
import Gallery from '../components/Gallery'

export default function CategoryPage({ category }) {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)

  const categoryInfo = {
    portraits: { title: 'Portraits', desc: 'Professional portrait photography' },
    landscapes: { title: 'Landscapes', desc: 'Breathtaking landscape photography' },
    events: { title: 'Events', desc: 'Wedding, corporate, and special events' },
    products: { title: 'Product Photography', desc: 'Professional product shots' },
    nature: { title: 'Nature & Wildlife', desc: 'Nature and wildlife photography' },
    travel: { title: 'Travel', desc: 'Travel and adventure photography' }
  }

  useEffect(() => {
    fetch(`/api/images?category=${category}`)
      .then(r => r.json())
      .then(data => setImages(data))
      .catch(err => console.error(err))
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
          <p>Loading images...</p>
        ) : images.length === 0 ? (
          <p>No images in this category yet.</p>
        ) : (
          <Gallery items={images} />
        )}
      </div>
    </section>
  )
}
