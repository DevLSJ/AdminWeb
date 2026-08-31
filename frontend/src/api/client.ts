import axios from 'axios'

export const TOKEN_STORAGE_KEY = 'token'
export const SESSION_STORAGE_KEY = 'auth-session'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

apiClient.interceptors.request.use((config) => {
  // 모든 API 요청에 현재 JWT를 자동 주입해 화면별 중복 인증 코드를 없앤다.
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.endsWith('/api/auth/login')
      if (!isLoginRequest) {
        // 인증 API 외의 401은 만료·무효 세션으로 보고 저장소를 정리한 뒤 로그인 화면으로 보낸다.
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        localStorage.removeItem(SESSION_STORAGE_KEY)
        if (window.location.pathname !== '/login') window.location.replace('/login')
      }
    }
    return Promise.reject(error)
  },
)
