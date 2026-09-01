import { useEffect, useMemo, useState } from 'react'
import { ArrowBackRounded, ContentCopyRounded, LockOpenRounded, LockRounded, PlayArrowRounded } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { KeyLifecycleTimeline } from '../../components/keys/KeyLifecycleTimeline'
import { useKmsMock } from '../../hooks/useKmsMock'
import { getStatusLabel } from '../../utils/status'
import { canDecryptWithStatus, canEncryptWithStatus } from '../../utils/keyLifecycle'
import { getKeyAlgorithmLabel } from '../../utils/keyPresentation'

function CryptoTest() {
  const { keys, keyHistories, loadKeyHistory, encrypt: encryptWithKey, decrypt: decryptWithKey } = useKmsMock()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialKey = searchParams.get('key') ?? keys.find((key) => key.integrityValid && (canEncryptWithStatus(key.status) || canDecryptWithStatus(key.status)))?.keyUid ?? ''
  const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt')
  const [keyUid, setKeyUid] = useState(initialKey)
  const [plaintext, setPlaintext] = useState("Hello D'Guard KMS")
  const [ciphertext, setCiphertext] = useState('')
  const [iv, setIv] = useState('')
  const [keyVersion, setKeyVersion] = useState<number | ''>('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)

  const selectedKey = useMemo(() => keys.find((key) => key.keyUid === keyUid), [keyUid, keys])
  const histories = selectedKey ? keyHistories[selectedKey.keyUid] ?? [] : []
  const canEncrypt = Boolean(selectedKey?.integrityValid && selectedKey && canEncryptWithStatus(selectedKey.status))
  const canDecrypt = Boolean(selectedKey?.integrityValid && selectedKey && canDecryptWithStatus(selectedKey.status))
  const executable = mode === 'encrypt' ? canEncrypt : canDecrypt

  useEffect(() => {
    if (!keyUid) setKeyUid(searchParams.get('key') ?? keys.find((key) => key.integrityValid && (canEncryptWithStatus(key.status) || canDecryptWithStatus(key.status)))?.keyUid ?? '')
  }, [keyUid, keys, searchParams])

  useEffect(() => {
    if (selectedKey) void loadKeyHistory(selectedKey.keyUid).catch(() => undefined)
  }, [loadKeyHistory, selectedKey])

  const encrypt = async () => {
    if (!executable || !plaintext.trim()) return
    setRunning(true)
    try {
      const encrypted = await encryptWithKey(keyUid, plaintext)
      setIv(encrypted.iv ?? '')
      setCiphertext(encrypted.ciphertext)
      setKeyVersion(encrypted.version)
      setResult(encrypted.ciphertext)
      setError('')
    } catch (requestError) {
      setResult('')
      setError(requestError instanceof Error ? requestError.message : '암호화에 실패했습니다.')
    } finally {
      setRunning(false)
    }
  }

  const decrypt = async () => {
    if (!executable || !ciphertext.trim()) return
    setRunning(true)
    try {
      const decrypted = await decryptWithKey(keyUid, ciphertext, selectedKey?.algorithm === 'RSA' ? null : iv, keyVersion === '' ? undefined : keyVersion)
      setResult(decrypted)
      setError('')
    } catch (requestError) {
      setResult('')
      setError(requestError instanceof Error ? requestError.message : '복호화에 실패했습니다.')
    } finally {
      setRunning(false)
    }
  }

  const resetDecryptResult = () => {
    setResult('')
    setError('')
  }

  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2.5 }}>
        <Button color="inherit" startIcon={<ArrowBackRounded />} onClick={() => navigate('/keys')}>키 목록</Button>
        <Box sx={{ height: 40, borderLeft: '2px solid', borderColor: 'text.disabled' }} />
        <Box sx={{ minWidth: 0 }}><Typography variant="h5">암복호화 테스트</Typography><Typography noWrap sx={{ mt: .25, color: 'text.secondary', fontSize: 11.5 }}>{selectedKey?.keyName ?? '키를 선택하세요'}</Typography></Box>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0,1.55fr) minmax(360px,.7fr)' }, alignItems: 'start', gap: 2 }}>
        <Card className="section-card">
          <Tabs value={mode} onChange={(_event, value: 'encrypt' | 'decrypt') => { setMode(value); setResult(''); setError('') }} sx={{ px: 2.5, borderBottom: 1, borderColor: 'divider' }}><Tab icon={<LockRounded />} iconPosition="start" label="암호화" value="encrypt" /><Tab icon={<LockOpenRounded />} iconPosition="start" label="복호화" value="decrypt" /></Tabs>
          <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
            <FormControl fullWidth sx={{ mb: 2 }}><InputLabel>관리 키 선택</InputLabel><Select label="관리 키 선택" value={keyUid} onChange={(event) => { const nextKeyUid = event.target.value; setKeyUid(nextKeyUid); setKeyVersion(keys.find((key) => key.keyUid === nextKeyUid)?.version ?? ''); setResult(''); setError('') }}>{keys.map((key) => <MenuItem key={key.keyUid} value={key.keyUid} disabled={!key.integrityValid || (!canEncryptWithStatus(key.status) && !canDecryptWithStatus(key.status))}>{key.keyName} · {getKeyAlgorithmLabel(key)} · {getStatusLabel(key.status)}{!key.integrityValid ? ' · 무결성 위반' : ''}</MenuItem>)}</Select></FormControl>
            {selectedKey && <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1, mb: 2 }}><Alert severity={canEncrypt ? 'success' : 'error'} icon={<LockRounded />} sx={{ py: 0.15, '& .MuiAlert-message': { fontSize: 12.5, fontWeight: 700 } }}>암호화 {canEncrypt ? '허용' : '차단'}</Alert><Alert severity={canDecrypt ? 'success' : 'error'} icon={<LockOpenRounded />} sx={{ py: 0.15, '& .MuiAlert-message': { fontSize: 12.5, fontWeight: 700 } }}>복호화 {canDecrypt ? '허용' : '차단'}</Alert></Box>}
            {selectedKey && !selectedKey.integrityValid && <Alert severity="error" sx={{ mb: 2 }}>무결성 위반 키는 모든 암호 연산이 즉시 차단됩니다.</Alert>}
            {selectedKey && selectedKey.integrityValid && !executable && <Alert severity="warning" sx={{ mb: 2 }}>{getStatusLabel(selectedKey.status)} 상태에서는 {mode === 'encrypt' ? '암호화' : '복호화'}를 실행할 수 없습니다.</Alert>}
            {mode === 'encrypt' ? <TextField fullWidth multiline minRows={7} label="평문 (plaintext)" value={plaintext} onChange={(event) => { setPlaintext(event.target.value); setResult(''); setError('') }} helperText={`${plaintext.length}자 · 테스트 후 평문을 서버 로그에 기록하지 않습니다.`} /> : <Stack spacing={0.75}><Typography component="label" htmlFor="ciphertext-input" sx={{ fontSize: 13.5, fontWeight: 700 }}>암호문 Base64 (ciphertext)</Typography><TextField id="ciphertext-input" fullWidth multiline minRows={5} placeholder="서버가 반환한 ciphertext Base64 값을 입력하세요." value={ciphertext} onChange={(event) => { setCiphertext(event.target.value); resetDecryptResult() }} slotProps={{ htmlInput: { 'aria-label': '암호문 Base64' } }} helperText="서버가 반환한 ciphertext Base64 값을 입력하세요." />{selectedKey?.algorithm !== 'RSA' && <TextField fullWidth required label="IV" value={iv} error={Boolean(error)} onChange={(event) => { setIv(event.target.value); resetDecryptResult() }} helperText="AES 암호문과 함께 반환된 IV를 입력하세요." />}<TextField fullWidth type="number" label="Key Version" value={keyVersion} onChange={(event) => { setKeyVersion(event.target.value ? Number(event.target.value) : ''); resetDecryptResult() }} slotProps={{ htmlInput: { min: 1 } }} helperText="갱신 전 암호문은 암호화 결과의 Key Version을 입력하세요. 비우면 현재 버전을 사용합니다." /></Stack>}
            <Button variant="contained" size="large" startIcon={<PlayArrowRounded />} disabled={running || !executable || (mode === 'encrypt' ? !plaintext.trim() : !ciphertext.trim() || (selectedKey?.algorithm !== 'RSA' && !iv.trim()))} onClick={() => void (mode === 'encrypt' ? encrypt() : decrypt())} sx={{ mt: 2.5 }}>{running ? '처리 중…' : mode === 'encrypt' ? '암호화 테스트 실행' : '복호화 테스트 실행'}</Button>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {result && <Box sx={{ mt: 2.5, p: 2.5, borderRadius: 1, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}><Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}><Typography sx={{ fontWeight: 700 }}>{mode === 'encrypt' ? '암호문 결과' : '평문 결과'}</Typography><Button size="small" startIcon={<ContentCopyRounded />} onClick={() => void navigator.clipboard?.writeText(result)}>복사</Button></Box><Typography sx={{ fontFamily: 'monospace', fontSize: 12.5, wordBreak: 'break-all' }}>{result}</Typography>{mode === 'encrypt' && <><Typography sx={{ mt: 1.5, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>IV: {iv || 'RSA는 IV를 사용하지 않음'}</Typography><Typography sx={{ mt: 0.75, fontFamily: 'monospace', fontSize: 12 }}>Key Version: v{keyVersion}</Typography></>}<Alert severity="success" sx={{ mt: 2 }}>성공 사용 로그가 기록되었습니다.</Alert></Box>}
          </CardContent>
        </Card>
        <KeyLifecycleTimeline histories={histories} sticky maxHeight="calc(100vh - 190px)" />
      </Box>
    </Box>
  )
}

export default CryptoTest
