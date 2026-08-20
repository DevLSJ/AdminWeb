import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { UserRole } from '../../types/auth'

export function RequireAuth() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />
}

export function RequireRole({ allowedRoles }: { allowedRoles: UserRole[] }) {
  const { user } = useAuth()
  const location = useLocation()
  return user && allowedRoles.includes(user.role)
    ? <Outlet />
    : <Navigate to="/forbidden" replace state={{ from: location.pathname }} />
}
