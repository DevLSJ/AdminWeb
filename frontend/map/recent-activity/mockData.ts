import type {
  RecentActivity,
  RecentActivityPageResult,
  RecentActivityQuery,
  RecentActivitySource,
  RecentActivityStatus,
  RecentActivityType,
} from './types'

interface ActivitySeed {
  timestamp: string
  activityType: RecentActivityType
  targetKey: string | null
  status: RecentActivityStatus
  description: string
  ipAddress?: string
  version?: string
}

const activitySeeds: ActivitySeed[] = [
  { timestamp: '2026-08-20T09:42:18+09:00', activityType: 'KEY_DEPLOY', targetKey: 'PAYMENT-AES-001', status: 'SUCCESS', description: '운영 결제 서버에 v2 키를 배포했습니다.', version: 'v2' },
  { timestamp: '2026-08-20T09:31:04+09:00', activityType: 'LOGIN', targetKey: null, status: 'SUCCESS', description: '관리자 콘솔에 로그인했습니다.' },
  { timestamp: '2026-08-20T08:55:43+09:00', activityType: 'KEY_ROTATE', targetKey: 'AUTH-HMAC-004', status: 'SUCCESS', description: '수동 키 갱신을 완료했습니다.', version: 'v3' },
  { timestamp: '2026-08-19T18:22:11+09:00', activityType: 'KEY_STATUS_CHANGE', targetKey: 'MEMBER-AES-003', status: 'SUCCESS', description: '키 상태를 활성으로 변경했습니다.' },
  { timestamp: '2026-08-19T16:08:37+09:00', activityType: 'CRYPTO_TEST', targetKey: 'PAYMENT-AES-001', status: 'SUCCESS', description: '암호화·복호화 테스트를 실행했습니다.', version: 'v2' },
  { timestamp: '2026-08-19T14:36:09+09:00', activityType: 'KEY_CREATE', targetKey: 'ANALYTICS-AES-007', status: 'SUCCESS', description: 'AES-256 데이터 분석 키를 생성했습니다.', version: 'v1' },
  { timestamp: '2026-08-19T11:12:52+09:00', activityType: 'KEY_DEPLOY', targetKey: 'ANALYTICS-AES-007', status: 'FAILURE', description: 'K8s Secret 배포 중 대상 연결에 실패했습니다.', version: 'v1' },
  { timestamp: '2026-08-18T17:45:30+09:00', activityType: 'NOTICE_UPDATE', targetKey: null, status: 'SUCCESS', description: '키 갱신 정책 변경 안내를 게시했습니다.' },
  { timestamp: '2026-08-18T15:19:14+09:00', activityType: 'KEY_DEPLOY', targetKey: 'NOTICE-AES-002', status: 'IN_PROGRESS', description: '스테이징 서버로 키를 배포하고 있습니다.', version: 'v2' },
  { timestamp: '2026-08-18T10:04:26+09:00', activityType: 'LOGIN', targetKey: null, status: 'SUCCESS', description: '관리자 콘솔에 로그인했습니다.', ipAddress: '10.20.1.18' },
  { timestamp: '2026-08-17T19:38:02+09:00', activityType: 'LOGOUT', targetKey: null, status: 'SUCCESS', description: '관리자 콘솔에서 로그아웃했습니다.' },
  { timestamp: '2026-08-17T16:21:47+09:00', activityType: 'KEY_ROTATE', targetKey: 'MEMBER-AES-003', status: 'SUCCESS', description: '자동 갱신 정책에 따라 키가 순환되었습니다.', version: 'v4' },
  { timestamp: '2026-08-17T13:11:08+09:00', activityType: 'CRYPTO_TEST', targetKey: 'AUTH-HMAC-004', status: 'FAILURE', description: '잘못된 입력 형식으로 검증 테스트가 실패했습니다.', version: 'v2' },
  { timestamp: '2026-08-16T18:02:35+09:00', activityType: 'KEY_STATUS_CHANGE', targetKey: 'LEGACY-RSA-002', status: 'SUCCESS', description: '기존 키를 구버전 상태로 전환했습니다.', version: 'v1' },
  { timestamp: '2026-08-16T12:44:50+09:00', activityType: 'KEY_CREATE', targetKey: 'FILE-RSA-006', status: 'SUCCESS', description: 'RSA-2048 파일 서명 키를 생성했습니다.', version: 'v1' },
  { timestamp: '2026-08-15T17:28:19+09:00', activityType: 'KEY_DEPLOY', targetKey: 'FILE-RSA-006', status: 'SUCCESS', description: '문서 서비스 App ID에 키를 배포했습니다.', version: 'v1' },
  { timestamp: '2026-08-15T09:02:41+09:00', activityType: 'LOGIN', targetKey: null, status: 'FAILURE', description: '비밀번호 불일치로 로그인에 실패했습니다.', ipAddress: '10.20.1.77' },
  { timestamp: '2026-08-14T16:52:03+09:00', activityType: 'NOTICE_UPDATE', targetKey: null, status: 'SUCCESS', description: '정기 점검 안내 내용을 수정했습니다.' },
  { timestamp: '2026-08-14T14:33:27+09:00', activityType: 'KEY_ROTATE', targetKey: 'PAYMENT-AES-001', status: 'SUCCESS', description: 'v1을 구버전으로 전환하고 v2를 활성화했습니다.', version: 'v2' },
  { timestamp: '2026-08-13T11:47:56+09:00', activityType: 'CRYPTO_TEST', targetKey: 'MEMBER-AES-003', status: 'SUCCESS', description: '복호화 호환성 테스트를 완료했습니다.', version: 'v3' },
  { timestamp: '2026-08-12T15:16:38+09:00', activityType: 'KEY_STATUS_CHANGE', targetKey: 'NOTICE-AES-002', status: 'SUCCESS', description: '키 상태를 비활성에서 활성으로 변경했습니다.' },
  { timestamp: '2026-08-11T10:39:12+09:00', activityType: 'KEY_CREATE', targetKey: 'NOTICE-AES-002', status: 'SUCCESS', description: 'AES-256 공지 첨부파일 키를 생성했습니다.', version: 'v1' },
  { timestamp: '2026-08-08T17:05:44+09:00', activityType: 'KEY_DEPLOY', targetKey: 'AUTH-HMAC-004', status: 'SUCCESS', description: '인증 API 서버에 키를 배포했습니다.', version: 'v2' },
  { timestamp: '2026-08-05T09:18:25+09:00', activityType: 'LOGIN', targetKey: null, status: 'SUCCESS', description: '관리자 콘솔에 로그인했습니다.', ipAddress: '10.20.1.21' },
]

const clientActivityPatterns: Omit<ActivitySeed, 'timestamp'>[] = [
  { activityType: 'CRYPTO_TEST', targetKey: 'PAYMENT-AES-001', status: 'SUCCESS', description: '암호화·복호화 테스트를 실행했습니다.', version: 'v2' },
  { activityType: 'LOGIN', targetKey: null, status: 'SUCCESS', description: '클라이언트 콘솔에 로그인했습니다.' },
  { activityType: 'NOTICE_UPDATE', targetKey: null, status: 'SUCCESS', description: '내 게시글을 작성하거나 수정했습니다.' },
  { activityType: 'CRYPTO_TEST', targetKey: 'MEMBER-AES-003', status: 'SUCCESS', description: '복호화 호환성 테스트를 완료했습니다.', version: 'v4' },
  { activityType: 'LOGOUT', targetKey: null, status: 'SUCCESS', description: '클라이언트 콘솔에서 로그아웃했습니다.' },
]

const clientActivitySeeds: ActivitySeed[] = activitySeeds.slice(0, 20).map((seed, index) => ({
  ...clientActivityPatterns[index % clientActivityPatterns.length],
  timestamp: seed.timestamp,
  ipAddress: `10.30.2.${21 + (index % 4)}`,
}))

function buildMockActivities(seeds: ActivitySeed[], userId: string, idPrefix: string): RecentActivity[] {
  return seeds.map((seed, index) => ({
    id: `ACT-${idPrefix}-${String(index + 1).padStart(5, '0')}`,
    userId,
    timestamp: seed.timestamp,
    activityType: seed.activityType,
    targetKey: seed.targetKey,
    targetKeyUid: seed.targetKey ? `DGK-${String(91000 + index).padStart(6, '0')}` : undefined,
    keyVersion: seed.version,
    status: seed.status,
    ipAddress: seed.ipAddress ?? '10.20.1.12',
    description: seed.description,
  }))
}

export const recentActivityMockData: RecentActivity[] = [
  ...buildMockActivities(activitySeeds, 'admin', 'A'),
  ...buildMockActivities(clientActivitySeeds, 'client', 'C'),
]
  .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))

export function getLatestMockActivities(limit = 10, userId = 'admin'): RecentActivity[] {
  return recentActivityMockData
    .filter((activity) => activity.userId === userId)
    .slice(0, Math.max(0, limit))
}

export async function fetchMockRecentActivities(
  query: RecentActivityQuery,
  signal?: AbortSignal,
): Promise<RecentActivityPageResult> {
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, 180)
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer)
      reject(new DOMException('요청이 취소되었습니다.', 'AbortError'))
    }, { once: true })
  })

  const filtered = recentActivityMockData.filter((activity) => {
    const activityDate = activity.timestamp.slice(0, 10)
    return activity.userId === query.userId
      && (query.activityType === 'ALL' || activity.activityType === query.activityType)
      && (!query.fromDate || activityDate >= query.fromDate)
      && (!query.toDate || activityDate <= query.toDate)
  })
  const start = query.page * query.size

  return {
    content: filtered.slice(start, start + query.size),
    totalElements: filtered.length,
    totalPages: Math.ceil(filtered.length / query.size),
    page: query.page,
    size: query.size,
  }
}

export const mockRecentActivitySource: RecentActivitySource = {
  fetchActivities: fetchMockRecentActivities,
}
