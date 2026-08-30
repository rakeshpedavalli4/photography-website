import React from 'react'

export default function Gallery({ items = [] }) {
  return (
    <div className="gallery">
      {items.map((it, idx) => {
        const src = /^https?:\/\//.test(it.path || '') ? it.path : `/images/${it.path}`
        const title = it.title || it.name || 'Portfolio image'
        return (
          <figure key={idx} className="photo">
            <a href={src} target="_blank" rel="noreferrer">
              <img src={src} alt={title} decoding="async" loading="lazy" />
            </a>
            <figcaption>{title}</figcaption>
          </figure>
        )
      })}
    </div>
  )
}
