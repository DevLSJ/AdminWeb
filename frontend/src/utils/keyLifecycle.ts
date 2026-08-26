import type { KeyStatus } from '../types/api'

interface KeyStatusMetadata {
  label: string
  description: string
  terminal?: boolean
}

export const keyStatusOrder: KeyStatus[] = [
  'CREATED',
  'ACTIVE',
  'EXPIRED',
  'INACTIVE',
  'DISTRIBUTED',
  'COMPROMISED',
  'DESTROYED',
]

export const keyStatusMetadata: Record<KeyStatus, KeyStatusMetadata> = {
  CREATED: { label: '생성됨', description: '키가 생성됐으나 아직 암복호화에 사용할 수 없습니다.' },
  ACTIVE: { label: '활성화', description: '최신 버전으로 암호화하고 모든 보존 버전으로 복호화할 수 있습니다.' },
  EXPIRED: { label: '만료됨', description: '유효기간이 만료됐으며 사유를 입력해 재활성화할 수 있습니다.' },
  INACTIVE: { label: '비활성화', description: '사용이 중지됐으며 폐기만 가능합니다.' },
  DISTRIBUTED: { label: '배포됨', description: '외부 시스템에 배포된 사실이 기록된 상태입니다.' },
  COMPROMISED: { label: '침해됨', description: '키 노출 또는 유출이 의심되어 폐기만 가능합니다.' },
  DESTROYED: { label: '폐기됨', description: '복구할 수 없는 최종 상태이며 다른 상태로 전이할 수 없습니다.', terminal: true },
}

export const keyStatusTransitions: Record<KeyStatus, KeyStatus[]> = {
  CREATED: ['ACTIVE'],
  ACTIVE: ['EXPIRED', 'INACTIVE', 'DISTRIBUTED', 'COMPROMISED'],
  EXPIRED: ['INACTIVE', 'ACTIVE'],
  INACTIVE: ['DESTROYED'],
  DISTRIBUTED: ['DESTROYED'],
  COMPROMISED: ['DESTROYED'],
  DESTROYED: [],
}

export function getAllowedKeyStatusTransitions(status: KeyStatus) {
  return keyStatusTransitions[status]
}

export function getManualKeyStatusTransitions(status: KeyStatus) {
  return keyStatusTransitions[status].filter((target) => target !== 'DISTRIBUTED')
}

export function getKeyStatusDescription(status: KeyStatus) {
  return keyStatusMetadata[status].description
}
