import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  AutorenewRounded,
  CheckCircleRounded,
  CloudUploadRounded,
  DescriptionRounded,
  ErrorOutlineRounded,
  KeyRounded,
  LoginRounded,
  LogoutRounded,
  RefreshRounded,
  ScienceRounded,
  SecurityRounded,
  SwapHorizRounded,
} from '@mui/icons-material'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { StatusBadge } from '../../src/components/common/StatusBadge'
import { apiRecentActivitySource } from './apiData'
import type {
  RecentActivityPageResult,
  RecentActivityQuery,
  RecentActivityRequestState,
  RecentActivitySource,
  RecentActivityType,
  RecentActivityTypeFilter,
} from './types'

const emptyResult: RecentActivityPageResult = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  page: 0,
  size: 10,
}

const activityTypeOptions: Array<{
  value: RecentActivityTypeFilter
  label: string
}> = [
  { value: 'ALL', label: '전체 활동' },
  { value: 'KEY_CREATE', label: '키 생성' },
  { value: 'KEY_DEPLOY', label: '키 배포' },
  { value: 'KEY_ROTATE', label: '키 갱신' },
  { value: 'KEY_STATUS_CHANGE', label: '상태 변경' },
  { value: 'CRYPTO_TEST', label: '암복호화 테스트' },
  { value: 'LOGIN', label: '로그인' },
  { value: 'LOGOUT', label: '로그아웃' },
  { value: 'NOTICE_UPDATE', label: '게시판 활동' },
]

const activityTypeStyle: Record<RecentActivityType, {
  label: string
  color: string
  icon: ReactNode
}> = {
  KEY_CREATE: { label: '키 생성', color: '#d92f81', icon: <KeyRounded /> },
  KEY_DEPLOY: { label: '키 배포', color: '#3979cf', icon: <CloudUploadRounded /> },
  KEY_ROTATE: { label: '키 갱신', color: '#7652b8', icon: <AutorenewRounded /> },
  KEY_STATUS_CHANGE: { label: '상태 변경', color: '#ef7c45', icon: <SwapHorizRounded /> },
  CRYPTO_TEST: { label: '암복호화 테스트', color: '#32a9c8', icon: <ScienceRounded /> },
  LOGIN: { label: '로그인', color: '#25a875', icon: <LoginRounded /> },
  LOGOUT: { label: '로그아웃', color: '#7a8090', icon: <LogoutRounded /> },
  NOTICE_UPDATE: { label: '게시판 활동', color: '#e09a16', icon: <DescriptionRounded /> },
  AUDIT_EVENT: { label: '감사 이벤트', color: '#596273', icon: <SecurityRounded /> },
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp))
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return '최근 활동을 불러오지 못했습니다.'
}

function useRecentActivities(
  source: RecentActivitySource,
  query: RecentActivityQuery,
  pollingIntervalMs: number,
) {
  const [state, setState] = useState<RecentActivityRequestState>({
    data: { ...emptyResult, size: query.size },
    loading: true,
    refreshing: false,
    error: null,
    lastUpdatedAt: null,
  })
  const abortRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async (background = false) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setState((current) => ({
      ...current,
      loading: background ? current.loading : true,
      refreshing: background,
      error: null,
    }))

    try {
      const data = await source.fetchActivities(query, controller.signal)
      setState({
        data,
        loading: false,
        refreshing: false,
        error: null,
        lastUpdatedAt: new Date(),
      })
    } catch (error) {
      if (controller.signal.aborted) return
      setState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        error: getErrorMessage(error),
      }))
    }
  }, [query, source])

  useEffect(() => {
    void refresh(false)
    const pollingTimer = pollingIntervalMs > 0
      ? window.setInterval(() => void refresh(true), pollingIntervalMs)
      : undefined
    const unsubscribe = source.subscribeLatest?.(
      query.userId,
      () => void refresh(true),
      (error) => setState((current) => ({ ...current, error: error.message })),
    )

    return () => {
      if (pollingTimer !== undefined) window.clearInterval(pollingTimer)
      unsubscribe?.()
      abortRef.current?.abort()
    }
  }, [pollingIntervalMs, query.userId, refresh, source])

  return { ...state, refresh }
}

export interface RecentActivityPageProps {
  userId?: string
  source?: RecentActivitySource
  pollingIntervalMs?: number
}

export function RecentActivityPage({
  userId = 'admin',
  source = apiRecentActivitySource,
  pollingIntervalMs = 10_000,
}: RecentActivityPageProps) {
  const [activityType, setActivityType] = useState<RecentActivityTypeFilter>('ALL')
  const [fromDate, setFromDate] = useState(() => { const date = new Date(); date.setDate(date.getDate() - 30); return date.toISOString().slice(0, 10) })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const query = useMemo<RecentActivityQuery>(() => ({
    userId,
    activityType,
    fromDate,
    toDate,
    page,
    size: rowsPerPage,
  }), [activityType, fromDate, page, rowsPerPage, toDate, userId])
  const { data, loading, refreshing, error, lastUpdatedAt, refresh } = useRecentActivities(
    source,
    query,
    pollingIntervalMs,
  )

  const updateFilter = (update: () => void) => {
    setPage(0)
    update()
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="h5">최근 활동</Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <StatusBadge
            icon={<CheckCircleRounded />}
            label={pollingIntervalMs > 0 ? `${pollingIntervalMs / 1000}초 자동 갱신` : '수동 갱신'}
            tone="positive"
          />
          <Tooltip title={lastUpdatedAt ? `마지막 갱신 ${lastUpdatedAt.toLocaleTimeString('ko-KR')}` : '새로고침'}>
            <span>
              <Button
                variant="outlined"
                startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshRounded />}
                disabled={refreshing}
                onClick={() => void refresh(false)}
                sx={{ px: 1.8 }}
              >
                새로고침
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Box>

      <Card sx={{ mt: 3 }}>
        <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(190px, 1fr) repeat(2, minmax(160px, 0.8fr))' },
              gap: 1.5,
              alignItems: 'center',
            }}
          >
            <FormControl size="small" fullWidth>
              <InputLabel id="recent-activity-type-label">활동 유형</InputLabel>
              <Select
                labelId="recent-activity-type-label"
                label="활동 유형"
                value={activityType}
                onChange={(event) => updateFilter(() => setActivityType(event.target.value as RecentActivityTypeFilter))}
              >
                {activityTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              type="date"
              label="시작일"
              value={fromDate}
              onChange={(event) => updateFilter(() => setFromDate(event.target.value))}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: toDate || undefined } }}
            />
            <TextField
              size="small"
              type="date"
              label="종료일"
              value={toDate}
              onChange={(event) => updateFilter(() => setToDate(event.target.value))}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: fromDate || undefined } }}
            />
          </Box>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void refresh(false)}>재시도</Button>} sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ mt: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table aria-label="내 최근 활동 목록" sx={{ minWidth: 920 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f7f8fb' }}>
                <TableCell>일시</TableCell>
                <TableCell>활동 유형</TableCell>
                <TableCell>대상 키</TableCell>
                <TableCell>상세 내용</TableCell>
                <TableCell align="center">결과</TableCell>
                <TableCell>IP 주소</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ height: 250 }}>
                    <CircularProgress size={30} />
                    <Typography sx={{ mt: 1.2, color: 'text.secondary', fontSize: 14 }}>활동 이력을 불러오는 중입니다.</Typography>
                  </TableCell>
                </TableRow>
              ) : data.content.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ height: 250 }}>
                    <ErrorOutlineRounded sx={{ color: 'text.disabled', fontSize: 38 }} />
                    <Typography sx={{ mt: 1, color: 'text.secondary', fontSize: 14 }}>선택한 조건의 활동 이력이 없습니다.</Typography>
                  </TableCell>
                </TableRow>
              ) : data.content.map((activity) => {
                const activityStyle = activityTypeStyle[activity.activityType]
                return (
                  <TableRow key={activity.id} hover>
                    <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                      {formatTimestamp(activity.timestamp)}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1.1} sx={{ alignItems: 'center' }}>
                        <Avatar sx={{ width: 34, height: 34, bgcolor: alpha(activityStyle.color, 0.12), color: activityStyle.color, '& svg': { fontSize: 18 } }}>
                          {activityStyle.icon}
                        </Avatar>
                        <Chip label={activityStyle.label} size="small" sx={{ bgcolor: alpha(activityStyle.color, 0.1), color: activityStyle.color }} />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {activity.targetKey ? (
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 750 }}>{activity.targetKey}</Typography>
                          <Typography sx={{ mt: 0.2, color: 'text.secondary', fontSize: 12.5 }}>
                            {[activity.targetKeyUid, activity.keyVersion].filter(Boolean).join(' · ')}
                          </Typography>
                        </Box>
                      ) : <Typography sx={{ color: 'text.disabled' }}>—</Typography>}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 350 }}>
                      <Typography sx={{ fontSize: 14, lineHeight: 1.55 }}>{activity.description}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <StatusBadge status={activity.status} />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{activity.ipAddress}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={data.totalElements}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[5, 10, 20]}
          labelRowsPerPage="페이지당 행"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}건`}
          onPageChange={(_event, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value))
            setPage(0)
          }}
          sx={{ borderTop: '1px solid', borderColor: 'divider' }}
        />
      </Card>
    </Box>
  )
}

export default RecentActivityPage
