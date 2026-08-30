import React from 'react'

export default function Checklist() {
  const items = [
    { done: false, title: 'Portfolio Images', desc: 'Upload your best photos to NAS (organize in folders by category)' },
    { done: false, title: 'Image Metadata', desc: 'Add titles, descriptions, camera settings (EXIF) for each photo' },
    { done: false, title: 'Category Sections', desc: 'Organize into categories (Portraits, Landscapes, Events, etc.)' },
    { done: false, title: 'Contact Form', desc: 'Add contact/booking inquiry form' },
    { done: false, title: 'Social Links', desc: 'Link to Instagram, Facebook, or email' },
    { done: false, title: 'Pricing/Services', desc: 'If you offer photography services, add pricing page' },
    { done: false, title: 'NAS Configuration', desc: 'Set NAS_BASE_URL and credentials in .env' },
    { done: false, title: 'Custom Domain', desc: 'Point your domain to the hosted app' },
    { done: false, title: 'Color Profiles', desc: 'Ensure master images have embedded ICC profiles' },
    { done: false, title: 'Mobile Optimization', desc: 'Test gallery on mobile devices for responsive design' }
  ]

  return (
    <section className="checklist">
      <div className="checklist-container">
        <h2>📋 Setup Checklist</h2>
        <p className="subtitle">Things to add/configure for your photography portfolio:</p>
        <ul className="checklist-items">
          {items.map((item, idx) => (
            <li key={idx} className="checklist-item">
              <span className="checkbox">☐</span>
              <div>
                <strong>{item.title}</strong>
                <p className="item-desc">{item.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
