import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { DownloadRounded, FactCheckRounded, SearchRounded, VerifiedRounded, WarningAmberRounded } from '@mui/icons-material'
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
  FormControl,
  InputAdornment,
  InputLabel,
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
import { StatusBadge } from '../../components/common/StatusBadge'
import type { AuditAction, AuditEntryVerification, AuditListParams, AuditLog as AuditLogType, AuditVerification, PageResponse } from '../../types/api'

const auditActions: Array<AuditAction | 'ALL'> = [
  'ALL', 'LOGIN', 'LOGOUT', 'SESSION_REFRESH', 'KEY_CREATE', 'KEY_UPDATE', 'KEY_DELETE',
  'KEY_STATUS_CHANGE', 'KEY_DEPLOY', 'KEY_DEPLOY_ROLLBACK', 'KEY_ROTATE',
  'KEY_AUTO_ROTATION_UPDATE', 'KEY_TEST', 'USER_CREATE', 'USER_UPDATE',
  'USER_VIEW_PLAIN', 'USER_STATUS_CHANGE', 'USER_PASSWORD_RESET', 'AUDIT_EXPORT',
  'NOTICE_CREATE', 'NOTICE_UPDATE', 'NOTICE_DELETE', 'FILE_DOWNLOAD',
]

const auditActionLabels: Record<AuditAction | 'ALL', string> = {
  ALL: '전체 행위', LOGIN: '로그인', LOGOUT: '로그아웃', SESSION_REFRESH: '세션 연장',
  KEY_CREATE: '키 생성', KEY_UPDATE: '키 수정', KEY_DELETE: '키 삭제', KEY_STATUS_CHANGE: '키 상태 변경',
  KEY_DEPLOY: '키 배포', KEY_DEPLOY_ROLLBACK: '키 배포 롤백', KEY_ROTATE: '키 갱신',
  KEY_AUTO_ROTATION_UPDATE: '자동 갱신 설정', KEY_TEST: '키 테스트', USER_CREATE: '사용자 생성',
  USER_UPDATE: '사용자 수정', USER_VIEW_PLAIN: '개인정보 원문 조회', USER_STATUS_CHANGE: '사용자 상태 변경',
  USER_PASSWORD_RESET: '비밀번호 재설정', AUDIT_EXPORT: '감사 CSV 내보내기', NOTICE_CREATE: '공지 생성',
  NOTICE_UPDATE: '공지 수정', NOTICE_DELETE: '공지 삭제', FILE_DOWNLOAD: '파일 내려받기',
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

function AuditLog() {
  const [draft, setDraft] = useState(defaultParams)
  const [params, setParams] = useState(defaultParams)
  const [pageData, setPageData] = useState(emptyPage)
  const [loading, setLoading] = useState(true)
  const [verification, setVerification] = useState<AuditVerification | null>(null)
  const [detail, setDetail] = useState<AuditLogType | null>(null)
  const [entryVerification, setEntryVerification] = useState<AuditEntryVerification | null>(null)
  const [verifyingUid, setVerifyingUid] = useState<string | null>(null)
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

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setParams({ ...draft, page: 0 })
  }

  const verifyChain = async () => {
    setError('')
    try {
      setVerification(await verifyAuditLogs())
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '감사 로그 체인을 검증하지 못했습니다.'))
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
        description="서버의 append-only 감사 이벤트를 검색하고 행 HMAC·prev_hash 연결·체인 헤드를 한 번에 검증합니다."
        action={<Stack direction="row" spacing={1}><Button data-testid="audit-verify-button" variant="outlined" startIcon={<FactCheckRounded />} onClick={() => void verifyChain()}>해시 체인 검증</Button><Button variant="contained" startIcon={<DownloadRounded />} onClick={() => void exportCsv()}>서명 CSV 내려받기</Button></Stack>}
      />
      {verification?.valid && <Alert data-testid="audit-verify-success" icon={<VerifiedRounded />} severity="success" onClose={() => setVerification(null)} sx={{ mb: 2 }}>총 {verification.checkedCount.toLocaleString()}건의 행 HMAC, prev_hash 연결, 최종 체인 헤드가 정상입니다. · {formatKst(verification.verifiedAt)} KST</Alert>}
      {verification && !verification.valid && <Alert icon={<WarningAmberRounded />} severity="error" onClose={() => setVerification(null)} sx={{ mb: 2 }}>해시 체인 검증 실패: {verification.invalidLogUids.length ? verification.invalidLogUids.join(', ') : '체인 헤드'} 구간의 변조 또는 삭제 가능성을 확인하세요.</Alert>}
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
        <TableContainer sx={{ maxHeight: 'calc(100vh - 390px)', minHeight: 290 }}>
          <Table stickyHeader size="small" sx={{ minWidth: 980, tableLayout: 'fixed' }}>
            <TableHead><TableRow><TableCell sx={{ width: '16%' }}>시각 (KST)</TableCell><TableCell sx={{ width: '10%' }}>행위자</TableCell><TableCell sx={{ width: '16%' }}>행위</TableCell><TableCell sx={{ width: '21%' }}>대상</TableCell><TableCell sx={{ width: '27%' }}>설명</TableCell><TableCell sx={{ width: '10%' }}>행 HMAC</TableCell></TableRow></TableHead>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} align="center" sx={{ height: 180 }}><CircularProgress size={28} /></TableCell></TableRow>}
              {!loading && pageData.content.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ height: 180, color: 'text.secondary' }}>조회된 감사 로그가 없습니다.</TableCell></TableRow>}
              {!loading && pageData.content.map((log) => {
                const invalid = !log.chainValid || invalidLogUids.has(log.logUid)
                return <TableRow key={log.logUid} hover tabIndex={0} className="interactive-row" onClick={() => { setDetail(log); setEntryVerification(null); void verifyEntry(log) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { setDetail(log); setEntryVerification(null); void verifyEntry(log) } }} sx={{ cursor: 'pointer', ...(invalid ? { bgcolor: 'rgba(228, 81, 111, 0.09)' } : {}) }}><TableCell sx={{ whiteSpace: 'nowrap' }}>{formatKst(log.createdAt)}</TableCell><TableCell><StatusBadge label={log.actor} tone="neutral" /></TableCell><TableCell><Typography sx={{ fontWeight: 700, color: log.action === 'USER_VIEW_PLAIN' ? 'error.main' : 'text.primary', fontSize: 13.5 }}>{auditActionLabels[log.action] ?? log.action}</Typography></TableCell><TableCell><Typography noWrap sx={{ fontSize: 13.5 }}>{log.targetType}</Typography><Typography noWrap sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: 11.5 }}>{log.targetId}</Typography></TableCell><TableCell><Typography noWrap sx={{ fontSize: 13.5 }}>{log.detail}</Typography></TableCell><TableCell>{verifyingUid === log.logUid ? <CircularProgress size={18} /> : <StatusBadge status={invalid ? 'INVALID' : 'VALID'} />}</TableCell></TableRow>
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <PaginationBar page={params.page} size={params.size} totalElements={pageData.totalElements} onPageChange={(page) => setParams((current) => ({ ...current, page }))} onSizeChange={(size) => setParams((current) => ({ ...current, page: 0, size }))} />
      </Card>

      <Dialog open={Boolean(detail)} onClose={() => { setDetail(null); setEntryVerification(null) }} fullWidth maxWidth="md" slotProps={{ paper: { sx: { borderRadius: 1 } } }}>
        <DialogTitle>감사 이벤트 · 해시 체인 무결성</DialogTitle>
        <DialogContent dividers>{detail && <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1fr) minmax(320px,.85fr)' }, gap: 3 }}><Box><Typography sx={{ mb: 1, fontSize: 12, fontWeight: 850, letterSpacing: '.08em', color: 'text.secondary' }}>EVENT</Typography><InfoRow label="로그 UID" value={detail.logUid} /><InfoRow label="행위자" value={detail.actor} /><InfoRow label="행위" value={auditActionLabels[detail.action] ?? detail.action} /><InfoRow label="대상 유형" value={detail.targetType} /><InfoRow label="대상 ID" value={detail.targetId} /><InfoRow label="기록 시각" value={`${formatKst(detail.createdAt)} KST`} /><InfoRow label="상세" value={<Box component="pre" sx={{ m: 0, p: 1.5, border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 13, lineHeight: 1.6 }}>{detail.detail}</Box>} /></Box><Box sx={{ p: 2, borderLeft: { md: '1px solid' }, borderColor: { md: 'divider' } }}><Typography sx={{ mb: 1.5, fontSize: 12, fontWeight: 850, letterSpacing: '.08em', color: 'text.secondary' }}>CHAIN VERIFICATION</Typography>{verifyingUid === detail.logUid && <Box sx={{ display: 'grid', minHeight: 220, placeItems: 'center' }}><CircularProgress size={28} /></Box>}{entryVerification && <><Alert severity={entryVerification.valid ? 'success' : 'error'} sx={{ mb: 2 }}>{entryVerification.valid ? '선택 행과 인접 체인이 정상입니다.' : '선택 행 구간에서 위변조 가능성이 발견되었습니다.'}</Alert><InfoRow label="행 HMAC" value={<StatusBadge status={entryVerification.rowHashValid ? 'VALID' : 'INVALID'} />} /><InfoRow label="이전 연결" value={<StatusBadge status={entryVerification.previousLinkValid ? 'VALID' : 'INVALID'} label={entryVerification.previousLinkValid ? 'prev_hash 일치' : 'prev_hash 불일치'} />} /><InfoRow label="다음 연결" value={<StatusBadge status={entryVerification.nextLinkValid ? 'VALID' : 'INVALID'} label={entryVerification.nextLinkValid ? 'next.prev_hash 일치' : 'next.prev_hash 불일치'} />} /><InfoRow label="체인 헤드" value={<StatusBadge status={entryVerification.chainHeadValid ? 'VALID' : 'INVALID'} label={entryVerification.nextLogUid ? '중간 행' : entryVerification.chainHeadValid ? '최종 헤드 일치' : '최종 헤드 불일치'} />} /><InfoRow label="이전 로그" value={entryVerification.previousLogUid ?? 'Genesis'} /><InfoRow label="다음 로그" value={entryVerification.nextLogUid ?? 'Chain head'} /><InfoRow label="검증 시각" value={`${formatKst(entryVerification.verifiedAt)} KST`} /></>}</Box></Box>}</DialogContent>
        <DialogActions><Button variant="contained" onClick={() => { setDetail(null); setEntryVerification(null) }}>닫기</Button></DialogActions>
      </Dialog>
    </Box>
  )
}

export default AuditLog
