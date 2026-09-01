import { useEffect, useMemo, useState } from 'react'
import { ArrowBackRounded, AutorenewRounded, EditRounded } from '@mui/icons-material'
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { InfoRow } from '../../components/admin/AdminPage'
import { StatusBadge } from '../../components/common/StatusBadge'
import { KeyLifecycleTimeline } from '../../components/keys/KeyLifecycleTimeline'
import { useAuth } from '../../hooks/useAuth'
import { useKmsMock } from '../../hooks/useKmsMock'
import { canRotateWithStatus, getManualKeyStatusTransitions } from '../../utils/keyLifecycle'
import { getKeyAlgorithmLabel, getKeyCategoryLabel } from '../../utils/keyPresentation'
import type { AutoRotationDays, KeyPurpose, KeyStatus } from '../../types/api'
import { isAdminRole } from '../../types/auth'
import { getStatusLabel } from '../../utils/status'

const usageLabels: Record<string, string> = { total: '전체 사용', success: '성공', failure: '실패', encrypt: '암호화', decrypt: '복호화' }

function KeyDetail() {
  const { user } = useAuth()
  const { keys, keyHistories, keyUsage, autoRotationByKey, loadKeyDetail, loadKeyHistory, loadKeyUsage, updateKeyMetadata, changeKeyStatus, rotateKey, setAutoRotation } = useKmsMock()
  const isAdmin = isAdminRole(user?.role)
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const key = useMemo(() => keys.find((item) => item.keyUid === id), [id, keys])
  const histories = key ? keyHistories[key.keyUid] ?? [] : []
  const usage = key ? keyUsage[key.keyUid] : undefined
  const autoRotation = key ? autoRotationByKey[key.keyUid] ?? null : null
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ keyName: '', purpose: 'ENCRYPT' as KeyPurpose, expireAt: '' })
  const [statusOpen, setStatusOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [toStatus, setToStatus] = useState<KeyStatus | ''>('')
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')
  const [requestError, setRequestError] = useState('')
  const [loading, setLoading] = useState(true)
  const [rotationDraft, setRotationDraft] = useState('')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setRequestError('')
    void Promise.all([loadKeyDetail(id), loadKeyHistory(id), loadKeyUsage(id)])
      .catch((error: unknown) => setRequestError(error instanceof Error ? error.message : '키 상세를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [id, loadKeyDetail, loadKeyHistory, loadKeyUsage])

  useEffect(() => {
    if (key) setEditForm({ keyName: key.keyName, purpose: key.purpose, expireAt: key.expireAt })
  }, [key])

  useEffect(() => setRotationDraft(autoRotation ? String(autoRotation) : ''), [autoRotation])

  const openEdit = () => {
    if (!key) return
    setEditForm({ keyName: key.keyName, purpose: key.purpose, expireAt: key.expireAt })
    setEditOpen(true)
  }

  const saveMetadata = async () => {
    if (!key) return
    try {
      await updateKeyMetadata(key.keyUid, editForm)
      setEditOpen(false)
      setNotice('키 메타정보와 무결성 해시를 갱신했습니다.')
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : '키 메타정보를 수정하지 못했습니다.')
    }
  }

  const applyStatus = async () => {
    if (!key || !toStatus || !reason.trim()) return
    const previousStatus = key.status
    try {
      await changeKeyStatus(key.keyUid, toStatus, reason)
      setNotice(`${getStatusLabel(previousStatus)} → ${getStatusLabel(toStatus)} 상태 전이가 기록되었습니다.`)
      setStatusOpen(false)
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : '키 상태를 변경하지 못했습니다.')
    }
  }

  const executeRotation = async () => {
    if (!key) return
    try {
      const newVersion = await rotateKey(key.keyUid)
      setRotateOpen(false)
      setNotice(`새 키 버전 v${newVersion}을 생성했습니다.`)
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : '키를 갱신하지 못했습니다.')
    }
  }

  const updateAutoRotation = async () => {
    if (!key) return
    const days: AutoRotationDays = rotationDraft === '' ? null : Number(rotationDraft)
    try {
      await setAutoRotation(key.keyUid, days)
      setNotice(`자동 갱신 주기를 ${days ? `${days}일` : '미사용'}로 설정했습니다.`)
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : '자동 갱신 정책을 수정하지 못했습니다.')
    }
  }

  if (loading && !key) return <Box sx={{ display: 'grid', minHeight: 320, placeItems: 'center' }}><CircularProgress /></Box>
  if (!key) return <Alert severity="error">{requestError || '요청한 키를 찾을 수 없습니다.'}</Alert>

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2.5 }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <Button color="inherit" startIcon={<ArrowBackRounded />} onClick={() => navigate('/keys')}>키 목록</Button>
          <Box sx={{ height: 40, borderLeft: '2px solid', borderColor: 'text.disabled' }} />
          <Box><Typography variant="h5">{key.keyName}</Typography><Typography sx={{ mt: .25, color: 'text.secondary', fontFamily: 'monospace', fontSize: 11.5 }}>{key.keyUid}</Typography></Box>
        </Stack>
        {isAdmin && <Button variant="contained" disabled={!key.integrityValid || getManualKeyStatusTransitions(key.status).length === 0} onClick={() => { setToStatus(''); setReason(''); setStatusOpen(true) }}>상태 변경</Button>}
      </Box>

      {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}
      {requestError && <Alert severity="error" onClose={() => setRequestError('')} sx={{ mb: 2 }}>{requestError}</Alert>}
      {!key.integrityValid && <Alert severity="error" sx={{ mb: 2 }}>무결성 검증에 실패하여 모든 변경 작업을 차단합니다.</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0,1.55fr) minmax(360px,.7fr)' }, alignItems: 'start', gap: 2 }}>
        <Stack spacing={2}>
          <Card className="section-card">
            <Box className="section-card-header" sx={{ display: 'flex', alignItems: 'center' }}><Typography variant="h6">기본 정보</Typography></Box>
            <CardContent sx={{ p: '16px 20px !important' }}>
              <InfoRow label="이름" value={<Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><Typography>{key.keyName}</Typography>{isAdmin && <Button size="small" startIcon={<EditRounded />} onClick={openEdit}>Edit</Button>}</Stack>} />
              <InfoRow label="상태" value={<StatusBadge dot status={key.status} minWidth={0} />} />
              <InfoRow label="키 유형" value={`${getKeyCategoryLabel(key.algorithm)} · ${getKeyAlgorithmLabel(key)}`} />
              <InfoRow label="키 용도" value={key.purpose} />
              <InfoRow label="현재 버전" value={`v${key.version}`} />
              <InfoRow label="만료일" value={key.expireAt} />
              <InfoRow label="무결성" value={<StatusBadge dot status={key.integrityValid ? 'VALID' : 'INVALID'} label={key.integrityValid ? '정상' : '비정상'} />} />
            </CardContent>
          </Card>

          <Card className="section-card">
            <Box className="section-card-header" sx={{ display: 'flex', alignItems: 'center' }}><Typography variant="h6">회전 설정</Typography></Box>
            <CardContent sx={{ p: '16px 20px !important' }}><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '150px minmax(180px,1fr) auto auto' }, alignItems: 'center', gap: 1.25 }}><Typography sx={{ fontWeight: 750, fontSize: 13.5 }}>자동 회전 주기</Typography><TextField size="small" type="number" value={rotationDraft} placeholder="미사용" disabled={!isAdmin} onChange={(event) => setRotationDraft(event.target.value)} slotProps={{ htmlInput: { min: 1, max: 3650 } }} /><Button size="small" variant="outlined" disabled={!isAdmin || (rotationDraft !== '' && (Number(rotationDraft) < 1 || Number(rotationDraft) > 3650))} onClick={() => void updateAutoRotation()}>적용</Button>{isAdmin && <Button size="small" startIcon={<AutorenewRounded />} disabled={!key.integrityValid || !canRotateWithStatus(key.status)} onClick={() => setRotateOpen(true)}>키 갱신</Button>}</Box></CardContent>
          </Card>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(5,1fr)' }, gap: 1 }}>{usage && Object.entries(usage).map(([label, value]) => <Box key={label} sx={{ minHeight: 76, p: 1.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}><Typography sx={{ color: 'text.secondary', fontSize: 12 }}>{usageLabels[label] ?? label}</Typography><Typography sx={{ mt: .25, fontSize: 20, fontWeight: 850 }}>{value.toLocaleString()}</Typography></Box>)}</Box>
        </Stack>

        <KeyLifecycleTimeline histories={histories} sticky />
      </Box>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: 1 } } }}><DialogTitle>기본 정보 수정</DialogTitle><DialogContent><TextField fullWidth label="키 이름" value={editForm.keyName} onChange={(event) => setEditForm((current) => ({ ...current, keyName: event.target.value }))} sx={{ mt: 1, mb: 2 }} /><FormControl fullWidth sx={{ mb: 2 }}><InputLabel>용도</InputLabel><Select label="용도" value={editForm.purpose} onChange={(event) => setEditForm((current) => ({ ...current, purpose: event.target.value as KeyPurpose }))}><MenuItem value="ENCRYPT">데이터 암복호화</MenuItem><MenuItem value="WRAP">키 래핑</MenuItem><MenuItem value="SIGN">전자서명</MenuItem><MenuItem value="AUTH">메시지 인증</MenuItem></Select></FormControl><TextField fullWidth type="date" label="만료일" value={editForm.expireAt} onChange={(event) => setEditForm((current) => ({ ...current, expireAt: event.target.value }))} slotProps={{ inputLabel: { shrink: true } }} /></DialogContent><DialogActions><Button onClick={() => setEditOpen(false)}>취소</Button><Button variant="contained" disabled={!editForm.keyName.trim() || !editForm.expireAt} onClick={() => void saveMetadata()}>저장</Button></DialogActions></Dialog>
      <Dialog open={statusOpen} onClose={() => setStatusOpen(false)} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: 1 } } }}><DialogTitle>키 상태 변경</DialogTitle><DialogContent><InfoRow label="현재 상태" value={<StatusBadge dot status={key.status} minWidth={0} />} /><FormControl fullWidth sx={{ mt: 1, mb: 2 }}><InputLabel>변경 상태</InputLabel><Select label="변경 상태" value={toStatus} onChange={(event) => setToStatus(event.target.value as KeyStatus)}>{getManualKeyStatusTransitions(key.status).map((status) => <MenuItem key={status} value={status}>{getStatusLabel(status)}</MenuItem>)}</Select></FormControl><TextField fullWidth required multiline minRows={3} label="변경 사유" value={reason} onChange={(event) => setReason(event.target.value)} /></DialogContent><DialogActions><Button onClick={() => setStatusOpen(false)}>취소</Button><Button variant="contained" disabled={!toStatus || !reason.trim()} onClick={() => void applyStatus()}>변경 실행</Button></DialogActions></Dialog>
      <Dialog open={rotateOpen} onClose={() => setRotateOpen(false)} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: 1 } } }}><DialogTitle>키 갱신</DialogTitle><DialogContent><Alert severity="info" sx={{ mb: 2 }}>현재 v{key.version}을 보존하고 신규 v{key.version + 1} 키 재료를 생성합니다.</Alert><InfoRow label="대상 키" value={key.keyName} /><InfoRow label="현재 상태" value={<StatusBadge status={key.status} />} /></DialogContent><DialogActions><Button onClick={() => setRotateOpen(false)}>취소</Button><Button variant="contained" startIcon={<AutorenewRounded />} onClick={() => void executeRotation()}>v{key.version + 1} 생성</Button></DialogActions></Dialog>
    </Box>
  )
}

export default KeyDetail
