import { useKeySettings } from '../stores/keySettings'
import { ResizableTable as Table } from '../components/admin/ResizableTable'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AccessTimeRounded, ArrowForwardRounded, PeopleRounded, CampaignRounded, SecurityRounded, VpnKeyRounded } from '@mui/icons-material'
import { Alert, Avatar, Box, Button, Card, CardContent, Divider, LinearProgress, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import { fetchAuditLogPage, fetchDashboardExpiring, fetchDashboardSummary, fetchDashboardTrend, fetchKeys, fetchNoticePage } from '../api/kms'
import { InteractiveUsageChart } from '../components/dashboard/InteractiveUsageChart'
import { useAuth } from '../hooks/useAuth'
import type { AuditLog, CryptoKey, DashboardExpiringKey, DashboardSummary, DashboardTrend, Notice } from '../types/api'
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

function formatDate(date: Date) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) }
function formatKst(value: string) { return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) }

function KeyStatusChart({ distribution }: { distribution: Array<{ status: CanonicalKeyStatus; value: number }> }) {
  const navigate = useNavigate()
  const total = distribution.reduce((sum, item) => sum + item.value, 0)
  const [activeStatus, setActiveStatus] = useState<CanonicalKeyStatus | null>(null)
  const active = distribution.find((item) => item.status === activeStatus)
  const circumference = 2 * Math.PI * 52
  let offset = 0

  const openStatus = (status: CanonicalKeyStatus) => navigate(`/keys?status=${status}`)
  return <Box className="dashboard-status-chart" sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'stretch', gap: .5, flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
    <Box sx={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, containerType: 'size' }}>
      <Box component="svg" viewBox="0 0 140 140" sx={{ display: 'block', width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r="52" fill="none" stroke="#edf1f7" strokeWidth="14" />
        {distribution.map((item) => {
          const length = total ? item.value / total * circumference : 0
          const dashOffset = -offset
          offset += length
          const selected = activeStatus === item.status
          return <circle key={item.status} cx="70" cy="70" r="52" fill="none" stroke={statusColors[item.status]} strokeWidth={selected ? 18 : 14} strokeLinecap="round" strokeDasharray={`${Math.max(0, length - 3)} ${circumference}`} strokeDashoffset={dashOffset} onMouseEnter={() => setActiveStatus(item.status)} onMouseLeave={() => setActiveStatus(null)} onClick={() => openStatus(item.status)} style={{ cursor: 'pointer', transition: 'stroke-width 180ms cubic-bezier(.16,1,.3,1), opacity 180ms ease', opacity: activeStatus && !selected ? .72 : 1 }} />
        })}
      </Box>
      <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
        <Typography sx={{ color: active ? statusColors[active.status] : 'text.primary', fontSize: active ? 'min(15px, 13cqmin)' : 'min(29px, 22cqmin)', fontWeight: 850 }}>{active ? getStatusLabel(active.status) : total}</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 'min(11.5px, 10cqmin)' }}>{active ? `${active.value}개 · ${total ? Math.round(active.value / total * 100) : 0}%` : '전체 키'}</Typography>
      </Box>
    </Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', alignContent: 'center', gap: .25, flexShrink: 0, width: { xs: '100%', sm: '45%' } }}>
      {distribution.map(({ status, value }) => <Box key={status} role="link" tabIndex={0} onFocus={() => setActiveStatus(status)} onBlur={() => setActiveStatus(null)} onMouseEnter={() => setActiveStatus(status)} onMouseLeave={() => setActiveStatus(null)} onClick={() => openStatus(status)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openStatus(status) } }} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: .5, minWidth: 0, px: .5, py: .25, borderRadius: 1, cursor: 'pointer', bgcolor: activeStatus === status ? alpha(statusColors[status], .1) : 'transparent', transition: 'background-color 180ms ease' }}>
        <Stack direction="row" spacing={.5} sx={{ minWidth: 0, alignItems: 'center' }}><Box sx={{ width: 6, height: 6, flexShrink: 0, bgcolor: statusColors[status] }} /><Typography noWrap sx={{ fontSize: { xs: 10, sm: 12 } }}>{getStatusLabel(status)}</Typography></Stack>
        <Typography sx={{ fontSize: { xs: 10, sm: 12 }, fontWeight: 800 }}>{value}</Typography>
      </Box>)}
    </Box>
  </Box>
}

function Dashboard() {
  const { policy: keyPolicy } = useKeySettings()
  const expiryDays = keyPolicy?.expiryWarningDays ?? 30
  const { user } = useAuth(); const navigate = useNavigate()
  const [summary, setSummary] = useState<DashboardSummary | null>(null); const [keys, setKeys] = useState<CryptoKey[]>([]); const [trend, setTrend] = useState<DashboardTrend | null>(null); const [activities, setActivities] = useState<AuditLog[]>([])
  const [expiringKeys, setExpiringKeys] = useState<DashboardExpiringKey[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [period, setPeriod] = useState<'DAY' | 'MONTH'>('DAY'); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => { const to = new Date(); const from = new Date(to); if (period === 'DAY') from.setDate(from.getDate() - 29); else from.setMonth(from.getMonth() - 11); void fetchDashboardTrend(formatDate(from), formatDate(to), period).then(setTrend).catch(() => setError('키 사용 추이를 불러오지 못했습니다.')) }, [period])
  useEffect(() => { setLoading(true); const requests: Promise<unknown>[] = [fetchDashboardSummary().then(setSummary), fetchDashboardExpiring().then(setExpiringKeys), fetchKeys().then(setKeys), fetchNoticePage({ title: "", category: "ALL", exposeYn: "ALL", page: 0, size: 20 }).then((page) => setNotices(page.content))]; if (isAdminRole(user?.role)) requests.push(fetchAuditLogPage({ from: '', to: '', actor: '', action: 'ALL', page: 0, size: 20 }).then((page) => setActivities(page.content))); void Promise.all(requests).catch(() => setError('대시보드 실데이터를 불러오지 못했습니다.')).finally(() => setLoading(false)) }, [user?.role, expiryDays])
  const statusDistribution = useMemo(() => {
    const counts = keys.reduce<Record<CanonicalKeyStatus, number>>((result, key) => {
      const status = getCanonicalKeyStatus(key.status)
      result[status] += 1
      return result
    }, { CREATED: 0, ACTIVE: 0, DEACTIVATED: 0, COMPROMISED: 0, DESTROYED: 0 })
    return keyStatusOrder.map((status) => ({ status, value: counts[status] }))
  }, [keys])
  const summaryItems: SummaryCardProps[] = [
    { label: '전체 관리 키', value: String(summary?.totalKeys ?? 0), note: 'DB crypto_key 전체', color: '#d92f81', icon: <VpnKeyRounded />, href: '/keys?category=ALL' },
    { label: '서비스 사용자', value: String(summary?.totalUsers ?? 0), note: '등록된 서비스 사용자 수', color: '#2e9b69', icon: <PeopleRounded />, href: '/users' },
    { label: '전체 게시글', value: String(summary?.totalNotices ?? 0), note: '공지·일반 게시글 수', color: '#e99220', icon: <CampaignRounded />, href: '/notices' },
    { label: '무결성 위반', value: String(summary?.integrityViolations ?? 0), note: `키 ${summary?.keyIntegrityViolations ?? 0} · 사용자 ${summary?.userIntegrityViolations ?? 0} · 감사 ${summary?.auditIntegrityViolations ?? 0}`, color: '#c93451', icon: <SecurityRounded />, href: '/audit-logs' },
  ]
  const dashboardPanelHeaderSx = { display: 'flex', minHeight: 48, flexShrink: 0, flexWrap: 'wrap', gap: 1, justifyContent: 'space-between', alignItems: 'center', px: 2.25, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }
  return <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5, overflow: 'hidden', minHeight: 0 }}>
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', gap: 1, flexShrink: 0, flexWrap: 'wrap' }}><Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>{isAdminRole(user?.role) && <Button variant="outlined" onClick={() => navigate("/keys")}>키 등록</Button>}<Button variant="outlined" onClick={() => navigate("/notices")}>게시글 등록</Button>{isAdminRole(user?.role) && <Button variant="contained" onClick={() => navigate("/users?create=1")}>사용자 등록</Button>}</Stack></Box>
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    {loading && <LinearProgress sx={{ mb: 2 }} />}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: `repeat(${summaryItems.length},minmax(0,1fr))` }, gap: 1.5, flexShrink: 0 }}>{summaryItems.map((item) => <SummaryCard key={item.label} {...item} />)}</Box>

    <Card sx={{ flexShrink: 0 }}><CardContent sx={{ p: '8px 16px !important' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><AccessTimeRounded color="warning" /><Typography variant="h6">만료 임박 키 ({summary?.expiringKeys ?? 0})</Typography><Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{expiryDays}일 이내 · ACTIVE</Typography></Stack>
        <Button size="small" onClick={() => navigate(`/keys?status=ACTIVE&category=EXPIRING&expiringWithinDays=${expiryDays}`)}>전체보기</Button>
      </Stack>
      <Box role="region" aria-label="만료 임박 키 목록" sx={{ display: 'flex', gap: 1, overflowX: 'auto', minHeight: 32, alignItems: 'center' }}>
        {expiringKeys.length === 0 ? <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>만료 임박 키가 없습니다.</Typography> : expiringKeys.map((key) => <Button key={key.keyUid} size="small" sx={{ flexShrink: 0 }} onClick={() => navigate(`/keys/${key.keyUid}`)}>{key.keyName} · {key.expireAt}</Button>)}
      </Box>
    </CardContent></Card>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1.6fr) minmax(0,1fr)' }, gap: 1.5, flex: '1.8 1 0', minHeight: { xs: 240, sm: 180 } }}>
      <Card className="dashboard-trend-panel" sx={{ minWidth: 0, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <CardContent sx={{ p: '10px 12px !important', flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .5, justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, mb: .5 }}>
            <Stack direction="row" useFlexGap spacing={.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}><Typography variant="h6" sx={{ fontSize: { xs: 13, sm: 16 } }}>키 생성·사용 추이</Typography><Button size="small" sx={{ minWidth: 0, px: .5, '& .MuiButton-endIcon': { display: { xs: 'none', sm: 'inline-flex' } } }} endIcon={<ArrowForwardRounded />} onClick={() => navigate('/analytics')}>상세 통계</Button></Stack>
            <ToggleButtonGroup exclusive size="small" value={period} onChange={(_e, value) => value && setPeriod(value)}><ToggleButton value="DAY">일</ToggleButton><ToggleButton value="MONTH">월</ToggleButton></ToggleButtonGroup>
          </Box>
          <Box role="region" aria-label="키 생성·사용 추이 차트" sx={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}><InteractiveUsageChart trend={trend} compact fillContainer /></Box>
        </CardContent>
      </Card>
      <Card className="dashboard-status-panel" sx={{ minWidth: 0, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <CardContent sx={{ p: '10px 12px !important', flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}><Typography variant="h6" sx={{ flexShrink: 0, fontSize: { xs: 13, sm: 16 } }}>전체 키 상태</Typography><KeyStatusChart distribution={statusDistribution} /></CardContent>
      </Card>
    </Box>

    <Box sx={{ display: 'grid', gridTemplateColumns: isAdminRole(user?.role) ? 'minmax(0,.8fr) minmax(0,1.7fr)' : 'minmax(0,1fr)', gap: 1.5, flex: '1 1 0', minHeight: 0 }}>
      {isAdminRole(user?.role) && <Card sx={{ display: 'flex', minHeight: 0, minWidth: 0 }}><CardContent sx={{ p: '12px 16px !important', display: 'flex', flexDirection: 'column', minHeight: 0, width: '100%' }}><Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="h6">최근 활동</Typography><Button size="small" endIcon={<ArrowForwardRounded />} onClick={() => navigate('/audit-logs')}>전체보기</Button></Box><Box tabIndex={0} role="region" aria-label="최근 활동 목록" sx={{ mt: 1.25, mr: -1.5, pr: 1.5, overflowY: 'auto', minHeight: 0, flex: 1, overscrollBehavior: 'contain' }}>{activities.length === 0 && <Typography sx={{ color: 'text.secondary', py: 3 }}>기록된 활동이 없습니다.</Typography>}{activities.map((activity, index) => <Box key={activity.logUid}><Box sx={{ py: 1.15 }}><Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}><Typography sx={{ minWidth: 0, fontSize: 13.5, fontWeight: 800 }}>{auditActionLabels[activity.action]}</Typography><Typography sx={{ flexShrink: 0, fontSize: 11.5, color: 'text.secondary' }}>{formatKst(activity.createdAt)}</Typography></Stack><Typography title={activity.detail} noWrap sx={{ mt: .32, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11.75, color: 'text.secondary' }}>{truncateAuditDetail(activity.detail)} · {activity.actor}</Typography></Box>{index < activities.length - 1 && <Divider />}</Box>)}</Box></CardContent></Card>}
      <Card className="dashboard-panel" sx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}><Box sx={dashboardPanelHeaderSx}><Typography variant="h6">게시글</Typography><Button size="small" endIcon={<ArrowForwardRounded />} onClick={() => navigate('/notices')}>전체보기</Button></Box><TableContainer tabIndex={0} role="region" aria-label="게시글 목록" sx={{ minHeight: 0, flex: 1, overflow: 'auto', overscrollBehavior: 'contain' }}><Table stickyHeader size="small" sx={{ tableLayout: 'fixed', minWidth: 420, '& .MuiTableCell-root': { px: 2.25 } }}><TableHead><TableRow><TableCell>제목</TableCell><TableCell sx={{ width: 100 }}>작성자</TableCell><TableCell sx={{ width: 140 }}>등록일</TableCell></TableRow></TableHead><TableBody>{notices.length === 0 && <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4 }}>게시글이 없습니다.</TableCell></TableRow>}{notices.map((notice) => <TableRow key={notice.noticeUid} hover><TableCell><Button color="inherit" title={notice.title} sx={{ display: 'block', width: '100%', minWidth: 0, px: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isAdminRole(notice.authorRole) ? 800 : 400, textAlign: 'left' }} onClick={() => navigate(`/notices/${notice.noticeUid}`)}>{notice.title}</Button></TableCell><TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={notice.createdBy}>{notice.createdBy}</TableCell><TableCell sx={{ whiteSpace: 'nowrap' }}>{formatKst(notice.createdAt)}</TableCell></TableRow>)}</TableBody></Table></TableContainer></Card>
    </Box>
  </Box>
}
export default Dashboard
