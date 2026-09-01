import { lazy, Suspense } from 'react'
import { Box, CircularProgress } from '@mui/material'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth, RequireRole } from './components/auth/RouteGuards'
import { useAuth } from './hooks/useAuth'
import MainLayout from './layouts/MainLayout'
import Login from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const AuditLog = lazy(() => import('./pages/audit/AuditLog'))
const Forbidden = lazy(() => import('./pages/errors/Forbidden'))
const CryptoTest = lazy(() => import('./pages/keys/CryptoTest'))
const KeyDetail = lazy(() => import('./pages/keys/KeyDetail'))
const KeyList = lazy(() => import('./pages/keys/KeyList'))
const NoticeList = lazy(() => import('./pages/notices/NoticeList'))
const Profile = lazy(() => import('./pages/profile/Profile'))
const UserList = lazy(() => import('./pages/users/UserList'))
const RecentActivityPage = lazy(() => import('../map/recent-activity'))

function MyRecentActivityRoute() {
  const { user } = useAuth()
  return <RecentActivityPage userId={user?.loginId ?? ''} />
}

function App() {
  const { isAuthenticated } = useAuth()

  return (
    <Suspense fallback={<Box sx={{ display: 'grid', minHeight: 320, placeItems: 'center' }}><CircularProgress /></Box>}>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />

        <Route element={<RequireAuth />}>
          <Route element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="/keys" element={<KeyList />} />
            <Route path="/keys/test" element={<CryptoTest />} />
            <Route path="/keys/:id" element={<KeyDetail />} />
            <Route path="/notices" element={<NoticeList key="notice-list" />} />
            <Route path="/notices/new" element={<NoticeList key="notice-new" autoCreate />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/forbidden" element={<Forbidden />} />

            <Route element={<RequireRole allowedRoles={['S.ADMIN', 'ADMIN']} />}>
              <Route path="/my/recent-activity" element={<MyRecentActivityRoute />} />
              <Route path="/keys/register" element={<Navigate to="/keys" replace />} />
              <Route path="/users" element={<UserList />} />
              <Route path="/audit-logs" element={<AuditLog />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
