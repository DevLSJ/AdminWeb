const statusLabels: Record<string, string> = {
  ACTIVE: '활성',
  CREATED: '준비',
  EXPIRED: '만료',
  INACTIVE: '비활성',
  DISTRIBUTED: '배포됨',
  COMPROMISED: '침해됨',
  DEPLOYING: '배포 중',
  DEPLOYED: '배포 완료',
  DEPLOY_FAILED: '배포 실패',
  ROTATED: '순환됨',
  DEPRECATED: '구버전',
  ROLLED_BACK: '롤백 완료',
  DESTROYED: '폐기',
  Y: '노출',
  N: '숨김',
  SUCCESS: '성공',
  FAILURE: '실패',
  IN_PROGRESS: '진행 중',
  PENDING: '대기',
  VALID: '정상',
  INVALID: '위반',
  'S.ADMIN': 'S.Admin',
  ADMIN: 'Admin',
  CLIENT: 'Client',
  DECRYPT_ONLY: '복호화 전용',
}

export function getStatusLabel(status: string) {
  return statusLabels[status] ?? status
}
