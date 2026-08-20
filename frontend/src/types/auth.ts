export type UserRole = 'S.ADMIN' | 'ADMIN' | 'CLIENT'

export const ADMIN_ROLES: UserRole[] = ['S.ADMIN', 'ADMIN']

export function isAdminRole(role?: UserRole | null): boolean {
  return role === 'S.ADMIN' || role === 'ADMIN'
}

export function canChangeRole(actor: AuthUser | null, target: AuthUser, nextRole: UserRole): boolean {
  if (!actor || actor.loginId === target.loginId) return false
  if (actor.role === 'S.ADMIN') return true
  return actor.role === 'ADMIN' && target.role === 'CLIENT' && nextRole !== 'S.ADMIN'
}

export interface AuthUser {
  userUid: string
  loginId: string
  name: string
  role: UserRole
}

export interface MockAccount extends AuthUser {
  password: string
}

export interface LoginCredentials {
  loginId: string
  password: string
}

export interface AuthResult {
  success: boolean
  message: string
}

export interface AuthContextValue {
  user: AuthUser | null
  accounts: AuthUser[]
  isAuthenticated: boolean
  isInitializing: boolean
  login: (credentials: LoginCredentials) => Promise<AuthResult>
  logout: () => void
  updateProfile: (name: string) => void
  changePassword: (currentPassword: string, newPassword: string) => AuthResult
  updateAccountRole: (loginId: string, role: UserRole) => AuthResult
}
