export type RecentActivityType =
  | 'KEY_CREATE'
  | 'KEY_DEPLOY'
  | 'KEY_ROTATE'
  | 'KEY_STATUS_CHANGE'
  | 'CRYPTO_TEST'
  | 'LOGIN'
  | 'LOGOUT'
  | 'NOTICE_UPDATE'
  | 'AUDIT_EVENT'

export type RecentActivityStatus = 'SUCCESS' | 'FAILURE' | 'IN_PROGRESS'

export interface RecentActivity {
  id: string
  userId: string
  timestamp: string
  activityType: RecentActivityType
  targetKey: string | null
  targetKeyUid?: string
  keyVersion?: string
  status: RecentActivityStatus
  ipAddress: string
  description: string
  metadata?: Record<string, string | number | boolean | null>
}

export type RecentActivityTypeFilter = 'ALL' | RecentActivityType

export interface RecentActivityQuery {
  userId: string
  activityType: RecentActivityTypeFilter
  fromDate: string
  toDate: string
  page: number
  size: number
}

export interface RecentActivityPageResult {
  content: RecentActivity[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

export interface RecentActivitySource {
  fetchActivities: (
    query: RecentActivityQuery,
    signal?: AbortSignal,
  ) => Promise<RecentActivityPageResult>
  subscribeLatest?: (
    userId: string,
    onActivity: (activity: RecentActivity) => void,
    onError?: (error: Error) => void,
  ) => () => void
}

export interface RecentActivityRequestState {
  data: RecentActivityPageResult
  loading: boolean
  refreshing: boolean
  error: string | null
  lastUpdatedAt: Date | null
}
