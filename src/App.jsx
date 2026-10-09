import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import CategoryPage from './pages/CategoryPage'
import ProfilePage from './pages/ProfilePage'
import Contact from './components/Contact'
import AdminDashboard from './pages/AdminDashboard'
import AdminProfiles from './pages/AdminProfiles'
import AdminUpload from './pages/AdminUpload'
import AdminAddProject from './pages/AdminAddProject'
import AuthSuccess from './pages/AuthSuccess'
import './styles.css'

function CategoryPageWrapper() {
  const { category } = useParams()
  return <CategoryPage category={category} />
}

function ProfilePageWrapper() {
  return <ProfilePage />
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/gallery/:category/:profileId" element={<ProfilePageWrapper />} />
          <Route path="/gallery/:category" element={<CategoryPageWrapper />} />
          <Route path="/gallery" element={<CategoryPageWrapper />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/admin" element={<Navigate to="/" replace />} />
          <Route path="/admin/upload" element={<AdminUpload />} />
          <Route path="/admin/profiles" element={<AdminProfiles />} />
          <Route path="/admin/add/:category" element={<AdminAddProject />} />
          <Route path="/auth/success" element={<AuthSuccess />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
