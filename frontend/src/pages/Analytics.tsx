import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnalyticsRounded, ErrorOutlineRounded, KeyRounded, ShieldRounded, VpnKeyRounded } from '@mui/icons-material'
import { Alert, Avatar, Box, Card, CardContent, LinearProgress, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import { fetchDashboardSummary, fetchDashboardTrend, fetchKeys } from '../api/kms'
import { InteractiveUsageChart } from '../components/dashboard/InteractiveUsageChart'
import { StatusBadge } from '../components/common/StatusBadge'
import type { CryptoKey, DashboardSummary, DashboardTrend } from '../types/api'
import { getCanonicalKeyStatus, keyStatusOrder, type CanonicalKeyStatus } from '../utils/keyLifecycle'
import { getStatusLabel } from '../utils/status'

const statusColors: Record<CanonicalKeyStatus, string> = { CREATED: '#7f65c4', ACTIVE: '#28ad73', DEACTIVATED: '#eea325', COMPROMISED: '#df4c64', DESTROYED: '#596273' }

function formatDate(date: Date) { return date.toISOString().slice(0, 10) }

function MetricCard({ label, value, note, color, icon, href }: { label: string; value: string; note: string; color: string; icon: ReactNode; href?: string }) {
  const navigate = useNavigate()
  const open = () => href && navigate(href)
  return <Card className="analytics-metric-card dashboard-card" role={href ? 'link' : undefined} tabIndex={href ? 0 : undefined} onClick={open} onKeyDown={(event) => { if (href && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); open() } }} sx={{ position: 'relative', height: '100%', minWidth: 0, overflow: 'hidden', cursor: href ? 'pointer' : 'default', '&::after': { position: 'absolute', right: -24, bottom: -44, width: 64, height: 64, borderRadius: '50%', bgcolor: alpha(color, .08), content: '""' } }}>
    <CardContent sx={{ position: 'relative', zIndex: 1, p: '10px 14px !important' }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}><Typography noWrap sx={{ color: 'text.secondary', fontSize: 11.5, fontWeight: 800 }}>{label}</Typography><Typography sx={{ mt: .3, fontSize: 25, lineHeight: 1.1, fontWeight: 900 }}>{value}</Typography></Box>
        <Avatar className="dashboard-card-icon" variant="rounded" sx={{ width: 32, height: 32, borderRadius: 2, color, bgcolor: alpha(color, .11) }}>{icon}</Avatar>
      </Stack>
      <Typography noWrap sx={{ mt: .6, color: 'text.secondary', fontSize: 11 }}>{note}</Typography>
    </CardContent>
  </Card>
}

function DistributionPanel({ title, items, total }: { title: string; items: Array<{ label: string; value: number; color: string; href: string }>; total: number }) {
  const navigate = useNavigate()
  return <Card className="section-card analytics-distribution" sx={{ minWidth: 0, overflow: 'hidden' }}>
    <Box sx={{ px: 1.5, pt: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><Typography sx={{ fontSize: 13, fontWeight: 800 }}>{title}</Typography><StatusBadge label={`${total.toLocaleString()}개`} tone="neutral" minWidth={0} /></Box>
    <CardContent role="region" aria-label={`${title} 통계`} sx={{ p: '6px 12px 10px !important' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: 1 }}>
        {items.map((item) => { const rate = total ? item.value / total * 100 : 0; return <Box key={item.label} role="link" tabIndex={0} onClick={() => navigate(item.href)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(item.href) } }} sx={{ minWidth: 0, p: .5, cursor: 'pointer', borderRadius: 1, '&:hover, &:focus-visible': { bgcolor: 'action.hover' } }}>
          <Typography noWrap sx={{ fontSize: 11, color: 'text.secondary' }}>{item.label}</Typography>
          <Typography sx={{ my: .25, fontSize: 15, fontWeight: 850 }}>{item.value} <Typography component="span" sx={{ color: 'text.secondary', fontSize: 10 }}>({Math.round(rate)}%)</Typography></Typography>
          <Box sx={{ height: 4, overflow: 'hidden', borderRadius: 1, bgcolor: 'action.hover' }}><Box className="analytics-progress" sx={{ width: `${rate}%`, height: '100%', bgcolor: item.color }} /></Box>
        </Box> })}
      </Box>
    </CardContent>
  </Card>
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
    return keyStatusOrder.map((status) => ({ label: getStatusLabel(status), value: counts[status], color: statusColors[status], href: `/keys?status=${status}` }))
  }, [keys])
  const algorithmItems = useMemo(() => ['AES', 'RSA', 'HMAC'].map((algorithm, index) => ({ label: algorithm, value: keys.filter((key) => key.algorithm === algorithm).length, color: ['#2478e8', '#28ad73', '#eea325'][index], href: `/keys?algorithm=${algorithm}` })), [keys])
  const expiring = useMemo(() => keys.filter((key) => key.status !== 'DESTROYED' && new Date(`${key.expireAt}T23:59:59`).getTime() >= Date.now() && new Date(`${key.expireAt}T23:59:59`).getTime() - Date.now() <= 30 * 86_400_000).length, [keys])
  const operationTotal = trend?.points.reduce((sum, point) => sum + point.totalOperations, 0) ?? 0

  const metrics = [
    { label: '전체 관리 키', value: String(summary?.totalKeys ?? 0), note: 'DB에 등록된 전체 키', color: '#2478e8', icon: <VpnKeyRounded />, href: '/keys?category=ALL' },
    { label: '기간 내 키 사용', value: operationTotal.toLocaleString(), note: period === 'DAY' ? '최근 30일 암·복호화' : '최근 12개월 암·복호화', color: '#28ad73', icon: <AnalyticsRounded /> },
    { label: '만료 임박', value: `${expiring}개`, note: '30일 이내 확인 필요', color: '#eea325', icon: <KeyRounded />, href: '/keys?category=EXPIRING&expiringWithinDays=30' },
    { label: '무결성 위반', value: `${summary?.integrityViolations ?? 0}개`, note: summary?.integrityViolations ? '즉시 조사 필요' : '전체 키 정상', color: '#df4c64', icon: summary?.integrityViolations ? <ErrorOutlineRounded /> : <ShieldRounded />, href: '/keys?category=INTEGRITY_VIOLATION' },
  ]

  return <Box className="analytics-page" sx={{ width: '100%', height: '100%', minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.25, overflow: 'hidden' }}>
    <Stack direction="row" sx={{ flexShrink: 0, alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
      <Typography variant="h5" sx={{ fontSize: { xs: 20, sm: 24 }, whiteSpace: 'nowrap' }}>키 통계</Typography>
      <ToggleButtonGroup exclusive size="small" value={period} onChange={(_event, value) => value && setPeriod(value)}><ToggleButton value="DAY">최근 30일</ToggleButton><ToggleButton value="MONTH">최근 12개월</ToggleButton></ToggleButtonGroup>
    </Stack>
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ flexShrink: 0 }}>{error}</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'repeat(4,minmax(0,1fr))' }, gap: 1.25, flexShrink: 0 }}>{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</Box>
    <Card className="section-card analytics-chart-card" sx={{ position: 'relative', flex: '1 1 0', minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
      <Box sx={{ px: 2, pt: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexShrink: 0 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 800 }}>키 생성·사용 상세</Typography>
        <Typography sx={{ display: { xs: 'none', sm: 'block' }, color: 'text.secondary', fontSize: 11 }}>그래프에 마우스를 올려 기간별 수치를 확인하세요</Typography>
      </Box>
      <CardContent role="region" aria-label="키 생성·사용 상세 차트" sx={{ p: '6px 12px 8px !important', minHeight: 0, minWidth: 0, flex: 1, overflow: 'hidden' }}><InteractiveUsageChart trend={trend} detailed fillContainer /></CardContent>
    </Card>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1.4fr) minmax(0,1fr)' }, gap: 1.25, flexShrink: 0 }}><DistributionPanel title="전체 키 상태" items={statusItems} total={keys.length} /><DistributionPanel title="알고리즘 분포" items={algorithmItems} total={keys.length} /></Box>
  </Box>
}

export default Analytics
