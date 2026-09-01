import { fetchAuditLogPage, fetchKeys } from '../../src/api/kms'
import type { AuditAction } from '../../src/types/api'
import { auditActionLabels, getAuditTargetTypeLabel } from '../../src/utils/auditPresentation'
import type { RecentActivitySource, RecentActivityType } from './types'

const toAuditAction: Partial<Record<RecentActivityType, AuditAction>> = {
  KEY_CREATE: 'KEY_CREATE', KEY_DEPLOY: 'KEY_DEPLOY', KEY_ROTATE: 'KEY_ROTATE',
  KEY_STATUS_CHANGE: 'KEY_STATUS_CHANGE', CRYPTO_TEST: 'KEY_TEST', LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT', NOTICE_UPDATE: 'NOTICE_UPDATE',
}

const toActivityType = (action: AuditAction): RecentActivityType => {
  if (action === 'KEY_TEST') return 'CRYPTO_TEST'
  if (action.startsWith('NOTICE_')) return 'NOTICE_UPDATE'
  return (Object.keys(toAuditAction).find((type) => toAuditAction[type as RecentActivityType] === action) ?? 'AUDIT_EVENT') as RecentActivityType
}

let cachedKeyNames = new Map<string, string>()
let keyNamesCachedAt = 0

async function getKeyNames() {
  if (Date.now() - keyNamesCachedAt < 60_000) return cachedKeyNames
  const keys = await fetchKeys()
  cachedKeyNames = new Map(keys.map((key) => [key.keyUid, key.keyName]))
  keyNamesCachedAt = Date.now()
  return cachedKeyNames
}

export const apiRecentActivitySource: RecentActivitySource = {
  async fetchActivities(query) {
    const [page, keyNames] = await Promise.all([
      fetchAuditLogPage({
        from: query.fromDate, to: query.toDate, actor: query.userId,
        action: query.activityType === 'ALL' ? 'ALL' : (toAuditAction[query.activityType] ?? 'ALL'),
        page: query.page, size: query.size,
      }),
      getKeyNames(),
    ])
    return {
      page: page.page, size: page.size, totalElements: page.totalElements, totalPages: page.totalPages,
      content: page.content.map((log) => ({
        id: log.logUid, userId: log.actor, timestamp: log.createdAt,
        activityType: toActivityType(log.action), activityLabel: auditActionLabels[log.action],
        targetLabel: keyNames.get(log.targetId) ?? getAuditTargetTypeLabel(log.targetType),
        targetReference: log.targetId || undefined, status: log.chainValid ? 'SUCCESS' : 'FAILURE',
        ipAddress: '서버 감사로그', description: log.detail,
      })),
    }
  },
}
