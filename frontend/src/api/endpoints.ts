type QueryValue = string | number | boolean | null | undefined

export function toQueryString(params: Record<string, QueryValue>) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'ALL') {
      searchParams.set(key, String(value))
    }
  })
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export const apiEndpoints = {
  auth: {
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
    me: '/api/auth/me',
    logout: '/api/auth/logout',
  },
  keys: {
    list: '/api/keys',
    create: '/api/keys',
    detail: (id: string) => `/api/keys/${id}`,
    update: (id: string) => `/api/keys/${id}`,
    delete: (id: string) => `/api/keys/${id}`,
    status: (id: string) => `/api/keys/${id}/status`,
    history: (id: string) => `/api/keys/${id}/history`,
    usage: (id: string) => `/api/keys/${id}/usage`,
    versions: (id: string) => `/api/keys/${id}/versions`,
    rotationPolicy: (id: string) => `/api/keys/${id}/rotation-policy`,
    encryptTest: (id: string) => `/api/keys/${id}/test/encrypt`,
    decryptTest: (id: string) => `/api/keys/${id}/test/decrypt`,
    rotate: (id: string) => `/api/keys/${id}/rotate`,
    distribute: (id: string) => `/api/keys/${id}/distribute`,
  },
  users: {
    list: '/api/users',
    create: '/api/users',
    detail: (id: string) => `/api/users/${id}`,
    update: (id: string) => `/api/users/${id}`,
    plain: (id: string) => `/api/users/${id}/plain`,
    password: (id: string) => `/api/users/${id}/password`,
    status: (id: string) => `/api/users/${id}/status`,
  },
  adminAccounts: {
    list: '/api/admin-accounts',
    detail: (id: string) => `/api/admin-accounts/${id}`,
    update: (id: string) => `/api/admin-accounts/${id}`,
    status: (id: string) => `/api/admin-accounts/${id}/status`,
    password: (id: string) => `/api/admin-accounts/${id}/password`,
  },
  auditLogs: {
    list: '/api/audit-logs',
    verify: '/api/audit-logs/verify',
    verifyEntry: (id: string) => `/api/audit-logs/${id}/verify`,
    export: '/api/audit-logs/export',
  },
  notices: {
    list: '/api/notices',
    create: '/api/notices',
    detail: (id: string) => `/api/notices/${id}`,
    update: (id: string) => `/api/notices/${id}`,
    delete: (id: string) => `/api/notices/${id}`,
  },
  files: {
    download: (id: string) => `/api/files/${id}/download`,
    delete: (id: string) => `/api/files/${id}`,
  },
  dashboard: {
    summary: '/api/dashboard/summary',
    expiring: '/api/dashboard/expiring',
    usageTrend: '/api/dashboard/usage-trend',
  },
} as const
