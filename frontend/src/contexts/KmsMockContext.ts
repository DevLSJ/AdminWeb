import { createContext } from 'react'
import type {
  AuditLog,
  AutoRotationDays,
  CryptoKey,
  DeploymentTargetType,
  KeyDeployment,
  KeyStatus,
  KeyStatusHistory,
  KeyVersion,
} from '../types/api'

export interface CreateKeyInput {
  keyName: string
  algorithm: CryptoKey['algorithm']
  keySize: number
  purpose: CryptoKey['purpose']
  expireAt: string
  activateImmediately: boolean
}

export interface KmsMockContextValue {
  keys: CryptoKey[]
  auditLogs: AuditLog[]
  deployments: KeyDeployment[]
  keyHistories: Record<string, KeyStatusHistory[]>
  keyVersions: Record<string, KeyVersion[]>
  autoRotationByKey: Record<string, AutoRotationDays>
  createKey: (input: CreateKeyInput) => CryptoKey
  updateKeyMetadata: (keyUid: string, values: Pick<CryptoKey, 'keyName' | 'purpose' | 'expireAt'>) => void
  changeKeyStatus: (keyUid: string, status: KeyStatus, reason: string) => void
  startDeployment: (keyUids: string[], targetType: DeploymentTargetType, target: string, simulateFailure: boolean) => string
  rollbackDeployment: (deploymentUid: string) => void
  rotateKey: (keyUid: string) => number | null
  setAutoRotation: (keyUid: string, days: AutoRotationDays) => void
}

export const KmsMockContext = createContext<KmsMockContextValue | null>(null)
