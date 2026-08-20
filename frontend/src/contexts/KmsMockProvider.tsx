import { useState, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { keyStatusTransitions, mockAuditLogs, mockKeyHistory, mockKeys } from '../mocks/adminData'
import type {
  AuditAction,
  AuditLog,
  AutoRotationDays,
  CryptoKey,
  DeploymentTargetType,
  KeyDeployment,
  KeyStatus,
  KeyStatusHistory,
  KeyVersion,
} from '../types/api'
import { KmsMockContext, type CreateKeyInput, type KeyTestOperation } from './KmsMockContext'

function nowKst() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date()).replace(',', '')
}

function createInitialHistories() {
  return Object.fromEntries(mockKeys.map((key, index) => [
    key.keyUid,
    index === 0 ? mockKeyHistory : [{
      id: `KH-${key.keyUid.slice(0, 8)}-001`,
      fromStatus: null,
      toStatus: 'CREATED' as KeyStatus,
      reason: '키 최초 생성',
      changedBy: 'admin',
      changedAt: key.createdAt,
    }],
  ]))
}

function createInitialVersions() {
  return Object.fromEntries(mockKeys.map((key) => [
    key.keyUid,
    Array.from({ length: key.version }, (_, index): KeyVersion => ({
      version: index + 1,
      status: index + 1 === key.version ? key.status : 'DEPRECATED',
      createdAt: index + 1 === 1 ? key.createdAt : key.updatedAt,
      createdBy: 'admin',
      decryptOnly: index + 1 !== key.version,
    })).reverse(),
  ]))
}

export function KmsMockProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [keys, setKeys] = useState(mockKeys)
  const [auditLogs, setAuditLogs] = useState(mockAuditLogs)
  const [deployments, setDeployments] = useState<KeyDeployment[]>([])
  const [keyHistories, setKeyHistories] = useState<Record<string, KeyStatusHistory[]>>(createInitialHistories)
  const [keyVersions, setKeyVersions] = useState<Record<string, KeyVersion[]>>(createInitialVersions)
  const [autoRotationByKey, setAutoRotationByKey] = useState<Record<string, AutoRotationDays>>(
    Object.fromEntries(mockKeys.map((key) => [key.keyUid, null])),
  )
  const actor = user?.loginId ?? 'system'

  const appendAudit = (action: AuditAction, targetId: string, detail: string) => {
    const log: AuditLog = {
      logUid: `log-${crypto.randomUUID().slice(0, 8)}`,
      actor,
      action,
      targetType: 'CRYPTO_KEY',
      targetId,
      detail,
      createdAt: nowKst(),
      chainValid: true,
    }
    setAuditLogs((current) => [log, ...current])
  }

  const appendHistory = (keyUid: string, fromStatus: KeyStatus | null, toStatus: KeyStatus, reason: string) => {
    const history: KeyStatusHistory = {
      id: `KH-${crypto.randomUUID().slice(0, 8)}`,
      fromStatus,
      toStatus,
      reason,
      changedBy: actor,
      changedAt: nowKst(),
    }
    setKeyHistories((current) => ({ ...current, [keyUid]: [history, ...(current[keyUid] ?? [])] }))
  }

  const createKey = (input: CreateKeyInput) => {
    const timestamp = nowKst()
    const created: CryptoKey = {
      keyUid: crypto.randomUUID(),
      keyName: input.keyName,
      algorithm: input.algorithm,
      keySize: input.keySize,
      purpose: input.purpose,
      status: input.activateImmediately ? 'ACTIVE' : 'CREATED',
      version: 1,
      expireAt: input.expireAt,
      integrityValid: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    setKeys((current) => [created, ...current])
    setKeyVersions((current) => ({ ...current, [created.keyUid]: [{ version: 1, status: created.status, createdAt: timestamp, createdBy: actor, decryptOnly: false }] }))
    setKeyHistories((current) => ({ ...current, [created.keyUid]: [{ id: `KH-${crypto.randomUUID().slice(0, 8)}`, fromStatus: null, toStatus: created.status, reason: '키 최초 생성', changedBy: actor, changedAt: timestamp }] }))
    setAutoRotationByKey((current) => ({ ...current, [created.keyUid]: null }))
    appendAudit('KEY_CREATE', created.keyUid, `[${actor}] v1 키 생성 완료`)
    return created
  }

  const updateKeyMetadata = (keyUid: string, values: Pick<CryptoKey, 'keyName' | 'purpose' | 'expireAt'>) => {
    setKeys((current) => current.map((key) => key.keyUid === keyUid ? { ...key, ...values, updatedAt: nowKst() } : key))
  }

  const changeKeyStatus = (keyUid: string, status: KeyStatus, reason: string) => {
    const key = keys.find((item) => item.keyUid === keyUid)
    if (!key || !keyStatusTransitions[key.status].includes(status)) return
    setKeys((current) => current.map((item) => item.keyUid === keyUid ? { ...item, status, updatedAt: nowKst() } : item))
    setKeyVersions((current) => ({ ...current, [keyUid]: (current[keyUid] ?? []).map((version) => version.version === key.version ? { ...version, status } : version) }))
    appendHistory(keyUid, key.status, status, reason)
    appendAudit('KEY_STATUS_CHANGE', keyUid, `[${actor}] ${key.keyName} 상태 변경 완료`)
  }

  const startDeployment = (keyUids: string[], targetType: DeploymentTargetType, target: string, simulateFailure: boolean) => {
    const deploymentUid = `deploy-${crypto.randomUUID().slice(0, 8)}`
    const timestamp = nowKst()
    const selectedKeys = keys.filter((key) => keyUids.includes(key.keyUid))
    const deployment: KeyDeployment = {
      deploymentUid,
      keyUids,
      targetType,
      target,
      status: 'DEPLOYING',
      previousVersions: Object.fromEntries(selectedKeys.map((key) => [key.keyUid, Math.max(1, key.version - 1)])),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    setDeployments((current) => [deployment, ...current])
    setKeys((current) => current.map((key) => keyUids.includes(key.keyUid) ? { ...key, status: 'DEPLOYING', updatedAt: timestamp } : key))
    setKeyVersions((current) => {
      const next = { ...current }
      selectedKeys.forEach((key) => { next[key.keyUid] = (next[key.keyUid] ?? []).map((version) => version.version === key.version ? { ...version, status: 'DEPLOYING' } : version) })
      return next
    })
    selectedKeys.forEach((key) => appendHistory(key.keyUid, key.status, 'DEPLOYING', `${targetType} 대상 ${target} 배포 시작`))

    window.setTimeout(() => {
      const resultStatus: KeyStatus = simulateFailure ? 'DEPLOY_FAILED' : 'DEPLOYED'
      const completedAt = nowKst()
      setDeployments((current) => current.map((item) => item.deploymentUid === deploymentUid ? { ...item, status: resultStatus, updatedAt: completedAt } : item))
      setKeys((current) => current.map((key) => keyUids.includes(key.keyUid) ? { ...key, status: resultStatus, updatedAt: completedAt } : key))
      setKeyVersions((current) => {
        const next = { ...current }
        selectedKeys.forEach((key) => { next[key.keyUid] = (next[key.keyUid] ?? []).map((version) => version.version === key.version ? { ...version, status: resultStatus } : version) })
        return next
      })
      selectedKeys.forEach((key) => {
        appendHistory(key.keyUid, 'DEPLOYING', resultStatus, simulateFailure ? '대상 에이전트 응답 실패' : `${target} 배포 완료`)
        appendAudit('KEY_DEPLOY', key.keyUid, `[${actor}] v${key.version} 키 배포 ${simulateFailure ? '실패' : '성공'}`)
      })
    }, 900)

    return deploymentUid
  }

  const rollbackDeployment = (deploymentUid: string) => {
    const deployment = deployments.find((item) => item.deploymentUid === deploymentUid)
    if (!deployment || deployment.status !== 'DEPLOY_FAILED') return
    const timestamp = nowKst()
    setDeployments((current) => current.map((item) => item.deploymentUid === deploymentUid ? { ...item, status: 'ROLLED_BACK', updatedAt: timestamp } : item))
    setKeys((current) => current.map((key) => deployment.keyUids.includes(key.keyUid) ? { ...key, version: deployment.previousVersions[key.keyUid], status: 'DEPLOYED', updatedAt: timestamp } : key))
    setKeyVersions((current) => {
      const next = { ...current }
      deployment.keyUids.forEach((keyUid) => {
        const rollbackVersion = deployment.previousVersions[keyUid]
        next[keyUid] = (next[keyUid] ?? []).map((version) => ({ ...version, status: version.version === rollbackVersion ? 'ACTIVE' : 'DEPRECATED', decryptOnly: version.version !== rollbackVersion }))
      })
      return next
    })
    deployment.keyUids.forEach((keyUid) => {
      appendHistory(keyUid, 'DEPLOY_FAILED', 'DEPLOYED', `v${deployment.previousVersions[keyUid]} 이전 버전 롤백 완료`)
      appendAudit('KEY_DEPLOY_ROLLBACK', keyUid, `[${actor}] v${deployment.previousVersions[keyUid]} 이전 버전 롤백 완료`)
    })
  }

  const rotateKey = (keyUid: string) => {
    const key = keys.find((item) => item.keyUid === keyUid)
    if (!key || key.status === 'DESTROYED') return null
    const newVersion = key.version + 1
    const timestamp = nowKst()
    setKeys((current) => current.map((item) => item.keyUid === keyUid ? { ...item, version: newVersion, status: 'ACTIVE', updatedAt: timestamp } : item))
    setKeyVersions((current) => ({
      ...current,
      [keyUid]: [
        { version: newVersion, status: 'ACTIVE', createdAt: timestamp, createdBy: actor, decryptOnly: false },
        ...(current[keyUid] ?? []).map((version) => ({ ...version, status: 'DEPRECATED' as KeyStatus, decryptOnly: true })),
      ],
    }))
    appendHistory(keyUid, key.status, 'ROTATED', `v${key.version} 키 순환 및 구버전 전환`)
    appendHistory(keyUid, 'ROTATED', 'ACTIVE', `v${newVersion} 신규 버전 활성화`)
    appendAudit('KEY_ROTATE', keyUid, `[${actor}] v${newVersion} 키 갱신 완료`)
    return newVersion
  }

  const setAutoRotation = (keyUid: string, days: AutoRotationDays) => {
    setAutoRotationByKey((current) => ({ ...current, [keyUid]: days }))
    appendAudit('KEY_AUTO_ROTATION_UPDATE', keyUid, `[${actor}] 자동 갱신 주기 ${days ? `${days}일` : '미사용'} 설정`)
  }

  const recordKeyTest = (keyUid: string, operation: KeyTestOperation, success: boolean, failureReason?: string) => {
    const operationLabel = operation === 'ENCRYPT' ? '암호화' : '복호화'
    const resultLabel = success ? '성공' : '실패'
    const reason = !success && failureReason ? `: ${failureReason}` : ''
    appendAudit('KEY_TEST', keyUid, `[${actor}] ${operationLabel} ${resultLabel}${reason}`)
  }

  return <KmsMockContext.Provider value={{ keys, auditLogs, deployments, keyHistories, keyVersions, autoRotationByKey, createKey, updateKeyMetadata, changeKeyStatus, startDeployment, rollbackDeployment, rotateKey, setAutoRotation, recordKeyTest }}>{children}</KmsMockContext.Provider>
}
