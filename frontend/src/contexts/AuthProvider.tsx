import { useEffect, useState, type ReactNode } from 'react'
import axios from 'axios'
import { Alert, Snackbar } from '@mui/material'
import { apiEndpoints } from '../api/endpoints'
import { apiClient, SESSION_STORAGE_KEY, TOKEN_STORAGE_KEY } from '../api/client'
import { AuthContext } from './AuthContext'
import type { ApiResponse } from '../types/api'
import { canChangeRole, type AuthContextValue, type AuthResult, type AuthUser, type LoginCredentials, type MockAccount, type UserRole } from '../types/auth'

// TODO: 프로필·역할 편집 화면용 임시 데이터이며, 실제 로그인 인증은 항상 백엔드 API가 담당한다.
const initialAccounts: MockAccount[] = [
  { userUid: 'usr-auth-admin', loginId: 'admin', password: 'admin', name: '최고 관리자', role: 'S.ADMIN' },
  { userUid: 'usr-auth-manager', loginId: 'manager', password: 'manager', name: '일반 관리자', role: 'ADMIN' },
  { userUid: 'usr-auth-client', loginId: 'client', password: 'client', name: '클라이언트 사용자', role: 'CLIENT' },
  { userUid: 'usr-auth-auditor', loginId: 'auditor', password: 'auditor', name: '감사 관리자', role: 'ADMIN' },
  { userUid: 'usr-auth-operator', loginId: 'operator', password: 'operator', name: '운영 클라이언트', role: 'CLIENT' },
]

function readStoredSession(): AuthUser | null {
  // 토큰과 사용자 정보가 모두 있을 때만 새로고침 후 세션 복원을 시도한다.
  if (!localStorage.getItem(TOKEN_STORAGE_KEY)) return null
  try {
    const value = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!value) return null
    const stored = JSON.parse(value) as AuthUser
    const account = initialAccounts.find((item) => item.loginId === stored.loginId)
    return account
      ? { userUid: account.userUid, loginId: account.loginId, name: stored.name || account.name, role: account.role }
      : null
  } catch {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [user, setUser] = useState<AuthUser | null>(readStoredSession)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY))
  const [isInitializing, setIsInitializing] = useState(Boolean(token))
  const [sessionNoticeOpen, setSessionNoticeOpen] = useState(false)

  const persistToken = (nextToken: string) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)
    setToken(nextToken)
  }

  const clearSession = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(SESSION_STORAGE_KEY)
    setToken(null)
    setUser(null)
  }

  const persistSession = (session: AuthUser) => {
    setUser(session)
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  }

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!token) {
      setIsInitializing(false)
      return
    }

    // 저장된 JWT의 유효성과 최신 계정 상태를 서버에서 다시 확인한다.
    let active = true
    void apiClient.get<ApiResponse<AuthUser>>(apiEndpoints.auth.me)
      .then(({ data }) => {
        if (active && data.success) persistSession(data.data)
      })
      .catch(() => {
        if (!active) return
        clearSession()
      })
      .finally(() => {
        if (active) setIsInitializing(false)
      })

    return () => { active = false }
  }, [])

  const login = async ({ loginId, password }: LoginCredentials): Promise<AuthResult> => {
    try {
      const { data } = await apiClient.post<ApiResponse<AuthUser & { token: string }>>(apiEndpoints.auth.login, { loginId, password })
      const session: AuthUser = {
        userUid: data.data.userUid,
        loginId: data.data.loginId,
        name: data.data.name,
        role: data.data.role,
      }
      persistToken(data.data.token)
      persistSession(session)
      return { success: true, message: data.message || '로그인되었습니다.' }
    } catch (error) {
      const message = axios.isAxiosError<ApiResponse<never>>(error)
        ? error.response?.data?.message
        : undefined
      return { success: false, message: message || '아이디 또는 비밀번호가 올바르지 않습니다' }
    }
  }

  const logout = () => {
    void apiClient.post(apiEndpoints.auth.logout).catch(() => undefined)
    clearSession()
  }

  const refreshSession = async (): Promise<AuthResult> => {
    try {
      // refresh 응답의 새 JWT를 먼저 저장해 이후 타이머와 API 요청 기준을 함께 갱신한다.
      const { data } = await apiClient.post<ApiResponse<AuthUser & { token: string }>>(apiEndpoints.auth.refresh)
      persistToken(data.data.token)
      persistSession({
        userUid: data.data.userUid,
        loginId: data.data.loginId,
        name: data.data.name,
        role: data.data.role,
      })
      return { success: true, message: data.message || '세션이 연장되었습니다.' }
    } catch (error) {
      const message = axios.isAxiosError<ApiResponse<never>>(error) ? error.response?.data?.message : undefined
      return { success: false, message: message || '세션을 연장하지 못했습니다.' }
    }
  }

  const expireSession = () => {
    clearSession()
    setSessionNoticeOpen(true)
  }

  const updateProfile = (name: string) => {
    if (!user) return
    setAccounts((current) => current.map((account) => account.loginId === user.loginId ? { ...account, name } : account))
    persistSession({ ...user, name })
  }

  const changePassword = (currentPassword: string, newPassword: string): AuthResult => {
    if (!user) return { success: false, message: '로그인이 필요합니다.' }
    const account = accounts.find((item) => item.loginId === user.loginId)
    if (!account || account.password !== currentPassword) return { success: false, message: '현재 비밀번호가 올바르지 않습니다.' }
    setAccounts((current) => current.map((item) => item.loginId === user.loginId ? { ...item, password: newPassword } : item))
    return { success: true, message: '비밀번호가 변경되었습니다. 실제 API 연동 시 새 Salt와 PBKDF2 해시를 저장합니다.' }
  }

  const updateAccountRole = (loginId: string, role: UserRole): AuthResult => {
    if (!user) return { success: false, message: '로그인이 필요합니다.' }
    const target = accounts.find((account) => account.loginId === loginId)
    if (!target) return { success: false, message: '변경할 계정을 찾을 수 없습니다.' }
    if (!canChangeRole(user, target, role)) {
      if (loginId === user.loginId) return { success: false, message: '현재 로그인한 계정의 권한은 변경할 수 없습니다.' }
      if (user.role === 'CLIENT') return { success: false, message: '관리자 권한이 필요합니다.' }
      return { success: false, message: '일반 관리자는 CLIENT 계정만 ADMIN 또는 CLIENT로 변경할 수 있습니다.' }
    }
    setAccounts((current) => current.map((account) => account.loginId === loginId ? { ...account, role } : account))
    return { success: true, message: `${loginId} 계정 권한이 ${role}(으)로 변경되었습니다.` }
  }

  const publicAccounts = accounts.map((account) => ({ userUid: account.userUid, loginId: account.loginId, name: account.name, role: account.role }))
  const value: AuthContextValue = { user, token, accounts: publicAccounts, isAuthenticated: Boolean(user && token), isInitializing, login, logout, refreshSession, expireSession, updateProfile, changePassword, updateAccountRole }

  return (
    <AuthContext.Provider value={value}>
      {children}
      <Snackbar open={sessionNoticeOpen} autoHideDuration={5000} onClose={() => setSessionNoticeOpen(false)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="warning" variant="filled" onClose={() => setSessionNoticeOpen(false)}>세션이 만료되어 자동 로그아웃되었습니다.</Alert>
      </Snackbar>
    </AuthContext.Provider>
  )
}
