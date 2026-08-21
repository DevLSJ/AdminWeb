import { useMemo, useState } from 'react'
import { DownloadRounded, FactCheckRounded, SearchRounded, VerifiedRounded, WarningAmberRounded } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
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
import { FilterCard, InfoRow, PageHeader, PaginationBar } from '../../components/admin/AdminPage'
import { StatusBadge } from '../../components/common/StatusBadge'
import { useKmsMock } from '../../hooks/useKmsMock'
import type { AuditAction, AuditListParams, AuditLog as AuditLogType } from '../../types/api'

const auditActions: Array<AuditAction | 'ALL'> = ['ALL', 'LOGIN', 'LOGOUT', 'KEY_CREATE', 'KEY_STATUS_CHANGE', 'KEY_DEPLOY', 'KEY_DEPLOY_ROLLBACK', 'KEY_ROTATE', 'KEY_AUTO_ROTATION_UPDATE', 'KEY_TEST', 'USER_CREATE', 'USER_UPDATE', 'USER_VIEW_PLAIN', 'USER_PASSWORD_RESET', 'NOTICE_CREATE', 'NOTICE_UPDATE', 'NOTICE_DELETE', 'FILE_DOWNLOAD']
const auditActionLabels: Record<AuditAction | 'ALL', string> = {
  ALL: '전체 행위', LOGIN: '로그인', LOGOUT: '로그아웃', KEY_CREATE: '키 생성', KEY_STATUS_CHANGE: '키 상태 변경',
  KEY_DEPLOY: '키 배포', KEY_DEPLOY_ROLLBACK: '키 배포 롤백', KEY_ROTATE: '키 갱신', KEY_AUTO_ROTATION_UPDATE: '자동 갱신 설정',
  KEY_TEST: '키 테스트', USER_CREATE: '사용자 생성', USER_UPDATE: '사용자 수정', USER_VIEW_PLAIN: '개인정보 원문 조회',
  USER_PASSWORD_RESET: '비밀번호 재설정', NOTICE_CREATE: '공지 생성', NOTICE_UPDATE: '공지 수정', NOTICE_DELETE: '공지 삭제', FILE_DOWNLOAD: '파일 내려받기',
}
const defaultParams: AuditListParams = { from: '2026-08-01', to: new Date().toISOString().slice(0, 10), actor: '', action: 'ALL', page: 0, size: 5 }

function AuditLog() {
  const { auditLogs } = useKmsMock()
  const [params, setParams] = useState(defaultParams)
  const [verifyResult, setVerifyResult] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const [detail, setDetail] = useState<AuditLogType | null>(null)

  const filteredLogs = useMemo(() => auditLogs.filter((log) => {
    const date = log.createdAt.slice(0, 10)
    return (!params.from || date >= params.from)
      && (!params.to || date <= params.to)
      && (!params.actor.trim() || log.actor.toLowerCase().includes(params.actor.trim().toLowerCase()))
      && (params.action === 'ALL' || log.action === params.action)
  }), [auditLogs, params])
  const pageContent = filteredLogs.slice(params.page * params.size, (params.page + 1) * params.size)
  const invalidLogs = auditLogs.filter((log) => !log.chainValid)

  const updateParam = <K extends keyof AuditListParams>(key: K, value: AuditListParams[K]) => setParams((current) => ({ ...current, [key]: value, page: key === 'page' ? Number(value) : 0 }))

  const verifyChain = () => setVerifyResult(invalidLogs.length > 0 ? 'invalid' : 'valid')

  const exportCsv = () => {
    const header = ['logUid', 'actor', 'action', 'targetType', 'targetId', 'createdAt', 'chainValid']
    const rows = filteredLogs.map((log) => [log.logUid, log.actor, log.action, log.targetType, log.targetId, log.createdAt, String(log.chainValid)])
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `audit-logs-${params.from}-${params.to}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Box>
      <PageHeader title="감사 로그" description="모든 관리자 행위를 검색하고 append-only 해시 체인의 변조·삭제 여부를 검증합니다." action={<Stack direction="row" spacing={1}><Button variant="outlined" startIcon={<FactCheckRounded />} onClick={verifyChain}>해시 체인 검증</Button><Button variant="contained" startIcon={<DownloadRounded />} onClick={exportCsv}>CSV 내려받기</Button></Stack>} />
      <Alert severity="info" sx={{ mb: 2.5 }}>감사로그는 append-only입니다. 화면과 API에서 UPDATE·DELETE 기능을 제공하지 않습니다.</Alert>
      {verifyResult === 'valid' && <Alert icon={<VerifiedRounded />} severity="success" onClose={() => setVerifyResult('idle')} sx={{ mb: 2 }}>prev_hash + row_hash 체인이 모두 정상입니다.</Alert>}
      {verifyResult === 'invalid' && <Alert icon={<WarningAmberRounded />} severity="error" onClose={() => setVerifyResult('idle')} sx={{ mb: 2 }}>해시 체인 검증 실패: {invalidLogs.map((log) => log.logUid).join(', ')} 구간에서 변조 또는 삭제 가능성이 발견되었습니다.</Alert>}
      <FilterCard>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(150px, 0.8fr)) 1fr 1.2fr auto' }, gap: 1.5 }}>
          <TextField size="small" type="date" label="from" value={params.from} onChange={(event) => updateParam('from', event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" type="date" label="to" value={params.to} onChange={(event) => updateParam('to', event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" label="actor" placeholder="행위자" value={params.actor} onChange={(event) => updateParam('actor', event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }} />
          <FormControl size="small"><InputLabel>행위</InputLabel><Select label="행위" value={params.action} onChange={(event) => updateParam('action', event.target.value as AuditListParams['action'])}>{auditActions.map((action) => <MenuItem key={action} value={action}>{auditActionLabels[action]}</MenuItem>)}</Select></FormControl>
          <Button color="inherit" onClick={() => setParams(defaultParams)}>초기화</Button>
        </Box>
      </FilterCard>
      <Card>
        <TableContainer><Table sx={{ minWidth: 1120 }}><TableHead><TableRow sx={{ bgcolor: '#f8f9fc' }}><TableCell>시각 (KST)</TableCell><TableCell>행위자</TableCell><TableCell>행위</TableCell><TableCell>대상</TableCell><TableCell>설명</TableCell><TableCell sx={{ minWidth: 112, whiteSpace: 'nowrap' }}>체인 검증</TableCell><TableCell align="right">상세</TableCell></TableRow></TableHead><TableBody>{pageContent.map((log) => <TableRow key={log.logUid} hover><TableCell>{log.createdAt}</TableCell><TableCell><StatusBadge label={log.actor} tone="neutral" /></TableCell><TableCell><Typography sx={{ fontWeight: 700, color: log.action === 'USER_VIEW_PLAIN' ? 'error.main' : 'text.primary', fontSize: 14 }}>{auditActionLabels[log.action]}</Typography></TableCell><TableCell><Typography sx={{ fontSize: 14 }}>{log.targetType}</Typography><Typography sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: 12.5 }}>{log.targetId}</Typography></TableCell><TableCell sx={{ maxWidth: 280 }}><Typography noWrap sx={{ fontSize: 14 }}>{log.detail}</Typography></TableCell><TableCell sx={{ minWidth: 112, whiteSpace: 'nowrap' }}><StatusBadge status={log.chainValid ? 'VALID' : 'INVALID'} /></TableCell><TableCell align="right"><Button size="small" onClick={() => setDetail(log)}>보기</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer>
        <PaginationBar page={params.page} size={params.size} totalElements={filteredLogs.length} onPageChange={(page) => updateParam('page', page)} onSizeChange={(size) => updateParam('size', size)} />
      </Card>
      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} fullWidth maxWidth="sm"><DialogTitle>감사로그 상세</DialogTitle><DialogContent>{detail && <><InfoRow label="로그 UID" value={detail.logUid} /><InfoRow label="행위자" value={detail.actor} /><InfoRow label="행위" value={auditActionLabels[detail.action]} /><InfoRow label="대상 유형" value={detail.targetType} /><InfoRow label="대상 ID" value={detail.targetId} /><InfoRow label="상세 JSON" value={<Box component="pre" sx={{ m: 0, p: 1.5, borderRadius: 2, bgcolor: '#f7f8fc', whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.6 }}>{JSON.stringify({ message: detail.detail, chainValid: detail.chainValid }, null, 2)}</Box>} /><InfoRow label="기록 시각" value={`${detail.createdAt} KST`} /></>}</DialogContent><DialogActions><Button onClick={() => setDetail(null)}>닫기</Button></DialogActions></Dialog>
    </Box>
  )
}

export default AuditLog
