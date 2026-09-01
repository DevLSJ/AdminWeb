import type { AuditAction } from '../types/api'

export const auditActionLabels: Record<AuditAction, string> = {
  LOGIN: '로그인', LOGOUT: '로그아웃', SESSION_REFRESH: '세션 연장',
  KEY_CREATE: '키 생성', KEY_UPDATE: '키 정보 수정', KEY_DELETE: '키 폐기', KEY_STATUS_CHANGE: '키 상태 변경',
  KEY_TEST: '암복호화 테스트', KEY_DEPLOY: '키 배포', KEY_DEPLOY_ROLLBACK: '키 배포 롤백', KEY_ROTATE: '키 갱신',
  KEY_AUTO_ROTATION_UPDATE: '자동 갱신 설정', USER_CREATE: '사용자 생성', USER_UPDATE: '사용자 수정',
  USER_VIEW_PLAIN: '개인정보 원문 조회', USER_STATUS_CHANGE: '사용자 상태 변경', USER_PASSWORD_RESET: '비밀번호 재설정',
  AUDIT_EXPORT: '감사 로그 내보내기', NOTICE_CREATE: '공지 등록', NOTICE_VIEW: '공지 조회', NOTICE_UPDATE: '공지 수정',
  NOTICE_DELETE: '공지 삭제', FILE_DOWNLOAD: '첨부파일 다운로드', FILE_DELETE: '첨부파일 삭제',
  ADMIN_ACCOUNT_UPDATE: '관리 계정 수정', ADMIN_ACCOUNT_STATUS_CHANGE: '관리 계정 상태 변경', ADMIN_ACCOUNT_PASSWORD_RESET: '관리 계정 비밀번호 재설정',
}

const targetTypeLabels: Record<string, string> = {
  KEY: '관리 키', CRYPTO_KEY: '관리 키', USER: '사용자', APP_USER: '서비스 사용자', ADMIN_USER: '관리 계정',
  NOTICE: '공지사항', NOTICE_FILE: '첨부파일', AUTH: '인증 세션', AUDIT_LOG: '감사 로그', SYSTEM: '시스템',
}

export function getAuditTargetTypeLabel(targetType: string) {
  return targetTypeLabels[targetType.toUpperCase()] ?? targetType.replaceAll('_', ' ')
}

export function truncateAuditDetail(detail: string, maxLength = 42) {
  const normalized = detail.replace(/\s+/g, ' ').trim()
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized
}
