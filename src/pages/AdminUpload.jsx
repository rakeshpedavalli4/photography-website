import React, { useState, useCallback } from 'react'

const BACKEND_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:4000'
  : 'https://backend-we97.onrender.com'

export default function AdminUpload() {
  const [profileId, setProfileId] = useState('emma-johnson')
  const [imageUrls, setImageUrls] = useState('')
  const [droppedImages, setDroppedImages] = useState([]) // { name, size, dataUrl }
  const [status, setStatus] = useState('')
  const [isDragActive, setIsDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const handleFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList).filter((f) => f.type && f.type.startsWith('image/'))
    if (!files.length) return
    try {
      const results = await Promise.all(files.map(async (f) => ({ name: f.name, size: f.size, dataUrl: await readFileAsDataUrl(f), file: f })))
      setDroppedImages((prev) => [...prev, ...results])
    } catch (err) {
      console.error('Failed reading dropped files', err)
    }
  }, [])

  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDragActive(false)
    if (e.dataTransfer && e.dataTransfer.files) {
      await handleFiles(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragActive(true)
  }

  const handleDragLeave = () => {
    setIsDragActive(false)
  }

  const removeDroppedImage = (index) => {
    setDroppedImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setUploading(true)

    // combine dropped images (file objects) and any typed URLs
    const typed = imageUrls.split('\n').map((line) => line.trim()).filter(Boolean)

    if (droppedImages.length === 0 && typed.length === 0) {
      setStatus('Please add at least one image (drag files or paste URLs).')
      setUploading(false)
      return
    }

    // Build FormData — always use the new /api/admin/upload/:profileId endpoint
    const form = new FormData()
    // append files if any
    droppedImages.forEach((d) => {
      if (d.file) form.append('images', d.file)
    })
    if (typed.length) form.append('urls', JSON.stringify(typed))

    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/upload/${encodeURIComponent(profileId)}`, {
        method: 'POST',
        credentials: 'include',
        body: form
      })

      if (res.status === 401) {
        const redirect = encodeURIComponent(window.location.pathname || '/admin/upload')
        window.location.href = `${BACKEND_URL}/auth/google?redirect=${redirect}`
        return
      }

      const data = await res.json()
      setStatus(data.message || 'Upload complete')
      setImageUrls('')
      setDroppedImages([])
    } catch (err) {
      console.error(err)
      setStatus('Upload failed — check console for details')
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-header">
        <h1>Upload Photos</h1>
        <a className="ghost-btn" href="/admin">Back to dashboard</a>
      </div>

      <form className="admin-form" onSubmit={handleSubmit}>
        <label>
          Profile ID
          <input value={profileId} onChange={(e) => setProfileId(e.target.value)} />
        </label>

        <div
          className={`dropzone ${isDragActive ? 'dragover' : ''}`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="dropzone-inner">
            <strong>Drag & drop images here</strong>
            <div className="dropzone-sub">or paste image URLs below (one per line)</div>
          </div>
        </div>

        {droppedImages.length > 0 && (
          <div className="preview-grid">
            {droppedImages.map((img, idx) => (
              <div className="preview-thumb" key={`${img.name}-${idx}`}>
                <img src={img.dataUrl} alt={img.name} />
                <div className="preview-meta">
                  <div className="preview-name">{img.name}</div>
                  <button type="button" className="ghost-btn small" onClick={() => removeDroppedImage(idx)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <label>
          Image URLs (one per line)
          <textarea rows="8" value={imageUrls} onChange={(e) => setImageUrls(e.target.value)} placeholder="https://...jpg" />
        </label>

        <button className="primary-btn" type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Add photos'}</button>
      </form>

      {status && <div className="success-message">{status}</div>}
    </section>
  )
}
