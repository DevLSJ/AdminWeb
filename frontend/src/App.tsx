import { lazy, Suspense, useEffect } from 'react'
import { Box, CircularProgress } from '@mui/material'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth, RequireRole } from './components/auth/RouteGuards'
import { useAuth } from './hooks/useAuth'
import MainLayout from './layouts/MainLayout'
import Login from './pages/Login'
import { refreshKeySettings, resetKeySettings } from './stores/keySettings'

const KeySettings = lazy(() => import('./pages/settings/KeySettings'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Analytics = lazy(() => import('./pages/Analytics'))
const AuditLog = lazy(() => import('./pages/audit/AuditLog'))
const Forbidden = lazy(() => import('./pages/errors/Forbidden'))
const CryptoTest = lazy(() => import('./pages/keys/CryptoTest'))
const KeyDetail = lazy(() => import('./pages/keys/KeyDetail'))
const KeyList = lazy(() => import('./pages/keys/KeyList'))
const NoticeList = lazy(() => import('./pages/notices/NoticeList'))
const Profile = lazy(() => import('./pages/profile/Profile'))
const UserList = lazy(() => import('./pages/users/UserList'))

function App() {
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) { resetKeySettings(); return }
    const refresh = () => { void refreshKeySettings().catch(() => {}) }
    refresh()
    window.addEventListener('focus', refresh)
    return () => { window.removeEventListener('focus', refresh); resetKeySettings() }
  }, [isAuthenticated])

  return (
    <Suspense fallback={<Box sx={{ display: 'grid', minHeight: 320, placeItems: 'center' }}><CircularProgress /></Box>}>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />

        <Route element={<RequireAuth />}>
          <Route element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/keys" element={<KeyList />} />
            <Route path="/keys/test" element={<CryptoTest />} />
            <Route path="/keys/:id" element={<KeyDetail />} />
            <Route path="/notices/*" element={<NoticeList />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/forbidden" element={<Forbidden />} />

            <Route element={<RequireRole allowedRoles={['S.ADMIN', 'ADMIN']} />}>
              <Route path="/my/recent-activity" element={<Navigate to="/audit-logs" replace />} />
              <Route path="/keys/register" element={<Navigate to="/keys" replace />} />
              <Route path="/users/*" element={<UserList />} />
              <Route path="/audit-logs" element={<AuditLog />} />
              <Route path="/settings" element={<KeySettings />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
