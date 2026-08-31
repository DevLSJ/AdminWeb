import { useCallback, useEffect, useState } from 'react'
import {
  AddRounded,
  AccountTreeRounded,
  CheckCircleRounded,
  CloudUploadRounded,
  DeleteOutlineRounded,
  FilterAltOffRounded,
  SearchRounded,
  ShieldOutlined,
  WarningAmberRounded,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputAdornment,
  InputLabel,
  ListItemText,
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
import { useNavigate } from 'react-router-dom'
import { alpha } from '@mui/material/styles'
import { FilterCard, PageHeader, PaginationBar } from '../../components/admin/AdminPage'
import { StatusBadge } from '../../components/common/StatusBadge'
import { KeyLifecycleGuide } from '../../components/keys/KeyLifecycleGuide'
import { useAuth } from '../../hooks/useAuth'
import { useKmsMock } from '../../hooks/useKmsMock'
import { getManualKeyStatusTransitions } from '../../utils/keyLifecycle'
import type { CryptoKey, DeploymentTargetType, KeyListParams, KeyStatus } from '../../types/api'
import { isAdminRole } from '../../types/auth'
import { getStatusLabel } from '../../utils/status'
import { fetchKeyPage, getApiErrorMessage } from '../../api/kms'
import KeyRegisterDialog from './KeyRegister'

const defaultParams: KeyListParams = {
  keyword: '',
  algorithm: 'ALL',
  status: 'ALL',
  purpose: 'ALL',
  page: 0,
  size: 20,
  sort: 'createdAt,desc',
}

const algorithmOptions = ['ALL', 'AES', 'HMAC', 'RSA'] as const
const statusOptions = ['ALL', 'CREATED', 'ACTIVE', 'REACTIVATED', 'DEACTIVATED', 'EXPIRED', 'INACTIVE', 'DISTRIBUTED', 'COMPROMISED', 'DESTROYED'] as const
const purposeOptions = ['ALL', 'ENCRYPT', 'SIGN', 'AUTH', 'WRAP'] as const

function KeyList() {
  const { user } = useAuth()
  const { keys, loading, error, changeKeyStatus, deleteKey, distributeKeys } = useKmsMock()
  const isAdmin = isAdminRole(user?.role)
  const [params, setParams] = useState<KeyListParams>(defaultParams)
  const [transitionKey, setTransitionKey] = useState<CryptoKey | null>(null)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [lifecycleOpen, setLifecycleOpen] = useState(false)
  const [toStatus, setToStatus] = useState<KeyStatus | ''>('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [deployOpen, setDeployOpen] = useState(false)
  const [deployKeyUids, setDeployKeyUids] = useState<string[]>([])
  const [targetType, setTargetType] = useState<DeploymentTargetType>('SERVER_IP')
  const [target, setTarget] = useState('')
  const [deploymentReason, setDeploymentReason] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [deploymentComplete, setDeploymentComplete] = useState(false)
  const [deleteKeyTarget, setDeleteKeyTarget] = useState<CryptoKey | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [pageContent, setPageContent] = useState<CryptoKey[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')
  const navigate = useNavigate()

  const loadPage = useCallback(async () => {
    setListLoading(true)
    try {
      const result = await fetchKeyPage(params)
      setPageContent(result.content)
      setTotalElements(result.totalElements)
      setListError('')
    } catch (requestError) {
      setListError(getApiErrorMessage(requestError, '키 목록을 불러오지 못했습니다.'))
    } finally {
      setListLoading(false)
    }
  }, [params])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPage(), 200)
    return () => window.clearTimeout(timer)
  }, [loadPage])

  const updateParam = <K extends keyof KeyListParams>(key: K, value: KeyListParams[K]) => {
    setParams((current) => ({ ...current, [key]: value, page: key === 'page' ? Number(value) : 0 }))
  }

  const openTransition = (key: CryptoKey) => {
    setTransitionKey(key)
    setToStatus('')
    setReason('')
  }

  const handleTransition = async () => {
    if (!transitionKey || !toStatus || !reason.trim()) return
    try {
      await changeKeyStatus(transitionKey.keyUid, toStatus, reason)
      await loadPage()
      setMessage(`${transitionKey.keyName}: ${getStatusLabel(transitionKey.status)} → ${getStatusLabel(toStatus)} 상태 전이가 반영되었습니다.`)
      setTransitionKey(null)
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : '상태 변경에 실패했습니다.')
    }
  }

  const openDeployment = () => {
    setDeployKeyUids([])
    setTargetType('SERVER_IP')
    setTarget('')
    setDeploymentReason('')
    setDeploymentComplete(false)
    setDeployOpen(true)
  }

  const executeDeployment = async () => {
    if (deployKeyUids.length === 0 || !target.trim() || !deploymentReason.trim()) return
    setDeploying(true)
    try {
      await distributeKeys(deployKeyUids, target.trim(), deploymentReason.trim())
      await loadPage()
      setDeploymentComplete(true)
      setMessage(`${deployKeyUids.length}개 키가 배포되어 DISTRIBUTED 상태로 전환되었습니다.`)
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : '키 배포에 실패했습니다.')
    } finally {
      setDeploying(false)
    }
  }

  const openDelete = (key: CryptoKey) => {
    setDeleteKeyTarget(key)
    setDeleteConfirmation('')
  }

  const executeDelete = async () => {
    if (!deleteKeyTarget || deleteConfirmation !== deleteKeyTarget.keyName) return
    setDeleting(true)
    try {
      await deleteKey(deleteKeyTarget.keyUid)
      await loadPage()
      setMessage(`${deleteKeyTarget.keyName} 키가 영구 삭제되었습니다.`)
      setDeleteKeyTarget(null)
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : '키를 삭제하지 못했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Box>
      <PageHeader
        title="키 목록"
        description={isAdmin ? 'KMS 관리 키를 검색하고 상태·무결성·만료 정보를 관리합니다. 키 원문과 래핑 값은 화면에 노출하지 않습니다.' : '사용 가능한 KMS 관리 키의 메타정보와 상태를 조회합니다.'}
        action={(
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'flex-end', rowGap: 1 }}>
            <Button variant="outlined" startIcon={<AccountTreeRounded />} onClick={() => setLifecycleOpen(true)}>키 상태 변화 보기</Button>
            {isAdmin && <Button variant="contained" startIcon={<AddRounded />} onClick={() => setRegisterOpen(true)}>키 등록</Button>}
            {isAdmin && <Button variant="outlined" startIcon={<CloudUploadRounded />} onClick={openDeployment}>키 배포</Button>}
          </Stack>
        )}
      />

      {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}
      {(error || listError) && <Alert severity="error" sx={{ mb: 2 }}>{listError || error}</Alert>}
      {(loading || listLoading) && <Alert severity="info" sx={{ mb: 2 }}>키 목록을 불러오는 중입니다.</Alert>}

      <FilterCard>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 2fr) repeat(4, minmax(130px, 1fr))' }, gap: 1.5 }}>
          <TextField
            size="small"
            label="검색어"
            placeholder="키 이름 또는 key_uid"
            value={params.keyword}
            onChange={(event) => updateParam('keyword', event.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }}
          />
          <FormControl size="small"><InputLabel>알고리즘</InputLabel><Select label="알고리즘" value={params.algorithm} onChange={(event) => updateParam('algorithm', event.target.value as KeyListParams['algorithm'])}>{algorithmOptions.map((option) => <MenuItem key={option} value={option}>{option === 'ALL' ? '전체 알고리즘' : option}</MenuItem>)}</Select></FormControl>
          <FormControl size="small"><InputLabel>상태</InputLabel><Select label="상태" value={params.status} onChange={(event) => updateParam('status', event.target.value as KeyListParams['status'])}>{statusOptions.map((option) => <MenuItem key={option} value={option}>{option === 'ALL' ? '전체 상태' : getStatusLabel(option)}</MenuItem>)}</Select></FormControl>
          <FormControl size="small"><InputLabel>용도</InputLabel><Select label="용도" value={params.purpose} onChange={(event) => updateParam('purpose', event.target.value as KeyListParams['purpose'])}>{purposeOptions.map((option) => <MenuItem key={option} value={option}>{option === 'ALL' ? '전체 용도' : option}</MenuItem>)}</Select></FormControl>
          <FormControl size="small"><InputLabel>정렬</InputLabel><Select label="정렬" value={params.sort} onChange={(event) => updateParam('sort', event.target.value)}><MenuItem value="createdAt,desc">최신 생성순</MenuItem><MenuItem value="createdAt,asc">오래된 생성순</MenuItem><MenuItem value="expireAt,asc">만료 임박순</MenuItem><MenuItem value="keyName,asc">키 이름순</MenuItem></Select></FormControl>
        </Box>
        <Stack direction="row" spacing={1} sx={{ mt: 1.5, alignItems: 'center' }}>
          <StatusBadge icon={<ShieldOutlined />} label="외부 식별자는 UUID(key_uid)만 사용" tone="neutral" minWidth={0} />
          <Button size="small" color="inherit" startIcon={<FilterAltOffRounded />} onClick={() => setParams((current) => ({ ...defaultParams, size: current.size }))}>필터 초기화</Button>
        </Stack>
      </FilterCard>

      <Card sx={{ overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.75, py: 0.8, borderBottom: '1px solid', borderColor: 'divider', bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.025) }}><Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>관리 키 {totalElements.toLocaleString()}개</Typography>{pageContent.some((key) => !key.integrityValid) && <StatusBadge status="INVALID" label="무결성 경고 포함" minWidth={0} />}</Stack><FormControl size="small" sx={{ minWidth: 128 }}><Select value={params.size} onChange={(event) => updateParam('size', Number(event.target.value))} inputProps={{ 'aria-label': '키 목록 페이지당 개수' }}>{[20, 50, 100].map((size) => <MenuItem key={size} value={size}>{size}개씩 보기</MenuItem>)}</Select></FormControl></Box>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 350px)', minHeight: 360 }}>
          <Table stickyHeader size="small" sx={{ minWidth: 1180, '& .MuiTableCell-root': { px: 1.25, py: 0.72 }, '& .MuiTableCell-head': { py: 0.9, bgcolor: 'background.paper', fontSize: 12, letterSpacing: '0.02em' } }}>
            <TableHead><TableRow><TableCell>키 이름 / UID</TableCell><TableCell>알고리즘·모드</TableCell><TableCell>용도</TableCell><TableCell>상태</TableCell><TableCell>버전</TableCell><TableCell>자동 갱신</TableCell><TableCell>만료일</TableCell><TableCell>무결성</TableCell><TableCell align="right">관리</TableCell></TableRow></TableHead>
            <TableBody>
              {pageContent.map((key) => (
                <TableRow key={key.keyUid} hover sx={{ cursor: 'pointer', bgcolor: key.integrityValid ? undefined : (theme) => alpha(theme.palette.error.main, 0.085), boxShadow: key.integrityValid ? undefined : (theme) => `inset 4px 0 0 ${theme.palette.error.main}`, '&:hover': { bgcolor: key.integrityValid ? 'action.hover' : (theme) => alpha(theme.palette.error.main, 0.13) } }} onDoubleClick={() => navigate(`/keys/${key.keyUid}`)}>
                  <TableCell><Typography noWrap sx={{ maxWidth: 220, fontWeight: 750, fontSize: 12.75 }}>{key.keyName}</Typography><Typography noWrap sx={{ maxWidth: 220, color: 'text.secondary', fontFamily: 'monospace', fontSize: 10.5 }}>{key.keyUid}</Typography></TableCell>
                  <TableCell><Typography sx={{ fontSize: 12.25, fontWeight: 700 }}>{key.algorithm}-{key.keySize}</Typography><Typography sx={{ color: 'text.secondary', fontSize: 10.75 }}>{key.mode}</Typography></TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{key.purpose}</TableCell>
                  <TableCell><StatusBadge status={key.status} /></TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 800 }}>v{key.version}</TableCell>
                  <TableCell sx={{ fontSize: 11.5 }}>{key.autoRotationDays ? `${key.autoRotationDays}일` : '—'}</TableCell>
                  <TableCell sx={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{key.expireAt || '—'}</TableCell>
                  <TableCell>{key.integrityValid ? <StatusBadge status="VALID" icon={<CheckCircleRounded />} /> : <StatusBadge status="INVALID" icon={<WarningAmberRounded />} sx={{ animation: 'integrity-pulse 1.8s ease-in-out infinite' }} />}</TableCell>
                  <TableCell align="right"><Stack direction="row" spacing={0.35} sx={{ justifyContent: 'flex-end' }}><Button size="small" variant="text" onClick={() => navigate(`/keys/${key.keyUid}`)}>상세</Button>{isAdmin && <Button size="small" variant="outlined" disabled={!key.integrityValid || getManualKeyStatusTransitions(key.status).length === 0} onClick={() => openTransition(key)}>상태</Button>}{isAdmin && <Button size="small" color="error" onClick={() => openDelete(key)}><DeleteOutlineRounded sx={{ fontSize: 17 }} /></Button>}</Stack></TableCell>
                </TableRow>
              ))}
              {!listLoading && pageContent.length === 0 && <TableRow><TableCell colSpan={9} align="center" sx={{ py: 8, color: 'text.secondary' }}>조건에 맞는 키가 없습니다.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
        <PaginationBar page={params.page} size={params.size} totalElements={totalElements} onPageChange={(page) => updateParam('page', page)} />
      </Card>

      <Dialog open={lifecycleOpen} onClose={() => setLifecycleOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>키 상태 변화 목록</DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 2, sm: 2.5 } }}>
          <KeyLifecycleGuide />
        </DialogContent>
        <DialogActions><Button onClick={() => setLifecycleOpen(false)}>닫기</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(transitionKey)} onClose={() => setTransitionKey(null)} fullWidth maxWidth="sm">
        <DialogTitle>키 상태 변경</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>현재 상태에서 허용된 전이만 선택할 수 있으며 모든 변경은 감사로그와 상태 이력에 기록됩니다.</Alert>
          <TextField fullWidth label="대상 키" value={transitionKey?.keyName ?? ''} disabled sx={{ mb: 2 }} />
          <FormControl fullWidth sx={{ mb: 2 }}><InputLabel>변경 상태</InputLabel><Select label="변경 상태" value={toStatus} onChange={(event) => setToStatus(event.target.value as KeyStatus)}>{transitionKey && getManualKeyStatusTransitions(transitionKey.status).map((status) => <MenuItem key={status} value={status}>{getStatusLabel(status)}</MenuItem>)}</Select></FormControl>
          <TextField fullWidth required multiline minRows={3} label="변경 사유 (reason)" value={reason} onChange={(event) => setReason(event.target.value)} helperText="재활성 및 모든 상태 전이는 사유 입력이 필수입니다." />
        </DialogContent>
        <DialogActions><Button onClick={() => setTransitionKey(null)}>취소</Button><Button variant="contained" disabled={!toStatus || !reason.trim()} onClick={handleTransition}>변경 적용</Button></DialogActions>
      </Dialog>

      <KeyRegisterDialog open={registerOpen} onClose={() => setRegisterOpen(false)} onCreated={(key) => { setMessage(`${key.keyName} 키가 등록되었습니다.`); void loadPage() }} />

      <Dialog open={Boolean(deleteKeyTarget)} onClose={() => !deleting && setDeleteKeyTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>키 영구 삭제</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>키 재료, 상태 이력, 사용 로그가 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</Alert>
          <Typography sx={{ mb: 2 }}><strong>{deleteKeyTarget?.keyName}</strong>을 삭제하려면 아래에 키 이름을 정확히 입력하세요.</Typography>
          <TextField fullWidth label="삭제할 키 이름" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} disabled={deleting} />
        </DialogContent>
        <DialogActions><Button onClick={() => setDeleteKeyTarget(null)} disabled={deleting}>취소</Button><Button color="error" variant="contained" disabled={!deleteKeyTarget || deleteConfirmation !== deleteKeyTarget.keyName || deleting} onClick={() => void executeDelete()}>{deleting ? '삭제 중…' : '영구 삭제'}</Button></DialogActions>
      </Dialog>

      <Dialog open={deployOpen} onClose={() => !deploying && setDeployOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>키 배포</DialogTitle>
        <DialogContent>
          {deploymentComplete && <Alert severity="success" sx={{ mb: 2 }}>배포가 완료되었습니다. 키 상태는 DISTRIBUTED로 변경되었습니다.</Alert>}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth disabled={deploying || deploymentComplete}><InputLabel>배포할 키</InputLabel><Select multiple label="배포할 키" value={deployKeyUids} renderValue={(selected) => selected.map((uid) => keys.find((key) => key.keyUid === uid)?.keyName).filter(Boolean).join(', ')} onChange={(event) => setDeployKeyUids(typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)}>{keys.filter((key) => key.status === 'ACTIVE').map((key) => <MenuItem key={key.keyUid} value={key.keyUid}><Checkbox checked={deployKeyUids.includes(key.keyUid)} /><ListItemText primary={key.keyName} secondary={`v${key.version} · ${getStatusLabel(key.status)}`} /></MenuItem>)}</Select></FormControl>
            <FormControl fullWidth disabled={deploying || deploymentComplete}><InputLabel>배포 대상 유형</InputLabel><Select label="배포 대상 유형" value={targetType} onChange={(event) => setTargetType(event.target.value as DeploymentTargetType)}><MenuItem value="SERVER_IP">서버 IP</MenuItem><MenuItem value="K8S_SECRET">K8s Secret</MenuItem><MenuItem value="APP_ID">App ID</MenuItem></Select></FormControl>
            <TextField fullWidth required disabled={deploying || deploymentComplete} label={targetType === 'SERVER_IP' ? '서버 IP' : targetType === 'K8S_SECRET' ? 'K8s Secret 이름' : 'App ID'} placeholder={targetType === 'SERVER_IP' ? '10.20.30.40' : targetType === 'K8S_SECRET' ? 'kms/payment-key' : 'payment-service'} value={target} onChange={(event) => setTarget(event.target.value)} />
            <TextField fullWidth required multiline minRows={2} disabled={deploying || deploymentComplete} label="배포 사유" value={deploymentReason} onChange={(event) => setDeploymentReason(event.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setDeployOpen(false)} disabled={deploying}>{deploymentComplete ? '닫기' : '취소'}</Button>{!deploymentComplete && <Button variant="contained" startIcon={<CloudUploadRounded />} disabled={deploying || deployKeyUids.length === 0 || !target.trim() || !deploymentReason.trim()} onClick={() => void executeDeployment()}>{deploying ? '배포 중…' : '배포 실행'}</Button>}</DialogActions>
      </Dialog>
    </Box>
  )
}

export default KeyList
