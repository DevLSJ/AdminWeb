import type { KeyStatus } from '../types/api'

interface KeyStatusMetadata {
  label: string
  description: string
  terminal?: boolean
}

export const keyStatusOrder: KeyStatus[] = [
  'CREATED',
  'ACTIVE',
  'REACTIVATED',
  'DEACTIVATED',
  'EXPIRED',
  'INACTIVE',
  'DISTRIBUTED',
  'COMPROMISED',
  'DESTROYED',
]

export const keyStatusMetadata: Record<KeyStatus, KeyStatusMetadata> = {
  CREATED: { label: '준비 · Pre-Active', description: 'KMIP Pre-Active 대응 상태입니다. 키가 생성됐으나 암복호화에는 사용할 수 없습니다.' },
  ACTIVE: { label: '활성 · Active', description: 'KMIP Active 대응 상태입니다. 최신 버전 암호화와 보존 버전 복호화를 허용합니다.' },
  REACTIVATED: { label: '재활성 · D’Guard', description: 'D’Guard 확장 정책입니다. 재활성화 이후 신규 암호화만 허용하고 복호화는 차단합니다.' },
  DEACTIVATED: { label: '비활성 · Deactivated', description: 'KMIP Deactivated 대응 상태입니다. 기존 데이터 복호화만 허용하고 신규 암호화는 차단합니다.' },
  EXPIRED: { label: '만료 · D’Guard', description: '유효기간에 따른 D’Guard 정책 상태입니다. 사유를 기록한 재활성화만 허용합니다.' },
  INACTIVE: { label: '운영 중지 · D’Guard', description: '관리자가 완전히 사용 중지한 D’Guard 확장 상태이며 폐기만 가능합니다.' },
  DISTRIBUTED: { label: '배포됨 · D’Guard', description: '수명주기가 아닌 외부 시스템 배포 사실을 보존하는 D’Guard 확장 상태입니다.' },
  COMPROMISED: { label: '침해 · Compromised', description: 'KMIP Compromised 대응 상태입니다. 키 노출 또는 유출이 의심되어 폐기만 가능합니다.' },
  DESTROYED: { label: '폐기 · Destroyed', description: 'KMIP Destroyed 대응 최종 상태입니다. 키 재료는 NULL이며 추가 전이가 불가능합니다.', terminal: true },
}

export const keyStatusTransitions: Record<KeyStatus, KeyStatus[]> = {
  CREATED: ['ACTIVE'],
  ACTIVE: ['DEACTIVATED', 'EXPIRED', 'INACTIVE', 'DISTRIBUTED', 'COMPROMISED'],
  REACTIVATED: ['DEACTIVATED', 'EXPIRED', 'INACTIVE', 'DISTRIBUTED', 'COMPROMISED'],
  DEACTIVATED: ['REACTIVATED', 'DESTROYED'],
  EXPIRED: ['INACTIVE', 'REACTIVATED'],
  INACTIVE: ['DESTROYED'],
  DISTRIBUTED: ['DESTROYED'],
  COMPROMISED: ['DESTROYED'],
  DESTROYED: [],
}

export function canEncryptWithStatus(status: KeyStatus) {
  return status === 'ACTIVE' || status === 'REACTIVATED'
}

export function canDecryptWithStatus(status: KeyStatus) {
  return status === 'ACTIVE' || status === 'DEACTIVATED'
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
