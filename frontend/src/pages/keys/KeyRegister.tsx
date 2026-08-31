import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AutorenewRounded, KeyRounded, LockRounded, VerifiedRounded } from '@mui/icons-material'
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, FormControlLabel, InputAdornment, InputLabel, MenuItem, Select, Stack, Switch,
  TextField, Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { LargeDateCalendar } from '../../components/keys/LargeDateCalendar'
import { StatusBadge } from '../../components/common/StatusBadge'
import { useKmsMock } from '../../hooks/useKmsMock'
import type { AutoRotationDays, CryptoKey, KeyAlgorithm, KeyMode, KeyPurpose } from '../../types/api'

function futureDate(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const initialForm = {
  keyName: '', algorithm: 'AES' as KeyAlgorithm, keySize: 256, mode: 'GCM' as KeyMode,
  purpose: 'ENCRYPT' as KeyPurpose, expireAt: futureDate(365), autoRotationDays: 90 as AutoRotationDays,
  activateImmediately: false,
}

const algorithmPolicy = {
  AES: {
    sizes: [128, 192, 256],
    modes: [{ value: 'GCM', label: 'GCM · 인증 암호화' }, { value: 'CBC', label: 'CBC · HMAC 무결성 포함' }],
    purposes: [{ value: 'ENCRYPT', label: '데이터 암복호화' }, { value: 'WRAP', label: '키 래핑' }],
  },
  RSA: {
    sizes: [2048, 3072, 4096],
    modes: [{ value: 'OAEP_SHA256', label: 'OAEP-SHA256 · 공개키 암호화' }],
    purposes: [{ value: 'ENCRYPT', label: '공개키 암복호화' }, { value: 'SIGN', label: '전자서명용 키 쌍' }],
  },
} as const

interface KeyRegisterDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: (key: CryptoKey) => void
}

function KeyRegisterDialog({ open, onClose, onCreated }: KeyRegisterDialogProps) {
  const { createKey } = useKmsMock()
  const [form, setForm] = useState(initialForm)
  const [created, setCreated] = useState<CryptoKey | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const policy = algorithmPolicy[form.algorithm === 'RSA' ? 'RSA' : 'AES']

  useEffect(() => {
    if (!open) return
    setForm({ ...initialForm, expireAt: futureDate(365) })
    setCreated(null)
    setError('')
  }, [open])

  const policySummary = useMemo(() => form.algorithm === 'RSA'
    ? `${form.keySize}비트 RSA 개인키는 래핑 저장하고 공개키만 암호화에 사용합니다.`
    : `${form.keySize}비트 AES-${form.mode} 정책으로 데이터 키를 생성합니다.`, [form.algorithm, form.keySize, form.mode])

  const changeAlgorithm = (algorithm: 'AES' | 'RSA') => {
    setForm((current) => ({
      ...current, algorithm, keySize: algorithm === 'RSA' ? 2048 : 256,
      mode: algorithm === 'RSA' ? 'OAEP_SHA256' : 'GCM', purpose: 'ENCRYPT',
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const result = await createKey(form)
      setCreated(result)
      onCreated?.(result)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '키 생성에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" aria-labelledby="key-register-dialog-title" slotProps={{ backdrop: { sx: { bgcolor: 'rgba(16, 19, 28, 0.48)', backdropFilter: 'blur(10px)' } }, paper: { sx: { maxHeight: '94vh' } } }}>
      <DialogTitle id="key-register-dialog-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box><Typography component="span" sx={{ fontSize: 18, fontWeight: 800 }}>새 암호 키 등록</Typography><Typography sx={{ mt: 0.25, color: 'text.secondary', fontSize: 12.5 }}>정책 입력 → DB 저장 → v1 버전 반영</Typography></Box>
        <StatusBadge label={form.algorithm === 'RSA' ? 'ASYMMETRIC' : 'SYMMETRIC'} tone={form.algorithm === 'RSA' ? 'accent' : 'info'} minWidth={0} />
      </DialogTitle>
      <DialogContent dividers sx={{ p: { xs: 2, md: 2.5 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.08fr) minmax(390px, 0.92fr)' }, gap: 2.5 }}>
          <Box id="key-register-form" component="form" onSubmit={handleSubmit}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1.5fr) minmax(150px, 0.5fr)' }, gap: 1.5 }}>
              <TextField size="small" fullWidth required disabled={Boolean(created)} label="키 이름" placeholder="PAYMENT-AES-010" value={form.keyName} onChange={(event) => setForm((current) => ({ ...current, keyName: event.target.value }))} helperText="서비스-알고리즘-순번 형식을 권장합니다." />
              <FormControl size="small" fullWidth disabled={Boolean(created)}><InputLabel>알고리즘</InputLabel><Select label="알고리즘" value={form.algorithm} onChange={(event) => changeAlgorithm(event.target.value as 'AES' | 'RSA')}><MenuItem value="AES">AES · 대칭키</MenuItem><MenuItem value="RSA">RSA · 공개키</MenuItem></Select></FormControl>
            </Box>

            <Typography sx={{ mt: 2.25, mb: 1, fontSize: 12, fontWeight: 850, letterSpacing: '0.08em', color: 'text.secondary' }}>CRYPTO POLICY</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
              <FormControl size="small" disabled={Boolean(created)}><InputLabel>키 길이</InputLabel><Select label="키 길이" value={form.keySize} onChange={(event) => setForm((current) => ({ ...current, keySize: Number(event.target.value) }))}>{policy.sizes.map((size) => <MenuItem key={size} value={size}>{size} bit</MenuItem>)}</Select></FormControl>
              <FormControl size="small" disabled={Boolean(created)}><InputLabel>암호 모드</InputLabel><Select label="암호 모드" value={form.mode} onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value as KeyMode }))}>{policy.modes.map((mode) => <MenuItem key={mode.value} value={mode.value}>{mode.label}</MenuItem>)}</Select></FormControl>
              <FormControl size="small" disabled={Boolean(created)}><InputLabel>키 용도</InputLabel><Select label="키 용도" value={form.purpose} onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value as KeyPurpose }))}>{policy.purposes.map((purpose) => <MenuItem key={purpose.value} value={purpose.value}>{purpose.value} · {purpose.label}</MenuItem>)}</Select></FormControl>
            </Box>
            <Alert icon={<VerifiedRounded />} severity="info" sx={{ mt: 1.5, py: 0.25 }}>{policySummary}</Alert>

            <Typography sx={{ mt: 2.25, mb: 1, fontSize: 12, fontWeight: 850, letterSpacing: '0.08em', color: 'text.secondary' }}>ROTATION & ACTIVATION</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(180px, 0.65fr) minmax(0, 1.35fr)' }, gap: 1.5, alignItems: 'start' }}>
              <FormControl size="small" fullWidth disabled={Boolean(created)}><InputLabel>자동 갱신</InputLabel><Select label="자동 갱신" value={form.autoRotationDays ?? 'NONE'} onChange={(event) => setForm((current) => ({ ...current, autoRotationDays: event.target.value === 'NONE' ? null : Number(event.target.value) }))}><MenuItem value="NONE">미사용</MenuItem><MenuItem value={30}>30일</MenuItem><MenuItem value={60}>60일</MenuItem><MenuItem value={90}>90일</MenuItem></Select></FormControl>
              <TextField size="small" type="number" label="갱신 주기 직접 입력(일)" value={form.autoRotationDays ?? ''} disabled={Boolean(created)} onChange={(event) => setForm((current) => ({ ...current, autoRotationDays: event.target.value ? Number(event.target.value) : null }))} slotProps={{ input: { startAdornment: <InputAdornment position="start"><AutorenewRounded sx={{ fontSize: 18 }} /></InputAdornment> }, htmlInput: { min: 1, max: 3650 } }} helperText="Naver·Kakao·KMIP 호환 일 단위 정책" />
            </Box>
            <FormControlLabel sx={{ mt: 1 }} disabled={Boolean(created)} control={<Switch checked={form.activateImmediately} onChange={(event) => setForm((current) => ({ ...current, activateImmediately: event.target.checked }))} />} label={<Box><Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>생성 직후 활성화</Typography><Typography sx={{ color: 'text.secondary', fontSize: 11.5 }}>상태 이력에 CREATED → ACTIVE 전이가 기록됩니다.</Typography></Box>} />

            {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
            {created && <Alert severity="success" sx={{ mt: 1.5 }}><Typography sx={{ fontWeight: 800 }}>{created.keyName} 등록 완료</Typography><Typography sx={{ mt: 0.35, fontFamily: 'monospace', fontSize: 12 }}>{created.keyUid}</Typography><Stack direction="row" spacing={0.75} sx={{ mt: 1 }}><StatusBadge status={created.status} /><StatusBadge label={`v${created.version}`} tone="accent" /><StatusBadge status={created.integrityValid ? 'VALID' : 'INVALID'} /></Stack></Alert>}
          </Box>

          <Stack spacing={1.5}>
            <LargeDateCalendar value={form.expireAt} onChange={(expireAt) => setForm((current) => ({ ...current, expireAt }))} disabled={Boolean(created)} />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
              {[30, 180, 365].map((days) => <Button key={days} size="small" variant="outlined" disabled={Boolean(created)} onClick={() => setForm((current) => ({ ...current, expireAt: futureDate(days) }))}>{days === 365 ? '1년 후' : `${days}일 후`}</Button>)}
            </Box>
            <Box sx={{ p: 1.75, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.035) }}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}><LockRounded color="primary" sx={{ fontSize: 19 }} /><Typography sx={{ fontSize: 13.5, fontWeight: 800 }}>저장 보안</Typography></Box><Typography sx={{ color: 'text.secondary', fontSize: 12.25, lineHeight: 1.7 }}>원시 키는 응답과 로그에 노출되지 않으며, 마스터키로 래핑된 키 재료와 버전별 HMAC만 저장됩니다.</Typography></Box>
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5 }}><Button color="inherit" onClick={onClose}>{created ? '완료' : '취소'}</Button>{!created && <Button type="submit" form="key-register-form" variant="contained" startIcon={<KeyRounded />} disabled={submitting || !form.keyName.trim() || !form.expireAt}>{submitting ? 'DB 반영 중…' : '키 생성 및 v1 반영'}</Button>}</DialogActions>
    </Dialog>
  )
}

export default KeyRegisterDialog
