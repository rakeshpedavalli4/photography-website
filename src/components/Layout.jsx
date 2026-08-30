import React from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function Layout({ children }) {
  const location = useLocation()

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
