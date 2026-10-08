import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const BACKEND_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:4000'
  : 'https://backend-we97.onrender.com'

export default function Layout({ children }) {
  const location = useLocation()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/auth/user`, { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => setIsAdmin(Boolean(data.user)))
      .catch(() => setIsAdmin(false))
  }, [])

  return (
    <div className="app">
      <header className="header">
        <nav className="navbar">
          <Link to="/" className="logo">
            <h1>📸 Portfolio</h1>
          </Link>
          <ul className="nav-links">
            <li><Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link></li>
            <li><Link to="/contact" className={location.pathname === '/contact' ? 'active' : ''}>Contact</Link></li>
          </ul>
          <div className="admin-controls">
            {isAdmin && <div className="admin-status">You are an admin</div>}
            {isAdmin ? (
              <Link className="admin-button" to="/gallery/portraits">Admin</Link>
            ) : (
              <a className="admin-button" href={`${BACKEND_URL}/auth/google?redirect=${encodeURIComponent('/')}`}>Admin</a>
            )}
          </div>
        </nav>
      </header>

      <main className="main-content">
        {children}
      </main>

      <footer className="footer">
        <p>© 2025 Rakesh Chowdary Pedavalli • Cincinnati, Ohio</p>
        <p>📧 <a href="mailto:rakesh.pedavalli2204@gmail.com">rakesh.pedavalli2204@gmail.com</a> • 📱 <a href="tel:+15138796147">(513) 879-6147</a></p>
        <p>Powered by your NAS • Preserving quality and color</p>
      </footer>
    </div>
  )
}
