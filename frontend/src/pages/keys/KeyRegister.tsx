import { useEffect, useState, type FormEvent } from 'react'
import { KeyRounded, LockRounded } from '@mui/icons-material'
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch,
  TextField, Typography,
} from '@mui/material'
import { useKmsMock } from '../../hooks/useKmsMock'
import { StatusBadge } from '../../components/common/StatusBadge'
import type { CryptoKey, KeyAlgorithm, KeyPurpose } from '../../types/api'

const initialForm = {
  keyName: '', algorithm: 'AES' as KeyAlgorithm, keySize: 256,
  purpose: 'ENCRYPT' as KeyPurpose, expireAt: '2027-08-19', activateImmediately: false,
}

interface KeyRegisterDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: (key: CryptoKey) => void
}

function KeyRegisterDialog({ open, onClose, onCreated }: KeyRegisterDialogProps) {
  const { createKey } = useKmsMock()
  const [form, setForm] = useState(initialForm)
  const [createdUid, setCreatedUid] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(initialForm)
    setCreatedUid('')
  }, [open])

  const keySizeOptions = form.algorithm === 'RSA' ? [2048, 3072, 4096] : form.algorithm === 'HMAC' ? [256, 384, 512] : [128, 192, 256]
  const changeAlgorithm = (algorithm: KeyAlgorithm) => {
    const keySize = algorithm === 'RSA' ? 2048 : 256
    const purpose = algorithm === 'RSA' ? 'SIGN' : algorithm === 'HMAC' ? 'AUTH' : 'ENCRYPT'
    setForm((current) => ({ ...current, algorithm, keySize, purpose }))
  }
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const created = createKey(form)
    setCreatedUid(created.keyUid)
    onCreated?.(created)
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" aria-labelledby="key-register-dialog-title">
      <DialogTitle id="key-register-dialog-title">키 등록</DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ mb: 2.5, color: 'text.secondary', fontSize: 14 }}>SecureRandom으로 관리 키를 생성하고 마스터키로 AES-256-GCM 래핑해 저장합니다.</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.55fr) minmax(250px, 0.65fr)' }, gap: 2.5 }}>
          <Box id="key-register-form" component="form" onSubmit={handleSubmit}>
            <Typography variant="h6" sx={{ mb: 2.5 }}>키 메타정보</Typography>
            <TextField fullWidth required disabled={Boolean(createdUid)} label="키 이름 (keyName)" placeholder="예: PAYMENT-AES-010" value={form.keyName} onChange={(event) => setForm((current) => ({ ...current, keyName: event.target.value }))} helperText="영문 대문자, 숫자, 하이픈을 사용한 식별 가능한 이름을 권장합니다." sx={{ mb: 2 }} />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2, mb: 2 }}>
              <FormControl fullWidth disabled={Boolean(createdUid)}><InputLabel>알고리즘 (algorithm)</InputLabel><Select label="알고리즘 (algorithm)" value={form.algorithm} onChange={(event) => changeAlgorithm(event.target.value as KeyAlgorithm)}><MenuItem value="AES">AES</MenuItem><MenuItem value="HMAC">HMAC</MenuItem><MenuItem value="RSA">RSA</MenuItem></Select></FormControl>
              <FormControl fullWidth disabled={Boolean(createdUid)}><InputLabel>키 길이 (keySize)</InputLabel><Select label="키 길이 (keySize)" value={form.keySize} onChange={(event) => setForm((current) => ({ ...current, keySize: Number(event.target.value) }))}>{keySizeOptions.map((size) => <MenuItem key={size} value={size}>{size} bit</MenuItem>)}</Select></FormControl>
              <FormControl fullWidth disabled={Boolean(createdUid)}><InputLabel>용도 (purpose)</InputLabel><Select label="용도 (purpose)" value={form.purpose} onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value as KeyPurpose }))}><MenuItem value="ENCRYPT">ENCRYPT · 데이터 암복호화</MenuItem><MenuItem value="SIGN">SIGN · 전자서명</MenuItem><MenuItem value="AUTH">AUTH · 메시지 인증</MenuItem><MenuItem value="WRAP">WRAP · 키 래핑</MenuItem></Select></FormControl>
              <TextField fullWidth required disabled={Boolean(createdUid)} label="유효기간 (expireAt)" type="date" value={form.expireAt} onChange={(event) => setForm((current) => ({ ...current, expireAt: event.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
            </Box>
            <FormControlLabel disabled={Boolean(createdUid)} control={<Switch checked={form.activateImmediately} onChange={(event) => setForm((current) => ({ ...current, activateImmediately: event.target.checked }))} />} label="생성 직후 활성 상태로 전환 (상태 이력 기록)" />
            {createdUid && <Alert severity="success" sx={{ mt: 2.5 }}><Typography sx={{ fontWeight: 700 }}>키가 목업 생성되었습니다.</Typography><Typography sx={{ mt: 0.5, fontFamily: 'monospace', fontSize: 12.5 }}>키 UID: {createdUid}</Typography><Typography sx={{ mt: 0.5, fontSize: 13 }}>상태: {form.activateImmediately ? '활성' : '생성'} · 무결성: 정상</Typography></Alert>}
          </Box>
          <Stack spacing={2}>
            <Box sx={{ p: 2.25, border: '1px solid', borderColor: 'divider', borderRadius: 2.5, bgcolor: '#fafbfe' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}><LockRounded color="primary" /><Typography variant="h6">저장 보안</Typography></Box>
              <Stack spacing={1.2}><StatusBadge label="키 평문 DB 저장 금지" tone="danger" /><StatusBadge label="마스터키 AES-256-GCM 래핑" tone="accent" /><StatusBadge label="HMAC-SHA256 무결성 생성" tone="positive" /></Stack>
            </Box>
            <Alert severity="info">화면에는 키 메타정보와 UUID만 반환합니다. 생성된 키 값과 wrapped_key는 API 응답 및 로그에 포함하지 않습니다.</Alert>
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button color="inherit" onClick={onClose}>{createdUid ? '닫기' : '취소'}</Button>
        {!createdUid && <Button type="submit" form="key-register-form" variant="contained" startIcon={<KeyRounded />} disabled={!form.keyName.trim() || !form.expireAt}>키 자동 생성</Button>}
      </DialogActions>
    </Dialog>
  )
}

export default KeyRegisterDialog
