import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  changeKeyStatus as changeKeyStatusRequest,
  createKey as createKeyRequest,
  decryptWithKey,
  distributeKey,
  encryptWithKey,
  fetchAuditLogs,
  fetchKey,
  fetchKeyHistory,
  fetchKeys,
  fetchKeyUsage,
  fetchKeyVersions,
  getApiErrorMessage,
  rotateKey as rotateKeyRequest,
  updateKey,
  updateRotationPolicy,
} from '../api/kms'
import { useAuth } from '../hooks/useAuth'
import type { AutoRotationDays, CryptoKey, KeyStatus } from '../types/api'
import { isAdminRole } from '../types/auth'
import { KmsContext, type CreateKeyInput } from './KmsContext'

function replaceKey(keys: CryptoKey[], updated: CryptoKey) {
  const exists = keys.some((key) => key.keyUid === updated.keyUid)
  return exists ? keys.map((key) => key.keyUid === updated.keyUid ? updated : key) : [updated, ...keys]
}

export function KmsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [keys, setKeys] = useState<CryptoKey[]>([])
  const [auditLogs, setAuditLogs] = useState<import('../types/api').AuditLog[]>([])
  const [keyHistories, setKeyHistories] = useState<Record<string, import('../types/api').KeyStatusHistory[]>>({})
  const [keyVersions, setKeyVersions] = useState<Record<string, import('../types/api').KeyVersion[]>>({})
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

  const refreshAuditLogs = useCallback(async () => {
    const result = await run(fetchAuditLogs, '감사 로그를 불러오지 못했습니다.')
    setAuditLogs(result)
  }, [run])

  const refreshAuditAfterMutation = useCallback(async () => {
    if (!user || !isAdminRole(user.role)) return
    try {
      await refreshAuditLogs()
    } catch {
      // The mutation already succeeded; keep its result even if the follow-up refresh fails.
    }
  }, [refreshAuditLogs, user])

  useEffect(() => {
    if (!user) {
      setKeys([])
      setAuditLogs([])
      return
    }
    void refreshKeys().catch(() => undefined)
    if (isAdminRole(user.role)) void refreshAuditLogs().catch(() => undefined)
  }, [refreshAuditLogs, refreshKeys, user])

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

  const loadKeyVersions = useCallback(async (keyUid: string) => {
    const result = await run(() => fetchKeyVersions(keyUid), '키 버전 이력을 불러오지 못했습니다.')
    setKeyVersions((current) => ({ ...current, [keyUid]: result }))
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
    await refreshAuditAfterMutation()
    return created
  }, [refreshAuditAfterMutation, run])

  const updateKeyMetadata = useCallback(async (keyUid: string, values: Pick<CryptoKey, 'keyName' | 'purpose' | 'expireAt'>) => {
    const result = await run(() => updateKey(keyUid, values), '키 메타정보를 수정하지 못했습니다.')
    setKeys((current) => replaceKey(current, result))
    await refreshAuditAfterMutation()
    return result
  }, [refreshAuditAfterMutation, run])

  const changeKeyStatus = useCallback(async (keyUid: string, status: KeyStatus, reason: string) => {
    const result = await run(() => changeKeyStatusRequest(keyUid, status, reason), '키 상태를 변경하지 못했습니다.')
    setKeys((current) => replaceKey(current, result))
    await loadKeyHistory(keyUid)
    await refreshAuditAfterMutation()
    return result
  }, [loadKeyHistory, refreshAuditAfterMutation, run])

  const distributeKeys = useCallback(async (keyUids: string[], target: string, reason: string) => {
    const results = await run(
      () => Promise.all(keyUids.map((keyUid) => distributeKey(keyUid, target, reason))),
      '키를 배포하지 못했습니다.',
    )
    await refreshKeys()
    await Promise.all(keyUids.map((keyUid) => loadKeyHistory(keyUid)))
    await refreshAuditAfterMutation()
    return results
  }, [loadKeyHistory, refreshAuditAfterMutation, refreshKeys, run])

  const rotateKey = useCallback(async (keyUid: string) => {
    const result = await run(() => rotateKeyRequest(keyUid), '키를 갱신하지 못했습니다.')
    setKeys((current) => replaceKey(current, result.key))
    await Promise.all([loadKeyHistory(keyUid), loadKeyVersions(keyUid)])
    await refreshAuditAfterMutation()
    return result.newVersion
  }, [loadKeyHistory, loadKeyVersions, refreshAuditAfterMutation, run])

  const setAutoRotation = useCallback(async (keyUid: string, days: AutoRotationDays) => {
    const result = await run(() => updateRotationPolicy(keyUid, days), '자동 갱신 정책을 수정하지 못했습니다.')
    setKeys((current) => replaceKey(current, result))
    setAutoRotationByKey((current) => ({ ...current, [keyUid]: days }))
    await refreshAuditAfterMutation()
  }, [refreshAuditAfterMutation, run])

  const encrypt = useCallback(async (keyUid: string, plaintext: string) => {
    const result = await run(() => encryptWithKey(keyUid, plaintext), '암호화에 실패했습니다.')
    await Promise.all([loadKeyUsage(keyUid).catch(() => undefined), refreshAuditAfterMutation()])
    return result
  }, [loadKeyUsage, refreshAuditAfterMutation, run])

  const decrypt = useCallback(async (keyUid: string, ciphertext: string, iv: string) => {
    const result = await run(() => decryptWithKey(keyUid, ciphertext, iv), '복호화에 실패했습니다.')
    await Promise.all([loadKeyUsage(keyUid).catch(() => undefined), refreshAuditAfterMutation()])
    return result.plaintext
  }, [loadKeyUsage, refreshAuditAfterMutation, run])

  const value = useMemo(() => ({
    keys, auditLogs, keyHistories, keyVersions, keyUsage, autoRotationByKey, loading, error,
    refreshKeys, refreshAuditLogs, loadKeyDetail, loadKeyHistory, loadKeyVersions, loadKeyUsage,
    createKey, updateKeyMetadata, changeKeyStatus, distributeKeys, rotateKey, setAutoRotation,
    encrypt, decrypt,
  }), [
    keys, auditLogs, keyHistories, keyVersions, keyUsage, autoRotationByKey, loading, error,
    refreshKeys, refreshAuditLogs, loadKeyDetail, loadKeyHistory, loadKeyVersions, loadKeyUsage,
    createKey, updateKeyMetadata, changeKeyStatus, distributeKeys, rotateKey, setAutoRotation,
    encrypt, decrypt,
  ])

  return <KmsContext.Provider value={value}>{children}</KmsContext.Provider>
}
