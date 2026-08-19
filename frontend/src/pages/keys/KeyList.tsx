import { useMemo, useState } from 'react'
import {
  AddRounded,
  CheckCircleRounded,
  FilterAltOffRounded,
  MoreVertRounded,
  SearchRounded,
  ShieldOutlined,
  WarningAmberRounded,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
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
  Tooltip,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { FilterCard, PageHeader, PaginationBar, StatusChip } from '../../components/admin/AdminPage'
import { keyStatusTransitions, mockKeys } from '../../mocks/adminData'
import type { CryptoKey, KeyListParams, KeyStatus } from '../../types/api'

const defaultParams: KeyListParams = {
  keyword: '',
  algorithm: 'ALL',
  status: 'ALL',
  purpose: 'ALL',
  page: 0,
  size: 5,
  sort: 'createdAt,desc',
}

const algorithmOptions = ['ALL', 'AES', 'HMAC', 'RSA'] as const
const statusOptions = ['ALL', 'CREATED', 'ACTIVE', 'EXPIRED', 'INACTIVE', 'DISTRIBUTED', 'COMPROMISED', 'DESTROYED'] as const
const purposeOptions = ['ALL', 'ENCRYPT', 'SIGN', 'AUTH', 'WRAP'] as const

function KeyList() {
  const [params, setParams] = useState<KeyListParams>(defaultParams)
  const [keys, setKeys] = useState(mockKeys)
  const [transitionKey, setTransitionKey] = useState<CryptoKey | null>(null)
  const [toStatus, setToStatus] = useState<KeyStatus | ''>('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const filteredKeys = useMemo(() => {
    const keyword = params.keyword.trim().toLowerCase()
    const result = keys.filter((key) => {
      const keywordMatched = !keyword || key.keyName.toLowerCase().includes(keyword) || key.keyUid.toLowerCase().includes(keyword)
      return keywordMatched
        && (params.algorithm === 'ALL' || key.algorithm === params.algorithm)
        && (params.status === 'ALL' || key.status === params.status)
        && (params.purpose === 'ALL' || key.purpose === params.purpose)
    })

    const [field, direction] = params.sort.split(',')
    return [...result].sort((a, b) => {
      const left = String(a[field as keyof CryptoKey])
      const right = String(b[field as keyof CryptoKey])
      return direction === 'asc' ? left.localeCompare(right) : right.localeCompare(left)
    })
  }, [keys, params])

  const pageContent = filteredKeys.slice(params.page * params.size, (params.page + 1) * params.size)

  const updateParam = <K extends keyof KeyListParams>(key: K, value: KeyListParams[K]) => {
    setParams((current) => ({ ...current, [key]: value, page: key === 'page' ? Number(value) : 0 }))
  }

  const openTransition = (key: CryptoKey) => {
    setTransitionKey(key)
    setToStatus('')
    setReason('')
  }

  const handleTransition = () => {
    if (!transitionKey || !toStatus || !reason.trim()) return
    setKeys((current) => current.map((key) => key.keyUid === transitionKey.keyUid ? { ...key, status: toStatus, updatedAt: '2026-08-19 16:30:00' } : key))
    setMessage(`${transitionKey.keyName}: ${transitionKey.status} → ${toStatus} 상태 전이가 반영되었습니다.`)
    setTransitionKey(null)
  }

  return (
    <Box>
      <PageHeader
        title="키 목록"
        description="KMS 관리 키를 검색하고 상태·무결성·만료 정보를 관리합니다. 키 원문과 래핑 값은 화면에 노출하지 않습니다."
        action={<Button variant="contained" startIcon={<AddRounded />} onClick={() => navigate('/keys/register')}>키 등록</Button>}
      />

      {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}

      <FilterCard>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 2fr) repeat(4, minmax(130px, 1fr))' }, gap: 1.5 }}>
          <TextField
            size="small"
            label="keyword"
            placeholder="키 이름 또는 key_uid"
            value={params.keyword}
            onChange={(event) => updateParam('keyword', event.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }}
          />
          <FormControl size="small"><InputLabel>algorithm</InputLabel><Select label="algorithm" value={params.algorithm} onChange={(event) => updateParam('algorithm', event.target.value as KeyListParams['algorithm'])}>{algorithmOptions.map((option) => <MenuItem key={option} value={option}>{option === 'ALL' ? '전체 알고리즘' : option}</MenuItem>)}</Select></FormControl>
          <FormControl size="small"><InputLabel>status</InputLabel><Select label="status" value={params.status} onChange={(event) => updateParam('status', event.target.value as KeyListParams['status'])}>{statusOptions.map((option) => <MenuItem key={option} value={option}>{option === 'ALL' ? '전체 상태' : option}</MenuItem>)}</Select></FormControl>
          <FormControl size="small"><InputLabel>purpose</InputLabel><Select label="purpose" value={params.purpose} onChange={(event) => updateParam('purpose', event.target.value as KeyListParams['purpose'])}>{purposeOptions.map((option) => <MenuItem key={option} value={option}>{option === 'ALL' ? '전체 용도' : option}</MenuItem>)}</Select></FormControl>
          <FormControl size="small"><InputLabel>sort</InputLabel><Select label="sort" value={params.sort} onChange={(event) => updateParam('sort', event.target.value)}><MenuItem value="createdAt,desc">최신 생성순</MenuItem><MenuItem value="createdAt,asc">오래된 생성순</MenuItem><MenuItem value="expireAt,asc">만료 임박순</MenuItem><MenuItem value="keyName,asc">키 이름순</MenuItem></Select></FormControl>
        </Box>
        <Stack direction="row" spacing={1} sx={{ mt: 1.5, alignItems: 'center' }}>
          <Chip icon={<ShieldOutlined />} label="외부 식별자는 UUID(key_uid)만 사용" size="small" variant="outlined" />
          <Button size="small" color="inherit" startIcon={<FilterAltOffRounded />} onClick={() => setParams(defaultParams)}>필터 초기화</Button>
        </Stack>
      </FilterCard>

      <Card>
        <TableContainer>
          <Table sx={{ minWidth: 1050 }}>
            <TableHead><TableRow sx={{ bgcolor: '#f8f9fc' }}><TableCell>키 이름 / UID</TableCell><TableCell>알고리즘</TableCell><TableCell>용도</TableCell><TableCell>상태</TableCell><TableCell>버전</TableCell><TableCell>만료일</TableCell><TableCell>무결성</TableCell><TableCell align="right">관리</TableCell></TableRow></TableHead>
            <TableBody>
              {pageContent.map((key) => (
                <TableRow key={key.keyUid} hover sx={{ cursor: 'pointer' }} onDoubleClick={() => navigate(`/keys/${key.keyUid}`)}>
                  <TableCell><Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{key.keyName}</Typography><Typography sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: 10.5 }}>{key.keyUid}</Typography></TableCell>
                  <TableCell><Chip label={`${key.algorithm}-${key.keySize}`} size="small" variant="outlined" /></TableCell>
                  <TableCell>{key.purpose}</TableCell>
                  <TableCell><StatusChip status={key.status} /></TableCell>
                  <TableCell>v{key.version}</TableCell>
                  <TableCell>{key.expireAt}</TableCell>
                  <TableCell>{key.integrityValid ? <Chip icon={<CheckCircleRounded />} label="정상" color="success" size="small" variant="outlined" /> : <Chip icon={<WarningAmberRounded />} label="위반" color="error" size="small" />}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => navigate(`/keys/${key.keyUid}`)}>상세</Button>
                    <Button size="small" disabled={keyStatusTransitions[key.status].length === 0} onClick={() => openTransition(key)}>상태 변경</Button>
                    <Tooltip title="향후 행별 작업 메뉴"><IconButton size="small"><MoreVertRounded /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <PaginationBar page={params.page} size={params.size} totalElements={filteredKeys.length} onPageChange={(page) => updateParam('page', page)} onSizeChange={(size) => updateParam('size', size)} />
      </Card>

      <Dialog open={Boolean(transitionKey)} onClose={() => setTransitionKey(null)} fullWidth maxWidth="sm">
        <DialogTitle>키 상태 변경</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>현재 상태에서 허용된 전이만 선택할 수 있으며 모든 변경은 감사로그와 상태 이력에 기록됩니다.</Alert>
          <TextField fullWidth label="대상 키" value={transitionKey?.keyName ?? ''} disabled sx={{ mb: 2 }} />
          <FormControl fullWidth sx={{ mb: 2 }}><InputLabel>변경 상태</InputLabel><Select label="변경 상태" value={toStatus} onChange={(event) => setToStatus(event.target.value as KeyStatus)}>{transitionKey && keyStatusTransitions[transitionKey.status].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</Select></FormControl>
          <TextField fullWidth required multiline minRows={3} label="변경 사유 (reason)" value={reason} onChange={(event) => setReason(event.target.value)} helperText="재활성 및 모든 상태 전이는 사유 입력이 필수입니다." />
        </DialogContent>
        <DialogActions><Button onClick={() => setTransitionKey(null)}>취소</Button><Button variant="contained" disabled={!toStatus || !reason.trim()} onClick={handleTransition}>변경 적용</Button></DialogActions>
      </Dialog>
    </Box>
  )
}

export default KeyList
