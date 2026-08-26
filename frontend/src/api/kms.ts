import axios from 'axios'
import type {
  ApiResponse,
  AuditLog,
  CryptoKey,
  KeyDistributionResult,
  KeyEncryptResult,
  KeyStatus,
  KeyStatusHistory,
  KeyUsageSummary,
  KeyVersion,
  KeyListParams,
  PageResponse,
} from '../types/api'
import { apiClient } from './client'
import { apiEndpoints } from './endpoints'

export interface CreateKeyRequest {
  keyName: string
  algorithm: CryptoKey['algorithm']
  keySize: number
  purpose: CryptoKey['purpose']
  expireAt: string
}

export interface UpdateKeyRequest {
  keyName: string
  purpose: CryptoKey['purpose']
  expireAt: string
}

export interface RotationResult {
  keyUid: string
  previousVersion: number
  newVersion: number
  key: CryptoKey
}

type ListPayload<T> = T[] | PageResponse<T>

function unwrap<T>(response: { data: ApiResponse<T> }) {
  return response.data.data
}

function asList<T>(payload: ListPayload<T>) {
  return Array.isArray(payload) ? payload : payload.content
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<ApiResponse<unknown>>(error)) {
    return error.response?.data?.message || error.message || fallback
  }
  return error instanceof Error ? error.message : fallback
}

export async function fetchKeys() {
  const page = await fetchKeyPage({
    keyword: '', algorithm: 'ALL', status: 'ALL', purpose: 'ALL', page: 0, size: 100, sort: 'createdAt,desc',
  })
  return page.content
}

export async function fetchKeyPage(params: KeyListParams) {
  return unwrap(await apiClient.get<ApiResponse<PageResponse<CryptoKey>>>(
    apiEndpoints.keys.list,
    {
      params: {
        keyword: params.keyword.trim() || undefined,
        algorithm: params.algorithm === 'ALL' ? undefined : params.algorithm,
        status: params.status === 'ALL' ? undefined : params.status,
        purpose: params.purpose === 'ALL' ? undefined : params.purpose,
        page: params.page,
        size: params.size,
        sort: params.sort,
      },
    },
  ))
}

export async function fetchKey(keyUid: string) {
  return unwrap(await apiClient.get<ApiResponse<CryptoKey>>(apiEndpoints.keys.detail(keyUid)))
}

export async function fetchKeyHistory(keyUid: string) {
  return unwrap(await apiClient.get<ApiResponse<KeyStatusHistory[]>>(apiEndpoints.keys.history(keyUid)))
}

export async function fetchKeyUsage(keyUid: string) {
  return unwrap(await apiClient.get<ApiResponse<KeyUsageSummary>>(apiEndpoints.keys.usage(keyUid)))
}

export async function fetchKeyVersions(keyUid: string) {
  return unwrap(await apiClient.get<ApiResponse<KeyVersion[]>>(apiEndpoints.keys.versions(keyUid)))
}

export async function createKey(request: CreateKeyRequest) {
  return unwrap(await apiClient.post<ApiResponse<CryptoKey>>(apiEndpoints.keys.create, request))
}

export async function deleteKey(keyUid: string) {
  await apiClient.delete<ApiResponse<null>>(apiEndpoints.keys.delete(keyUid))
}

export async function updateKey(keyUid: string, request: UpdateKeyRequest) {
  return unwrap(await apiClient.put<ApiResponse<CryptoKey>>(apiEndpoints.keys.update(keyUid), request))
}

export async function changeKeyStatus(keyUid: string, toStatus: KeyStatus, reason: string) {
  return unwrap(await apiClient.patch<ApiResponse<CryptoKey>>(apiEndpoints.keys.status(keyUid), { toStatus, reason }))
}

export async function rotateKey(keyUid: string) {
  return unwrap(await apiClient.post<ApiResponse<RotationResult>>(apiEndpoints.keys.rotate(keyUid)))
}

export async function distributeKey(keyUid: string, target: string, reason: string) {
  return unwrap(await apiClient.post<ApiResponse<KeyDistributionResult>>(apiEndpoints.keys.distribute(keyUid), { target, reason }))
}

export async function updateRotationPolicy(keyUid: string, days: 30 | 60 | 90 | null) {
  return unwrap(await apiClient.patch<ApiResponse<CryptoKey>>(apiEndpoints.keys.rotationPolicy(keyUid), { days }))
}

export async function encryptWithKey(keyUid: string, plaintext: string) {
  return unwrap(await apiClient.post<ApiResponse<KeyEncryptResult>>(apiEndpoints.keys.encryptTest(keyUid), { plaintext }))
}

export async function decryptWithKey(keyUid: string, ciphertext: string, iv: string, version?: number) {
  return unwrap(await apiClient.post<ApiResponse<{ plaintext: string }>>(apiEndpoints.keys.decryptTest(keyUid), { ciphertext, iv, version }))
}

export async function fetchAuditLogs() {
  const payload = unwrap(await apiClient.get<ApiResponse<ListPayload<AuditLog>>>(
    apiEndpoints.auditLogs.list,
    { params: { page: 0, size: 100 } },
  ))
  return asList(payload)
}

export async function verifyAuditLogs() {
  return unwrap(await apiClient.get<ApiResponse<{ valid: boolean; invalidLogUids?: string[] }>>(apiEndpoints.auditLogs.verify))
}
