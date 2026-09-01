import type { KeyStatus } from '../types/api'

interface KeyStatusMetadata {
  label: string
  description: string
  terminal?: boolean
}

export type CanonicalKeyStatus = 'CREATED' | 'ACTIVE' | 'DEACTIVATED' | 'COMPROMISED' | 'DESTROYED'

export const keyStatusOrder: CanonicalKeyStatus[] = ['CREATED', 'ACTIVE', 'DEACTIVATED', 'COMPROMISED', 'DESTROYED']

export function getCanonicalKeyStatus(status: KeyStatus): CanonicalKeyStatus {
  if (status === 'REACTIVATED' || status === 'DISTRIBUTED') return 'ACTIVE'
  if (status === 'EXPIRED' || status === 'INACTIVE') return 'DEACTIVATED'
  return status
}

export const keyStatusMetadata: Record<KeyStatus, KeyStatusMetadata> = {
  CREATED: { label: '생성됨', description: '안전하게 생성되어 고유 식별자와 최초 버전이 부여된 상태입니다. 활성화 전에는 암·복호화에 사용할 수 없습니다.' },
  ACTIVE: { label: '활성화', description: '암호화와 복호화에 사용할 수 있는 운영 상태입니다. 생성된 키는 등록 절차에서 자동 활성화됩니다.' },
  REACTIVATED: { label: '활성화', description: '기존 데이터 호환을 위해 활성 상태로 정규화된 레거시 재활성 기록입니다.' },
  DEACTIVATED: { label: '비활성', description: '암호화와 복호화 요청은 모두 차단되지만 설정된 회전 주기와 관리 이력은 유지됩니다.' },
  EXPIRED: { label: '비활성', description: '유효기간 만료로 사용이 중지된 레거시 상태이며 비활성으로 표시합니다.' },
  INACTIVE: { label: '비활성', description: '관리자가 사용을 중지한 레거시 상태이며 비활성으로 표시합니다.' },
  DISTRIBUTED: { label: '활성화', description: '배포 이력이 있는 레거시 상태입니다. 배포는 생명주기와 분리하고 활성 상태로 표시합니다.' },
  COMPROMISED: { label: '침해', description: '키 노출 또는 유출이 의심되어 모든 암·복호화를 차단하고 폐기만 허용하는 상태입니다.' },
  DESTROYED: { label: '폐기', description: '원시 키가 제로화되어 복구할 수 없는 최종 상태입니다. 무결성 검증용 메타데이터와 감사 이력은 보존됩니다.', terminal: true },
}

export const keyStatusTransitions: Record<KeyStatus, KeyStatus[]> = {
  CREATED: ['ACTIVE', 'DESTROYED'],
  ACTIVE: ['DEACTIVATED', 'COMPROMISED', 'DESTROYED'],
  REACTIVATED: ['DEACTIVATED', 'COMPROMISED', 'DESTROYED'],
  DEACTIVATED: ['ACTIVE', 'COMPROMISED', 'DESTROYED'],
  EXPIRED: ['ACTIVE', 'COMPROMISED', 'DESTROYED'],
  INACTIVE: ['ACTIVE', 'COMPROMISED', 'DESTROYED'],
  DISTRIBUTED: ['DEACTIVATED', 'COMPROMISED', 'DESTROYED'],
  COMPROMISED: ['DESTROYED'],
  DESTROYED: [],
}

export function canEncryptWithStatus(status: KeyStatus) {
  return getCanonicalKeyStatus(status) === 'ACTIVE'
}

export function canDecryptWithStatus(status: KeyStatus) {
  return getCanonicalKeyStatus(status) === 'ACTIVE'
}

export function canRotateWithStatus(status: KeyStatus) {
  const canonical = getCanonicalKeyStatus(status)
  return canonical === 'ACTIVE' || canonical === 'DEACTIVATED'
}

export function getAllowedKeyStatusTransitions(status: KeyStatus) {
  return keyStatusTransitions[status]
}

export function getManualKeyStatusTransitions(status: KeyStatus) {
  return keyStatusTransitions[status]
}

export function getKeyStatusDescription(status: KeyStatus) {
  return keyStatusMetadata[status].description
}
