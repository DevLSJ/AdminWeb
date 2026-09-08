import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import {
  changeKeyStatus as changeKeyStatusRequest,
  createKey as createKeyRequest,
  deleteKey as deleteKeyRequest,
  decryptWithKey,
  distributeKey,
  encryptWithKey,
  fetchKey,
  fetchKeyHistory,
  fetchKeys,
  fetchKeyUsage,
  getApiErrorMessage,
  rotateKey as rotateKeyRequest,
  updateKey,
  updateRotationPolicy,
} from '../api/kms'
import { useAuth } from '../hooks/useAuth'
import type { AutoRotationDays, CryptoKey, KeyStatus } from '../types/api'
import { KmsContext, type CreateKeyInput } from './KmsContext'

function replaceKey(keys: CryptoKey[], updated: CryptoKey) {
  const exists = keys.some((key) => key.keyUid === updated.keyUid)
  return exists ? keys.map((key) => key.keyUid === updated.keyUid ? updated : key) : [updated, ...keys]
}

export function KmsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const keyListPath = pathname.replace(/\/+$/, '').toLowerCase()
  const needsKeyList = keyListPath === '/keys' || keyListPath === '/keys/test'
  const userUid = user?.userUid
  const userRole = user?.role
  const [keys, setKeys] = useState<CryptoKey[]>([])
  const [keyHistories, setKeyHistories] = useState<Record<string, import('../types/api').KeyStatusHistory[]>>({})
  const [keyUsage, setKeyUsage] = useState<Record<string, import('../types/api').KeyUsageSummary>>({})
  const [autoRotationByKey, setAutoRotationByKey] = useState<Record<string, AutoRotationDays>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = useCallback(async <T,>(operation: () => Promise<T>, fallback: string) => {
    try {
      setError('')
      return await operation()
    } catch (requestError) {
      const message = getApiErrorMessage(requestError, fallback)
      setError(message)
      throw new Error(message)
    }
  }, [])

  const refreshKeys = useCallback(async () => {
    setLoading(true)
    try {
      const result = await run(fetchKeys, '키 목록을 불러오지 못했습니다.')
      setKeys(result)
      setAutoRotationByKey(Object.fromEntries(result.map((key) => [key.keyUid, key.autoRotationDays ?? null])))
    } finally {
      setLoading(false)
    }
  }, [run])

  useEffect(() => {
    if (!userUid) {
      setKeys([])
      return
    }
    // Only key selection/deployment screens consume the complete key list.
    if (needsKeyList) void refreshKeys().catch(() => undefined)
  }, [needsKeyList, refreshKeys, userUid, userRole])

  const loadKeyDetail = useCallback(async (keyUid: string) => {
    const result = await run(() => fetchKey(keyUid), '키 상세를 불러오지 못했습니다.')
    setKeys((current) => replaceKey(current, result))
    setAutoRotationByKey((current) => ({ ...current, [keyUid]: result.autoRotationDays ?? null }))
    return result
  }, [run])

  const loadKeyHistory = useCallback(async (keyUid: string) => {
    const result = await run(() => fetchKeyHistory(keyUid), '키 상태 이력을 불러오지 못했습니다.')
    setKeyHistories((current) => ({ ...current, [keyUid]: result }))
    return result
  }, [run])

  const loadKeyUsage = useCallback(async (keyUid: string) => {
    const result = await run(() => fetchKeyUsage(keyUid), '키 사용 로그 요약을 불러오지 못했습니다.')
    setKeyUsage((current) => ({ ...current, [keyUid]: result }))
    return result
  }, [run])

  const createKey = useCallback(async (input: CreateKeyInput) => {
    const { activateImmediately, ...request } = input
    let created = await run(() => createKeyRequest(request), '키를 생성하지 못했습니다.')
    if (activateImmediately) {
      created = await run(
        () => changeKeyStatusRequest(created.keyUid, 'ACTIVE', '생성 직후 활성화'),
        '키는 생성됐지만 활성화하지 못했습니다.',
      )
    }
    setKeys((current) => replaceKey(current, created))
    await loadKeyHistory(created.keyUid).catch(() => undefined)
    return created
  }, [loadKeyHistory, run])

  const deleteKey = useCallback(async (keyUid: string) => {
    await run(() => deleteKeyRequest(keyUid), '키를 삭제하지 못했습니다.')
    await Promise.all([refreshKeys(), loadKeyHistory(keyUid).catch(() => undefined)])
  }, [loadKeyHistory, refreshKeys, run])

  const updateKeyMetadata = useCallback(async (keyUid: string, values: Pick<CryptoKey, 'keyName' | 'purpose' | 'expireAt'>) => {
    const result = await run(() => updateKey(keyUid, values), '키 메타정보를 수정하지 못했습니다.')
    setKeys((current) => replaceKey(current, result))
    return result
  }, [run])

  const changeKeyStatus = useCallback(async (keyUid: string, status: KeyStatus, reason: string) => {
    const result = await run(() => changeKeyStatusRequest(keyUid, status, reason), '키 상태를 변경하지 못했습니다.')
    setKeys((current) => replaceKey(current, result))
    await loadKeyHistory(keyUid)
    return result
  }, [loadKeyHistory, run])

  const distributeKeys = useCallback(async (keyUids: string[], target: string, reason: string) => {
    const results = await run(
      () => Promise.all(keyUids.map((keyUid) => distributeKey(keyUid, target, reason))),
      '키를 배포하지 못했습니다.',
    )
    await refreshKeys()
    await Promise.all(keyUids.map((keyUid) => loadKeyHistory(keyUid)))
    return results
  }, [loadKeyHistory, refreshKeys, run])

  const rotateKey = useCallback(async (keyUid: string) => {
    const result = await run(() => rotateKeyRequest(keyUid), '키를 갱신하지 못했습니다.')
    setKeys((current) => replaceKey(current, result.key))
    await loadKeyHistory(keyUid)
    return result.newVersion
  }, [loadKeyHistory, run])

  const setAutoRotation = useCallback(async (keyUid: string, days: AutoRotationDays) => {
    const result = await run(() => updateRotationPolicy(keyUid, days), '자동 갱신 정책을 수정하지 못했습니다.')
    setKeys((current) => replaceKey(current, result))
    setAutoRotationByKey((current) => ({ ...current, [keyUid]: days }))
  }, [run])

  const encrypt = useCallback(async (keyUid: string, plaintext: string) => {
    const result = await run(() => encryptWithKey(keyUid, plaintext), '암호화에 실패했습니다.')
    await loadKeyUsage(keyUid).catch(() => undefined)
    return result
  }, [loadKeyUsage, run])

  const decrypt = useCallback(async (keyUid: string, ciphertext: string, iv: string | null, version?: number) => {
    const result = await run(() => decryptWithKey(keyUid, ciphertext, iv, version), '복호화에 실패했습니다.')
    await loadKeyUsage(keyUid).catch(() => undefined)
    return result.plaintext
  }, [loadKeyUsage, run])

  const value = useMemo(() => ({
    keys, keyHistories, keyUsage, autoRotationByKey, loading, error,
    refreshKeys, loadKeyDetail, loadKeyHistory, loadKeyUsage,
    createKey, deleteKey, updateKeyMetadata, changeKeyStatus, distributeKeys, rotateKey, setAutoRotation,
    encrypt, decrypt,
  }), [
    keys, keyHistories, keyUsage, autoRotationByKey, loading, error,
    refreshKeys, loadKeyDetail, loadKeyHistory, loadKeyUsage,
    createKey, deleteKey, updateKeyMetadata, changeKeyStatus, distributeKeys, rotateKey, setAutoRotation,
    encrypt, decrypt,
  ])

  return <KmsContext.Provider value={value}>{children}</KmsContext.Provider>
}
