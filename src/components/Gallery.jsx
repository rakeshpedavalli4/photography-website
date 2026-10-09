import React from 'react'

export default function Gallery({ items = [], showCoverControls = false, coverImage, coverSavingPath, onSetCover }) {
  return (
    <div className="gallery">
      {items.map((it, idx) => {
        const src = /^https?:\/\//.test(it.path || '') ? it.path : `/images/${it.path}`
        const title = it.title || it.name || 'Portfolio image'
        return (
          <figure key={`${it.path || title}-${idx}`} className="photo">
            <a href={src} target="_blank" rel="noreferrer">
              <img src={src} alt={title} decoding="async" loading="lazy" />
            </a>
            {showCoverControls && (
              <button
                className="photo-cover-button"
                type="button"
                disabled={Boolean(coverSavingPath)}
                aria-pressed={it.path === coverImage}
                onClick={() => onSetCover?.(it)}
              >
                {coverSavingPath === it.path ? 'Saving...' : it.path === coverImage ? 'Current cover' : 'Set as cover'}
              </button>
            )}
          </figure>
        )
      })}
    </div>
  )
}
