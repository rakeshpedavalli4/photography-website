import React, { useState, useCallback, useEffect } from 'react'

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

  // Auth guard: check session; if not authenticated show options (sign in or return home)
  const [authChecking, setAuthChecking] = useState(true)
  const [notAuthenticated, setNotAuthenticated] = useState(false)

  useEffect(() => {
    let mounted = true
    fetch(`${BACKEND_URL}/api/auth/user`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return
        if (!d.user) {
          setNotAuthenticated(true)
        } else {
          setAuthChecking(false)
        }
      })
      .catch(() => {
        if (!mounted) return
        setNotAuthenticated(true)
      })
    return () => { mounted = false }
  }, [])

  if (authChecking) return <section className="admin-page"><p>Checking authentication...</p></section>

  if (notAuthenticated) {
    const redirect = encodeURIComponent(window.location.pathname || '/admin/upload')
    return (
      <section className="admin-page admin-login-card">
        <h1>Admin access required</h1>
        <p style={{ color: '#6b6b6b' }}>You must sign in with Google to access the upload tools.</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.25rem' }}>
          <a className="primary-btn" href={`${BACKEND_URL}/auth/google?redirect=${redirect}`}>Sign in with Google</a>
          <a className="ghost-btn" href="/">Return to home</a>
        </div>
      </section>
    )
  }

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

      const contentType = (res.headers.get('content-type') || '').toLowerCase()

      // If not OK, try to read text to show a helpful error
      if (!res.ok) {
        // If new endpoint is not found on the server (404), try the legacy JSON endpoint as a fallback.
        if (res.status === 404) {
          console.warn('New upload endpoint returned 404 — attempting legacy JSON upload fallback')
          const typed = imageUrls.split('\n').map((line) => line.trim()).filter(Boolean)
          const droppedDataUrls = droppedImages.map((d) => d.dataUrl)
          const images = [...droppedDataUrls, ...typed]
          if (images.length) {
            try {
              const fallbackRes = await fetch(`${BACKEND_URL}/api/admin/upload`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId, images })
              })
              if (fallbackRes.ok) {
                const data = await fallbackRes.json()
                setStatus(data.message || 'Upload complete (legacy endpoint)')
                setImageUrls('')
                setDroppedImages([])
                return
              } else {
                const text = await fallbackRes.text().catch(() => '<no body>')
                console.error('Legacy upload failed', fallbackRes.status, text)
                setStatus(`Upload failed: server returned ${fallbackRes.status} on fallback`)
                return
              }
            } catch (err) {
              console.error('Legacy upload attempt failed', err)
              setStatus('Upload failed (fallback) — see console')
              return
            }
          }
        }

        let text
        try { text = await res.text() } catch (e) { text = `<no body: ${String(e)}>` }
        console.error('Upload failed', res.status, text)
        setStatus(`Upload failed: server returned ${res.status}`)
        return
      }

      // If server returned HTML (often an error page) avoid calling res.json()
      if (!contentType.includes('application/json')) {
        const text = await res.text()
        console.error('Upload returned non-JSON response:', text)
        setStatus('Upload failed: unexpected server response — see console for details')
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
