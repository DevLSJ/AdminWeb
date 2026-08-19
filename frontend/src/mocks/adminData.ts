import type {
  AppUser,
  AuditAction,
  AuditLog,
  CryptoKey,
  KeyStatus,
  KeyStatusHistory,
  KeyUsageSummary,
  Notice,
} from '../types/api'

export const mockKeys: CryptoKey[] = [
  { keyUid: '9a12f0d4-5901-4c55-8517-111111111111', keyName: 'PAYMENT-AES-001', algorithm: 'AES', keySize: 256, purpose: 'ENCRYPT', status: 'ACTIVE', version: 2, expireAt: '2026-08-24', integrityValid: true, createdAt: '2026-05-10 09:12:31', updatedAt: '2026-08-01 14:20:00' },
  { keyUid: '20b11c91-05f2-4b2f-9191-222222222222', keyName: 'MEMBER-AES-003', algorithm: 'AES', keySize: 256, purpose: 'ENCRYPT', status: 'ACTIVE', version: 1, expireAt: '2026-08-28', integrityValid: true, createdAt: '2026-06-02 11:04:52', updatedAt: '2026-06-02 11:04:52' },
  { keyUid: '774ce1aa-d3ca-4fd4-a203-333333333333', keyName: 'AUTH-HMAC-004', algorithm: 'HMAC', keySize: 256, purpose: 'AUTH', status: 'DISTRIBUTED', version: 3, expireAt: '2026-09-02', integrityValid: true, createdAt: '2026-02-14 08:40:12', updatedAt: '2026-08-10 17:30:21' },
  { keyUid: 'a1204b7c-97f0-4b40-b148-444444444444', keyName: 'NOTICE-AES-002', algorithm: 'AES', keySize: 256, purpose: 'WRAP', status: 'INACTIVE', version: 1, expireAt: '2026-09-08', integrityValid: true, createdAt: '2026-03-28 13:30:00', updatedAt: '2026-08-11 09:22:41' },
  { keyUid: 'c875e21f-184e-409d-81b3-555555555555', keyName: 'BACKUP-RSA-001', algorithm: 'RSA', keySize: 2048, purpose: 'SIGN', status: 'CREATED', version: 1, expireAt: '2027-01-31', integrityValid: true, createdAt: '2026-08-18 16:45:10', updatedAt: '2026-08-18 16:45:10' },
  { keyUid: 'd46a5403-ac81-4907-96d1-666666666666', keyName: 'LEGACY-AES-007', algorithm: 'AES', keySize: 256, purpose: 'ENCRYPT', status: 'EXPIRED', version: 1, expireAt: '2026-07-31', integrityValid: false, createdAt: '2025-08-01 10:00:00', updatedAt: '2026-08-01 00:00:01' },
  { keyUid: 'e709b235-f8c8-4dd6-aae1-777777777777', keyName: 'API-HMAC-008', algorithm: 'HMAC', keySize: 512, purpose: 'AUTH', status: 'COMPROMISED', version: 1, expireAt: '2026-12-15', integrityValid: true, createdAt: '2026-04-21 15:14:11', updatedAt: '2026-08-17 21:32:00' },
  { keyUid: 'f912ab23-ae12-45b4-88c0-888888888888', keyName: 'ARCHIVE-AES-009', algorithm: 'AES', keySize: 256, purpose: 'ENCRYPT', status: 'DESTROYED', version: 4, expireAt: '2026-04-30', integrityValid: true, createdAt: '2024-05-01 08:00:00', updatedAt: '2026-05-01 08:00:00' },
]

export const keyStatusTransitions: Record<KeyStatus, KeyStatus[]> = {
  CREATED: ['ACTIVE'],
  ACTIVE: ['EXPIRED', 'INACTIVE', 'DISTRIBUTED', 'COMPROMISED'],
  EXPIRED: ['INACTIVE', 'ACTIVE'],
  INACTIVE: ['DESTROYED'],
  DISTRIBUTED: ['DESTROYED'],
  COMPROMISED: ['DESTROYED'],
  DESTROYED: [],
}

export const mockKeyHistory: KeyStatusHistory[] = [
  { id: 'KH-003', fromStatus: 'CREATED', toStatus: 'ACTIVE', reason: '운영 환경 배포 승인', changedBy: 'admin', changedAt: '2026-05-12 10:32:01' },
  { id: 'KH-002', fromStatus: null, toStatus: 'CREATED', reason: '키 최초 생성', changedBy: 'admin', changedAt: '2026-05-10 09:12:31' },
]

export const mockKeyUsage: KeyUsageSummary = {
  total: 12840,
  success: 12836,
  failure: 4,
  encrypt: 8021,
  decrypt: 4819,
}

export const mockUsers: AppUser[] = [
  { userUid: 'usr-67d2f941', name: '홍길동', phoneMasked: '010-****-5678', phonePlain: '010-1234-5678', emailMasked: 'ho***@example.com', emailPlain: 'hong@example.com', status: 'ACTIVE', integrityValid: true, encVer: 1, createdAt: '2026-04-11 09:11:02', updatedAt: '2026-08-10 12:41:00' },
  { userUid: 'usr-f791a023', name: '김민지', phoneMasked: '010-****-1024', phonePlain: '010-7391-1024', emailMasked: 'mi***@example.com', emailPlain: 'minji@example.com', status: 'ACTIVE', integrityValid: true, encVer: 1, createdAt: '2026-05-01 13:45:22', updatedAt: '2026-07-22 09:14:11' },
  { userUid: 'usr-18cbe920', name: '박서준', phoneMasked: '010-****-8841', phonePlain: '010-2204-8841', emailMasked: 'se***@example.com', emailPlain: 'seojoon@example.com', status: 'INACTIVE', integrityValid: true, encVer: 1, createdAt: '2026-01-20 16:31:02', updatedAt: '2026-08-02 11:24:51' },
  { userUid: 'usr-551d4cd8', name: '이하늘', phoneMasked: '010-****-9920', phonePlain: '010-5518-9920', emailMasked: 'ha***@example.com', emailPlain: 'haneul@example.com', status: 'ACTIVE', integrityValid: false, encVer: 1, createdAt: '2026-03-08 08:18:14', updatedAt: '2026-08-18 10:05:22' },
  { userUid: 'usr-bb92174a', name: '최유진', phoneMasked: '010-****-7732', phonePlain: '010-9811-7732', emailMasked: 'yu***@example.com', emailPlain: 'yujin@example.com', status: 'ACTIVE', integrityValid: true, encVer: 1, createdAt: '2026-06-17 12:51:09', updatedAt: '2026-06-17 12:51:09' },
]

const auditActions: AuditAction[] = ['LOGIN', 'KEY_CREATE', 'KEY_STATUS_CHANGE', 'KEY_TEST', 'USER_CREATE', 'USER_VIEW_PLAIN', 'USER_PASSWORD_RESET', 'NOTICE_CREATE', 'FILE_DOWNLOAD', 'LOGOUT']

export const mockAuditLogs: AuditLog[] = auditActions.map((action, index) => ({
  logUid: `log-${String(index + 1).padStart(4, '0')}`,
  actor: index === 8 ? 'operator01' : 'admin',
  action,
  targetType: action.startsWith('KEY') ? 'CRYPTO_KEY' : action.startsWith('USER') ? 'APP_USER' : action.startsWith('NOTICE') || action === 'FILE_DOWNLOAD' ? 'NOTICE' : 'AUTH',
  targetId: index % 3 === 0 ? '9a12f0d4-5901-4c55-8517-111111111111' : `target-${index + 1}`,
  detail: action === 'USER_VIEW_PLAIN' ? '개인정보 원문 조회 · 감사기록 필수' : `${action} 작업이 정상 처리되었습니다.`,
  createdAt: `2026-08-${String(19 - Math.floor(index / 3)).padStart(2, '0')} ${String(9 + index).padStart(2, '0')}:24:10`,
  chainValid: index !== 6,
}))

export const mockNotices: Notice[] = [
  { noticeUid: 'notice-001', title: 'D’Guard KMS 정기 점검 안내', content: '서비스 안정성 향상을 위한 정기 점검이 예정되어 있습니다. 점검 시간 동안 일부 키 관리 기능이 제한될 수 있습니다.', exposeYn: 'Y', viewCount: 842, createdBy: 'admin', createdAt: '2026-08-18 09:30:00', updatedAt: '2026-08-18 09:30:00', files: [{ fileUid: 'file-001', originalName: '점검_작업계획서.pdf', size: 248320, encVer: 1 }] },
  { noticeUid: 'notice-002', title: '키 교체 정책 변경 사전 안내', content: '관리 키 교체 주기 정책이 변경됩니다. 상세 내용은 첨부된 정책 문서를 확인해 주세요.', exposeYn: 'Y', viewCount: 529, createdBy: 'admin', createdAt: '2026-08-13 14:10:00', updatedAt: '2026-08-16 11:20:00', files: [{ fileUid: 'file-002', originalName: '키_교체_정책_v2.docx', size: 91392, encVer: 1 }] },
  { noticeUid: 'notice-003', title: '개인정보 조회 권한 점검', content: 'ADMIN 권한 및 개인정보 원문 조회 감사로그를 정기적으로 확인해 주세요.', exposeYn: 'N', viewCount: 74, createdBy: 'admin', createdAt: '2026-08-08 10:00:00', updatedAt: '2026-08-08 10:00:00', files: [] },
  { noticeUid: 'notice-004', title: '신규 관리자 화면 오픈', content: '통합 키 관리 어드민 화면의 목업 버전을 공개합니다.', exposeYn: 'Y', viewCount: 1204, createdBy: 'admin', createdAt: '2026-08-01 08:30:00', updatedAt: '2026-08-01 08:30:00', files: [] },
]
