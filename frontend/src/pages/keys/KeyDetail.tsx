import { useMemo, useState } from 'react'
import { ArrowBackRounded, AutorenewRounded, EditRounded, HistoryRounded, QueryStatsRounded, ShieldRounded } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { InfoRow, PageHeader, StatusChip } from '../../components/admin/AdminPage'
import { keyStatusTransitions, mockKeyHistory, mockKeys, mockKeyUsage } from '../../mocks/adminData'
import type { KeyStatus } from '../../types/api'

function KeyDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const initialKey = useMemo(() => mockKeys.find((item) => item.keyUid === id) ?? mockKeys[0], [id])
  const [key, setKey] = useState(initialKey)
  const [editOpen, setEditOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [toStatus, setToStatus] = useState<KeyStatus | ''>('')
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')

  const applyStatus = () => {
    if (!toStatus || !reason.trim()) return
    setKey((current) => ({ ...current, status: toStatus, updatedAt: '2026-08-19 16:45:00' }))
    setNotice(`상태 전이 ${key.status} → ${toStatus}가 처리되고 이력·감사로그에 기록되었습니다.`)
    setStatusOpen(false)
  }

  const rotateKey = () => {
    setKey((current) => ({ ...current, version: current.version + 1, status: 'ACTIVE', updatedAt: '2026-08-19 16:50:00' }))
    setNotice('심화 기능: 신규 버전 키가 생성되고 이전 버전은 INACTIVE 처리되었습니다.')
  }

  return (
    <Box>
      <PageHeader title="키 상세" description="키 값은 반환하지 않고 메타정보, 무결성, 상태 이력과 사용 통계만 제공합니다." action={<Stack direction="row" spacing={1}><Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/keys')}>목록</Button><Button variant="outlined" startIcon={<EditRounded />} onClick={() => setEditOpen(true)}>메타정보 수정</Button></Stack>} />
      {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}
      {!key.integrityValid && <Alert severity="error" sx={{ mb: 2 }}>무결성 검증에 실패했습니다. 읽기 외 작업을 중단하고 409 상태 충돌로 처리해야 합니다.</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.35fr) minmax(320px, 0.65fr)' }, gap: 2.5 }}>
        <Stack spacing={2.5}>
          <Card><CardContent sx={{ p: 3 }}><Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}><Typography variant="h6">키 메타정보</Typography><StatusChip status={key.status} /></Box><Divider /><InfoRow label="key_uid" value={<Typography sx={{ fontFamily: 'monospace', fontSize: 12.5, wordBreak: 'break-all' }}>{key.keyUid}</Typography>} /><InfoRow label="키 이름" value={key.keyName} /><InfoRow label="알고리즘" value={`${key.algorithm}-${key.keySize}`} /><InfoRow label="용도" value={key.purpose} /><InfoRow label="버전" value={`v${key.version}`} /><InfoRow label="만료일" value={key.expireAt} /><InfoRow label="수정 시각" value={`${key.updatedAt} KST`} /><InfoRow label="무결성" value={<Chip icon={<ShieldRounded />} label={key.integrityValid ? 'HMAC 검증 정상' : '검증 실패'} color={key.integrityValid ? 'success' : 'error'} size="small" />} /></CardContent></Card>
          <Card><CardContent sx={{ p: 3 }}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}><HistoryRounded color="primary" /><Typography variant="h6">상태 전이 이력</Typography></Box>{mockKeyHistory.map((history, index) => <Box key={history.id} sx={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 1.5 }}><Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'primary.main', mt: 0.7 }} />{index < mockKeyHistory.length - 1 && <Box sx={{ width: 2, flex: 1, minHeight: 55, bgcolor: 'divider' }} />}</Box><Box sx={{ pb: 2.5 }}><Typography sx={{ fontWeight: 700 }}>{history.fromStatus ?? '초기'} → {history.toStatus}</Typography><Typography sx={{ mt: 0.4, color: 'text.secondary', fontSize: 12.5 }}>{history.reason}</Typography><Typography sx={{ mt: 0.6, color: 'text.secondary', fontSize: 11.5 }}>{history.changedAt} · {history.changedBy}</Typography></Box></Box>)}</CardContent></Card>
        </Stack>
        <Stack spacing={2.5}>
          <Card><CardContent sx={{ p: 3 }}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}><QueryStatsRounded color="secondary" /><Typography variant="h6">사용 통계</Typography></Box><Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>{Object.entries(mockKeyUsage).map(([label, value]) => <Box key={label} sx={{ p: 1.8, borderRadius: 2, bgcolor: '#f8f9fc' }}><Typography sx={{ color: 'text.secondary', fontSize: 11.5 }}>{label.toUpperCase()}</Typography><Typography sx={{ mt: 0.5, fontSize: 22, fontWeight: 800 }}>{value.toLocaleString()}</Typography></Box>)}</Box></CardContent></Card>
          <Card><CardContent sx={{ p: 3 }}><Typography variant="h6" sx={{ mb: 2 }}>생명주기 작업</Typography><Stack spacing={1.2}><Button fullWidth variant="contained" disabled={!key.integrityValid || keyStatusTransitions[key.status].length === 0} onClick={() => { setToStatus(''); setReason(''); setStatusOpen(true) }}>상태 변경</Button><Button fullWidth variant="outlined" onClick={() => navigate(`/keys/test?key=${key.keyUid}`)}>암복호화 테스트</Button><Button fullWidth color="secondary" variant="outlined" startIcon={<AutorenewRounded />} disabled={key.status === 'DESTROYED'} onClick={rotateKey}>키 교체 (심화)</Button></Stack></CardContent></Card>
        </Stack>
      </Box>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm"><DialogTitle>키 메타정보 수정</DialogTitle><DialogContent><TextField fullWidth label="키 이름" value={key.keyName} onChange={(event) => setKey((current) => ({ ...current, keyName: event.target.value }))} sx={{ mt: 1, mb: 2 }} /><FormControl fullWidth sx={{ mb: 2 }}><InputLabel>용도</InputLabel><Select label="용도" value={key.purpose} onChange={(event) => setKey((current) => ({ ...current, purpose: event.target.value as typeof current.purpose }))}><MenuItem value="ENCRYPT">ENCRYPT</MenuItem><MenuItem value="SIGN">SIGN</MenuItem><MenuItem value="AUTH">AUTH</MenuItem><MenuItem value="WRAP">WRAP</MenuItem></Select></FormControl><TextField fullWidth type="date" label="만료일" value={key.expireAt} onChange={(event) => setKey((current) => ({ ...current, expireAt: event.target.value }))} slotProps={{ inputLabel: { shrink: true } }} helperText="저장 시 integrity_hash를 재계산합니다." /></DialogContent><DialogActions><Button onClick={() => setEditOpen(false)}>취소</Button><Button variant="contained" onClick={() => { setEditOpen(false); setNotice('메타정보가 수정되고 무결성 해시가 재계산되었습니다.') }}>저장</Button></DialogActions></Dialog>
      <Dialog open={statusOpen} onClose={() => setStatusOpen(false)} fullWidth maxWidth="sm"><DialogTitle>상태 전이</DialogTitle><DialogContent><Alert severity="warning" sx={{ mb: 2 }}>DESTROYED에서 나가는 전이와 CREATED → DESTROYED 직행은 금지됩니다.</Alert><FormControl fullWidth sx={{ mb: 2 }}><InputLabel>변경 상태</InputLabel><Select label="변경 상태" value={toStatus} onChange={(event) => setToStatus(event.target.value as KeyStatus)}>{keyStatusTransitions[key.status].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</Select></FormControl><TextField fullWidth required multiline minRows={3} label="변경 사유" value={reason} onChange={(event) => setReason(event.target.value)} /></DialogContent><DialogActions><Button onClick={() => setStatusOpen(false)}>취소</Button><Button variant="contained" disabled={!toStatus || !reason.trim()} onClick={applyStatus}>전이 실행</Button></DialogActions></Dialog>
    </Box>
  )
}

export default KeyDetail
