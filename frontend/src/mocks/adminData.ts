import type {
  AppUser,
  Notice,
} from '../types/api'

export const mockUsers: AppUser[] = [
  { userUid: 'usr-auth-admin', loginId: 'admin', name: '최고 관리자', phoneMasked: '010-****-5678', phonePlain: '010-1234-5678', emailMasked: 'ad***@example.com', emailPlain: 'admin@example.com', status: 'ACTIVE', integrityValid: true, encVer: 1, createdAt: '2026-04-11 09:11:02', updatedAt: '2026-08-10 12:41:00' },
  { userUid: 'usr-auth-manager', loginId: 'manager', name: '일반 관리자', phoneMasked: '010-****-1024', phonePlain: '010-7391-1024', emailMasked: 'ma***@example.com', emailPlain: 'manager@example.com', status: 'ACTIVE', integrityValid: true, encVer: 1, createdAt: '2026-05-01 13:45:22', updatedAt: '2026-07-22 09:14:11' },
  { userUid: 'usr-auth-client', loginId: 'client', name: '클라이언트 사용자', phoneMasked: '010-****-8841', phonePlain: '010-2204-8841', emailMasked: 'cl***@example.com', emailPlain: 'client@example.com', status: 'INACTIVE', integrityValid: true, encVer: 1, createdAt: '2026-01-20 16:31:02', updatedAt: '2026-08-02 11:24:51' },
  { userUid: 'usr-auth-auditor', loginId: 'auditor', name: '감사 관리자', phoneMasked: '010-****-9920', phonePlain: '010-5518-9920', emailMasked: 'au***@example.com', emailPlain: 'auditor@example.com', status: 'ACTIVE', integrityValid: false, encVer: 1, createdAt: '2026-03-08 08:18:14', updatedAt: '2026-08-18 10:05:22' },
  { userUid: 'usr-auth-operator', loginId: 'operator', name: '운영 클라이언트', phoneMasked: '010-****-7732', phonePlain: '010-9811-7732', emailMasked: 'op***@example.com', emailPlain: 'operator@example.com', status: 'ACTIVE', integrityValid: true, encVer: 1, createdAt: '2026-06-17 12:51:09', updatedAt: '2026-06-17 12:51:09' },
]


export const mockNotices: Notice[] = [
  { noticeUid: 'notice-005', title: '클라이언트 연동 테스트 결과', content: '암복호화 테스트와 키 목록 조회 기능이 정상 동작하는 것을 확인했습니다.', exposeYn: 'Y', viewCount: 36, createdBy: 'client', createdAt: '2026-08-20 08:40:00', updatedAt: '2026-08-20 08:40:00', files: [] },
  { noticeUid: 'notice-001', title: 'D’Guard KMS 정기 점검 안내', content: '서비스 안정성 향상을 위한 정기 점검이 예정되어 있습니다. 점검 시간 동안 일부 키 관리 기능이 제한될 수 있습니다.', exposeYn: 'Y', viewCount: 842, createdBy: 'admin', createdAt: '2026-08-18 09:30:00', updatedAt: '2026-08-18 09:30:00', files: [{ fileUid: 'file-001', originalName: '점검_작업계획서.pdf', size: 248320, encVer: 1 }] },
  { noticeUid: 'notice-002', title: '키 교체 정책 변경 사전 안내', content: '관리 키 교체 주기 정책이 변경됩니다. 상세 내용은 첨부된 정책 문서를 확인해 주세요.', exposeYn: 'Y', viewCount: 529, createdBy: 'admin', createdAt: '2026-08-13 14:10:00', updatedAt: '2026-08-16 11:20:00', files: [{ fileUid: 'file-002', originalName: '키_교체_정책_v2.docx', size: 91392, encVer: 1 }] },
  { noticeUid: 'notice-003', title: '개인정보 조회 권한 점검', content: 'ADMIN 권한 및 개인정보 원문 조회 감사로그를 정기적으로 확인해 주세요.', exposeYn: 'N', viewCount: 74, createdBy: 'admin', createdAt: '2026-08-08 10:00:00', updatedAt: '2026-08-08 10:00:00', files: [] },
  { noticeUid: 'notice-004', title: '신규 관리자 화면 오픈', content: '통합 키 관리 어드민 화면의 목업 버전을 공개합니다.', exposeYn: 'Y', viewCount: 1204, createdBy: 'admin', createdAt: '2026-08-01 08:30:00', updatedAt: '2026-08-01 08:30:00', files: [] },
]
