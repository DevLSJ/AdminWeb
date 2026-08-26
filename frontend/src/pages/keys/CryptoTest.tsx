import { useEffect, useMemo, useState } from 'react'
import { ContentCopyRounded, LockOpenRounded, LockRounded, PlayArrowRounded } from '@mui/icons-material'
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
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/admin/AdminPage'
import { StatusBadge } from '../../components/common/StatusBadge'
import { useKmsMock } from '../../hooks/useKmsMock'
import { getStatusLabel } from '../../utils/status'

function CryptoTest() {
  const { keys, encrypt: encryptWithKey, decrypt: decryptWithKey } = useKmsMock()
  const [searchParams] = useSearchParams()
  const initialKey = searchParams.get('key') ?? keys.find((key) => key.status === 'ACTIVE' && key.algorithm === 'AES')?.keyUid ?? ''
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
  const executable = selectedKey?.status === 'ACTIVE' && selectedKey.algorithm === 'AES'

  useEffect(() => {
    if (!keyUid) setKeyUid(searchParams.get('key') ?? keys.find((key) => key.status === 'ACTIVE' && key.algorithm === 'AES')?.keyUid ?? '')
  }, [keyUid, keys, searchParams])

  const encrypt = async () => {
    if (!executable || !plaintext.trim()) return
    setRunning(true)
    try {
      const encrypted = await encryptWithKey(keyUid, plaintext)
      setIv(encrypted.iv)
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
      const decrypted = await decryptWithKey(keyUid, ciphertext, iv, keyVersion === '' ? undefined : keyVersion)
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
      <PageHeader title="암복호화 테스트" description="KMS 관리 키를 언래핑해 동작을 검증합니다. 활성 상태의 AES 키만 실행할 수 있으며 모든 호출은 사용 로그와 감사 로그에 기록됩니다." />
      <Alert severity="warning" sx={{ mb: 2.5 }}>이 기능은 외부 시스템 연동이 아닌 관리자 검증 도구입니다. 운영 데이터나 실제 고객정보를 입력하지 마세요.</Alert>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.4fr) minmax(300px, 0.6fr)' }, gap: 2.5 }}>
        <Card>
          <Tabs value={mode} onChange={(_event, value: 'encrypt' | 'decrypt') => { setMode(value); setResult(''); setError('') }} sx={{ px: 2.5, borderBottom: 1, borderColor: 'divider' }}><Tab icon={<LockRounded />} iconPosition="start" label="암호화" value="encrypt" /><Tab icon={<LockOpenRounded />} iconPosition="start" label="복호화" value="decrypt" /></Tabs>
          <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
            <FormControl fullWidth sx={{ mb: 2.5 }}><InputLabel>관리 키 선택</InputLabel><Select label="관리 키 선택" value={keyUid} onChange={(event) => { const nextKeyUid = event.target.value; setKeyUid(nextKeyUid); setKeyVersion(keys.find((key) => key.keyUid === nextKeyUid)?.version ?? ''); setResult(''); setError('') }}>{keys.map((key) => <MenuItem key={key.keyUid} value={key.keyUid} disabled={key.status !== 'ACTIVE' || key.algorithm !== 'AES'}>{key.keyName} · {key.algorithm}-{key.keySize} · {getStatusLabel(key.status)}</MenuItem>)}</Select></FormControl>
            {selectedKey && !executable && <Alert severity="error" sx={{ mb: 2 }}>선택한 키는 {getStatusLabel(selectedKey.status)}/{selectedKey.algorithm} 상태이므로 테스트할 수 없습니다.</Alert>}
            {mode === 'encrypt' ? <TextField fullWidth multiline minRows={7} label="평문 (plaintext)" value={plaintext} onChange={(event) => { setPlaintext(event.target.value); setResult(''); setError('') }} helperText={`${plaintext.length}자 · 테스트 후 평문을 서버 로그에 기록하지 않습니다.`} /> : <Stack spacing={2}><TextField fullWidth multiline minRows={5} label="암호문 Base64 (ciphertext)" value={ciphertext} onChange={(event) => { setCiphertext(event.target.value); resetDecryptResult() }} helperText="서버가 반환한 ciphertext Base64 값을 입력하세요." /><TextField fullWidth required label="IV Base64" value={iv} error={Boolean(error)} onChange={(event) => { setIv(event.target.value); resetDecryptResult() }} helperText="암호문과 별도로 반환된 IV Base64 값이 필수입니다." /><TextField fullWidth type="number" label="키 버전" value={keyVersion} onChange={(event) => { setKeyVersion(event.target.value ? Number(event.target.value) : ''); resetDecryptResult() }} slotProps={{ htmlInput: { min: 1 } }} helperText="갱신 전 암호문은 암호화 결과에 표시된 버전을 입력하세요. 비우면 현재 버전을 사용합니다." /></Stack>}
            <Button variant="contained" size="large" startIcon={<PlayArrowRounded />} disabled={running || !executable || (mode === 'encrypt' ? !plaintext.trim() : !ciphertext.trim() || !iv.trim())} onClick={() => void (mode === 'encrypt' ? encrypt() : decrypt())} sx={{ mt: 2.5 }}>{running ? '처리 중…' : mode === 'encrypt' ? '암호화 테스트 실행' : '복호화 테스트 실행'}</Button>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {result && <Box sx={{ mt: 2.5, p: 2.5, borderRadius: 2, bgcolor: '#f7f8fc', border: '1px solid', borderColor: 'divider' }}><Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}><Typography sx={{ fontWeight: 700 }}>{mode === 'encrypt' ? '암호문 결과' : '평문 결과'}</Typography><Button size="small" startIcon={<ContentCopyRounded />} onClick={() => void navigator.clipboard?.writeText(result)}>복사</Button></Box><Typography sx={{ fontFamily: 'monospace', fontSize: 12.5, wordBreak: 'break-all' }}>{result}</Typography>{mode === 'encrypt' && <><Typography sx={{ mt: 1.5, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>IV: {iv}</Typography><Typography sx={{ mt: 0.75, fontFamily: 'monospace', fontSize: 12 }}>키 버전: v{keyVersion}</Typography></>}<Alert severity="success" sx={{ mt: 2 }}>성공 사용 로그가 기록되었습니다.</Alert></Box>}
          </CardContent>
        </Card>
        <Card><CardContent sx={{ p: 3 }}><Typography variant="h6" sx={{ mb: 2 }}>선택 키 정보</Typography>{selectedKey ? <Stack spacing={1.5}><Typography sx={{ fontWeight: 700 }}>{selectedKey.keyName}</Typography><Typography sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: 11.5, wordBreak: 'break-all' }}>{selectedKey.keyUid}</Typography><Stack direction="row" spacing={1}><StatusBadge status={selectedKey.status} /><StatusBadge status={selectedKey.integrityValid ? 'VALID' : 'INVALID'} label={`무결성 ${selectedKey.integrityValid ? '정상' : '위반'}`} /></Stack><Typography sx={{ fontSize: 13 }}>알고리즘: {selectedKey.algorithm}-{selectedKey.keySize}</Typography><Typography sx={{ fontSize: 13 }}>용도: {selectedKey.purpose}</Typography></Stack> : <Typography color="text.secondary">키를 선택하세요.</Typography>}</CardContent></Card>
      </Box>
    </Box>
  )
}

export default CryptoTest
