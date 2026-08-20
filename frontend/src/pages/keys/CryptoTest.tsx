import { useMemo, useState } from 'react'
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
import { PageHeader, StatusChip } from '../../components/admin/AdminPage'
import { useKmsMock } from '../../hooks/useKmsMock'
import { getStatusLabel } from '../../utils/status'

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value)
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
}

function decodeBase64(value: string) {
  const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function CryptoTest() {
  const { keys } = useKmsMock()
  const [searchParams] = useSearchParams()
  const initialKey = searchParams.get('key') ?? keys.find((key) => key.status === 'ACTIVE' && key.algorithm === 'AES')?.keyUid ?? ''
  const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt')
  const [keyUid, setKeyUid] = useState(initialKey)
  const [plaintext, setPlaintext] = useState('Hello D’Guard KMS')
  const [ciphertext, setCiphertext] = useState('')
  const [iv, setIv] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const selectedKey = useMemo(() => keys.find((key) => key.keyUid === keyUid), [keyUid, keys])
  const executable = selectedKey?.status === 'ACTIVE' && selectedKey.algorithm === 'AES'

  const encrypt = () => {
    if (!executable || !plaintext.trim()) return
    const mockIv = encodeBase64('mock-iv-12b')
    const mockCiphertext = encodeBase64(plaintext)
    setIv(mockIv)
    setCiphertext(mockCiphertext)
    setResult(mockCiphertext)
    setError('')
  }

  const decrypt = () => {
    if (!executable || !ciphertext.trim() || !iv.trim()) return
    try {
      setResult(decodeBase64(ciphertext))
      setError('')
    } catch {
      setResult('')
      setError('Base64 암호문 또는 IV 형식이 올바르지 않습니다.')
    }
  }

  return (
    <Box>
      <PageHeader title="암복호화 테스트" description="KMS 관리 키를 언래핑해 동작을 검증합니다. 활성 상태의 AES 키만 실행할 수 있으며 모든 호출은 사용 로그와 감사 로그에 기록됩니다." />
      <Alert severity="warning" sx={{ mb: 2.5 }}>이 기능은 외부 시스템 연동이 아닌 관리자 검증 도구입니다. 운영 데이터나 실제 고객정보를 입력하지 마세요.</Alert>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.4fr) minmax(300px, 0.6fr)' }, gap: 2.5 }}>
        <Card>
          <Tabs value={mode} onChange={(_event, value: 'encrypt' | 'decrypt') => { setMode(value); setResult(''); setError('') }} sx={{ px: 2.5, borderBottom: 1, borderColor: 'divider' }}><Tab icon={<LockRounded />} iconPosition="start" label="암호화" value="encrypt" /><Tab icon={<LockOpenRounded />} iconPosition="start" label="복호화" value="decrypt" /></Tabs>
          <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
            <FormControl fullWidth sx={{ mb: 2.5 }}><InputLabel>관리 키 선택</InputLabel><Select label="관리 키 선택" value={keyUid} onChange={(event) => setKeyUid(event.target.value)}>{keys.map((key) => <MenuItem key={key.keyUid} value={key.keyUid} disabled={key.status !== 'ACTIVE' || key.algorithm !== 'AES'}>{key.keyName} · {key.algorithm}-{key.keySize} · {getStatusLabel(key.status)}</MenuItem>)}</Select></FormControl>
            {selectedKey && !executable && <Alert severity="error" sx={{ mb: 2 }}>선택한 키는 {getStatusLabel(selectedKey.status)}/{selectedKey.algorithm} 상태이므로 테스트할 수 없습니다.</Alert>}
            {mode === 'encrypt' ? <TextField fullWidth multiline minRows={7} label="평문 (plaintext)" value={plaintext} onChange={(event) => setPlaintext(event.target.value)} helperText={`${plaintext.length}자 · 테스트 후 평문을 서버 로그에 기록하지 않습니다.`} /> : <Stack spacing={2}><TextField fullWidth multiline minRows={5} label="암호문 Base64 (ciphertext)" value={ciphertext} onChange={(event) => setCiphertext(event.target.value)} /><TextField fullWidth label="IV Base64" value={iv} onChange={(event) => setIv(event.target.value)} /></Stack>}
            <Button variant="contained" size="large" startIcon={<PlayArrowRounded />} disabled={!executable || (mode === 'encrypt' ? !plaintext.trim() : !ciphertext.trim() || !iv.trim())} onClick={mode === 'encrypt' ? encrypt : decrypt} sx={{ mt: 2.5 }}>{mode === 'encrypt' ? '암호화 테스트 실행' : '복호화 테스트 실행'}</Button>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {result && <Box sx={{ mt: 2.5, p: 2.5, borderRadius: 2, bgcolor: '#f7f8fc', border: '1px solid', borderColor: 'divider' }}><Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}><Typography sx={{ fontWeight: 700 }}>{mode === 'encrypt' ? '암호문 결과' : '평문 결과'}</Typography><Button size="small" startIcon={<ContentCopyRounded />} onClick={() => void navigator.clipboard?.writeText(result)}>복사</Button></Box><Typography sx={{ fontFamily: 'monospace', fontSize: 12.5, wordBreak: 'break-all' }}>{result}</Typography>{mode === 'encrypt' && <Typography sx={{ mt: 1.5, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>IV: {iv}</Typography>}<Alert severity="success" sx={{ mt: 2 }}>성공 사용 로그가 기록되었습니다.</Alert></Box>}
          </CardContent>
        </Card>
        <Card><CardContent sx={{ p: 3 }}><Typography variant="h6" sx={{ mb: 2 }}>선택 키 정보</Typography>{selectedKey ? <Stack spacing={1.5}><Typography sx={{ fontWeight: 700 }}>{selectedKey.keyName}</Typography><Typography sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: 11.5, wordBreak: 'break-all' }}>{selectedKey.keyUid}</Typography><StatusChip status={selectedKey.status} /><Typography sx={{ fontSize: 13 }}>알고리즘: {selectedKey.algorithm}-{selectedKey.keySize}</Typography><Typography sx={{ fontSize: 13 }}>용도: {selectedKey.purpose}</Typography><Typography sx={{ fontSize: 13 }}>무결성: {selectedKey.integrityValid ? '정상' : '위반'}</Typography></Stack> : <Typography color="text.secondary">키를 선택하세요.</Typography>}</CardContent></Card>
      </Box>
    </Box>
  )
}

export default CryptoTest
