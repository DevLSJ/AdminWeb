import { useMemo, useState } from 'react'
import { ArrowBackRounded, AutorenewRounded, EditRounded, HistoryRounded, QueryStatsRounded, ShieldRounded } from '@mui/icons-material'
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, InputLabel, MenuItem, Select, Stack, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { InfoRow, PageHeader, StatusChip } from '../../components/admin/AdminPage'
import { useAuth } from '../../hooks/useAuth'
import { useKmsMock } from '../../hooks/useKmsMock'
import { getManualKeyStatusTransitions, mockKeyUsage } from '../../mocks/adminData'
import type { AutoRotationDays, KeyPurpose, KeyStatus } from '../../types/api'
import { isAdminRole } from '../../types/auth'
import { getStatusLabel } from '../../utils/status'

const usageLabels: Record<string, string> = { total: '전체 사용', success: '성공', failure: '실패', encrypt: '암호화', decrypt: '복호화' }

function KeyDetail() {
  const { user } = useAuth()
  const { keys, keyHistories, keyVersions, autoRotationByKey, updateKeyMetadata, changeKeyStatus, rotateKey, setAutoRotation } = useKmsMock()
  const isAdmin = isAdminRole(user?.role)
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const key = useMemo(() => keys.find((item) => item.keyUid === id) ?? keys[0], [id, keys])
  const versions = keyVersions[key.keyUid] ?? []
  const histories = keyHistories[key.keyUid] ?? []
  const autoRotation = autoRotationByKey[key.keyUid] ?? null
  const [tab, setTab] = useState(0)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ keyName: key.keyName, purpose: key.purpose, expireAt: key.expireAt })
  const [statusOpen, setStatusOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [toStatus, setToStatus] = useState<KeyStatus | ''>('')
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')

  const openEdit = () => {
    setEditForm({ keyName: key.keyName, purpose: key.purpose, expireAt: key.expireAt })
    setEditOpen(true)
  }

  const saveMetadata = () => {
    updateKeyMetadata(key.keyUid, editForm)
    setEditOpen(false)
    setNotice('키 메타정보가 수정되고 무결성 해시가 재계산되었습니다.')
  }

  const applyStatus = () => {
    if (!toStatus || !reason.trim()) return
    const previousStatus = key.status
    changeKeyStatus(key.keyUid, toStatus, reason)
    setNotice(`${getStatusLabel(previousStatus)} → ${getStatusLabel(toStatus)} 상태 전이가 처리되고 이력·감사 로그에 기록되었습니다.`)
    setStatusOpen(false)
  }

  const executeRotation = () => {
    const previousVersion = key.version
    const newVersion = rotateKey(key.keyUid)
    if (!newVersion) return
    setRotateOpen(false)
    setNotice(`v${previousVersion}은 구버전·복호화 전용으로 유지되고, v${newVersion}이 활성 상태로 생성되었습니다.`)
  }

  const updateAutoRotation = (value: string | number) => {
    const days: AutoRotationDays = value === 'NONE' ? null : Number(value) as 30 | 60 | 90
    setAutoRotation(key.keyUid, days)
    setNotice(`자동 갱신 주기가 ${days ? `${days}일` : '미사용'}로 설정되었습니다.`)
  }

  return (
    <Box>
      <PageHeader title="키 상세" description="키 값은 노출하지 않고 메타정보, 버전, 무결성, 상태 이력과 사용 통계만 제공합니다." action={<Stack direction="row" spacing={1}><Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/keys')}>목록</Button>{isAdmin && <Button variant="outlined" startIcon={<EditRounded />} onClick={openEdit}>메타정보 수정</Button>}</Stack>} />
      {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}
      {!key.integrityValid && <Alert severity="error" sx={{ mb: 2 }}>무결성 검증에 실패했습니다. 읽기 외 작업을 중단하고 상태 충돌로 처리해야 합니다.</Alert>}

      <Card sx={{ mb: 2.5 }}><Tabs value={tab} onChange={(_event, value) => setTab(value)} aria-label="키 상세 탭"><Tab label="개요" /><Tab label="버전 관리" /></Tabs></Card>

      {tab === 0 ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.35fr) minmax(320px, 0.65fr)' }, gap: 2.5 }}>
          <Stack spacing={2.5}>
            <Card><CardContent sx={{ p: 3 }}><Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}><Typography variant="h6">키 메타정보</Typography><StatusChip status={key.status} /></Box><Divider /><InfoRow label="키 UID" value={<Typography sx={{ fontFamily: 'monospace', fontSize: 12.5, wordBreak: 'break-all' }}>{key.keyUid}</Typography>} /><InfoRow label="키 이름" value={key.keyName} /><InfoRow label="알고리즘" value={`${key.algorithm}-${key.keySize}`} /><InfoRow label="용도" value={key.purpose} /><InfoRow label="현재 버전" value={`v${key.version}`} /><InfoRow label="만료일" value={key.expireAt} /><InfoRow label="수정 시각" value={`${key.updatedAt} KST`} /><InfoRow label="무결성" value={<Chip icon={<ShieldRounded />} label={key.integrityValid ? 'HMAC 검증 정상' : '검증 실패'} color={key.integrityValid ? 'success' : 'error'} size="small" />} /></CardContent></Card>
            <Card><CardContent sx={{ p: 3 }}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}><HistoryRounded color="primary" /><Typography variant="h6">상태 전이 이력</Typography></Box>{histories.map((history, index) => <Box key={history.id} sx={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 1.5 }}><Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'primary.main', mt: 0.7 }} />{index < histories.length - 1 && <Box sx={{ width: 2, flex: 1, minHeight: 55, bgcolor: 'divider' }} />}</Box><Box sx={{ pb: 2.5 }}><Typography sx={{ fontWeight: 700 }}>{history.fromStatus ? getStatusLabel(history.fromStatus) : '초기'} → {getStatusLabel(history.toStatus)}</Typography><Typography sx={{ mt: 0.4, color: 'text.secondary', fontSize: 13 }}>{history.reason}</Typography><Typography sx={{ mt: 0.6, color: 'text.secondary', fontSize: 12.5 }}>{history.changedAt} · {history.changedBy}</Typography></Box></Box>)}</CardContent></Card>
          </Stack>
          <Stack spacing={2.5}>
            <Card><CardContent sx={{ p: 3 }}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}><QueryStatsRounded color="secondary" /><Typography variant="h6">사용 통계</Typography></Box><Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>{Object.entries(mockKeyUsage).map(([label, value]) => <Box key={label} sx={{ p: 1.8, borderRadius: 2, bgcolor: '#f8f9fc' }}><Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{usageLabels[label] ?? label}</Typography><Typography sx={{ mt: 0.5, fontSize: 22, fontWeight: 800 }}>{value.toLocaleString()}</Typography></Box>)}</Box></CardContent></Card>
            <Card><CardContent sx={{ p: 3 }}><Typography variant="h6" sx={{ mb: 2 }}>{isAdmin ? '생명주기 작업' : '사용 가능한 작업'}</Typography><Stack spacing={1.2}>{isAdmin && <Button fullWidth variant="contained" disabled={!key.integrityValid || getManualKeyStatusTransitions(key.status).length === 0} onClick={() => { setToStatus(''); setReason(''); setStatusOpen(true) }}>상태 변경</Button>}<Button fullWidth variant="outlined" onClick={() => navigate(`/keys/test?key=${key.keyUid}`)}>암복호화 테스트</Button>{isAdmin && <Button fullWidth color="secondary" variant="outlined" startIcon={<AutorenewRounded />} disabled={key.status === 'DESTROYED'} onClick={() => setTab(1)}>버전 관리로 이동</Button>}</Stack></CardContent></Card>
          </Stack>
        </Box>
      ) : (
        <Stack spacing={2.5}>
          <Card><CardContent sx={{ p: 3 }}><Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}><Box><Typography variant="h6">키 갱신 및 자동 순환</Typography><Typography sx={{ mt: 0.5, color: 'text.secondary' }}>새 버전은 활성화하고 기존 버전은 구버전·복호화 전용으로 보존합니다.</Typography></Box>{isAdmin && <Button variant="contained" startIcon={<AutorenewRounded />} disabled={!key.integrityValid || key.status === 'DESTROYED'} onClick={() => setRotateOpen(true)}>수동 키 갱신</Button>}</Box><Divider sx={{ my: 2.5 }} /><Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}><Typography sx={{ minWidth: 150, fontWeight: 700 }}>자동 갱신 주기</Typography><FormControl size="small" sx={{ minWidth: 180 }} disabled={!isAdmin}><InputLabel>갱신 주기</InputLabel><Select label="갱신 주기" value={autoRotation ?? 'NONE'} onChange={(event) => updateAutoRotation(event.target.value)}><MenuItem value="NONE">미사용</MenuItem><MenuItem value={30}>30일</MenuItem><MenuItem value={60}>60일</MenuItem><MenuItem value={90}>90일</MenuItem></Select></FormControl><Typography sx={{ color: 'text.secondary', fontSize: 13 }}>실제 연동 시 스케줄러가 만료 예정일과 정책을 확인해 자동 갱신합니다.</Typography></Box></CardContent></Card>
          <Card><CardContent sx={{ p: 0 }}><Box sx={{ px: 3, pt: 3, pb: 1 }}><Typography variant="h6">버전 이력</Typography></Box><TableContainer><Table><TableHead><TableRow sx={{ bgcolor: '#f8f9fc' }}><TableCell>버전</TableCell><TableCell>상태</TableCell><TableCell>사용 범위</TableCell><TableCell>생성자</TableCell><TableCell>생성 시각</TableCell></TableRow></TableHead><TableBody>{versions.map((version) => <TableRow key={version.version} hover><TableCell><Typography sx={{ fontWeight: 800 }}>v{version.version}</Typography></TableCell><TableCell><StatusChip status={version.status} /></TableCell><TableCell>{version.decryptOnly ? <Chip label="복호화 전용" color="warning" size="small" variant="outlined" /> : <Chip label="암호화·복호화" color="success" size="small" variant="outlined" />}</TableCell><TableCell>{version.createdBy}</TableCell><TableCell>{version.createdAt}</TableCell></TableRow>)}</TableBody></Table></TableContainer></CardContent></Card>
        </Stack>
      )}

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm"><DialogTitle>키 메타정보 수정</DialogTitle><DialogContent><TextField fullWidth label="키 이름" value={editForm.keyName} onChange={(event) => setEditForm((current) => ({ ...current, keyName: event.target.value }))} sx={{ mt: 1, mb: 2 }} /><FormControl fullWidth sx={{ mb: 2 }}><InputLabel>용도</InputLabel><Select label="용도" value={editForm.purpose} onChange={(event) => setEditForm((current) => ({ ...current, purpose: event.target.value as KeyPurpose }))}><MenuItem value="ENCRYPT">데이터 암복호화</MenuItem><MenuItem value="SIGN">전자서명</MenuItem><MenuItem value="AUTH">메시지 인증</MenuItem><MenuItem value="WRAP">키 래핑</MenuItem></Select></FormControl><TextField fullWidth type="date" label="만료일" value={editForm.expireAt} onChange={(event) => setEditForm((current) => ({ ...current, expireAt: event.target.value }))} slotProps={{ inputLabel: { shrink: true } }} helperText="저장 시 무결성 해시를 재계산합니다." /></DialogContent><DialogActions><Button onClick={() => setEditOpen(false)}>취소</Button><Button variant="contained" disabled={!editForm.keyName.trim() || !editForm.expireAt} onClick={saveMetadata}>저장</Button></DialogActions></Dialog>
      <Dialog open={statusOpen} onClose={() => setStatusOpen(false)} fullWidth maxWidth="sm"><DialogTitle>상태 변경</DialogTitle><DialogContent><Alert severity="warning" sx={{ mb: 2 }}>배포와 갱신 상태는 전용 기능에서만 변경할 수 있으며, 폐기 상태에서는 다른 상태로 전환할 수 없습니다.</Alert><FormControl fullWidth sx={{ mb: 2 }}><InputLabel>변경 상태</InputLabel><Select label="변경 상태" value={toStatus} onChange={(event) => setToStatus(event.target.value as KeyStatus)}>{getManualKeyStatusTransitions(key.status).map((status) => <MenuItem key={status} value={status}>{getStatusLabel(status)}</MenuItem>)}</Select></FormControl><TextField fullWidth required multiline minRows={3} label="변경 사유" value={reason} onChange={(event) => setReason(event.target.value)} /></DialogContent><DialogActions><Button onClick={() => setStatusOpen(false)}>취소</Button><Button variant="contained" disabled={!toStatus || !reason.trim()} onClick={applyStatus}>변경 실행</Button></DialogActions></Dialog>
      <Dialog open={rotateOpen} onClose={() => setRotateOpen(false)} fullWidth maxWidth="sm"><DialogTitle>수동 키 갱신</DialogTitle><DialogContent><Alert severity="info" sx={{ mb: 2 }}>현재 v{key.version}은 구버전으로 전환해 복호화 전용으로 유지하고, 신규 v{key.version + 1}을 활성 상태로 생성합니다.</Alert><InfoRow label="대상 키" value={key.keyName} /><InfoRow label="현재 상태" value={<StatusChip status={key.status} />} /><InfoRow label="자동 갱신" value={autoRotation ? `${autoRotation}일` : '미사용'} /></DialogContent><DialogActions><Button onClick={() => setRotateOpen(false)}>취소</Button><Button variant="contained" startIcon={<AutorenewRounded />} onClick={executeRotation}>v{key.version + 1} 생성 및 활성화</Button></DialogActions></Dialog>
    </Box>
  )
}

export default KeyDetail
