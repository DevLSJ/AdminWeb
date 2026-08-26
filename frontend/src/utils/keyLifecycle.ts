import type { KeyStatus } from '../types/api'

const manualTransitions: Partial<Record<KeyStatus, KeyStatus[]>> = {
  CREATED: ['ACTIVE'],
  ACTIVE: ['EXPIRED', 'INACTIVE', 'COMPROMISED'],
  EXPIRED: ['INACTIVE', 'ACTIVE'],
  INACTIVE: ['DESTROYED'],
  DISTRIBUTED: ['DESTROYED'],
  COMPROMISED: ['DESTROYED'],
}

export function getManualKeyStatusTransitions(status: KeyStatus) {
  return manualTransitions[status] ?? []
}
