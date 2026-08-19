import { lazy, Suspense, useState } from 'react'
import { Box, CircularProgress } from '@mui/material'
import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import Login from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const AuditLog = lazy(() => import('./pages/audit/AuditLog'))
const CryptoTest = lazy(() => import('./pages/keys/CryptoTest'))
const KeyDetail = lazy(() => import('./pages/keys/KeyDetail'))
const KeyList = lazy(() => import('./pages/keys/KeyList'))
const KeyRegister = lazy(() => import('./pages/keys/KeyRegister'))
const NoticeList = lazy(() => import('./pages/notices/NoticeList'))
const UserList = lazy(() => import('./pages/users/UserList'))

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(localStorage.getItem('token')),
  )

  const handleLogin = () => {
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setIsAuthenticated(false)
  }

  return (
    <Suspense fallback={<Box sx={{ display: 'grid', minHeight: 320, placeItems: 'center' }}><CircularProgress /></Box>}>
      <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <Login onLogin={handleLogin} />
          )
        }
      />

      <Route
        element={
          isAuthenticated ? (
            <MainLayout onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="/keys" element={<KeyList />} />
        <Route path="/keys/register" element={<KeyRegister />} />
        <Route path="/keys/test" element={<CryptoTest />} />
        <Route path="/keys/:id" element={<KeyDetail />} />
        <Route path="/users" element={<UserList />} />
        <Route path="/audit-logs" element={<AuditLog />} />
        <Route path="/notices" element={<NoticeList key="notice-list" />} />
        <Route path="/notices/new" element={<NoticeList key="notice-new" autoCreate />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
