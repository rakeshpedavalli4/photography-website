import React from 'react'

export default function Gallery({ items = [] }) {
  return (
    <div className="gallery">
      {items.map((it, idx) => {
        // each item expected { path: 'relative/path.jpg', title: '...' }
        const src = `/images/${it.path}`
        return (
          <figure key={idx} className="photo">
            <a href={src} target="_blank" rel="noreferrer">
              <img src={src} alt={it.title || ''} decoding="async" loading="lazy" />
            </a>
            <figcaption>{it.title}</figcaption>
          </figure>
        )
      })}
    </div>
  )
}
