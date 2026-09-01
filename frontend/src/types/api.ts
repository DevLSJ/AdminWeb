export interface ApiResponse<T> {
  success: boolean
  data: T
  message: string
  errorCode: string | null
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type SortDirection = 'asc' | 'desc'
export type KeyAlgorithm = 'AES' | 'HMAC' | 'RSA'
export type KeyMode = 'GCM' | 'CBC' | 'OAEP_SHA256'
export type KeyPurpose = 'ENCRYPT' | 'SIGN' | 'AUTH' | 'WRAP'
export type KeyStatus =
  | 'CREATED'
  | 'ACTIVE'
  | 'REACTIVATED'
  | 'DEACTIVATED'
  | 'EXPIRED'
  | 'INACTIVE'
  | 'DISTRIBUTED'
  | 'COMPROMISED'
  | 'DESTROYED'

export interface KeyListParams {
  keyword: string
  algorithm: KeyAlgorithm | 'ALL'
  status: KeyStatus | 'ALL'
  purpose: KeyPurpose | 'ALL'
  page: number
  size: number
  sort: string
}

export interface CryptoKey {
  keyUid: string
  keyName: string
  algorithm: KeyAlgorithm
  mode: KeyMode
  keySize: number
  purpose: KeyPurpose
  status: KeyStatus
  version: number
  expireAt: string
  autoRotationDays: AutoRotationDays
  integrityValid: boolean
  createdAt: string
  updatedAt: string
}

export interface KeyStatusHistory {
  id: string
  fromStatus: KeyStatus | null
  toStatus: KeyStatus
  operation: string
  keyVersion: number
  reason: string
  changedBy: string
  changedAt: string
}

export type DeploymentTargetType = 'SERVER_IP' | 'K8S_SECRET' | 'APP_ID'
export type DeploymentStatus = 'DEPLOYING' | 'DEPLOYED' | 'DEPLOY_FAILED' | 'ROLLED_BACK'
export type AutoRotationDays = number | null

export interface KeyVersion {
  version: number
  status: KeyStatus | 'DEPRECATED'
  createdAt: string
  createdBy: string
  decryptOnly: boolean
}

export interface KeyDeployment {
  deploymentUid: string
  keyUids: string[]
  targetType: DeploymentTargetType
  target: string
  status: DeploymentStatus
  previousVersions: Record<string, number>
  createdAt: string
  updatedAt: string
}

export interface KeyUsageSummary {
  total: number
  success: number
  failure: number
  encrypt: number
  decrypt: number
}

export interface KeyUsageLog {
  id: string | number
  operation: 'ENCRYPT' | 'DECRYPT'
  success: boolean
  failureReason: string | null
  actor: string
  usedAt: string
}

export interface KeyEncryptResult {
  ciphertext: string
  iv: string | null
  encoding: string
  version: number
}

export interface DashboardSummary {
  totalKeys: number
  encryptCapableKeys: number
  decryptCapableKeys: number
  destroyedKeys: number
  integrityViolations: number
  totalOperations: number
  successfulOperations: number
  failedOperations: number
}

export interface DashboardTrendPoint {
  period: string
  keysCreated: number
  encryptions: number
  decryptions: number
  totalOperations: number
}

export interface DashboardTrend {
  from: string
  to: string
  interval: 'DAY' | 'MONTH'
  points: DashboardTrendPoint[]
}

export interface KeyDistributionResult {
  keyUid: string
  version: number
  target: string
  status: KeyStatus
  distributedAt: string
}

export type UserStatus = 'ACTIVE' | 'INACTIVE'

export interface UserListParams {
  name: string
  status: UserStatus | 'ALL'
  phone: string
  page: number
  size: number
}

export interface AppUser {
  userUid: string
  name: string
  nameMasked: string
  phoneMasked: string
  emailMasked: string
  status: UserStatus
  integrityValid: boolean
  encVer: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface AppUserPlain {
  userUid: string
  name: string
  phone: string
  email: string
  encVer: number
}

export interface AdminAccount {
  userUid: string
  loginId: string
  name: string
  role: 'S.ADMIN' | 'ADMIN' | 'CLIENT'
  status: UserStatus
  integrityValid: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'SESSION_REFRESH'
  | 'KEY_CREATE'
  | 'KEY_UPDATE'
  | 'KEY_DELETE'
  | 'KEY_STATUS_CHANGE'
  | 'KEY_TEST'
  | 'KEY_DEPLOY'
  | 'KEY_DEPLOY_ROLLBACK'
  | 'KEY_ROTATE'
  | 'KEY_AUTO_ROTATION_UPDATE'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_VIEW_PLAIN'
  | 'USER_STATUS_CHANGE'
  | 'USER_PASSWORD_RESET'
  | 'AUDIT_EXPORT'
  | 'NOTICE_CREATE'
  | 'NOTICE_VIEW'
  | 'NOTICE_UPDATE'
  | 'NOTICE_DELETE'
  | 'FILE_DOWNLOAD'
  | 'FILE_DELETE'
  | 'ADMIN_ACCOUNT_UPDATE'
  | 'ADMIN_ACCOUNT_STATUS_CHANGE'
  | 'ADMIN_ACCOUNT_PASSWORD_RESET'

export interface AuditListParams {
  from: string
  to: string
  actor: string
  action: AuditAction | 'ALL'
  page: number
  size: number
}

export interface AuditLog {
  logUid: string
  actor: string
  action: AuditAction
  targetType: string
  targetId: string
  detail: string
  createdAt: string
  chainValid: boolean
}

export interface AuditVerification {
  valid: boolean
  checkedCount: number
  invalidLogUids: string[]
  headValid: boolean
  verifiedAt: string
}

export interface AuditEntryVerification {
  logUid: string
  valid: boolean
  rowHashValid: boolean
  previousLinkValid: boolean
  nextLinkValid: boolean
  chainHeadValid: boolean
  previousLogUid: string | null
  nextLogUid: string | null
  verifiedAt: string
}

export interface NoticeListParams {
  title: string
  exposeYn: 'Y' | 'N' | 'ALL'
  page: number
  size: number
}

export interface NoticeFile {
  fileUid: string
  originalName: string
  size: number
  encVer: number
}

export interface Notice {
  noticeUid: string
  title: string
  content: string
  exposeYn: 'Y' | 'N'
  viewCount: number
  createdBy: string
  createdAt: string
  updatedAt: string
  files: NoticeFile[]
}
