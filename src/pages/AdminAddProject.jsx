import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

const BACKEND_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:4000'
  : 'https://backend-we97.onrender.com'

const CATEGORY_LABELS = {
  portraits: 'Portraits',
  landscapes: 'Landscapes',
  events: 'Events',
  nature: 'Nature & Wildlife'
}

export default function AdminAddProject() {
  const { category } = useParams()
  const navigate = useNavigate()
  const safeCategory = category || 'portraits'

  const [authChecking, setAuthChecking] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrls, setImageUrls] = useState('')
  const [droppedImages, setDroppedImages] = useState([])
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)

  useEffect(() => {
    let mounted = true

    fetch(`${BACKEND_URL}/api/auth/user`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return
        if (!data.user) {
          const redirect = encodeURIComponent(window.location.pathname || `/admin/add/${safeCategory}`)
          window.location.href = `${BACKEND_URL}/auth/google?redirect=${redirect}`
          return
        }
        setAuthChecking(false)
      })
      .catch(() => {
        if (!mounted) return
        const redirect = encodeURIComponent(window.location.pathname || `/admin/add/${safeCategory}`)
        window.location.href = `${BACKEND_URL}/auth/google?redirect=${redirect}`
      })

    return () => { mounted = false }
  }, [safeCategory])

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const handleFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList).filter((file) => file.type && file.type.startsWith('image/'))
    if (!files.length) return

    try {
      const results = await Promise.all(files.map(async (file) => ({
        name: file.name,
        size: file.size,
        dataUrl: await readFileAsDataUrl(file),
        file
      })))
      setDroppedImages((prev) => [...prev, ...results])
    } catch (err) {
      console.error('Failed reading files', err)
    }
  }, [])

  const removeDroppedImage = (index) => {
    setDroppedImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDrop = async (event) => {
    event.preventDefault()
    setIsDragActive(false)
    if (event.dataTransfer && event.dataTransfer.files) {
      await handleFiles(event.dataTransfer.files)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!name.trim()) {
      setStatus('Please enter a project name.')
      return
    }

    const cleanName = name.trim()
    const cleanDescription = description.trim()
    const projectId = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `project-${Date.now()}`
    const typedUrls = imageUrls.split('\n').map((line) => line.trim()).filter(Boolean)

    setUploading(true)
    setStatus('Creating project...')

    try {
      const profilePayload = {
        id: projectId,
        name: cleanName,
        category: safeCategory,
        description: cleanDescription,
        coverImage: '',
        images: []
      }

      const createRes = await fetch(`${BACKEND_URL}/api/admin/profiles`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profilePayload)
      })

      if (createRes.status === 401) {
        const redirect = encodeURIComponent(window.location.pathname || `/admin/add/${safeCategory}`)
        window.location.href = `${BACKEND_URL}/auth/google?redirect=${redirect}`
        return
      }

      if (!createRes.ok) {
        const errText = await createRes.text().catch(() => '')
        throw new Error(errText || 'Could not create project.')
      }

      const form = new FormData()
      droppedImages.forEach((item) => {
        if (item.file) form.append('images', item.file)
      })
      if (typedUrls.length) form.append('urls', JSON.stringify(typedUrls))

      if (droppedImages.length || typedUrls.length) {
        const uploadRes = await fetch(`${BACKEND_URL}/api/admin/upload/${encodeURIComponent(projectId)}`, {
          method: 'POST',
          credentials: 'include',
          body: form
        })

        if (!uploadRes.ok) {
          const uploadText = await uploadRes.text().catch(() => '')
          throw new Error(uploadText || 'Could not upload photos.')
        }
      }

      setStatus('Project added successfully.')
      navigate(`/gallery/${safeCategory}`)
    } catch (err) {
      console.error(err)
      setStatus(err.message || 'Something went wrong while creating the project.')
    } finally {
      setUploading(false)
    }
  }

  if (authChecking) return <section className="admin-page"><p>Checking authentication...</p></section>

  return (
    <section className="admin-page admin-add-project">
      <div className="admin-header">
        <div>
          <h1>Add New {CATEGORY_LABELS[safeCategory] || 'Project'}</h1>
          <div className="admin-sub">Create a gallery item with a project name, a description, and photos.</div>
        </div>
        <Link className="ghost-btn" to={`/gallery/${safeCategory}`}>Back to {CATEGORY_LABELS[safeCategory] || 'gallery'}</Link>
      </div>

      <form className="admin-form" onSubmit={handleSubmit}>
        <label>
          Project name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Coastal Summer" />
        </label>

        <label>
          Description
          <textarea rows="5" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add a short description for this project..." />
        </label>

        <div
          className={`dropzone ${isDragActive ? 'dragover' : ''}`}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setIsDragActive(true) }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
        >
          <div className="dropzone-inner">
            <strong>Drag & drop images here</strong>
            <div className="dropzone-sub">or paste image URLs below (one per line)</div>
          </div>
        </div>

        {droppedImages.length > 0 && (
          <div className="preview-grid">
            {droppedImages.map((image, index) => (
              <div className="preview-thumb" key={`${image.name}-${index}`}>
                <img src={image.dataUrl} alt={image.name} />
                <div className="preview-meta">
                  <div className="preview-name">{image.name}</div>
                  <button type="button" className="ghost-btn small" onClick={() => removeDroppedImage(index)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <label>
          Image URLs (optional)
          <textarea rows="6" value={imageUrls} onChange={(e) => setImageUrls(e.target.value)} placeholder="https://example.com/image1.jpg" />
        </label>

        <button type="submit" className="primary-btn" disabled={uploading}>
          {uploading ? 'Saving...' : 'Add project'}
        </button>
      </form>

      {status && <div className="success-message" style={{ marginTop: '1rem' }}>{status}</div>}
    </section>
  )
}
