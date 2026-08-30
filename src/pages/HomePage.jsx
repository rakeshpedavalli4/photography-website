import React from 'react'
import { Link } from 'react-router-dom'

export default function HomePage() {
  const categories = [
    { id: 'portraits', title: '👤 Portraits', desc: 'Professional headshots and portraits' },
    { id: 'landscapes', title: '🏔️ Landscapes', desc: 'Nature and scenic views' },
    { id: 'events', title: '🎉 Events', desc: 'Weddings, parties & corporate' },
    { id: 'nature', title: '🦁 Nature & Wildlife', desc: 'Wildlife and nature shots' }
  ]

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
