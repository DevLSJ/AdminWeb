import { ResizableTable as Table } from '../components/admin/ResizableTable'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AccessTimeRounded, ArrowForwardRounded, CheckCircleRounded, SecurityRounded, ShieldRounded, VpnKeyRounded } from '@mui/icons-material'
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
        minHeight: 142,
        overflow: 'hidden',
        cursor: 'pointer',
        '&::after': {
          position: 'absolute',
          right: -24,
          bottom: -35,
          width: 90,
          height: 90,
          borderRadius: '50%',
          bgcolor: alpha(color, .085),
          content: '""',
        },
      }}
    >
      <CardContent sx={{ position: 'relative', zIndex: 1, p: '18px !important' }}>
        <Typography sx={{ color: 'text.secondary', fontSize: 12, fontWeight: 750 }}>{label}</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mt: .7 }}>
          <Typography sx={{ fontSize: 29, fontWeight: 850, lineHeight: 1.05, letterSpacing: '-.04em' }}>{value}</Typography>
          <Avatar className="dashboard-card-icon" variant="rounded" sx={{ width: 40, height: 40, borderRadius: 2.5, bgcolor: alpha(color, 0.12), color }}>{icon}</Avatar>
        </Box>
        <Typography sx={{ mt: 1.75, color: 'text.secondary', fontSize: 11 }}>{note}</Typography>
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
  return <Box sx={{ overflow: 'hidden' }}><Box sx={{ position: 'relative', width: 178, height: 178, mx: 'auto', my: 1.5, overflow: 'hidden' }}><Box component="svg" viewBox="0 0 140 140" sx={{ width: '100%', height: '100%', transform: 'rotate(-90deg)', overflow: 'hidden' }}><circle cx="70" cy="70" r="52" fill="none" stroke="#edf1f7" strokeWidth="14" />{distribution.map((item) => { const length = total ? item.value / total * circumference : 0; const dashOffset = -offset; offset += length; const selected = activeStatus === item.status; return <circle key={item.status} cx="70" cy="70" r="52" fill="none" stroke={statusColors[item.status]} strokeWidth={selected ? 18 : 14} strokeLinecap="round" strokeDasharray={`${Math.max(0, length - 3)} ${circumference}`} strokeDashoffset={dashOffset} onMouseEnter={() => setActiveStatus(item.status)} onMouseLeave={() => setActiveStatus(null)} onClick={() => openStatus(item.status)} style={{ cursor: 'pointer', transition: 'stroke-width 180ms cubic-bezier(.16,1,.3,1), opacity 180ms ease', opacity: activeStatus && !selected ? .72 : 1 }} /> })}</Box><Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center', pointerEvents: 'none' }}><Typography sx={{ color: active ? statusColors[active.status] : 'text.primary', fontSize: active ? 15 : 29, fontWeight: 850, transition: 'all 180ms ease' }}>{active ? getStatusLabel(active.status) : total}</Typography><Typography sx={{ mt: .2, color: 'text.secondary', fontSize: 11.5 }}>{active ? `${active.value}개 · ${total ? Math.round(active.value / total * 100) : 0}%` : '전체 키'}</Typography></Box></Box><Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: .75 }}>{distribution.map(({ status, value }) => <Box key={status} role="link" tabIndex={0} onMouseEnter={() => setActiveStatus(status)} onMouseLeave={() => setActiveStatus(null)} onClick={() => openStatus(status)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openStatus(status) }} sx={{ display: 'flex', justifyContent: 'space-between', minWidth: 0, p: .75, borderRadius: 1, cursor: 'pointer', bgcolor: activeStatus === status ? alpha(statusColors[status], .1) : 'transparent', transition: 'background-color 180ms ease' }}><Stack direction="row" spacing={.7} sx={{ minWidth: 0, alignItems: 'center' }}><Box sx={{ width: 8, height: 8, flexShrink: 0, bgcolor: statusColors[status] }} /><Typography noWrap sx={{ fontSize: 12.5 }}>{getStatusLabel(status)}</Typography></Stack><Typography sx={{ ml: 1, fontSize: 12.5, fontWeight: 800 }}>{value}</Typography></Box>)}</Box></Box>
}

function Dashboard() {
  const { user } = useAuth(); const navigate = useNavigate()
  const [summary, setSummary] = useState<DashboardSummary | null>(null); const [keys, setKeys] = useState<CryptoKey[]>([]); const [trend, setTrend] = useState<DashboardTrend | null>(null); const [activities, setActivities] = useState<AuditLog[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [period, setPeriod] = useState<'DAY' | 'MONTH'>('DAY'); const [expiryDays] = useState(30); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => { const to = new Date(); const from = new Date(to); if (period === 'DAY') from.setDate(from.getDate() - 29); else from.setMonth(from.getMonth() - 11); void fetchDashboardTrend(formatDate(from), formatDate(to), period).then(setTrend).catch(() => setError('키 사용 추이를 불러오지 못했습니다.')) }, [period])
  useEffect(() => { setLoading(true); const requests: Promise<unknown>[] = [fetchDashboardSummary().then(setSummary), fetchKeys().then(setKeys), fetchNoticePage({ title: "", category: "ALL", exposeYn: "ALL", page: 0, size: 5 }).then((page) => setNotices(page.content))]; if (isAdminRole(user?.role)) requests.push(fetchAuditLogPage({ from: '', to: '', actor: '', action: 'ALL', page: 0, size: 5 }).then((page) => setActivities(page.content))); void Promise.all(requests).catch(() => setError('대시보드 실데이터를 불러오지 못했습니다.')).finally(() => setLoading(false)) }, [user?.role])
  const statusDistribution = useMemo(() => {
    const counts = keys.reduce<Record<CanonicalKeyStatus, number>>((result, key) => {
      const status = getCanonicalKeyStatus(key.status)
      result[status] += 1
      return result
    }, { CREATED: 0, ACTIVE: 0, DEACTIVATED: 0, COMPROMISED: 0, DESTROYED: 0 })
    return keyStatusOrder.map((status) => ({ status, value: counts[status] }))
  }, [keys])
  const expiringKeys = useMemo(() => keys.map((key) => ({ ...key, days: Math.ceil((new Date(`${key.expireAt}T23:59:59`).getTime() - Date.now()) / 86_400_000) })).filter((key) => key.status !== 'DESTROYED' && key.days >= 0 && key.days <= expiryDays).sort((a, b) => a.days - b.days), [keys, expiryDays])
  const summaryItems: SummaryCardProps[] = [
    { label: '전체 관리 키', value: String(summary?.totalKeys ?? 0), note: 'DB crypto_key 전체', color: '#d92f81', icon: <VpnKeyRounded />, href: '/keys?category=ALL' },
    { label: '암호화 가능', value: String(summary?.encryptCapableKeys ?? 0), note: '현재 정책상 암호화 허용', color: '#2e9b69', icon: <CheckCircleRounded />, href: '/keys?category=ENCRYPT_CAPABLE' },
    { label: '복호화 가능', value: String(summary?.decryptCapableKeys ?? 0), note: '현재 정책상 복호화 허용', color: '#7652b8', icon: <ShieldRounded />, href: '/keys?category=DECRYPT_CAPABLE' },
    { label: '만료 임박 키', value: String(expiringKeys.length), note: `${expiryDays}일 이내 확인 필요`, color: '#e99220', icon: <AccessTimeRounded />, href: `/keys?category=EXPIRING&expiringWithinDays=${expiryDays}` },
    { label: '무결성 위반', value: String(summary?.integrityViolations ?? 0), note: summary?.integrityViolations ? '즉시 격리·조사 필요' : '검증 결과 정상', color: '#c93451', icon: <SecurityRounded />, href: '/keys?category=INTEGRITY_VIOLATION' },
  ]
  const dashboardPanelHeaderSx = { display: 'flex', minHeight: 58, flexWrap: 'wrap', gap: 1, justifyContent: 'space-between', alignItems: 'center', px: 2.25, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }
  return <Box>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 2.5 }}><Box><Typography variant="h5">대시보드</Typography><Typography sx={{ mt: .5, color: 'text.secondary', fontSize: 12.5 }}>D&apos;Guard KMS 운영 현황과 조치가 필요한 항목을 한 화면에서 확인합니다.</Typography></Box><Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>{isAdminRole(user?.role) && <Button variant="outlined" onClick={() => navigate("/keys")}>키 등록</Button>}<Button variant="outlined" onClick={() => navigate("/notices")}>게시글 등록</Button>{isAdminRole(user?.role) && <Button variant="contained" onClick={() => navigate("/users?create=1")}>사용자 등록</Button>}</Stack></Box>
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    {loading && <LinearProgress sx={{ mb: 2 }} />}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', lg: 'repeat(3,1fr)', xl: `repeat(${summaryItems.length},1fr)` }, gap: 1.75 }}>{summaryItems.map((item) => <SummaryCard key={item.label} {...item} />)}</Box>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,2fr) minmax(300px,.8fr)' }, gap: 2, mt: 2 }}>
      <Card sx={{ minWidth: 0, overflow: 'hidden' }}><CardContent><Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}><Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><Typography variant="h6">키 생성·사용 추이</Typography><Button size="small" endIcon={<ArrowForwardRounded />} onClick={() => navigate('/analytics')}>상세 통계</Button></Stack><ToggleButtonGroup exclusive size="small" value={period} onChange={(_e, value) => value && setPeriod(value)}><ToggleButton value="DAY">일</ToggleButton><ToggleButton value="MONTH">월</ToggleButton></ToggleButtonGroup></Box><InteractiveUsageChart trend={trend} /></CardContent></Card>
      <Card sx={{ minWidth: 0, overflow: 'hidden' }}><CardContent><Typography variant="h6">전체 키 상태</Typography><KeyStatusChart distribution={statusDistribution} /></CardContent></Card>
    </Box>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: isAdminRole(user?.role) ? 'minmax(320px,.8fr) minmax(0,1.7fr)' : '1fr' }, gap: 2, mt: 2 }}>
      {isAdminRole(user?.role) && <Card><CardContent><Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="h6">최근 활동</Typography><Button size="small" endIcon={<ArrowForwardRounded />} onClick={() => navigate('/audit-logs')}>전체보기</Button></Box><Box sx={{ mt: 1.25 }}>{activities.length === 0 && <Typography sx={{ color: 'text.secondary', py: 3 }}>기록된 활동이 없습니다.</Typography>}{activities.map((activity, index) => <Box key={activity.logUid}><Box sx={{ py: 1.15 }}><Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}><Typography sx={{ minWidth: 0, fontSize: 13.5, fontWeight: 800 }}>{auditActionLabels[activity.action]}</Typography><Typography sx={{ flexShrink: 0, fontSize: 11.5, color: 'text.secondary' }}>{formatKst(activity.createdAt)}</Typography></Stack><Typography title={activity.detail} noWrap sx={{ mt: .32, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11.75, color: 'text.secondary' }}>{truncateAuditDetail(activity.detail)} · {activity.actor}</Typography></Box>{index < activities.length - 1 && <Divider />}</Box>)}</Box></CardContent></Card>}
      <Card className="dashboard-panel" sx={{ overflow: 'hidden' }}><Box sx={dashboardPanelHeaderSx}><Typography variant="h6">게시글 목록</Typography><Button size="small" endIcon={<ArrowForwardRounded />} onClick={() => navigate('/notices')}>전체보기</Button></Box><TableContainer><Table size="small"><TableHead><TableRow><TableCell>제목</TableCell><TableCell>작성자</TableCell><TableCell>등록일</TableCell></TableRow></TableHead><TableBody>{notices.length === 0 && <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4 }}>게시글이 없습니다.</TableCell></TableRow>}{notices.map((notice) => <TableRow key={notice.noticeUid} hover><TableCell><Button color="inherit" sx={{ fontWeight: isAdminRole(notice.authorRole) ? 800 : 400, textAlign: 'left' }} onClick={() => navigate(`/notices/${notice.noticeUid}`)}>{notice.title}</Button></TableCell><TableCell>{notice.createdBy}</TableCell><TableCell>{formatKst(notice.createdAt)}</TableCell></TableRow>)}</TableBody></Table></TableContainer></Card>
    </Box>
  </Box>
}
export default Dashboard
