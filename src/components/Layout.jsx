import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { BACKEND_URL, apiFetch } from '../api'

export default function Layout({ children }) {
  const location = useLocation()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    console.info('[auth] session check started')
    apiFetch(`${BACKEND_URL}/api/auth/user`, { credentials: 'include' })
      .then((response) => {
        console.info('[auth] session response received', { status: response.status })
        if (!response.ok) throw new Error('Session request failed')
        return response.json()
      })
      .then((data) => {
        const authenticated = Boolean(data.user)
        console.info('[auth] session check completed', { authenticated })
        setIsAdmin(authenticated)
      })
      .catch((error) => {
        console.warn('[auth] session check failed', { errorName: error.name })
        setIsAdmin(false)
      })
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      const response = await apiFetch(`${BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Logout request failed')
      console.info('[auth] logout completed', { status: response.status })
      setIsAdmin(false)
    } catch (error) {
      console.error('[auth] logout failed', { errorName: error.name })
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <nav className="navbar">
          <Link to="/" className="logo">
            <h1>Portfolio</h1>
          </Link>
          <ul className="nav-links">
            <li><Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link></li>
            <li><Link to="/contact" className={location.pathname === '/contact' ? 'active' : ''}>Contact</Link></li>
          </ul>
        </nav>
      </header>

      <main className="main-content">
        {children}
      </main>

      <footer className="footer">
        <div className="admin-controls footer-admin-controls">
          {isAdmin && <div className="admin-status">You are an admin</div>}
          {isAdmin ? (
            <button className="admin-button admin-logout-button" type="button" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? 'Logging out...' : 'Logout'}
            </button>
          ) : (
            <a className="admin-button" href={`${BACKEND_URL}/auth/google?redirect=${encodeURIComponent('/')}`}>Admin</a>
          )}
        </div>
        <p>© 2025 Rakesh Chowdary Pedavalli • Cincinnati, Ohio</p>
      </footer>
    </div>
  )
}
