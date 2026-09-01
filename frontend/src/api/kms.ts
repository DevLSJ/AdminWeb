import axios from 'axios'
import type {
  ApiResponse,
  AppUser,
  AppUserPlain,
  AdminAccount,
  AuditLog,
  AuditListParams,
  AuditVerification,
  AuditEntryVerification,
  DashboardSummary,
  DashboardTrend,
  CryptoKey,
  KeyDistributionResult,
  KeyEncryptResult,
  KeyStatus,
  KeyStatusHistory,
  KeyUsageSummary,
  KeyVersion,
  KeyListParams,
  PageResponse,
  UserListParams,
  UserStatus,
} from '../types/api'
import { apiClient } from './client'
import { apiEndpoints } from './endpoints'

export interface CreateKeyRequest {
  keyName: string
  algorithm: CryptoKey['algorithm']
  keySize: number
  mode: CryptoKey['mode']
  purpose: CryptoKey['purpose']
  expireAt: string
  autoRotationDays: number | null
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

export interface CreateUserRequest {
  name: string
  phone: string
  email: string
  password: string
}

export type UpdateUserRequest = Omit<CreateUserRequest, 'password'>

function unwrap<T>(response: { data: ApiResponse<T> }) {
  return response.data.data
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<ApiResponse<unknown>>(error)) {
    return error.response?.data?.message || error.message || fallback
  }
  return error instanceof Error ? error.message : fallback
}

export async function fetchKeys() {
  const keys: CryptoKey[] = []
  let pageNumber = 0
  let totalPages = 1
  while (pageNumber < totalPages) {
    const page = await fetchKeyPage({ keyword: '', algorithm: 'ALL', status: 'ALL', purpose: 'ALL', page: pageNumber, size: 100, sort: 'createdAt,desc' })
    keys.push(...page.content)
    totalPages = page.totalPages
    pageNumber += 1
  }
  return keys
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

export async function updateRotationPolicy(keyUid: string, days: number | null) {
  return unwrap(await apiClient.patch<ApiResponse<CryptoKey>>(apiEndpoints.keys.rotationPolicy(keyUid), { days }))
}

export async function encryptWithKey(keyUid: string, plaintext: string) {
  return unwrap(await apiClient.post<ApiResponse<KeyEncryptResult>>(apiEndpoints.keys.encryptTest(keyUid), { plaintext }))
}

export async function decryptWithKey(keyUid: string, ciphertext: string, iv: string | null, version?: number) {
  return unwrap(await apiClient.post<ApiResponse<{ plaintext: string }>>(apiEndpoints.keys.decryptTest(keyUid), { ciphertext, iv, version }))
}

export async function fetchDashboardSummary() {
  return unwrap(await apiClient.get<ApiResponse<DashboardSummary>>(apiEndpoints.dashboard.summary))
}

export async function fetchDashboardTrend(from: string, to: string, interval: 'DAY' | 'MONTH') {
  return unwrap(await apiClient.get<ApiResponse<DashboardTrend>>(
    apiEndpoints.dashboard.usageTrend,
    { params: { from, to, interval } },
  ))
}

export async function fetchAuditLogs() {
  return (await fetchAuditLogPage({
    from: '', to: '', actor: '', action: 'ALL', page: 0, size: 100,
  })).content
}

export async function verifyAuditLogs() {
  return unwrap(await apiClient.get<ApiResponse<AuditVerification>>(apiEndpoints.auditLogs.verify))
}

export async function verifyAuditLogEntry(logUid: string) {
  return unwrap(await apiClient.get<ApiResponse<AuditEntryVerification>>(apiEndpoints.auditLogs.verifyEntry(logUid)))
}

export async function fetchAdminAccounts() {
  return unwrap(await apiClient.get<ApiResponse<AdminAccount[]>>(apiEndpoints.adminAccounts.list))
}

export async function fetchAuditLogPage(params: AuditListParams) {
  return unwrap(await apiClient.get<ApiResponse<PageResponse<AuditLog>>>(
    apiEndpoints.auditLogs.list,
    {
      params: {
        from: params.from || undefined,
        to: params.to || undefined,
        actor: params.actor.trim() || undefined,
        action: params.action === 'ALL' ? undefined : params.action,
        page: params.page,
        size: params.size,
      },
    },
  ))
}

export async function exportAuditLogs(params: AuditListParams) {
  const response = await apiClient.get<Blob>(apiEndpoints.auditLogs.export, {
    params: {
      from: params.from || undefined,
      to: params.to || undefined,
      actor: params.actor.trim() || undefined,
      action: params.action === 'ALL' ? undefined : params.action,
    },
    responseType: 'blob',
  })
  const disposition = String(response.headers['content-disposition'] ?? '')
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? 'audit-logs.csv'
  return { blob: response.data, filename }
}

export async function fetchUserPage(params: UserListParams) {
  return unwrap(await apiClient.get<ApiResponse<PageResponse<AppUser>>>(
    apiEndpoints.users.list,
    {
      params: {
        name: params.name.trim() || undefined,
        phone: params.phone.trim() || undefined,
        status: params.status === 'ALL' ? undefined : params.status,
        page: params.page,
        size: params.size,
      },
    },
  ))
}

export async function fetchUser(userUid: string) {
  return unwrap(await apiClient.get<ApiResponse<AppUser>>(apiEndpoints.users.detail(userUid)))
}

export async function createUser(request: CreateUserRequest) {
  return unwrap(await apiClient.post<ApiResponse<AppUser>>(apiEndpoints.users.create, request))
}

export async function updateUser(userUid: string, request: UpdateUserRequest) {
  return unwrap(await apiClient.put<ApiResponse<AppUser>>(apiEndpoints.users.update(userUid), request))
}

export async function fetchUserPlain(userUid: string, reason: string) {
  return unwrap(await apiClient.post<ApiResponse<AppUserPlain>>(apiEndpoints.users.plain(userUid), { reason }))
}

export async function changeUserStatus(userUid: string, status: UserStatus) {
  return unwrap(await apiClient.patch<ApiResponse<AppUser>>(apiEndpoints.users.status(userUid), { status }))
}

export async function resetUserPassword(userUid: string, password: string) {
  await apiClient.post<ApiResponse<null>>(apiEndpoints.users.password(userUid), { password })
}
