import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import {
  AccessTimeRounded,
  ArrowForwardRounded,
  BarChartRounded,
  CheckCircleRounded,
  DescriptionRounded,
  DragIndicatorRounded,
  ErrorOutlineRounded,
  KeyRounded,
  LockOpenRounded,
  PeopleAltRounded,
  SecurityRounded,
  ScienceRounded,
  ShowChartRounded,
  TrendingUpRounded,
  VpnKeyRounded,
} from '@mui/icons-material'
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import { StatusBadge } from '../components/common/StatusBadge'
import { useAuth } from '../hooks/useAuth'
import { isAdminRole } from '../types/auth'

const dashboardMockData = {
  summary: [
    {
      label: '전체 관리 키',
      value: '82',
      note: '지난달 대비 8개 증가',
      color: '#d92f81',
      icon: <VpnKeyRounded />,
    },
    {
      label: '활성 키',
      value: '64',
      note: '전체 키의 78%',
      color: '#7652b8',
      icon: <CheckCircleRounded />,
    },
    {
      label: '등록 사용자',
      value: '1,248',
      note: '이번 달 42명 증가',
      color: '#32b7d8',
      icon: <PeopleAltRounded />,
    },
    {
      label: '만료 임박 키',
      value: '4',
      note: '30일 이내 ACTIVE 키',
      color: '#ef7c45',
      icon: <AccessTimeRounded />,
    },
    {
      label: '무결성 위반',
      value: '0',
      note: '모든 데이터 정상',
      color: '#f5a623',
      icon: <SecurityRounded />,
    },
  ],
  operationCards: [
    {
      label: '이번 달 암호화',
      value: '12,840',
      detail: '성공률 99.98%',
      gradient: 'linear-gradient(135deg, #e73786 0%, #b83ca4 100%)',
      icon: <KeyRounded />,
    },
    {
      label: '이번 달 복호화',
      value: '9,432',
      detail: '성공률 99.96%',
      gradient: 'linear-gradient(135deg, #7652b8 0%, #5149a8 100%)',
      icon: <LockOpenRounded />,
    },
  ],
  activities: [
    { title: '키 상태 변경', detail: 'PAYMENT-AES-001 키 활성화', time: '8분 전', color: '#d92f81' },
    { title: '신규 키 등록', detail: 'AUTH-HMAC-004 키 생성', time: '35분 전', color: '#7652b8' },
    { title: '사용자 원문 조회', detail: '관리자 권한으로 사용자 정보 조회', time: '1시간 전', color: '#32b7d8' },
    { title: '공지사항 게시', detail: '시스템 정기 점검 안내', time: '3시간 전', color: '#f5a623' },
  ],
  expiringKeys: [
    { uid: 'DGK-9A12F0', name: 'PAYMENT-AES-001', algorithm: 'AES-256', expires: '2026-08-24', days: 5 },
    { uid: 'DGK-20B11C', name: 'MEMBER-AES-003', algorithm: 'AES-256', expires: '2026-08-28', days: 9 },
    { uid: 'DGK-774CE1', name: 'AUTH-HMAC-004', algorithm: 'HMAC-256', expires: '2026-09-02', days: 14 },
    { uid: 'DGK-A1204B', name: 'NOTICE-AES-002', algorithm: 'AES-256', expires: '2026-09-08', days: 20 },
  ],
}

interface SummaryCardProps {
  label: string
  value: string
  note: string
  color: string
  icon: ReactNode
}

function SummaryCard({ label, value, note, color, icon }: SummaryCardProps) {
  return (
    <Card className="dashboard-card" sx={{ height: '100%' }}>
      <CardContent sx={{ p: '20px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.5, fontWeight: 700 }}>
              {label}
            </Typography>
            <Typography className="stat-card-value" sx={{ mt: 0.65, fontSize: 31, fontWeight: 800, letterSpacing: '-0.04em' }}>
              {value}
            </Typography>
          </Box>
          <Avatar className="dashboard-card-icon" sx={{ width: 48, height: 48, bgcolor: alpha(color, 0.12), color }}>
            {icon}
          </Avatar>
        </Box>
        <Typography sx={{ mt: 1.8, color: 'text.secondary', fontSize: 13.5, lineHeight: 1.55 }}>
          {note}
        </Typography>
      </CardContent>
    </Card>
  )
}

type UsageChartMode = 'line' | 'bar'
type UsageGranularity = 'daily' | 'monthly'

interface DailyKeyStatus {
  date: string
  ready: number
  active: number
  inactive: number
  expired: number
}

interface KeyStatusChartPoint extends DailyKeyStatus {
  axisLabel: string
  detailLabel: string
  sampleDays: number
}

const DAY_WIDTH = 42
const CHART_HEIGHT = 270
const PLOT_TOP = 78
const PLOT_BOTTOM = 224
const CHART_LEFT = 24
const statusSeries = [
  { key: 'ready', label: '준비', color: '#7652b8' },
  { key: 'active', label: '활성', color: '#d92f81' },
  { key: 'inactive', label: '비활성', color: '#f5a623' },
  { key: 'expired', label: '만료', color: '#aeb5c4' },
] as const

function createDailyKeyStatusData(startDate: string, endDate: string): DailyKeyStatus[] {
  const current = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  const result: DailyKeyStatus[] = []
  let index = 0

  while (current <= end) {
    result.push({
      date: current.toISOString().slice(0, 10),
      ready: 5 + ((index * 3) % 7),
      active: 54 + Math.floor(index / 7) + Math.round(Math.sin(index * 0.48) * 2),
      inactive: 4 + (index % 4),
      expired: 1 + Math.floor(index / 18) + (index % 13 === 0 ? 1 : 0),
    })
    current.setUTCDate(current.getUTCDate() + 1)
    index += 1
  }

  return result
}

const dailyKeyStatusData = createDailyKeyStatusData('2026-07-01', '2026-08-24')

function createChartData(granularity: UsageGranularity): KeyStatusChartPoint[] {
  if (granularity === 'daily') {
    return dailyKeyStatusData.map((point) => ({
      ...point,
      axisLabel: point.date.slice(5).replace('-', '/'),
      detailLabel: point.date,
      sampleDays: 1,
    }))
  }

  const monthly = new Map<string, { ready: number; active: number; inactive: number; expired: number; sampleDays: number }>()
  dailyKeyStatusData.forEach((point) => {
    const month = point.date.slice(0, 7)
    const current = monthly.get(month) ?? { ready: 0, active: 0, inactive: 0, expired: 0, sampleDays: 0 }
    current.ready += point.ready
    current.active += point.active
    current.inactive += point.inactive
    current.expired += point.expired
    current.sampleDays += 1
    monthly.set(month, current)
  })

  return Array.from(monthly.entries()).map(([month, totals]) => ({
    date: `${month}-01`,
    axisLabel: `${Number(month.slice(5))}월`,
    detailLabel: `${month.replace('-', '년 ')}월 · 일평균`,
    sampleDays: totals.sampleDays,
    ready: Math.round(totals.ready / totals.sampleDays),
    active: Math.round(totals.active / totals.sampleDays),
    inactive: Math.round(totals.inactive / totals.sampleDays),
    expired: Math.round(totals.expired / totals.sampleDays),
  }))
}

function getDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

function resolveStandardDateSnapshot(serverNow: Date) {
  const standardDate = getDateKey(serverNow)
  return [...dailyKeyStatusData].reverse().find((point) => point.date <= standardDate) ?? dailyKeyStatusData[0]
}

function getStatusTotal(point: DailyKeyStatus) {
  return point.ready + point.active + point.inactive + point.expired
}

function buildSmoothLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return ''
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index]
    const midpoint = (previous.x + point.x) / 2
    return `${path} C ${midpoint} ${previous.y}, ${midpoint} ${point.y}, ${point.x} ${point.y}`
  }, `M ${points[0].x} ${points[0].y}`)
}

function UsageChart({ granularity }: { granularity: UsageGranularity }) {
  const [mode, setMode] = useState<UsageChartMode>('line')
  const chartData = useMemo(() => createChartData(granularity), [granularity])
  const [activeIndex, setActiveIndex] = useState(chartData.length - 1)
  const [dragging, setDragging] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragState = useRef({ active: false, startX: 0, scrollLeft: 0 })
  const unitWidth = granularity === 'daily' ? DAY_WIDTH : 280
  const chartWidth = CHART_LEFT * 2 + chartData.length * unitWidth
  const safeActiveIndex = Math.min(activeIndex, chartData.length - 1)
  const maxTotal = useMemo(() => Math.ceil(Math.max(...chartData.map(getStatusTotal)) / 10) * 10, [chartData])
  const selected = chartData[safeActiveIndex]
  const linePoints = useMemo(() => chartData.map((point, index) => ({
    x: CHART_LEFT + index * unitWidth + unitWidth / 2,
    y: PLOT_BOTTOM - (getStatusTotal(point) / maxTotal) * (PLOT_BOTTOM - PLOT_TOP),
  })), [chartData, maxTotal, unitWidth])
  const linePath = useMemo(() => buildSmoothLinePath(linePoints), [linePoints])
  const areaPath = `${linePath} L ${linePoints.at(-1)?.x ?? 0} ${PLOT_BOTTOM} L ${linePoints[0]?.x ?? 0} ${PLOT_BOTTOM} Z`

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    setActiveIndex(chartData.length - 1)
    const frame = requestAnimationFrame(() => {
      viewport.scrollTo({ left: viewport.scrollWidth, behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
  }, [chartData])

  const indexFromPointer = (clientX: number) => {
    const viewport = viewportRef.current
    if (!viewport) return activeIndex
    const renderedToViewBoxScale = chartWidth / viewport.scrollWidth
    const localX = (clientX - viewport.getBoundingClientRect().left + viewport.scrollLeft) * renderedToViewBoxScale - CHART_LEFT
    return Math.max(0, Math.min(chartData.length - 1, Math.floor(localX / unitWidth)))
  }

  const focusDate = (index: number) => {
    const nextIndex = Math.max(0, Math.min(chartData.length - 1, index))
    setActiveIndex(nextIndex)
    const viewport = viewportRef.current
    if (!viewport) return
    const targetX = CHART_LEFT + nextIndex * unitWidth + unitWidth / 2
    const viewBoxToRenderedScale = viewport.scrollWidth / chartWidth
    viewport.scrollTo({ left: targetX * viewBoxToRenderedScale - viewport.clientWidth / 2, behavior: 'smooth' })
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.setPointerCapture(event.pointerId)
    dragState.current = { active: true, startX: event.clientX, scrollLeft: viewport.scrollLeft }
    setDragging(true)
    setActiveIndex(indexFromPointer(event.clientX))
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current
    if (!viewport) return
    if (dragState.current.active) viewport.scrollLeft = dragState.current.scrollLeft - (event.clientX - dragState.current.startX)
    setActiveIndex(indexFromPointer(event.clientX))
  }

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current
    if (viewport?.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId)
    dragState.current.active = false
    setDragging(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    focusDate(safeActiveIndex + (event.key === 'ArrowRight' ? 1 : -1))
  }

  return (
    <Box sx={{ width: '100%', minWidth: 0, pt: 1.5 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 1.5 }}>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
          {statusSeries.map((status) => <Box key={status.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.65 }}><Box sx={{ width: 8, height: 8, borderRadius: 0.75, bgcolor: status.color }} /><Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{status.label}</Typography></Box>)}
        </Stack>
        <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_event, value: UsageChartMode | null) => value && setMode(value)} aria-label="차트 표시 방식">
          <ToggleButton value="line" aria-label="선형 차트"><ShowChartRounded sx={{ mr: 0.7, fontSize: 18 }} />Line</ToggleButton>
          <ToggleButton value="bar" aria-label="막대 차트"><BarChartRounded sx={{ mr: 0.7, fontSize: 18 }} />Bar</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ position: 'relative', height: CHART_HEIGHT, overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: 2.5, bgcolor: '#fbfcff' }}>
        <Box className="usage-detail-panel" sx={{ position: 'absolute', zIndex: 3, top: 10, left: 12, right: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: { xs: 1, sm: 1.5 }, px: 1.5, py: 1, border: '1px solid', borderColor: alpha('#7652b8', 0.16), borderRadius: 2, bgcolor: alpha('#ffffff', 0.93), boxShadow: '0 8px 22px rgba(31, 38, 54, 0.08)', pointerEvents: 'none', backdropFilter: 'blur(8px)' }}>
          <Typography sx={{ minWidth: granularity === 'daily' ? 88 : 146, fontSize: 13.5, fontWeight: 800 }}>{selected.detailLabel}</Typography>
          {statusSeries.map((status) => <Box key={status.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.55 }}><Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: status.color }} /><Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>{status.label}</Typography><Typography sx={{ fontSize: 13, fontWeight: 800 }}>{selected[status.key]}</Typography></Box>)}
          <Typography sx={{ ml: { sm: 'auto' }, color: 'primary.main', fontSize: 13, fontWeight: 800 }}>합계 {getStatusTotal(selected)}</Typography>
        </Box>

        <Box
          ref={viewportRef}
          className={`usage-chart-scroll${dragging ? ' is-dragging' : ''}`}
          role="application"
          tabIndex={0}
          aria-label="2026년 7월 1일부터 8월 24일까지 일별 키 상태 차트. 좌우 방향키 또는 마우스 드래그로 날짜를 탐색할 수 있습니다."
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          sx={{ width: '100%', height: '100%', overflowX: 'auto', overflowY: 'hidden', touchAction: 'pan-y' }}
        >
          <Box key={granularity} className="usage-chart-refresh" component="svg" width={chartWidth} height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`} role="img" aria-label={`${selected.detailLabel} 키 상태 합계 ${getStatusTotal(selected)}개`} sx={{ display: 'block', minWidth: '100%', maxWidth: 'none' }}>
            <defs>
              <linearGradient id="dailyUsageArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#d92f81" stopOpacity="0.24" /><stop offset="100%" stopColor="#d92f81" stopOpacity="0.01" /></linearGradient>
            </defs>

            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = PLOT_BOTTOM - ratio * (PLOT_BOTTOM - PLOT_TOP)
              return <g key={ratio}><line x1={CHART_LEFT} x2={chartWidth - CHART_LEFT} y1={y} y2={y} stroke="#e9ecf3" strokeWidth="1" /><text x={CHART_LEFT + 2} y={y - 5} fill="#9aa1af" fontSize="10">{Math.round(maxTotal * ratio)}</text></g>
            })}

            <g className={`usage-chart-mode usage-bar-mode${mode === 'bar' ? ' is-visible' : ''}`}>
              {chartData.map((point, index) => {
                let bottom = PLOT_BOTTOM
                return <g key={point.date}>{statusSeries.map((status) => {
                  const height = (point[status.key] / maxTotal) * (PLOT_BOTTOM - PLOT_TOP)
                  bottom -= height
                  const barWidth = Math.min(unitWidth - 16, 72)
                  return <rect key={status.key} className="usage-bar-segment" x={CHART_LEFT + index * unitWidth + (unitWidth - barWidth) / 2} y={bottom} width={barWidth} height={height} rx="3" fill={status.color} opacity={index === safeActiveIndex ? 1 : 0.82} />
                })}</g>
              })}
            </g>

            <g className={`usage-chart-mode usage-line-mode${mode === 'line' ? ' is-visible' : ''}`}>
              <path d={areaPath} fill="url(#dailyUsageArea)" />
              <path className="usage-line" d={linePath} fill="none" stroke="#d92f81" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
              {linePoints.map((point, index) => <circle key={chartData[index].date} className={`usage-chart-point${index === safeActiveIndex ? ' is-active' : ''}`} cx={point.x} cy={point.y} r="3.5" fill="#d92f81" stroke="#fff" strokeWidth="2" />)}
            </g>

            <line x1={linePoints[safeActiveIndex].x} x2={linePoints[safeActiveIndex].x} y1={PLOT_TOP} y2={PLOT_BOTTOM} stroke="#7652b8" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.65" pointerEvents="none" />
            {chartData.map((point, index) => <g key={`${point.date}-axis`}><text x={CHART_LEFT + index * unitWidth + unitWidth / 2} y="246" fill={index === safeActiveIndex ? '#7652b8' : '#9299a8'} fontSize={granularity === 'monthly' || index === safeActiveIndex ? 11 : 10} fontWeight={index === safeActiveIndex ? 800 : 500} textAnchor="middle">{point.axisLabel}</text><rect x={CHART_LEFT + index * unitWidth} y={PLOT_TOP} width={unitWidth} height={PLOT_BOTTOM - PLOT_TOP + 28} fill="transparent" onPointerEnter={() => !dragging && setActiveIndex(index)} /></g>)}
          </Box>
        </Box>

        <Box sx={{ position: 'absolute', zIndex: 3, right: 12, bottom: 12, display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.6, px: 1, py: 0.5, borderRadius: 1.5, bgcolor: alpha('#ffffff', 0.88), color: 'text.secondary', pointerEvents: 'none' }}><DragIndicatorRounded sx={{ fontSize: 16 }} /><Typography sx={{ fontSize: 11.5 }}>클릭 후 드래그 · 방향키 이동</Typography></Box>
      </Box>
    </Box>
  )
}

function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [expiryDays, setExpiryDays] = useState(30)
  const [granularity, setGranularity] = useState<UsageGranularity>('daily')
  const [serverNow, setServerNow] = useState(() => new Date())
  const expiringKeys = dashboardMockData.expiringKeys.filter((key) => key.days <= expiryDays)
  const standardDateSnapshot = useMemo(() => resolveStandardDateSnapshot(serverNow), [serverNow])
  const standardDateTotal = getStatusTotal(standardDateSnapshot)
  const statusDistribution = statusSeries.map((status) => ({
    ...status,
    value: standardDateSnapshot[status.key],
    percent: Math.round((standardDateSnapshot[status.key] / standardDateTotal) * 100),
  }))
  let donutOffset = 0
  const donutBackground = `conic-gradient(${statusDistribution.map((status) => {
    const start = donutOffset
    donutOffset += (status.value / standardDateTotal) * 100
    return `${status.color} ${start}% ${donutOffset}%`
  }).join(', ')})`
  const clientSummary = [
    dashboardMockData.summary[0],
    dashboardMockData.summary[1],
    { label: '내 테스트 호출', value: '148', note: '이번 달 성공 147건', color: '#32b7d8', icon: <ScienceRounded /> },
    { label: '내가 작성한 글', value: '3', note: '현재 노출 2건', color: '#4c8eda', icon: <DescriptionRounded /> },
  ]
  const summaryItems = user?.role === 'CLIENT' ? clientSummary : dashboardMockData.summary
  const operationItems = dashboardMockData.operationCards
  const activityItems = user?.role === 'CLIENT'
    ? [
        { title: '암호화 테스트', detail: 'PAYMENT-AES-001 테스트 성공', time: '12분 전', color: '#d92f81' },
        { title: '공지사항 작성', detail: '클라이언트 연동 점검 결과 등록', time: '1시간 전', color: '#4c8eda' },
        { title: '복호화 테스트', detail: 'MEMBER-AES-003 테스트 성공', time: '3시간 전', color: '#7652b8' },
      ]
    : dashboardMockData.activities

  useEffect(() => {
    const timer = window.setInterval(() => setServerNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: 'calc(100vh - 128px)',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h5">대시보드</Typography>
          <Typography sx={{ mt: 0.65, color: 'text.secondary', fontSize: 14 }}>
            {isAdminRole(user?.role) ? 'D\'Guard KMS 전체 운영·보안 현황을 확인하세요.' : '사용 가능한 키와 본인의 테스트·게시판 활동을 확인하세요.'}
          </Typography>
        </Box>
        <StatusBadge
          icon={<CheckCircleRounded />}
          status={user?.role ?? 'CLIENT'}
          label={`${user?.role ?? ''} VIEW`}
          sx={{ fontSize: 13 }}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(3, minmax(0, 1fr))',
            xl: user?.role === 'CLIENT' ? 'repeat(4, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))',
          },
          gap: 2,
          mt: 3,
        }}
      >
        {summaryItems.map((item) => (
          <SummaryCard key={item.label} {...item} />
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2.1fr) minmax(320px, 0.9fr)' },
          gap: 2,
          mt: 2,
        }}
      >
        <Card className="dashboard-card chart-card" sx={{ minWidth: 0 }}>
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
              <Box>
                <Typography variant="h6">키 사용 추이</Typography>
                <Typography sx={{ mt: 0.4, color: 'text.secondary', fontSize: 14 }}>
                  2026-07-01 ~ 2026-08-24 일별 키 상태 · 드래그하여 과거 탐색
                </Typography>
              </Box>
              <ToggleButtonGroup exclusive size="small" value={granularity} onChange={(_event, value: UsageGranularity | null) => value && setGranularity(value)} aria-label="차트 집계 단위">
                <ToggleButton value="daily" aria-label="일 단위">일 Daily</ToggleButton>
                <ToggleButton value="monthly" aria-label="월 단위">월 Monthly</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <UsageChart granularity={granularity} />
          </CardContent>
        </Card>

        <Card className="dashboard-card" sx={{ minWidth: 0 }}>
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Typography variant="h6">키 상태</Typography>
            <Typography sx={{ mt: 0.4, color: 'text.secondary', fontSize: 14 }}>
              서버 기준일 {standardDateSnapshot.date} 전체 키 상태 분포
            </Typography>
            <Box sx={{ display: 'grid', placeItems: 'center', py: 2.5 }}>
              <Box
                className="status-donut"
                sx={{
                  position: 'relative',
                  display: 'grid',
                  width: 154,
                  height: 154,
                  placeItems: 'center',
                  borderRadius: '50%',
                  background: donutBackground,
                  '&::after': {
                    position: 'absolute',
                    width: 105,
                    height: 105,
                    borderRadius: '50%',
                    bgcolor: 'background.paper',
                    content: '""',
                  },
                }}
              >
                <Box sx={{ zIndex: 1, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{standardDateTotal}</Typography>
                  <Typography sx={{ mt: 0.6, color: 'text.secondary', fontSize: 13.5 }}>전체 키</Typography>
                </Box>
              </Box>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
              {statusDistribution.map((status) => (
                <Box key={status.label}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: status.color }} />
                      <Typography sx={{ color: 'text.secondary', fontSize: 13.5 }}>{status.label}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 800 }}>{status.value} <Box component="span" sx={{ color: 'text.secondary', fontSize: 12, fontWeight: 600 }}>({status.percent}%)</Box></Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 2,
          mt: 2,
        }}
      >
        {operationItems.map((item) => (
          <Card className="dashboard-card metric-card" key={item.label} sx={{ overflow: 'hidden', border: 0, background: item.gradient, color: 'common.white' }}>
            <CardContent sx={{ p: '20px !important' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, opacity: 0.86 }}>{item.label}</Typography>
                  <Typography sx={{ mt: 0.8, fontSize: 27, fontWeight: 800 }}>{item.value}</Typography>
                </Box>
                <Box className="dashboard-card-icon" sx={{ display: 'grid', width: 42, height: 42, placeItems: 'center', borderRadius: 2, bgcolor: alpha('#ffffff', 0.18) }}>
                  {item.icon}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mt: 1.8 }}>
                <Typography sx={{ fontSize: 13.5, opacity: 0.84 }}>{item.detail}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 28 }}>
                  {[14, 22, 17, 27, 20, 25].map((height, index) => (
                    <Box
                      className="metric-bar"
                      key={`${item.label}-${height}`}
                      sx={{
                        width: 4,
                        height,
                        borderRadius: 1,
                        bgcolor: alpha('#ffffff', 0.72),
                        animationDelay: `${index * 70}ms`,
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(340px, 0.9fr) minmax(0, 1.7fr)' },
          gap: 2,
          mt: 2,
        }}
      >
        <Card className="dashboard-card">
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h6">최근 활동</Typography>
                <Typography sx={{ mt: 0.4, color: 'text.secondary', fontSize: 14 }}>
                  {isAdminRole(user?.role) ? '최근 관리자 작업 내역' : '최근 내 작업 내역'}
                </Typography>
              </Box>
              <Button
                size="small"
                endIcon={<ArrowForwardRounded />}
                onClick={() => navigate('/my/recent-activity')}
                sx={{ fontSize: 14 }}
              >
                전체보기
              </Button>
            </Box>
            <Box sx={{ mt: 2.4 }}>
              {activityItems.map((activity, index) => (
                <Box key={`${activity.title}-${activity.time}`}>
                  <Box sx={{ display: 'flex', gap: 1.5, py: 1.35 }}>
                    <Avatar sx={{ width: 34, height: 34, bgcolor: alpha(activity.color, 0.12), color: activity.color }}>
                      {index === 0 ? <TrendingUpRounded sx={{ fontSize: 17 }} /> : <AccessTimeRounded sx={{ fontSize: 17 }} />}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{activity.title}</Typography>
                        <Typography sx={{ flexShrink: 0, color: 'text.secondary', fontSize: 13 }}>{activity.time}</Typography>
                      </Box>
                      <Typography noWrap sx={{ mt: 0.4, color: 'text.secondary', fontSize: 13.5 }}>
                        {activity.detail}
                      </Typography>
                    </Box>
                  </Box>
                  {index < activityItems.length - 1 && <Divider />}
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h6">만료 임박 키</Typography>
                <Typography sx={{ mt: 0.4, color: 'text.secondary', fontSize: 14 }}>
                  30일 이내 만료 예정인 키
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Select size="small" value={expiryDays} onChange={(event) => setExpiryDays(Number(event.target.value))} aria-label="만료 임박 기준일" sx={{ fontSize: 14 }}><MenuItem value={7}>7일</MenuItem><MenuItem value={30}>30일</MenuItem><MenuItem value={60}>60일</MenuItem></Select>
                <StatusBadge label={`${expiringKeys.length}건`} tone="warning" minWidth={48} />
              </Stack>
            </Box>
            <TableContainer sx={{ mt: 2 }}>
              <Table size="small" aria-label="만료 임박 키 목록">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f7f8fb' }}>
                    {['키 이름', '알고리즘', '만료일', '남은 기간'].map((label) => (
                      <TableCell key={label} sx={{ borderBottom: 0, color: 'text.secondary', fontSize: 13.5, fontWeight: 800 }}>
                        {label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {expiringKeys.map((key) => (
                    <TableRow key={key.uid} hover>
                      <TableCell sx={{ py: 1.35 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{key.name}</Typography>
                        <Typography sx={{ mt: 0.2, color: 'text.secondary', fontSize: 12.5 }}>{key.uid}</Typography>
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 13.5 }}>{key.algorithm}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 13.5, whiteSpace: 'nowrap' }}>{key.expires}</TableCell>
                      <TableCell sx={{ minWidth: 100 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.max(12, 100 - key.days * 3.5)}
                            color={key.days <= 7 ? 'error' : 'warning'}
                            sx={{ width: 45, height: 4, borderRadius: 5, bgcolor: '#eef0f5' }}
                          />
                          <Typography sx={{ color: key.days <= 7 ? 'error.main' : 'warning.dark', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' }}>
                            D-{key.days}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 2, color: 'text.secondary' }}>
              <ErrorOutlineRounded sx={{ fontSize: 15 }} />
              <Typography sx={{ fontSize: 13.5 }}>만료 전 키 상태와 서비스 영향도를 확인하세요.</Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}

export default Dashboard
