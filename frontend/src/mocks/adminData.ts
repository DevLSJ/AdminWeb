import type { Notice } from '../types/api'


export const mockNotices: Notice[] = [
  { noticeUid: 'notice-005', title: '클라이언트 연동 테스트 결과', content: '암복호화 테스트와 키 목록 조회 기능이 정상 동작하는 것을 확인했습니다.', exposeYn: 'Y', viewCount: 36, createdBy: 'client', createdAt: '2026-08-20 08:40:00', updatedAt: '2026-08-20 08:40:00', files: [] },
  { noticeUid: 'notice-001', title: 'D’Guard KMS 정기 점검 안내', content: '서비스 안정성 향상을 위한 정기 점검이 예정되어 있습니다. 점검 시간 동안 일부 키 관리 기능이 제한될 수 있습니다.', exposeYn: 'Y', viewCount: 842, createdBy: 'admin', createdAt: '2026-08-18 09:30:00', updatedAt: '2026-08-18 09:30:00', files: [{ fileUid: 'file-001', originalName: '점검_작업계획서.pdf', size: 248320, encVer: 1 }] },
  { noticeUid: 'notice-002', title: '키 교체 정책 변경 사전 안내', content: '관리 키 교체 주기 정책이 변경됩니다. 상세 내용은 첨부된 정책 문서를 확인해 주세요.', exposeYn: 'Y', viewCount: 529, createdBy: 'admin', createdAt: '2026-08-13 14:10:00', updatedAt: '2026-08-16 11:20:00', files: [{ fileUid: 'file-002', originalName: '키_교체_정책_v2.docx', size: 91392, encVer: 1 }] },
  { noticeUid: 'notice-003', title: '개인정보 조회 권한 점검', content: 'ADMIN 권한 및 개인정보 원문 조회 감사로그를 정기적으로 확인해 주세요.', exposeYn: 'N', viewCount: 74, createdBy: 'admin', createdAt: '2026-08-08 10:00:00', updatedAt: '2026-08-08 10:00:00', files: [] },
  { noticeUid: 'notice-004', title: '신규 관리자 화면 오픈', content: '통합 키 관리 어드민 화면의 목업 버전을 공개합니다.', exposeYn: 'Y', viewCount: 1204, createdBy: 'admin', createdAt: '2026-08-01 08:30:00', updatedAt: '2026-08-01 08:30:00', files: [] },
]
