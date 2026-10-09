import React, { useEffect, useRef, useState } from 'react'
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
  const [slideDirection, setSlideDirection] = useState('next')
  const [paused, setPaused] = useState(false)
  const [leavingSlide, setLeavingSlide] = useState(null)
  const currentSlideRef = useRef(null)
  const hoveredSideRef = useRef(null)
  const touchStartRef = useRef(null)
  const suppressClickRef = useRef(false)

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
      setSlideDirection('next')
      setActiveSlide((current) => (current + 1 + Math.floor(Math.random() * (slides.length - 1))) % slides.length)
    }, 7000)
    return () => window.clearInterval(timer)
  }, [paused, slides.length])

  const currentSlide = slides[activeSlide]
  const previousSlideIndex = (activeSlide - 1 + slides.length) % slides.length
  const nextSlideIndex = (activeSlide + 1) % slides.length
  const previousSlide = slides.length > 1 ? slides[previousSlideIndex] : null
  const nextSlide = slides.length > 1 ? slides[nextSlideIndex] : null

  const handleShowcaseMouseMove = (event) => {
    if (slides.length < 2) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const side = event.clientX < bounds.left + bounds.width / 2 ? -1 : 1
    if (side === hoveredSideRef.current) return
    hoveredSideRef.current = side
    setSlideDirection(side < 0 ? 'previous' : 'next')
    setActiveSlide((current) => (current + side + slides.length) % slides.length)
  }

  const selectSlide = (index, direction) => {
    setSlideDirection(direction)
    setActiveSlide(index)
  }

  const handleTouchStart = (event) => {
    const touch = event.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    suppressClickRef.current = false
  }

  const handleTouchEnd = (event) => {
    const start = touchStartRef.current
    const touch = event.changedTouches[0]
    touchStartRef.current = null
    if (!start || !touch || slides.length < 2) return

    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) return

    const direction = deltaX < 0 ? 'next' : 'previous'
    const offset = direction === 'next' ? 1 : -1
    selectSlide((activeSlide + offset + slides.length) % slides.length, direction)
    suppressClickRef.current = true
    window.setTimeout(() => { suppressClickRef.current = false }, 500)
  }

  useEffect(() => {
    if (!currentSlide) return
    if (currentSlideRef.current && currentSlideRef.current.src !== currentSlide.src) {
      setLeavingSlide(currentSlideRef.current)
    }
    currentSlideRef.current = currentSlide
  }, [currentSlide])

  useEffect(() => {
    if (!leavingSlide) return undefined
    const timer = window.setTimeout(() => setLeavingSlide(null), 1200)
    return () => window.clearTimeout(timer)
  }, [leavingSlide])

  return (
    <section className="home-page">
      <div className="hero">
        <h1>Rakesh Pedavalli</h1>
        <p>Professional Photographer • Cincinnati, Ohio</p>
        <p className="tagline">Capturing moments with clarity and vibrant colors</p>
      </div>

      <div className="categories-section">
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
            <div className="home-showcase-frame">
              {previousSlide && (
                <button
                  className="home-showcase-preview previous"
                  type="button"
                  aria-label={`Previous photo: ${previousSlide.title}`}
                  onClick={() => selectSlide(previousSlideIndex, 'previous')}
                >
                  <img src={previousSlide.src} alt="" />
                </button>
              )}
              <Link
                className="home-showcase-link"
                to={`/gallery/${currentSlide.category}/${currentSlide.profileId}`}
                onMouseMove={handleShowcaseMouseMove}
                onMouseLeave={() => { hoveredSideRef.current = null }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={() => { touchStartRef.current = null }}
                onClickCapture={(event) => {
                  if (!suppressClickRef.current) return
                  event.preventDefault()
                  event.stopPropagation()
                  suppressClickRef.current = false
                }}
              >
                {leavingSlide && (
                  <img className={`home-showcase-image is-leaving is-leaving-${slideDirection}`} src={leavingSlide.src} alt="" />
                )}
                <img
                  key={currentSlide.src}
                  className={`home-showcase-image${leavingSlide ? ` is-entering is-entering-${slideDirection}` : ' is-visible'}`}
                  src={currentSlide.src}
                  alt={currentSlide.title}
                />
                <div className="home-showcase-caption">
                  <span>{currentSlide.category}</span>
                  <span>View project</span>
                </div>
              </Link>
              {nextSlide && (
                <button
                  className="home-showcase-preview next"
                  type="button"
                  aria-label={`Next photo: ${nextSlide.title}`}
                  onClick={() => selectSlide(nextSlideIndex, 'next')}
                >
                  <img src={nextSlide.src} alt="" />
                </button>
              )}
            </div>
          </section>
        )}
        
      </div>

      <div className="quick-links">
        <Link to="/gallery" className="primary-btn">View Gallery</Link>
      </div>
    </section>
  )
}
