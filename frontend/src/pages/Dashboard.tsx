import { ResizableTable as Table } from '../components/admin/ResizableTable'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AccessTimeRounded, ArrowForwardRounded, CheckCircleRounded, SecurityRounded, VpnKeyRounded } from '@mui/icons-material'
import { Alert, Avatar, Box, Button, Card, CardContent, Divider, LinearProgress, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import { fetchAuditLogPage, fetchDashboardSummary, fetchDashboardTrend, fetchKeys, fetchNoticePage } from '../api/kms'
import { InteractiveUsageChart } from '../components/dashboard/InteractiveUsageChart'
import { useAuth } from '../hooks/useAuth'
import type { AuditLog, CryptoKey, DashboardSummary, DashboardTrend, Notice } from '../types/api'
import { isAdminRole } from '../types/auth'
import { getStatusLabel } from '../utils/status'
import { getCanonicalKeyStatus, keyStatusOrder, type CanonicalKeyStatus } from '../utils/keyLifecycle'
import { auditActionLabels, truncateAuditDetail } from '../utils/auditPresentation'

const statusColors: Record<CanonicalKeyStatus, string> = { CREATED: '#8a6cc5', ACTIVE: '#2e9b69', DEACTIVATED: '#ef8b2c', COMPROMISED: '#c93451', DESTROYED: '#4f5663' }
interface SummaryCardProps { label: string; value: string; note: string; color: string; icon: ReactNode; href: string }

function SummaryCard({ label, value, note, color, icon, href }: SummaryCardProps) {
  const navigate = useNavigate()
  const open = () => navigate(href)
  return (
    <Card
      className="dashboard-card dashboard-summary-card"
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') open() }}
      sx={{
        position: 'relative',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        cursor: 'pointer',
        '&::after': {
          position: 'absolute',
          right: -35,
          bottom: -60,
          width: 90,
          height: 90,
          borderRadius: '50%',
          bgcolor: alpha(color, .085),
          content: '""',
        },
      }}
    >
      <CardContent sx={{ position: 'relative', zIndex: 1, p: '12px 16px !important' }}>
        <Typography sx={{ color: 'text.secondary', fontSize: 12, fontWeight: 750 }}>{label}</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mt: .7 }}>
          <Typography sx={{ fontSize: 29, fontWeight: 850, lineHeight: 1.05, letterSpacing: '-.04em' }}>{value}</Typography>
          <Avatar className="dashboard-card-icon" variant="rounded" sx={{ width: 40, height: 40, borderRadius: 2.5, bgcolor: alpha(color, 0.12), color }}>{icon}</Avatar>
        </Box>
        <Typography sx={{ mt: .75, color: 'text.secondary', fontSize: 11 }}>{note}</Typography>
      </CardContent>
    </Card>
  )
}

function formatDate(date: Date) { return date.toISOString().slice(0, 10) }
function formatKst(value: string) { return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) }

function KeyStatusChart({ distribution }: { distribution: Array<{ status: CanonicalKeyStatus; value: number }> }) {
  const navigate = useNavigate()
  const total = distribution.reduce((sum, item) => sum + item.value, 0)
  const [activeStatus, setActiveStatus] = useState<CanonicalKeyStatus | null>(null)
  const active = distribution.find((item) => item.status === activeStatus)
  const circumference = 2 * Math.PI * 52
  let offset = 0

  const openStatus = (status: CanonicalKeyStatus) => navigate(`/keys?status=${status}`)
  return <Box sx={{ overflow: 'hidden' }}><Box sx={{ position: 'relative', width: 160, height: 160, mx: 'auto', my: .5, overflow: 'hidden' }}><Box component="svg" viewBox="0 0 140 140" sx={{ width: '100%', height: '100%', transform: 'rotate(-90deg)', overflow: 'hidden' }}><circle cx="70" cy="70" r="52" fill="none" stroke="#edf1f7" strokeWidth="14" />{distribution.map((item) => { const length = total ? item.value / total * circumference : 0; const dashOffset = -offset; offset += length; const selected = activeStatus === item.status; return <circle key={item.status} cx="70" cy="70" r="52" fill="none" stroke={statusColors[item.status]} strokeWidth={selected ? 18 : 14} strokeLinecap="round" strokeDasharray={`${Math.max(0, length - 3)} ${circumference}`} strokeDashoffset={dashOffset} onMouseEnter={() => setActiveStatus(item.status)} onMouseLeave={() => setActiveStatus(null)} onClick={() => openStatus(item.status)} style={{ cursor: 'pointer', transition: 'stroke-width 180ms cubic-bezier(.16,1,.3,1), opacity 180ms ease', opacity: activeStatus && !selected ? .72 : 1 }} /> })}</Box><Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center', pointerEvents: 'none' }}><Typography sx={{ color: active ? statusColors[active.status] : 'text.primary', fontSize: active ? 15 : 29, fontWeight: 850, transition: 'all 180ms ease' }}>{active ? getStatusLabel(active.status) : total}</Typography><Typography sx={{ mt: .2, color: 'text.secondary', fontSize: 11.5 }}>{active ? `${active.value}개 · ${total ? Math.round(active.value / total * 100) : 0}%` : '전체 키'}</Typography></Box></Box><Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: .75 }}>{distribution.map(({ status, value }) => <Box key={status} role="link" tabIndex={0} onMouseEnter={() => setActiveStatus(status)} onMouseLeave={() => setActiveStatus(null)} onClick={() => openStatus(status)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openStatus(status) }} sx={{ display: 'flex', justifyContent: 'space-between', minWidth: 0, p: .75, borderRadius: 1, cursor: 'pointer', bgcolor: activeStatus === status ? alpha(statusColors[status], .1) : 'transparent', transition: 'background-color 180ms ease' }}><Stack direction="row" spacing={.7} sx={{ minWidth: 0, alignItems: 'center' }}><Box sx={{ width: 8, height: 8, flexShrink: 0, bgcolor: statusColors[status] }} /><Typography noWrap sx={{ fontSize: 12.5 }}>{getStatusLabel(status)}</Typography></Stack><Typography sx={{ ml: 1, fontSize: 12.5, fontWeight: 800 }}>{value}</Typography></Box>)}</Box></Box>
}

function Dashboard() {
  const { user } = useAuth(); const navigate = useNavigate()
  const [summary, setSummary] = useState<DashboardSummary | null>(null); const [keys, setKeys] = useState<CryptoKey[]>([]); const [trend, setTrend] = useState<DashboardTrend | null>(null); const [activities, setActivities] = useState<AuditLog[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [period, setPeriod] = useState<'DAY' | 'MONTH'>('DAY'); const [expiryDays] = useState(30); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => { const to = new Date(); const from = new Date(to); if (period === 'DAY') from.setDate(from.getDate() - 29); else from.setMonth(from.getMonth() - 11); void fetchDashboardTrend(formatDate(from), formatDate(to), period).then(setTrend).catch(() => setError('키 사용 추이를 불러오지 못했습니다.')) }, [period])
  useEffect(() => { setLoading(true); const requests: Promise<unknown>[] = [fetchDashboardSummary().then(setSummary), fetchKeys().then(setKeys), fetchNoticePage({ title: "", category: "ALL", exposeYn: "ALL", page: 0, size: 20 }).then((page) => setNotices(page.content))]; if (isAdminRole(user?.role)) requests.push(fetchAuditLogPage({ from: '', to: '', actor: '', action: 'ALL', page: 0, size: 20 }).then((page) => setActivities(page.content))); void Promise.all(requests).catch(() => setError('대시보드 실데이터를 불러오지 못했습니다.')).finally(() => setLoading(false)) }, [user?.role])
  const statusDistribution = useMemo(() => {
    const counts = keys.reduce<Record<CanonicalKeyStatus, number>>((result, key) => {
      const status = getCanonicalKeyStatus(key.status)
      result[status] += 1
      return result
    }, { CREATED: 0, ACTIVE: 0, DEACTIVATED: 0, COMPROMISED: 0, DESTROYED: 0 })
    return keyStatusOrder.map((status) => ({ status, value: counts[status] }))
  }, [keys])
  const expiringKeyCount = useMemo(() => {
    const now = Date.now()
    return keys.reduce((count, key) => {
      const days = Math.ceil((new Date(`${key.expireAt}T23:59:59`).getTime() - now) / 86_400_000)
      return count + Number(key.status !== 'DESTROYED' && days >= 0 && days <= expiryDays)
    }, 0)
  }, [keys, expiryDays])
  const summaryItems: SummaryCardProps[] = [
    { label: '전체 관리 키', value: String(summary?.totalKeys ?? 0), note: 'DB crypto_key 전체', color: '#d92f81', icon: <VpnKeyRounded />, href: '/keys?category=ALL' },
    { label: '암호화 가능', value: String(summary?.encryptCapableKeys ?? 0), note: '현재 정책상 암호화 허용', color: '#2e9b69', icon: <CheckCircleRounded />, href: '/keys?category=ENCRYPT_CAPABLE' },
    { label: '만료 임박 키', value: String(expiringKeyCount), note: `${expiryDays}일 이내 확인 필요`, color: '#e99220', icon: <AccessTimeRounded />, href: `/keys?category=EXPIRING&expiringWithinDays=${expiryDays}` },
    { label: '무결성 위반', value: String(summary?.integrityViolations ?? 0), note: summary?.integrityViolations ? '즉시 격리·조사 필요' : '검증 결과 정상', color: '#c93451', icon: <SecurityRounded />, href: '/keys?category=INTEGRITY_VIOLATION' },
  ]
  const dashboardPanelHeaderSx = { display: 'flex', minHeight: 48, flexShrink: 0, flexWrap: 'wrap', gap: 1, justifyContent: 'space-between', alignItems: 'center', px: 2.25, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }
  return <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5, overflow: 'hidden', minHeight: 0 }}>
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', gap: 1, flexShrink: 0, flexWrap: 'wrap' }}><Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>{isAdminRole(user?.role) && <Button variant="outlined" onClick={() => navigate("/keys")}>키 등록</Button>}<Button variant="outlined" onClick={() => navigate("/notices")}>게시글 등록</Button>{isAdminRole(user?.role) && <Button variant="contained" onClick={() => navigate("/users?create=1")}>사용자 등록</Button>}</Stack></Box>
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    {loading && <LinearProgress sx={{ mb: 2 }} />}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: `repeat(${summaryItems.length},minmax(0,1fr))` }, gap: 1.5, flexShrink: 0 }}>{summaryItems.map((item) => <SummaryCard key={item.label} {...item} />)}</Box>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1.6fr) minmax(0,1fr)' }, gap: 1.5, flex: '1.35 1 0', minHeight: 0 }}>
      <Card sx={{ minWidth: 0, minHeight: 0, overflow: 'auto' }}><CardContent sx={{ p: '12px 16px !important' }}><Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}><Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><Typography variant="h6">키 생성·사용 추이</Typography><Button size="small" endIcon={<ArrowForwardRounded />} onClick={() => navigate('/analytics')}>상세 통계</Button></Stack><ToggleButtonGroup exclusive size="small" value={period} onChange={(_e, value) => value && setPeriod(value)}><ToggleButton value="DAY">일</ToggleButton><ToggleButton value="MONTH">월</ToggleButton></ToggleButtonGroup></Box><InteractiveUsageChart trend={trend} compact /></CardContent></Card>
      <Card sx={{ minWidth: 0, minHeight: 0, overflow: 'auto' }}><CardContent sx={{ p: '12px 16px !important' }}><Typography variant="h6">전체 키 상태</Typography><KeyStatusChart distribution={statusDistribution} /></CardContent></Card>
    </Box>

    <Box sx={{ display: 'grid', gridTemplateColumns: isAdminRole(user?.role) ? 'minmax(0,.8fr) minmax(0,1.7fr)' : 'minmax(0,1fr)', gap: 1.5, flex: '1 1 0', minHeight: 0 }}>
      {isAdminRole(user?.role) && <Card sx={{ display: 'flex', minHeight: 0, minWidth: 0 }}><CardContent sx={{ p: '12px 16px !important', display: 'flex', flexDirection: 'column', minHeight: 0, width: '100%' }}><Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="h6">최근 활동</Typography><Button size="small" endIcon={<ArrowForwardRounded />} onClick={() => navigate('/audit-logs')}>전체보기</Button></Box><Box tabIndex={0} role="region" aria-label="최근 활동 목록" sx={{ mt: 1.25, mr: -1.5, pr: 1.5, overflowY: 'auto', minHeight: 0, flex: 1, overscrollBehavior: 'contain' }}>{activities.length === 0 && <Typography sx={{ color: 'text.secondary', py: 3 }}>기록된 활동이 없습니다.</Typography>}{activities.map((activity, index) => <Box key={activity.logUid}><Box sx={{ py: 1.15 }}><Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}><Typography sx={{ minWidth: 0, fontSize: 13.5, fontWeight: 800 }}>{auditActionLabels[activity.action]}</Typography><Typography sx={{ flexShrink: 0, fontSize: 11.5, color: 'text.secondary' }}>{formatKst(activity.createdAt)}</Typography></Stack><Typography title={activity.detail} noWrap sx={{ mt: .32, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11.75, color: 'text.secondary' }}>{truncateAuditDetail(activity.detail)} · {activity.actor}</Typography></Box>{index < activities.length - 1 && <Divider />}</Box>)}</Box></CardContent></Card>}
      <Card className="dashboard-panel" sx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}><Box sx={dashboardPanelHeaderSx}><Typography variant="h6">게시글</Typography><Button size="small" endIcon={<ArrowForwardRounded />} onClick={() => navigate('/notices')}>전체보기</Button></Box><TableContainer tabIndex={0} role="region" aria-label="게시글 목록" sx={{ minHeight: 0, flex: 1, overflow: 'auto', overscrollBehavior: 'contain' }}><Table stickyHeader size="small" sx={{ tableLayout: 'fixed', minWidth: 420, '& .MuiTableCell-root': { px: 2.25 } }}><TableHead><TableRow><TableCell>제목</TableCell><TableCell sx={{ width: 100 }}>작성자</TableCell><TableCell sx={{ width: 140 }}>등록일</TableCell></TableRow></TableHead><TableBody>{notices.length === 0 && <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4 }}>게시글이 없습니다.</TableCell></TableRow>}{notices.map((notice) => <TableRow key={notice.noticeUid} hover><TableCell><Button color="inherit" title={notice.title} sx={{ display: 'block', width: '100%', minWidth: 0, px: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isAdminRole(notice.authorRole) ? 800 : 400, textAlign: 'left' }} onClick={() => navigate(`/notices/${notice.noticeUid}`)}>{notice.title}</Button></TableCell><TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={notice.createdBy}>{notice.createdBy}</TableCell><TableCell sx={{ whiteSpace: 'nowrap' }}>{formatKst(notice.createdAt)}</TableCell></TableRow>)}</TableBody></Table></TableContainer></Card>
    </Box>
  </Box>
}
export default Dashboard
