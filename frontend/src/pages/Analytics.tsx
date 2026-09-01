import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnalyticsRounded, CheckCircleRounded, ErrorOutlineRounded, KeyRounded, LockRounded, ShieldRounded, VpnKeyRounded } from '@mui/icons-material'
import { Alert, Avatar, Box, Card, CardContent, LinearProgress, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { fetchDashboardSummary, fetchDashboardTrend, fetchKeys } from '../api/kms'
import { InteractiveUsageChart } from '../components/dashboard/InteractiveUsageChart'
import { StatusBadge } from '../components/common/StatusBadge'
import type { CryptoKey, DashboardSummary, DashboardTrend } from '../types/api'
import { getCanonicalKeyStatus, keyStatusOrder, type CanonicalKeyStatus } from '../utils/keyLifecycle'
import { getStatusLabel } from '../utils/status'

const statusColors: Record<CanonicalKeyStatus, string> = { CREATED: '#7f65c4', ACTIVE: '#28ad73', DEACTIVATED: '#eea325', COMPROMISED: '#df4c64', DESTROYED: '#596273' }

function formatDate(date: Date) { return date.toISOString().slice(0, 10) }

function MetricCard({ label, value, note, color, icon }: { label: string; value: string; note: string; color: string; icon: ReactNode }) {
  return <Card className="analytics-metric-card" sx={{ height: '100%' }}><CardContent sx={{ p: '18px !important' }}><Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><Box><Typography sx={{ color: 'text.secondary', fontSize: 11.5, fontWeight: 800, letterSpacing: '.035em' }}>{label}</Typography><Typography sx={{ mt: .7, fontSize: 27, lineHeight: 1.1, fontWeight: 900 }}>{value}</Typography></Box><Avatar sx={{ width: 38, height: 38, color, bgcolor: alpha(color, .11) }}>{icon}</Avatar></Stack><Typography sx={{ mt: 1.25, color: 'text.secondary', fontSize: 11.5 }}>{note}</Typography></CardContent></Card>
}

function DistributionPanel({ title, items, total }: { title: string; items: Array<{ label: string; value: number; color: string }>; total: number }) {
  return <Card className="section-card" sx={{ height: '100%' }}><Box className="section-card-header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><Typography variant="h6">{title}</Typography><StatusBadge label={`${total.toLocaleString()}개`} tone="neutral" minWidth={0} /></Box><CardContent sx={{ p: '18px 20px !important' }}><Stack spacing={1.65}>{items.map((item) => { const rate = total ? item.value / total * 100 : 0; return <Box key={item.label}><Stack direction="row" sx={{ mb: .65, justifyContent: 'space-between' }}><Stack direction="row" spacing={.8} sx={{ alignItems: 'center' }}><Box sx={{ width: 8, height: 8, bgcolor: item.color }} /><Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{item.label}</Typography></Stack><Typography sx={{ fontSize: 12.5, fontWeight: 850 }}>{item.value} <Typography component="span" sx={{ color: 'text.secondary', fontSize: 10.5 }}>({Math.round(rate)}%)</Typography></Typography></Stack><Box sx={{ height: 7, overflow: 'hidden', bgcolor: 'action.hover' }}><Box className="analytics-progress" sx={{ width: `${rate}%`, height: '100%', bgcolor: item.color }} /></Box></Box> })}</Stack></CardContent></Card>
}

function Analytics() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [keys, setKeys] = useState<CryptoKey[]>([])
  const [trend, setTrend] = useState<DashboardTrend | null>(null)
  const [period, setPeriod] = useState<'DAY' | 'MONTH'>('DAY')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    const to = new Date()
    const from = new Date(to)
    if (period === 'DAY') from.setDate(from.getDate() - 29)
    else from.setMonth(from.getMonth() - 11)
    void Promise.all([fetchDashboardSummary(), fetchKeys(), fetchDashboardTrend(formatDate(from), formatDate(to), period)])
      .then(([nextSummary, nextKeys, nextTrend]) => { setSummary(nextSummary); setKeys(nextKeys); setTrend(nextTrend) })
      .catch(() => setError('KMS 통계 실데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [period])

  const statusItems = useMemo(() => {
    const counts = keys.reduce<Record<CanonicalKeyStatus, number>>((result, key) => { result[getCanonicalKeyStatus(key.status)] += 1; return result }, { CREATED: 0, ACTIVE: 0, DEACTIVATED: 0, COMPROMISED: 0, DESTROYED: 0 })
    return keyStatusOrder.map((status) => ({ label: getStatusLabel(status), value: counts[status], color: statusColors[status] }))
  }, [keys])
  const algorithmItems = useMemo(() => ['AES', 'RSA', 'HMAC'].map((algorithm, index) => ({ label: algorithm, value: keys.filter((key) => key.algorithm === algorithm).length, color: ['#2478e8', '#28ad73', '#eea325'][index] })), [keys])
  const expiring = useMemo(() => keys.filter((key) => key.status !== 'DESTROYED' && new Date(`${key.expireAt}T23:59:59`).getTime() >= Date.now() && new Date(`${key.expireAt}T23:59:59`).getTime() - Date.now() <= 30 * 86_400_000).length, [keys])
  const successRate = summary?.totalOperations ? Math.round(summary.successfulOperations / summary.totalOperations * 1000) / 10 : 0
  const operationTotal = trend?.points.reduce((sum, point) => sum + point.totalOperations, 0) ?? 0

  const metrics = [
    { label: '전체 관리 키', value: String(summary?.totalKeys ?? 0), note: 'DB에 등록된 전체 키', color: '#2478e8', icon: <VpnKeyRounded /> },
    { label: '기간 내 키 사용', value: operationTotal.toLocaleString(), note: period === 'DAY' ? '최근 30일 암·복호화' : '최근 12개월 암·복호화', color: '#28ad73', icon: <AnalyticsRounded /> },
    { label: '작업 성공률', value: `${successRate}%`, note: `실패 ${summary?.failedOperations ?? 0}건`, color: successRate >= 99 ? '#28ad73' : '#df4c64', icon: <CheckCircleRounded /> },
    { label: '만료 임박', value: `${expiring}개`, note: '30일 이내 확인 필요', color: '#eea325', icon: <KeyRounded /> },
    { label: '무결성 위반', value: `${summary?.integrityViolations ?? 0}개`, note: summary?.integrityViolations ? '즉시 조사 필요' : '전체 키 정상', color: '#df4c64', icon: summary?.integrityViolations ? <ErrorOutlineRounded /> : <ShieldRounded /> },
  ]

  return <Box sx={{ width: '100%', maxWidth: '100%' }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2.5, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}><Box><Typography variant="h5">키 통계</Typography><Typography sx={{ mt: .4, color: 'text.secondary', fontSize: 12.5 }}>KMS 키 상태와 암·복호화 사용량을 서버 DB 기준으로 분석합니다.</Typography></Box><ToggleButtonGroup exclusive size="small" value={period} onChange={(_event, value) => value && setPeriod(value)}><ToggleButton value="DAY">최근 30일</ToggleButton><ToggleButton value="MONTH">최근 12개월</ToggleButton></ToggleButtonGroup></Stack>
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    {loading && <LinearProgress sx={{ mb: 2 }} />}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', xl: 'repeat(5,minmax(0,1fr))' }, gap: 1.5 }}>{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</Box>
    <Card className="section-card" sx={{ mt: 1.5, overflow: 'hidden' }}><Box className="section-card-header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><Box><Typography variant="h6">키 생성·사용 상세</Typography><Typography sx={{ mt: .15, color: 'text.secondary', fontSize: 11.5 }}>그래프 지점에 마우스를 올리거나 클릭해 기간별 수치를 확인하세요.</Typography></Box><Stack direction="row" spacing={.75} sx={{ alignItems: 'center' }}><LockRounded sx={{ color: 'primary.main', fontSize: 18 }} /><Typography sx={{ color: 'text.secondary', fontSize: 11.5 }}>실시간 API 연동</Typography></Stack></Box><CardContent sx={{ p: '8px 20px 14px !important' }}><InteractiveUsageChart trend={trend} detailed /></CardContent></Card>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2,minmax(0,1fr))' }, gap: 1.5, mt: 1.5 }}><DistributionPanel title="전체 키 상태" items={statusItems} total={keys.length} /><DistributionPanel title="알고리즘 분포" items={algorithmItems} total={keys.length} /></Box>
  </Box>
}

export default Analytics
