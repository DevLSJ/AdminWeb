import { useState, type ReactNode } from 'react'
import {
  AccessTimeRounded,
  ArrowForwardRounded,
  CheckCircleRounded,
  DescriptionRounded,
  ErrorOutlineRounded,
  KeyRounded,
  LockOpenRounded,
  PeopleAltRounded,
  SecurityRounded,
  TrendingUpRounded,
  VpnKeyRounded,
} from '@mui/icons-material'
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'

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
      label: '공지사항',
      value: '28',
      note: '현재 노출 24건',
      color: '#4c8eda',
      icon: <DescriptionRounded />,
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
    {
      label: '감사 이벤트',
      value: '1,286',
      detail: '오늘 46건 기록',
      gradient: 'linear-gradient(135deg, #35bad8 0%, #468bd9 100%)',
      icon: <SecurityRounded />,
    },
    {
      label: '공지사항',
      value: '28',
      detail: '게시 중 24건',
      gradient: 'linear-gradient(135deg, #f4b326 0%, #f47a48 100%)',
      icon: <DescriptionRounded />,
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
  keyStatus: [
    { label: '활성', value: 64, percent: 78, color: '#d92f81' },
    { label: '생성', value: 8, percent: 10, color: '#7652b8' },
    { label: '비활성', value: 6, percent: 7, color: '#f5a623' },
    { label: '만료', value: 4, percent: 5, color: '#dfe3eb' },
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
            <Typography sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 700 }}>
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
        <Typography sx={{ mt: 1.8, color: 'text.secondary', fontSize: 12 }}>
          {note}
        </Typography>
      </CardContent>
    </Card>
  )
}

function UsageChart() {
  return (
    <Box sx={{ width: '100%', minWidth: 0, pt: 1 }}>
      <Box
        component="svg"
        viewBox="0 0 640 205"
        role="img"
        aria-label="최근 6개월 키 사용 추이"
        sx={{ display: 'block', width: '100%', height: { xs: 200, lg: 230 } }}
      >
        <defs>
          <linearGradient id="pinkArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#e43a87" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#e43a87" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="purpleArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#7652b8" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#7652b8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[35, 75, 115, 155].map((y) => (
          <line key={y} x1="38" x2="620" y1={y} y2={y} stroke="#eef0f5" strokeWidth="1" />
        ))}
        <path
          className="usage-area"
          d="M40 158 C80 126 98 128 130 110 C166 89 191 134 230 100 C273 62 298 117 340 89 C382 61 404 128 452 79 C493 38 530 93 572 46 C596 22 607 93 620 151 L620 170 L40 170 Z"
          fill="url(#purpleArea)"
        />
        <path
          className="usage-area"
          d="M40 160 C75 116 102 133 137 103 C172 73 198 135 237 93 C278 48 310 105 350 65 C390 29 420 123 462 73 C504 21 542 109 576 57 C598 25 610 113 620 154 L620 170 L40 170 Z"
          fill="url(#pinkArea)"
        />
        <path
          className="usage-line"
          pathLength="1"
          d="M40 158 C80 126 98 128 130 110 C166 89 191 134 230 100 C273 62 298 117 340 89 C382 61 404 128 452 79 C493 38 530 93 572 46 C596 22 607 93 620 151"
          fill="none"
          stroke="#7652b8"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <path
          className="usage-line"
          pathLength="1"
          d="M40 160 C75 116 102 133 137 103 C172 73 198 135 237 93 C278 48 310 105 350 65 C390 29 420 123 462 73 C504 21 542 109 576 57 C598 25 610 113 620 154"
          fill="none"
          stroke="#e43a87"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <circle className="usage-chart-dot" cx="350" cy="65" r="5" fill="#e43a87" stroke="#fff" strokeWidth="3" />
        <circle className="usage-chart-dot" cx="452" cy="79" r="5" fill="#7652b8" stroke="#fff" strokeWidth="3" />
        {['07/21', '07/27', '08/02', '08/08', '08/14', '08/19'].map((label, index) => (
          <text
            key={label}
            x={40 + index * 116}
            y="196"
            fill="#a3a8b4"
            fontSize="10"
            textAnchor={index === 0 ? 'start' : index === 5 ? 'end' : 'middle'}
          >
            {label}
          </text>
        ))}
      </Box>
    </Box>
  )
}

function Dashboard() {
  const [expiryDays, setExpiryDays] = useState(30)
  const expiringKeys = dashboardMockData.expiringKeys.filter((key) => key.days <= expiryDays)

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h5">대시보드</Typography>
          <Typography sx={{ mt: 0.65, color: 'text.secondary', fontSize: 14 }}>
            D&apos;Guard KMS 운영 현황을 한눈에 확인하세요.
          </Typography>
        </Box>
        <Chip
          icon={<CheckCircleRounded />}
          label="시스템 정상"
          color="success"
          variant="outlined"
          size="small"
          sx={{ bgcolor: 'background.paper', fontWeight: 700, fontSize: 12 }}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' },
          gap: 2,
          mt: 3,
        }}
      >
        {dashboardMockData.summary.map((item) => (
          <SummaryCard key={item.label} {...item} />
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(300px, 0.85fr)' },
          gap: 2,
          mt: 2,
        }}
      >
        <Card className="dashboard-card chart-card">
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
              <Box>
                <Typography variant="h6">키 사용 추이</Typography>
                <Typography sx={{ mt: 0.4, color: 'text.secondary', fontSize: 13 }}>
                  최근 30일 key_usage_log 성공·실패 추이
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#e43a87' }} />
                  <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>성공</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#7652b8' }} />
                  <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>실패</Typography>
                </Box>
              </Box>
            </Box>
            <UsageChart />
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Typography variant="h6">키 상태</Typography>
            <Typography sx={{ mt: 0.4, color: 'text.secondary', fontSize: 13 }}>
              전체 관리 키 상태 분포
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
                  background: 'conic-gradient(#d92f81 0 78%, #7652b8 78% 88%, #f5a623 88% 95%, #dfe3eb 95% 100%)',
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
                  <Typography sx={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>82</Typography>
                  <Typography sx={{ mt: 0.6, color: 'text.secondary', fontSize: 12 }}>전체 키</Typography>
                </Box>
              </Box>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
              {dashboardMockData.keyStatus.map((status) => (
                <Box key={status.label}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: status.color }} />
                      <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>{status.label}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 800 }}>{status.value}</Typography>
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
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' },
          gap: 2,
          mt: 2,
        }}
      >
        {dashboardMockData.operationCards.map((item) => (
          <Card className="dashboard-card metric-card" key={item.label} sx={{ overflow: 'hidden', border: 0, background: item.gradient, color: 'common.white' }}>
            <CardContent sx={{ p: '20px !important' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, opacity: 0.82 }}>{item.label}</Typography>
                  <Typography sx={{ mt: 0.8, fontSize: 27, fontWeight: 800 }}>{item.value}</Typography>
                </Box>
                <Box className="dashboard-card-icon" sx={{ display: 'grid', width: 42, height: 42, placeItems: 'center', borderRadius: 2, bgcolor: alpha('#ffffff', 0.18) }}>
                  {item.icon}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mt: 1.8 }}>
                <Typography sx={{ fontSize: 12, opacity: 0.8 }}>{item.detail}</Typography>
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
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(300px, 0.85fr) minmax(0, 1.65fr)' },
          gap: 2,
          mt: 2,
        }}
      >
        <Card className="dashboard-card">
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h6">최근 활동</Typography>
                <Typography sx={{ mt: 0.4, color: 'text.secondary', fontSize: 13 }}>
                  최근 관리자 작업 내역
                </Typography>
              </Box>
              <Button size="small" endIcon={<ArrowForwardRounded />} sx={{ fontSize: 12 }}>
                전체보기
              </Button>
            </Box>
            <Box sx={{ mt: 2.4 }}>
              {dashboardMockData.activities.map((activity, index) => (
                <Box key={`${activity.title}-${activity.time}`}>
                  <Box sx={{ display: 'flex', gap: 1.5, py: 1.35 }}>
                    <Avatar sx={{ width: 34, height: 34, bgcolor: alpha(activity.color, 0.12), color: activity.color }}>
                      {index === 0 ? <TrendingUpRounded sx={{ fontSize: 17 }} /> : <AccessTimeRounded sx={{ fontSize: 17 }} />}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{activity.title}</Typography>
                        <Typography sx={{ flexShrink: 0, color: 'text.secondary', fontSize: 11 }}>{activity.time}</Typography>
                      </Box>
                      <Typography noWrap sx={{ mt: 0.4, color: 'text.secondary', fontSize: 11.5 }}>
                        {activity.detail}
                      </Typography>
                    </Box>
                  </Box>
                  {index < dashboardMockData.activities.length - 1 && <Divider />}
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
                <Typography sx={{ mt: 0.4, color: 'text.secondary', fontSize: 13 }}>
                  30일 이내 만료 예정인 키
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Select size="small" value={expiryDays} onChange={(event) => setExpiryDays(Number(event.target.value))} aria-label="만료 임박 기준일" sx={{ fontSize: 11.5 }}><MenuItem value={7}>7일</MenuItem><MenuItem value={30}>30일</MenuItem><MenuItem value={60}>60일</MenuItem></Select>
                <Chip label={`${expiringKeys.length}건`} color="warning" size="small" sx={{ fontWeight: 800, fontSize: 11 }} />
              </Stack>
            </Box>
            <TableContainer sx={{ mt: 2 }}>
              <Table size="small" aria-label="만료 임박 키 목록">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f7f8fb' }}>
                    {['키 이름', '알고리즘', '만료일', '남은 기간'].map((label) => (
                      <TableCell key={label} sx={{ borderBottom: 0, color: 'text.secondary', fontSize: 11, fontWeight: 800 }}>
                        {label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {expiringKeys.map((key) => (
                    <TableRow key={key.uid} hover>
                      <TableCell sx={{ py: 1.35 }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{key.name}</Typography>
                        <Typography sx={{ mt: 0.2, color: 'text.secondary', fontSize: 10 }}>{key.uid}</Typography>
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 11.5 }}>{key.algorithm}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 11.5, whiteSpace: 'nowrap' }}>{key.expires}</TableCell>
                      <TableCell sx={{ minWidth: 100 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.max(12, 100 - key.days * 3.5)}
                            color={key.days <= 7 ? 'error' : 'warning'}
                            sx={{ width: 45, height: 4, borderRadius: 5, bgcolor: '#eef0f5' }}
                          />
                          <Typography sx={{ color: key.days <= 7 ? 'error.main' : 'warning.dark', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
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
              <Typography sx={{ fontSize: 11.5 }}>만료 전 키 상태와 서비스 영향도를 확인하세요.</Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}

export default Dashboard
