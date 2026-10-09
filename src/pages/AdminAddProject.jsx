import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { BACKEND_URL, apiFetch } from '../api'

const CATEGORY_LABELS = {
  portraits: 'Portraits',
  landscapes: 'Landscapes',
  events: 'Events',
  nature: 'Nature & Wildlife'
}

export default function AdminAddProject() {
  const { category } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
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

    console.info('[admin-project] session check started', { category: safeCategory })
    apiFetch(`${BACKEND_URL}/api/auth/user`, { credentials: 'include' })
      .then((response) => {
        console.info('[admin-project] session response received', { category: safeCategory, status: response.status })
        if (!response.ok) throw new Error('Session request failed')
        return response.json()
      })
      .then((data) => {
        if (!mounted) return
        if (!data.user) {
          console.warn('[admin-project] session required; redirecting to sign in', { category: safeCategory })
          const redirect = encodeURIComponent(window.location.pathname || `/admin/add/${safeCategory}`)
          window.location.href = `${BACKEND_URL}/auth/google?redirect=${redirect}`
          return
        }
        console.info('[admin-project] session confirmed', { category: safeCategory })
        setAuthChecking(false)
      })
      .catch((error) => {
        if (!mounted) return
        console.error('[admin-project] session check failed', { category: safeCategory, errorName: error.name })
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
    console.info('[admin-project] files selected', {
      category: safeCategory,
      acceptedCount: files.length,
      rejectedCount: fileList.length - files.length,
      totalBytes: files.reduce((total, file) => total + file.size, 0)
    })
    if (!files.length) return

    try {
      const results = await Promise.all(files.map(async (file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        size: file.size,
        dataUrl: await readFileAsDataUrl(file),
        file
      })))
      setDroppedImages((prev) => [...prev, ...results])
    } catch (err) {
      console.error('[admin-project] file preview generation failed', { errorName: err.name })
    }
  }, [])

  const removeDroppedImage = (index) => {
    const remainingImages = droppedImages.filter((_, currentIndex) => currentIndex !== index)
    setDroppedImages(remainingImages)
  }

  const handleDrop = async (event) => {
    event.preventDefault()
    setIsDragActive(false)
    if (event.dataTransfer && event.dataTransfer.files) {
      await handleFiles(event.dataTransfer.files)
    }
  }

  const handleFileInput = (event) => {
    if (event.currentTarget.files) handleFiles(event.currentTarget.files)
    event.currentTarget.value = ''
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const typedUrls = imageUrls.split('\n').map((line) => line.trim()).filter(Boolean)
    console.info('[admin-project] submission started', {
      category: safeCategory,
      hasProjectName: Boolean(name.trim()),
      fileCount: droppedImages.length,
      urlCount: typedUrls.length
    })

    if (!name.trim()) {
      console.warn('[admin-project] submission rejected', { reason: 'missing_project_name' })
      setStatus('Please enter a project name.')
      return
    }

    const cleanName = name.trim()
    const cleanDescription = description.trim()
    const projectId = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `project-${Date.now()}`
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

      const createRes = await apiFetch(`${BACKEND_URL}/api/admin/profiles`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profilePayload)
      })
      console.info('[admin-project] project create response received', { category: safeCategory, status: createRes.status })

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
        console.info('[admin-project] image upload started', {
          category: safeCategory,
          fileCount: droppedImages.length,
          urlCount: typedUrls.length
        })
        const uploadRes = await apiFetch(`${BACKEND_URL}/api/admin/upload/${encodeURIComponent(projectId)}`, {
          method: 'POST',
          credentials: 'include',
          body: form
        })
        console.info('[admin-project] image upload response received', { category: safeCategory, status: uploadRes.status })

        if (!uploadRes.ok) {
          const uploadText = await uploadRes.text().catch(() => '')
          throw new Error(uploadText || 'Could not upload photos.')
        }
      }

      setStatus('Project added successfully.')
      console.info('[admin-project] submission completed', { category: safeCategory })
      navigate(`/gallery/${safeCategory}`)
    } catch (err) {
      console.error('[admin-project] submission failed', { category: safeCategory, errorName: err.name, message: err.message })
      setStatus(err.message || 'Something went wrong while creating the project.')
    } finally {
      setUploading(false)
    }
  }

  if (authChecking) return <section className="admin-page"><p>Checking authentication...</p></section>

  return (
    <section className="admin-page admin-form-page">
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
            <input
              ref={fileInputRef}
              className="dropzone-file-input"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileInput}
              aria-label="Choose photos"
            />
            <button className="ghost-btn" type="button" onClick={() => fileInputRef.current?.click()}>
              Choose photos
            </button>
          </div>
        </div>

        {droppedImages.length > 0 && (
          <>
            <p className="preview-count">{droppedImages.length} photos selected</p>
            <div className="preview-grid">
              {droppedImages.map((image, index) => (
                <div className="preview-thumb" key={image.id}>
                  <img src={image.dataUrl} alt={image.name} />
                  <div className="preview-meta">
                    <div className="preview-name">{image.name}</div>
                    <button type="button" className="ghost-btn small" onClick={() => removeDroppedImage(index)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </>
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
