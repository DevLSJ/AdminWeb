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
export type KeyPurpose = 'ENCRYPT' | 'SIGN' | 'AUTH' | 'WRAP'
export type KeyStatus =
  | 'CREATED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'INACTIVE'
  | 'DISTRIBUTED'
  | 'DEPLOYING'
  | 'DEPLOYED'
  | 'DEPLOY_FAILED'
  | 'ROTATED'
  | 'DEPRECATED'
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
  keySize: number
  purpose: KeyPurpose
  status: KeyStatus
  version: number
  expireAt: string
  integrityValid: boolean
  createdAt: string
  updatedAt: string
}

export interface KeyStatusHistory {
  id: string
  fromStatus: KeyStatus | null
  toStatus: KeyStatus
  reason: string
  changedBy: string
  changedAt: string
}

export type DeploymentTargetType = 'SERVER_IP' | 'K8S_SECRET' | 'APP_ID'
export type DeploymentStatus = 'DEPLOYING' | 'DEPLOYED' | 'DEPLOY_FAILED' | 'ROLLED_BACK'
export type AutoRotationDays = 30 | 60 | 90 | null

export interface KeyVersion {
  version: number
  status: KeyStatus
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
  loginId?: string
  name: string
  phoneMasked: string
  phonePlain: string
  emailMasked: string
  emailPlain: string
  status: UserStatus
  integrityValid: boolean
  encVer: number
  createdAt: string
  updatedAt: string
}

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'KEY_CREATE'
  | 'KEY_STATUS_CHANGE'
  | 'KEY_TEST'
  | 'KEY_DEPLOY'
  | 'KEY_DEPLOY_ROLLBACK'
  | 'KEY_ROTATE'
  | 'KEY_AUTO_ROTATION_UPDATE'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_VIEW_PLAIN'
  | 'USER_PASSWORD_RESET'
  | 'NOTICE_CREATE'
  | 'NOTICE_UPDATE'
  | 'NOTICE_DELETE'
  | 'FILE_DOWNLOAD'

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
