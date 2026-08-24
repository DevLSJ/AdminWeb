import type { KeyStatus } from '../types/api'

const manualTransitions: Partial<Record<KeyStatus, KeyStatus[]>> = {
  CREATED: ['ACTIVE'],
  ACTIVE: ['EXPIRED', 'INACTIVE', 'DEPLOY_FAILED'],
  EXPIRED: ['INACTIVE', 'ACTIVE'],
  INACTIVE: ['DESTROYED'],
  DISTRIBUTED: ['DESTROYED'],
  DEPLOY_FAILED: ['ACTIVE', 'DESTROYED'],
}

export function getManualKeyStatusTransitions(status: KeyStatus) {
  return manualTransitions[status] ?? []
}
