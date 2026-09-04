import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CalendarMonthRounded, CloseRounded, DownloadRounded, FactCheckRounded, FlightTakeoffRounded, SearchRounded, VerifiedRounded, WarningAmberRounded } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  InputAdornment,
  InputLabel,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { exportAuditLogs, fetchAuditLogPage, getApiErrorMessage, verifyAuditLogEntry, verifyAuditLogs } from '../../api/kms'
import { FilterCard, InfoRow, PageHeader, PaginationBar } from '../../components/admin/AdminPage'
import { paginatedTableCellSx, paginatedTableContainerSx } from '../../components/admin/pagination'
import { StatusBadge } from '../../components/common/StatusBadge'
import type { AuditAction, AuditEntryVerification, AuditListParams, AuditLog as AuditLogType, AuditVerification, PageResponse } from '../../types/api'

const auditActions: Array<AuditAction | 'ALL'> = [
  'ALL', 'LOGIN', 'LOGOUT', 'SESSION_REFRESH', 'KEY_CREATE', 'KEY_UPDATE', 'KEY_DELETE',
  'KEY_STATUS_CHANGE', 'KEY_DEPLOY', 'KEY_DEPLOY_ROLLBACK', 'KEY_ROTATE',
  'KEY_AUTO_ROTATION_UPDATE', 'KEY_TEST', 'USER_CREATE', 'USER_UPDATE',
  'USER_VIEW_PLAIN', 'USER_STATUS_CHANGE', 'USER_PASSWORD_RESET', 'AUDIT_EXPORT',
  'NOTICE_CREATE', 'NOTICE_VIEW', 'NOTICE_UPDATE', 'NOTICE_DELETE', 'FILE_DOWNLOAD', 'FILE_DELETE',
  'ADMIN_ACCOUNT_UPDATE', 'ADMIN_ACCOUNT_STATUS_CHANGE', 'ADMIN_ACCOUNT_PASSWORD_RESET',
]

const auditActionLabels: Record<AuditAction | 'ALL', string> = {
  ALL: '전체 행위', LOGIN: '로그인', LOGOUT: '로그아웃', SESSION_REFRESH: '세션 연장',
  KEY_CREATE: '키 생성', KEY_UPDATE: '키 수정', KEY_DELETE: '키 삭제', KEY_STATUS_CHANGE: '키 상태 변경',
  KEY_DEPLOY: '키 배포', KEY_DEPLOY_ROLLBACK: '키 배포 롤백', KEY_ROTATE: '키 갱신',
  KEY_AUTO_ROTATION_UPDATE: '자동 갱신 설정', KEY_TEST: '키 테스트', USER_CREATE: '사용자 생성',
  USER_UPDATE: '사용자 수정', USER_VIEW_PLAIN: '개인정보 원문 조회', USER_STATUS_CHANGE: '사용자 상태 변경',
  USER_PASSWORD_RESET: '비밀번호 재설정', AUDIT_EXPORT: '감사 CSV 내보내기', NOTICE_CREATE: '공지 생성',
  NOTICE_VIEW: '공지 조회', NOTICE_UPDATE: '공지 수정', NOTICE_DELETE: '공지 삭제', FILE_DOWNLOAD: '파일 내려받기', FILE_DELETE: '파일 삭제',
  ADMIN_ACCOUNT_UPDATE: '관리 계정 수정', ADMIN_ACCOUNT_STATUS_CHANGE: '관리 계정 상태 변경', ADMIN_ACCOUNT_PASSWORD_RESET: '관리 계정 비밀번호 재설정',
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

const today = new Date()
const defaultParams: AuditListParams = {
  from: isoDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)),
  to: isoDate(today), actor: '', action: 'ALL', page: 0, size: 10,
}
const emptyPage: PageResponse<AuditLogType> = { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 }

function formatKst(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date(value))
}

function localDateTimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function defaultVerificationRange() {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 7)
  from.setHours(0, 0, 0, 0)
  return { from: localDateTimeValue(from), to: localDateTimeValue(to) }
}

function AuditLog() {
  const [draft, setDraft] = useState(defaultParams)
  const [params, setParams] = useState(defaultParams)
  const [pageData, setPageData] = useState(emptyPage)
  const [loading, setLoading] = useState(true)
  const [verification, setVerification] = useState<AuditVerification | null>(null)
  const [detail, setDetail] = useState<AuditLogType | null>(null)
  const [entryVerification, setEntryVerification] = useState<AuditEntryVerification | null>(null)
  const [verifyingUid, setVerifyingUid] = useState<string | null>(null)
  const [verificationOpen, setVerificationOpen] = useState(false)
  const [verificationRange, setVerificationRange] = useState(defaultVerificationRange)
  const [verificationRangeError, setVerificationRangeError] = useState('')
  const [verifyingRange, setVerifyingRange] = useState(false)
  const [error, setError] = useState('')

  const loadLogs = useCallback(async (nextParams: AuditListParams) => {
    setLoading(true)
    setError('')
    try {
      setPageData(await fetchAuditLogPage(nextParams))
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '감사 로그를 불러오지 못했습니다.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLogs(params)
  }, [loadLogs, params])

  useEffect(() => {
    if (!detail) return
    const timer = window.setInterval(() => {
      void verifyAuditLogEntry(detail.logUid).then(setEntryVerification).catch((requestError) => setError(getApiErrorMessage(requestError, '실시간 인접 체인 검증에 실패했습니다.')))
    }, 3_000)
    return () => window.clearInterval(timer)
  }, [detail])

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setParams({ ...draft, page: 0 })
  }

  const openVerification = () => {
    setVerificationRange(defaultVerificationRange())
    setVerificationRangeError('')
    setVerificationOpen(true)
  }

  const verifyChain = async () => {
    const fromTime = new Date(verificationRange.from).getTime()
    const toTime = new Date(verificationRange.to).getTime()
    if (!verificationRange.from || !verificationRange.to || Number.isNaN(fromTime) || Number.isNaN(toTime)) {
      setVerificationRangeError('시작일시와 종료일시를 모두 선택해 주세요.')
      return
    }
    if (fromTime >= toTime) {
      setVerificationRangeError('종료일시는 시작일시보다 이후여야 합니다.')
      return
    }
    if (toTime - fromTime > 366 * 24 * 60 * 60 * 1000) {
      setVerificationRangeError('검증 기간은 최대 366일까지 선택할 수 있습니다.')
      return
    }
    setError('')
    setVerificationRangeError('')
    setVerifyingRange(true)
    try {
      setVerification(await verifyAuditLogs(verificationRange.from, verificationRange.to))
      setVerificationOpen(false)
    } catch (requestError) {
      setVerificationRangeError(getApiErrorMessage(requestError, '선택 기간의 감사 로그 체인을 검증하지 못했습니다.'))
    } finally {
      setVerifyingRange(false)
    }
  }

  const exportCsv = async () => {
    setError('')
    try {
      const { blob, filename } = await exportAuditLogs(params)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
      await loadLogs(params)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '감사 로그 CSV를 내려받지 못했습니다.'))
    }
  }

  const verifyEntry = async (log: AuditLogType) => {
    setVerifyingUid(log.logUid)
    setError('')
    try {
      setEntryVerification(await verifyAuditLogEntry(log.logUid))
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '선택한 감사 로그 체인을 검증하지 못했습니다.'))
    } finally {
      setVerifyingUid(null)
    }
  }

  const invalidLogUids = new Set(verification?.invalidLogUids ?? [])

  return (
    <Box>
      <PageHeader
        title="감사 로그"
        description="서버의 append-only 감사 이벤트를 검색하고 선택 기간의 행 HMAC·prev_hash 경계 연결을 검증합니다."
        action={<Stack direction="row" spacing={1}><Button data-testid="audit-verify-button" variant="outlined" startIcon={<FactCheckRounded />} onClick={openVerification}>기간 해시 체인 검증</Button><Button variant="contained" startIcon={<DownloadRounded />} onClick={() => void exportCsv()}>서명 CSV 내려받기</Button></Stack>}
      />
      {verification?.valid && <Alert data-testid="audit-verify-success" icon={<VerifiedRounded />} severity={verification.checkedCount === 0 ? 'info' : 'success'} onClose={() => setVerification(null)} sx={{ mb: 2 }}>{verification.rangeFrom && verification.rangeTo ? `${formatKst(verification.rangeFrom)} ~ ${formatKst(verification.rangeTo)} KST · ` : ''}{verification.checkedCount === 0 ? '선택 기간에 검증할 감사 로그가 없습니다.' : `총 ${verification.checkedCount.toLocaleString()}건의 행 HMAC과 기간 경계 연결이 정상입니다.`} · {formatKst(verification.verifiedAt)} KST</Alert>}
      {verification && !verification.valid && <Alert icon={<WarningAmberRounded />} severity="error" onClose={() => setVerification(null)} sx={{ mb: 2 }}>{verification.rangeFrom && verification.rangeTo ? `${formatKst(verification.rangeFrom)} ~ ${formatKst(verification.rangeTo)} KST · ` : ''}해시 체인 검증 실패: {verification.invalidLogUids.length ? verification.invalidLogUids.join(', ') : '기간 경계'} 구간의 변조 또는 삭제 가능성을 확인하세요.</Alert>}
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      <FilterCard>
        <Box component="form" onSubmit={search} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(150px, 0.75fr)) 1fr 1.25fr auto' }, gap: 1.25 }}>
          <TextField size="small" type="date" label="from" value={draft.from} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" type="date" label="to" value={draft.to} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" label="행위자" value={draft.actor} onChange={(event) => setDraft((current) => ({ ...current, actor: event.target.value }))} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }} />
          <FormControl size="small"><InputLabel>행위</InputLabel><Select label="행위" value={draft.action} onChange={(event) => setDraft((current) => ({ ...current, action: event.target.value as AuditListParams['action'] }))}>{auditActions.map((action) => <MenuItem key={action} value={action}>{auditActionLabels[action]}</MenuItem>)}</Select></FormControl>
          <Stack direction="row" spacing={1}><Button type="submit" variant="contained">검색</Button><Button color="inherit" onClick={() => { setDraft(defaultParams); setParams(defaultParams) }}>초기화</Button></Stack>
        </Box>
      </FilterCard>

      <Card>
        <TableContainer sx={paginatedTableContainerSx(params.size, 390)}>
          <Table stickyHeader size="small" sx={{ minWidth: 920, tableLayout: 'fixed', '& th, & td': { verticalAlign: 'middle', ...paginatedTableCellSx(params.size) }, '& th': { py: 0.9 } }}>
            <TableHead><TableRow><TableCell sx={{ width: '17%' }}>시각 (KST)</TableCell><TableCell sx={{ width: '11%' }}>행위자</TableCell><TableCell sx={{ width: '19%' }}>행위</TableCell><TableCell sx={{ width: '15%' }}>대상 유형</TableCell><TableCell sx={{ width: '28%' }}>설명</TableCell><TableCell align="center" sx={{ width: '10%' }}>행 HMAC</TableCell></TableRow></TableHead>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} align="center" sx={{ height: 180 }}><CircularProgress size={28} /></TableCell></TableRow>}
              {!loading && pageData.content.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ height: 180, color: 'text.secondary' }}>조회된 감사 로그가 없습니다.</TableCell></TableRow>}
              {!loading && pageData.content.map((log) => {
                const invalid = !log.chainValid || invalidLogUids.has(log.logUid)
                return <TableRow key={log.logUid} hover tabIndex={0} className="interactive-row" onClick={() => { setDetail(log); setEntryVerification(null); void verifyEntry(log) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { setDetail(log); setEntryVerification(null); void verifyEntry(log) } }} sx={{ cursor: 'pointer', ...(invalid ? { bgcolor: 'rgba(228, 81, 111, 0.09)' } : {}) }}><TableCell sx={{ whiteSpace: 'nowrap' }}>{formatKst(log.createdAt)}</TableCell><TableCell><StatusBadge label={log.actor} tone="neutral" /></TableCell><TableCell><Typography noWrap sx={{ fontWeight: 700, color: log.action === 'USER_VIEW_PLAIN' ? 'error.main' : 'text.primary', fontSize: 13.5 }}>{auditActionLabels[log.action] ?? log.action}</Typography></TableCell><TableCell><Typography noWrap sx={{ fontSize: 13.5 }}>{log.targetType}</Typography></TableCell><TableCell><Typography noWrap sx={{ fontSize: 13.5 }}>{log.detail}</Typography></TableCell><TableCell align="center">{verifyingUid === log.logUid ? <CircularProgress size={18} /> : <StatusBadge dot status={invalid ? 'INVALID' : 'VALID'} />}</TableCell></TableRow>
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <PaginationBar page={params.page} size={params.size} totalElements={pageData.totalElements} onPageChange={(page) => setParams((current) => ({ ...current, page }))} onSizeChange={(size) => setParams((current) => ({ ...current, page: 0, size }))} />
      </Card>

      <Dialog open={verificationOpen} onClose={() => { if (!verifyingRange) setVerificationOpen(false) }} fullWidth maxWidth="md" slotProps={{ paper: { sx: { overflow: 'hidden', borderRadius: 3 } } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}><Box sx={{ display: 'grid', width: 38, height: 38, placeItems: 'center', borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText' }}><CalendarMonthRounded /></Box><Box><Typography variant="h6">검증 기간 선택</Typography><Typography sx={{ color: 'text.secondary', fontSize: 13 }}>여정 구간을 고르듯 시작일시와 종료일시를 지정하세요.</Typography></Box></Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: '18px !important' }}>
          <Box sx={{ position: 'relative', mb: 2.5, px: { xs: 1, sm: 4 }, height: 62 }}>
            <Box sx={{ position: 'absolute', top: 27, left: { xs: 24, sm: 66 }, right: { xs: 24, sm: 66 }, height: 2, bgcolor: 'divider', overflow: 'hidden', '&::after': { content: '""', position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(54,112,246,.75), transparent)', animation: 'audit-route-shimmer 2.1s ease-in-out infinite', '@keyframes audit-route-shimmer': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(100%)' } } } }} />
            <Box sx={{ position: 'absolute', top: 15, left: { xs: 18, sm: 60 }, width: 26, height: 26, borderRadius: '50%', border: '6px solid', borderColor: 'background.paper', bgcolor: 'primary.main', boxShadow: '0 0 0 2px rgba(54,112,246,.18)' }} />
            <FlightTakeoffRounded sx={{ position: 'absolute', zIndex: 1, top: 15, color: 'primary.main', animation: 'audit-flight 2.1s ease-in-out infinite', '@keyframes audit-flight': { '0%': { left: '12%', opacity: 0, transform: 'translateY(5px) rotate(-5deg)' }, '18%': { opacity: 1 }, '82%': { opacity: 1 }, '100%': { left: '82%', opacity: 0, transform: 'translateY(-5px) rotate(4deg)' } } }} />
            <Box sx={{ position: 'absolute', top: 15, right: { xs: 18, sm: 60 }, width: 26, height: 26, borderRadius: '50%', border: '6px solid', borderColor: 'background.paper', bgcolor: 'secondary.main', boxShadow: '0 0 0 2px rgba(89,200,183,.22)' }} />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr auto 1fr' }, alignItems: 'stretch', gap: 1.5 }}>
            <Box sx={{ p: 2.25, border: '1px solid', borderColor: 'primary.main', borderRadius: 2.5, bgcolor: 'rgba(54,112,246,.045)', transition: 'transform .2s ease, box-shadow .2s ease', '&:focus-within': { transform: 'translateY(-3px)', boxShadow: '0 12px 28px rgba(54,112,246,.13)' } }}>
              <Typography sx={{ mb: .5, color: 'primary.main', fontWeight: 850, fontSize: 12, letterSpacing: '.08em' }}>START</Typography>
              <Typography sx={{ mb: 1.5, fontWeight: 800 }}>시작일시</Typography>
              <TextField data-testid="audit-verify-from" fullWidth type="datetime-local" value={verificationRange.from} onChange={(event) => setVerificationRange((current) => ({ ...current, from: event.target.value }))} slotProps={{ htmlInput: { max: verificationRange.to || localDateTimeValue(new Date()) } }} />
            </Box>
            <Box sx={{ display: { xs: 'none', md: 'grid' }, placeItems: 'center', color: 'text.disabled', fontSize: 22 }}>→</Box>
            <Box sx={{ p: 2.25, border: '1px solid', borderColor: 'secondary.main', borderRadius: 2.5, bgcolor: 'rgba(89,200,183,.055)', transition: 'transform .2s ease, box-shadow .2s ease', '&:focus-within': { transform: 'translateY(-3px)', boxShadow: '0 12px 28px rgba(89,200,183,.14)' } }}>
              <Typography sx={{ mb: .5, color: 'secondary.dark', fontWeight: 850, fontSize: 12, letterSpacing: '.08em' }}>END</Typography>
              <Typography sx={{ mb: 1.5, fontWeight: 800 }}>종료일시</Typography>
              <TextField data-testid="audit-verify-to" fullWidth type="datetime-local" value={verificationRange.to} onChange={(event) => setVerificationRange((current) => ({ ...current, to: event.target.value }))} slotProps={{ htmlInput: { min: verificationRange.from, max: localDateTimeValue(new Date()) } }} />
            </Box>
          </Box>
          <Alert severity="info" sx={{ mt: 2 }}>선택 기간 내부의 모든 행 HMAC과 첫 행의 이전 연결, 마지막 행의 다음 연결 또는 최종 체인 헤드까지 검증합니다.</Alert>
          {verificationRangeError && <Alert severity="error" sx={{ mt: 1.5 }}>{verificationRangeError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}><Button color="inherit" disabled={verifyingRange} onClick={() => setVerificationOpen(false)}>취소</Button><Button data-testid="audit-verify-submit" variant="contained" disabled={verifyingRange} startIcon={verifyingRange ? <CircularProgress size={17} color="inherit" /> : <FactCheckRounded />} onClick={() => void verifyChain()}>{verifyingRange ? '검증 중' : '선택 기간 검증'}</Button></DialogActions>
      </Dialog>

      <Drawer anchor="right" open={Boolean(detail)} onClose={() => { setDetail(null); setEntryVerification(null) }} slotProps={{ backdrop: { sx: { bgcolor: 'rgba(20,29,48,.34)', backdropFilter: 'blur(5px)' } }, paper: { sx: { width: { xs: '100%', sm: 720, xl: 880 }, maxWidth: '100%', borderRadius: { sm: '18px 0 0 18px' }, boxShadow: '-24px 0 64px rgba(25,42,78,.2)' } } }}>
        <Box sx={{ height: '100%', overflowY: 'auto' }}>
          <Box sx={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, px: 3, py: 2.25, bgcolor: 'background.paper', borderBottom: '2px solid', borderColor: 'divider' }}><Box sx={{ minWidth: 0 }}><Typography variant="h6">감사 이벤트 · 해시 체인 무결성</Typography><Typography noWrap sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: 11 }}>{detail?.logUid}</Typography></Box><Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}><StatusBadge dot label="3초 실시간 검증" tone="positive" minWidth={0} /><IconButton aria-label="감사 이벤트 닫기" onClick={() => { setDetail(null); setEntryVerification(null) }}><CloseRounded /></IconButton></Stack></Box>
          {detail && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0,1fr))' }, alignItems: 'stretch', gap: 2, p: 3 }}>
              <Box sx={{ minWidth: 0, p: 2.25, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                <Typography sx={{ minHeight: 24, mb: 1.5, fontSize: 12, fontWeight: 850, letterSpacing: '.08em', color: 'text.secondary' }}>EVENT</Typography>
                <InfoRow label="로그 UID" value={detail.logUid} /><InfoRow label="행위자" value={detail.actor} /><InfoRow label="행위" value={auditActionLabels[detail.action] ?? detail.action} /><InfoRow label="대상 유형" value={detail.targetType} /><InfoRow label="기록 시각" value={`${formatKst(detail.createdAt)} KST`} />
                <Box sx={{ mt: 1.5 }}><Typography sx={{ mb: .75, color: 'text.secondary', fontSize: 12.5, fontWeight: 750 }}>상세</Typography><Box component="pre" sx={{ m: 0, minHeight: 92, p: 1.5, border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 13, lineHeight: 1.6 }}>{detail.detail}</Box></Box>
              </Box>
              <Box sx={{ minWidth: 0, p: 2.25, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                <Typography sx={{ minHeight: 24, mb: 1.5, fontSize: 12, fontWeight: 850, letterSpacing: '.08em', color: 'text.secondary' }}>CHAIN VERIFICATION</Typography>
                {verifyingUid === detail.logUid && <Box sx={{ display: 'grid', minHeight: 220, placeItems: 'center' }}><CircularProgress size={28} /></Box>}
                {entryVerification && <><Alert severity={entryVerification.valid ? 'success' : 'error'} sx={{ mb: 2 }}>{entryVerification.valid ? '선택 행과 인접 체인이 정상입니다.' : '선택 행 구간에서 위변조 가능성이 발견되었습니다.'}</Alert><InfoRow label="행 HMAC" value={<StatusBadge dot status={entryVerification.rowHashValid ? 'VALID' : 'INVALID'} />} /><InfoRow label="이전 연결" value={<StatusBadge dot status={entryVerification.previousLinkValid ? 'VALID' : 'INVALID'} label={entryVerification.previousLinkValid ? 'prev_hash 일치' : 'prev_hash 불일치'} />} /><InfoRow label="다음 연결" value={<StatusBadge dot status={entryVerification.nextLinkValid ? 'VALID' : 'INVALID'} label={entryVerification.nextLinkValid ? 'next.prev_hash 일치' : 'next.prev_hash 불일치'} />} /><InfoRow label="체인 헤드" value={<StatusBadge dot status={entryVerification.chainHeadValid ? 'VALID' : 'INVALID'} label={entryVerification.nextLogUid ? '중간 행' : entryVerification.chainHeadValid ? '최종 헤드 일치' : '최종 헤드 불일치'} />} /><InfoRow label="검증 시각" value={`${formatKst(entryVerification.verifiedAt)} KST`} /></>}
              </Box>
            </Box>
          )}
        </Box>
      </Drawer>
    </Box>
  )
}

export default AuditLog
