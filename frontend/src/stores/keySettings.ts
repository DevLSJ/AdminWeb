import { useSyncExternalStore } from 'react'
import { apiClient } from '../api/client'
import type { ApiResponse } from '../types/api'

export interface CommonCode {
  group: 'ALGORITHM' | 'PURPOSE' | 'STATUS'
  code: string
  label: string
  description: string
  sortOrder: number
  enabled: boolean
  selectable: boolean
  version: number
  allowedPurposes: string[]
  allowedTransitions: string[]
}
export interface KeyPolicy {
  defaultValidityDays: number
  expiryWarningDays: number
  today: string
  defaultExpireAt: string
  version: number
  updatedBy: string
  updatedAt: string
}
interface Settings { codes: CommonCode[]; policy: KeyPolicy | null; loaded: boolean; error: string }
const empty: Settings = { codes: [], policy: null, loaded: false, error: '' }
let snapshot = empty
const listeners = new Set<() => void>()
let pending: Promise<Settings> | null = null
let generation = 0
function publish(next: Settings) { snapshot = next; listeners.forEach(listener => listener()) }
export function useKeySettings() { return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => snapshot) }
export function getCodeLabel(group: CommonCode['group'], code: string, fallback: string) {
  return snapshot.codes.find(entry => entry.group === group && entry.code === code)?.label ?? fallback
}
export function getKeyCode(code: string) { return snapshot.codes.find(entry => entry.group === 'STATUS' && entry.code === code) }
export function resetKeySettings() { generation++; pending = null; publish(empty) }
export function refreshKeySettings(): Promise<Settings> {
  if (pending) return pending
  const current = generation
  const request = Promise.all([
    apiClient.get<ApiResponse<CommonCode[]>>('/api/settings/key-codes'),
    apiClient.get<ApiResponse<KeyPolicy>>('/api/settings/key-policy'),
  ]).then(([codes, policy]) => {
    const next = { codes: codes.data.data, policy: policy.data.data, loaded: true, error: '' }
    if (current === generation) publish(next)
    return next
  }).catch((error: unknown) => {
    if (current === generation) publish({ ...snapshot, error: '코드·정책을 불러오지 못했습니다.' })
    throw error
  }).finally(() => { if (current === generation) pending = null })
  pending = request
  return request
}
export async function saveKeyPolicy(policy: Pick<KeyPolicy, 'defaultValidityDays' | 'expiryWarningDays' | 'version'>, reason: string) {
  const result = await apiClient.put<ApiResponse<KeyPolicy>>('/api/settings/key-policy', { ...policy, reason })
  publish({ ...snapshot, policy: result.data.data })
}
export async function saveCommonCode(code: CommonCode, reason: string) {
  const result = await apiClient.patch<ApiResponse<CommonCode>>(`/api/settings/key-codes/${code.group}/${code.code}`, {
    label: code.label, description: code.description, sortOrder: code.sortOrder, enabled: code.enabled, version: code.version, reason,
  })
  publish({ ...snapshot, codes: snapshot.codes.map(entry => entry.group === code.group && entry.code === code.code ? result.data.data : entry).sort((a, b) => a.sortOrder - b.sortOrder) })
}

/** Date-only keys keep UTC-midnight storage; warnings use the calendar date in Korea. */
export function kstDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-')
}
export function futureKstDate(days: number) {
  const date = new Date(`${kstDate()}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
export function isExpiringKey(key: { expireAt: string | null; status: string }, days: number, today = kstDate()) {
  if (key.status !== 'ACTIVE' || !key.expireAt) return false
  const remaining = (Date.parse(`${key.expireAt}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000
  return remaining >= 0 && remaining <= days
}
