import { useEffect, useRef, useState } from 'react'

interface JwtPayload {
  exp?: number
}

function getExpirationMillis(token: string | null): number | null {
  if (!token) return null
  try {
    // 서버 호출 없이 JWT payload의 exp(초)를 읽어 화면용 만료 시각(밀리초)으로 변환한다.
    const payload = token.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const decoded = decodeURIComponent(
      Array.from(atob(padded), (character) => `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    )
    const { exp } = JSON.parse(decoded) as JwtPayload
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

export function formatRemainingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function useAuthTimer(token: string | null, onExpire: () => void) {
  const expirationMillis = getExpirationMillis(token)
  const onExpireRef = useRef(onExpire)
  const expiredTokenRef = useRef<string | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(() => expirationMillis === null
    ? 0
    : Math.max(0, Math.ceil((expirationMillis - Date.now()) / 1000)))

  useEffect(() => { onExpireRef.current = onExpire }, [onExpire])

  useEffect(() => {
    expiredTokenRef.current = null
    const updateRemaining = () => {
      const next = expirationMillis === null
        ? 0
        : Math.max(0, Math.ceil((expirationMillis - Date.now()) / 1000))
      setRemainingSeconds(next)
      // 같은 토큰에 대한 만료 콜백은 한 번만 실행해 중복 로그아웃을 막는다.
      if (token && next === 0 && expiredTokenRef.current !== token) {
        expiredTokenRef.current = token
        onExpireRef.current()
      }
    }

    updateRemaining()
    const interval = window.setInterval(updateRemaining, 1_000)
    return () => window.clearInterval(interval)
  }, [expirationMillis, token])

  return {
    remainingSeconds,
    formattedTime: formatRemainingTime(remainingSeconds),
  }
}
