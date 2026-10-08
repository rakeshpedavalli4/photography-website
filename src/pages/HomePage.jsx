import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const BACKEND_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:4000'
  : 'https://backend-we97.onrender.com'

function shuffle(items) {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

export default function HomePage() {
  const [slides, setSlides] = useState([])
  const [activeSlide, setActiveSlide] = useState(0)
  const [paused, setPaused] = useState(false)

  const categories = [
    { id: 'portraits', title: '👤 Portraits', desc: 'Professional headshots and portraits' },
    { id: 'landscapes', title: '🏔️ Landscapes', desc: 'Nature and scenic views' },
    { id: 'events', title: '🎉 Events', desc: 'Weddings, parties & corporate' },
    { id: 'nature', title: '🦁 Nature & Wildlife', desc: 'Wildlife and nature shots' }
  ]

  useEffect(() => {
    let mounted = true
    fetch(`${BACKEND_URL}/api/profiles`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load featured photos.')
        return response.json()
      })
      .then((payload) => {
        const profiles = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.profiles) ? payload.profiles : []
        const items = profiles.flatMap((profile) => {
          const images = profile.images?.length
            ? profile.images
            : profile.coverImage ? [{ path: profile.coverImage, title: profile.name }] : []
          return images.filter((image) => image.path).map((image) => ({
            src: /^https?:\/\//.test(image.path)
              ? image.path
              : `${BACKEND_URL.replace(/\/$/, '')}/images/${String(image.path).replace(/^\/+/, '')}`,
            title: image.title || profile.name,
            category: profile.category,
            profileId: profile.id
          }))
        })
        if (mounted) setSlides(shuffle(items))
      })
      .catch((error) => console.warn('[home] featured photos unavailable', { errorName: error.name }))

    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (paused || slides.length < 2) return undefined
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1 + Math.floor(Math.random() * (slides.length - 1))) % slides.length)
    }, 7000)
    return () => window.clearInterval(timer)
  }, [paused, slides.length])

  const currentSlide = slides[activeSlide]

  const moveSlide = (direction) => {
    setActiveSlide((current) => (current + direction + slides.length) % slides.length)
  }

  return (
    <section className="home-page">
      <div className="hero">
        <h1>Rakesh Chowdary Pedavalli</h1>
        <p>Professional Photographer • Cincinnati, Ohio</p>
        <p className="tagline">Capturing moments with clarity and vibrant colors</p>
      </div>

      <div className="categories-section">
        <h2>Explore My Work</h2>
        <p className="section-desc">Select a category to view my portfolio</p>

        {currentSlide && (
          <section
            className="home-showcase"
            aria-label="Featured photography"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
            }}
          >
            <div className="home-showcase-heading">
              <span>Selected frames</span>
              <span>{String(activeSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
            </div>
            <div className="home-showcase-frame">
              <Link className="home-showcase-link" to={`/gallery/${currentSlide.category}/${currentSlide.profileId}`}>
                <img key={currentSlide.src} src={currentSlide.src} alt={currentSlide.title} />
                <div className="home-showcase-caption">
                  <span>{currentSlide.category}</span>
                  <h2>{currentSlide.title}</h2>
                  <span>View project</span>
                </div>
              </Link>
              {slides.length > 1 && (
                <>
                  <button className="home-showcase-control previous" type="button" aria-label="Previous photo" onClick={() => moveSlide(-1)}>
                  </button>
                  <button className="home-showcase-control next" type="button" aria-label="Next photo" onClick={() => moveSlide(1)}>
                  </button>
                </>
              )}
            </div>
          </section>
        )}
        
        <div className="categories-grid">
          {categories.map(cat => (
            <Link key={cat.id} to={`/gallery/${cat.id}`} className="category-card">
              <div className="card-content">
                <h3>{cat.title}</h3>
                <p>{cat.desc}</p>
                <span className="view-btn">View Gallery →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="quick-links">
        <Link to="/contact" className="primary-btn">Get In Touch</Link>
      </div>
    </section>
  )
}
