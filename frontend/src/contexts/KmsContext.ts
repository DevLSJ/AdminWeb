import { createContext } from 'react'
import type {
  AuditLog,
  AutoRotationDays,
  CryptoKey,
  KeyDistributionResult,
  KeyEncryptResult,
  KeyStatus,
  KeyStatusHistory,
  KeyUsageSummary,
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

export interface KmsContextValue {
  keys: CryptoKey[]
  auditLogs: AuditLog[]
  keyHistories: Record<string, KeyStatusHistory[]>
  keyVersions: Record<string, KeyVersion[]>
  keyUsage: Record<string, KeyUsageSummary>
  autoRotationByKey: Record<string, AutoRotationDays>
  loading: boolean
  error: string
  refreshKeys: () => Promise<void>
  refreshAuditLogs: () => Promise<void>
  loadKeyDetail: (keyUid: string) => Promise<CryptoKey>
  loadKeyHistory: (keyUid: string) => Promise<KeyStatusHistory[]>
  loadKeyVersions: (keyUid: string) => Promise<KeyVersion[]>
  loadKeyUsage: (keyUid: string) => Promise<KeyUsageSummary>
  createKey: (input: CreateKeyInput) => Promise<CryptoKey>
  updateKeyMetadata: (keyUid: string, values: Pick<CryptoKey, 'keyName' | 'purpose' | 'expireAt'>) => Promise<CryptoKey>
  changeKeyStatus: (keyUid: string, status: KeyStatus, reason: string) => Promise<CryptoKey>
  distributeKeys: (keyUids: string[], target: string, reason: string) => Promise<KeyDistributionResult[]>
  rotateKey: (keyUid: string) => Promise<number>
  setAutoRotation: (keyUid: string, days: AutoRotationDays) => Promise<void>
  encrypt: (keyUid: string, plaintext: string) => Promise<KeyEncryptResult>
  decrypt: (keyUid: string, ciphertext: string, iv: string) => Promise<string>
}

export const KmsContext = createContext<KmsContextValue | null>(null)
