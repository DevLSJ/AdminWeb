import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AddRounded,
  ArrowBackRounded,
  CloseRounded,
  EditRounded,
  LockResetRounded,
  RefreshRounded,
  SearchRounded,
  VisibilityRounded,
  WarningAmberRounded,
} from '@mui/icons-material'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  InputAdornment,
  InputLabel,
  IconButton,
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
import {
  changeUserStatus,
  changeAdminAccountStatus,
  createUser,
  fetchAdminAccounts,
  fetchAdminAccount,
  fetchUser,
  fetchUserPage,
  fetchUserPlain,
  getApiErrorMessage,
  resetUserPassword,
  resetAdminAccountPassword,
  updateAdminAccount,
  updateUser,
} from '../../api/kms'
import { FilterCard, InfoRow, PageHeader, PaginationBar } from '../../components/admin/AdminPage'
import { StatusBadge } from '../../components/common/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import type { AdminAccount, AppUser, AppUserPlain, PageResponse, UserListParams } from '../../types/api'
import { useLocation, useNavigate } from 'react-router-dom'

const emptyPage: PageResponse<AppUser> = { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 }
const emptyForm = { name: '', phone: '', email: '', password: '' }
const initialParams: UserListParams = { name: '', phone: '', status: 'ALL', page: 0, size: 10 }
const phonePattern = /^[0-9+()\-\s]{9,20}$/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function formatKst(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

function UserList() {
  const { user: sessionUser } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(initialParams)
  const [params, setParams] = useState(initialParams)
  const [pageData, setPageData] = useState(emptyPage)
  const [loading, setLoading] = useState(true)
  const [busyUserUid, setBusyUserUid] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [plainCandidate, setPlainCandidate] = useState<AppUser | null>(null)
  const [plainReason, setPlainReason] = useState('')
  const [plainUser, setPlainUser] = useState<AppUserPlain | null>(null)
  const [formUser, setFormUser] = useState<AppUser | null | undefined>(undefined)
  const [form, setForm] = useState(emptyForm)
  const [passwordUser, setPasswordUser] = useState<AppUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([])
  const [managedAdmin, setManagedAdmin] = useState<AdminAccount | null>(null)
  const [managedAppUser, setManagedAppUser] = useState<AppUser | null>(null)
  const [adminName, setAdminName] = useState('')
  const [adminRole, setAdminRole] = useState<AdminAccount['role']>('CLIENT')
  const [managedPassword, setManagedPassword] = useState('')

  const phoneDigits = form.phone.replace(/\D/g, '')
  const nameValid = form.name.trim().length >= 1 && form.name.trim().length <= 64
  const phoneValid = phonePattern.test(form.phone) && phoneDigits.length >= 9 && phoneDigits.length <= 15
  const emailValid = form.email.length <= 254 && emailPattern.test(form.email.trim())
  const passwordValid = form.password.length >= 8 && form.password.length <= 128
  const formValid = nameValid && phoneValid && emailValid && (Boolean(formUser) || passwordValid)

  const pathParts = location.pathname.split('/').filter(Boolean)
  const detailKind = pathParts[1]
  const detailUid = pathParts[2]
  const isDetailRoute = (detailKind === 'admin' || detailKind === 'app') && Boolean(detailUid)

  const loadUsers = useCallback(async (nextParams: UserListParams) => {
    setLoading(true)
    setError('')
    try {
      setPageData(await fetchUserPage(nextParams))
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '사용자 목록을 불러오지 못했습니다.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers(params)
  }, [loadUsers, params])

  useEffect(() => {
    void fetchAdminAccounts()
      .then(setAdminAccounts)
      .catch((requestError) => setError(getApiErrorMessage(requestError, '관리 계정을 불러오지 못했습니다.')))
  }, [])

  useEffect(() => {
    if (!isDetailRoute || !detailUid) { setManagedAdmin(null); setManagedAppUser(null); return }
    setError('')
    setLoading(true)
    const request = detailKind === 'admin'
      ? fetchAdminAccount(detailUid).then((account) => { setManagedAdmin(account); setManagedAppUser(null); setAdminName(account.name); setAdminRole(account.role) })
      : fetchUser(detailUid).then((appUser) => { setManagedAppUser(appUser); setManagedAdmin(null) })
    void request.catch((requestError) => setError(getApiErrorMessage(requestError, '사용자 상세를 불러오지 못했습니다.'))).finally(() => setLoading(false))
  }, [detailKind, detailUid, isDetailRoute])

  const visibleAdminAccounts = useMemo(() => {
    if (params.page !== 0 || params.phone.trim()) return []
    const name = params.name.trim().toLowerCase()
    return adminAccounts.filter((account) => {
      const matchesName = !name || account.loginId.toLowerCase().includes(name) || account.name.toLowerCase().includes(name)
      const matchesStatus = params.status === 'ALL' || account.status === params.status
      return matchesName && matchesStatus
    })
  }, [adminAccounts, params])

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setParams({ ...draft, page: 0 })
  }

  const resetFilters = () => {
    setDraft(initialParams)
    setParams(initialParams)
  }

  const openCreate = () => {
    setForm(emptyForm)
    setFormUser(null)
  }

  const openEdit = async (user: AppUser) => {
    setBusyUserUid(user.userUid)
    setError('')
    try {
      const plain = await fetchUserPlain(user.userUid, '사용자 개인정보 수정')
      setForm({ name: plain.name, phone: plain.phone, email: plain.email, password: '' })
      setFormUser(user)
      setMessage('수정 화면 구성을 위한 원문 조회가 감사 로그에 기록되었습니다.')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '수정할 개인정보를 불러오지 못했습니다.'))
    } finally {
      setBusyUserUid(null)
    }
  }

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    try {
      if (formUser) {
        const updated = await updateUser(formUser.userUid, { name: form.name, phone: form.phone, email: form.email })
        if (managedAppUser?.userUid === updated.userUid) setManagedAppUser(updated)
        setMessage('개인정보를 새 IV로 재암호화하고 검색·무결성 HMAC을 갱신했습니다.')
      } else {
        await createUser(form)
        setMessage('사용자를 등록했습니다. 개인정보는 마스터키로 암호화되어 DB에 저장됩니다.')
      }
      setFormUser(undefined)
      await loadUsers(params)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '사용자 정보를 저장하지 못했습니다.'))
    }
  }

  const viewPlain = async () => {
    if (!plainCandidate || plainReason.trim().length < 2) return
    setBusyUserUid(plainCandidate.userUid)
    setError('')
    try {
      setPlainUser(await fetchUserPlain(plainCandidate.userUid, plainReason.trim()))
      setPlainCandidate(null)
      setPlainReason('')
      setMessage('원문 조회 사유와 행위자가 USER_VIEW_PLAIN 감사 로그에 기록되었습니다.')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '개인정보 원문을 조회하지 못했습니다.'))
    } finally {
      setBusyUserUid(null)
    }
  }

  const resetPassword = async () => {
    if (!passwordUser || newPassword.length < 8) return
    setBusyUserUid(passwordUser.userUid)
    setError('')
    try {
      await resetUserPassword(passwordUser.userUid, newPassword)
      setPasswordUser(null)
      setNewPassword('')
      setMessage('새 Salt와 PBKDF2-HMAC-SHA256 해시로 비밀번호를 재설정했습니다.')
      await loadUsers(params)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '비밀번호를 재설정하지 못했습니다.'))
    } finally {
      setBusyUserUid(null)
    }
  }

  const canManageAdmin = (account: AdminAccount) => sessionUser?.role === 'S.ADMIN' || (sessionUser?.role === 'ADMIN' && account.role === 'CLIENT')

  const saveManagedAdmin = async () => {
    if (!managedAdmin || !canManageAdmin(managedAdmin)) return
    try {
      const updated = await updateAdminAccount(managedAdmin.userUid, { name: adminName.trim(), role: adminRole })
      setManagedAdmin(updated)
      setMessage('관리 계정 이름과 권한을 서버 DB에 반영했습니다.')
    } catch (requestError) { setError(getApiErrorMessage(requestError, '관리 계정을 수정하지 못했습니다.')) }
  }

  const toggleManagedAdminStatus = async () => {
    if (!managedAdmin || !canManageAdmin(managedAdmin)) return
    try {
      const updated = await changeAdminAccountStatus(managedAdmin.userUid, managedAdmin.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
      setManagedAdmin(updated)
      setMessage(`계정을 ${updated.status === 'ACTIVE' ? '활성화' : '정지'}했습니다.`)
    } catch (requestError) { setError(getApiErrorMessage(requestError, '계정 상태를 변경하지 못했습니다.')) }
  }

  const resetManagedAdminPassword = async () => {
    if (!managedAdmin || managedPassword.length < 8 || !canManageAdmin(managedAdmin)) return
    try {
      await resetAdminAccountPassword(managedAdmin.userUid, managedPassword)
      setManagedPassword('')
      setMessage('새 Salt와 PBKDF2 해시로 로그인 비밀번호를 재설정했습니다.')
    } catch (requestError) { setError(getApiErrorMessage(requestError, '로그인 비밀번호를 재설정하지 못했습니다.')) }
  }

  const toggleManagedAppStatus = async () => {
    if (!managedAppUser) return
    try {
      const updated = await changeUserStatus(managedAppUser.userUid, managedAppUser.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
      setManagedAppUser(updated)
      setMessage(`사용자를 ${updated.status === 'ACTIVE' ? '활성화' : '정지'}했습니다.`)
    } catch (requestError) { setError(getApiErrorMessage(requestError, '사용자 상태를 변경하지 못했습니다.')) }
  }

  const accountManageable = managedAdmin ? canManageAdmin(managedAdmin) : false
  const closeDetail = () => navigate('/users')
  const detailDrawer = (
    <Drawer anchor="right" open={isDetailRoute} onClose={closeDetail} slotProps={{ backdrop: { sx: { bgcolor: 'rgba(20,29,48,.34)', backdropFilter: 'blur(5px)' } }, paper: { sx: { top: { sm: 24 }, bottom: { sm: 'auto' }, width: { xs: '100%', sm: 700 }, maxWidth: '100%', height: { xs: '100%', sm: 'auto' }, maxHeight: { sm: 'calc(100% - 48px)' }, borderRadius: { sm: '16px 0 0 16px' }, boxShadow: '-24px 0 64px rgba(25,42,78,.2)' } } }}>
      <Box sx={{ overflowY: 'auto', p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, pb: 2, mb: 2.5, borderBottom: '2px solid', borderColor: 'divider' }}><Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}><Button color="inherit" startIcon={<ArrowBackRounded />} onClick={closeDetail}>사용자 목록</Button><Box sx={{ height: 34, borderLeft: '2px solid', borderColor: 'divider' }} /><Box sx={{ minWidth: 0 }}><Typography variant="h5" noWrap>{managedAdmin?.loginId ?? managedAppUser?.nameMasked ?? '사용자'}</Typography><Typography noWrap sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: 11 }}>{managedAdmin?.userUid ?? managedAppUser?.userUid}</Typography></Box></Stack><IconButton aria-label="사용자 상세 닫기" onClick={closeDetail}><CloseRounded /></IconButton></Box>
        {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}
        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
        {loading && <Box sx={{ display: 'grid', minHeight: 240, placeItems: 'center' }}><CircularProgress /></Box>}
        {managedAdmin && !loading && (
          <Card className="section-card">
            <Box className="section-card-header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><Typography variant="h6">계정 정보 및 제어</Typography><StatusBadge dot label={managedAdmin.integrityValid ? '정상' : '비정상'} tone={managedAdmin.integrityValid ? 'positive' : 'danger'} minWidth={0} /></Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 2.5, p: 2.5 }}>
              <Box><InfoRow label="로그인 ID" value={managedAdmin.loginId} /><InfoRow label="상태" value={<StatusBadge dot status={managedAdmin.status} minWidth={0} />} /><InfoRow label="최근 접속일" value={managedAdmin.lastLoginAt ? formatKst(managedAdmin.lastLoginAt) : '접속 이력 없음'} /><Button fullWidth variant="outlined" color={managedAdmin.status === 'ACTIVE' ? 'error' : 'primary'} disabled={!accountManageable || sessionUser?.loginId === managedAdmin.loginId} onClick={() => void toggleManagedAdminStatus()} sx={{ mt: 2 }}>{managedAdmin.status === 'ACTIVE' ? '계정 정지' : '계정 활성화'}</Button></Box>
              <Stack spacing={1.5}><TextField size="small" label="이름" value={adminName} disabled={!accountManageable} onChange={(event) => setAdminName(event.target.value)} /><FormControl size="small" disabled={!accountManageable}><InputLabel>권한</InputLabel><Select label="권한" value={adminRole} onChange={(event) => setAdminRole(event.target.value as AdminAccount['role'])}>{sessionUser?.role === 'S.ADMIN' && <MenuItem value="S.ADMIN">S.ADMIN</MenuItem>}{sessionUser?.role === 'S.ADMIN' && <MenuItem value="ADMIN">ADMIN</MenuItem>}<MenuItem value="CLIENT">CLIENT</MenuItem></Select></FormControl><Button variant="contained" disabled={!accountManageable} onClick={() => void saveManagedAdmin()}>상세 정보 저장</Button><TextField size="small" type="password" label="새 비밀번호" disabled={!accountManageable} value={managedPassword} onChange={(event) => setManagedPassword(event.target.value)} helperText="8자 이상 · PBKDF2-HMAC-SHA256" /><Button variant="outlined" disabled={!accountManageable || managedPassword.length < 8} onClick={() => void resetManagedAdminPassword()}>비밀번호 재설정</Button></Stack>
            </Box>
          </Card>
        )}
        {managedAppUser && !loading && (
          <Card className="section-card">
            <Box className="section-card-header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><Typography variant="h6">사용자 정보 및 제어</Typography><StatusBadge dot label={managedAppUser.integrityValid ? '정상' : '비정상'} tone={managedAppUser.integrityValid ? 'positive' : 'danger'} minWidth={0} /></Box>
            <Box sx={{ p: 2.5 }}><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, columnGap: 3 }}><InfoRow label="이름" value={managedAppUser.nameMasked} /><InfoRow label="상태" value={<StatusBadge dot status={managedAppUser.status} minWidth={0} />} /><InfoRow label="연락처" value={managedAppUser.phoneMasked} /><InfoRow label="이메일" value={managedAppUser.emailMasked} /><InfoRow label="등록일" value={formatKst(managedAppUser.createdAt)} /></Box><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)' }, gap: 1, mt: 2 }}><Button variant="contained" startIcon={<EditRounded />} disabled={!managedAppUser.integrityValid} onClick={() => void openEdit(managedAppUser)}>상세 수정</Button><Button variant="outlined" startIcon={<VisibilityRounded />} disabled={!managedAppUser.integrityValid} onClick={() => { setPlainCandidate(managedAppUser); setPlainReason('') }}>개인정보 원문 조회</Button><Button variant="outlined" startIcon={<LockResetRounded />} disabled={!managedAppUser.integrityValid} onClick={() => { setPasswordUser(managedAppUser); setNewPassword('') }}>비밀번호 재설정</Button><Button variant="outlined" color={managedAppUser.status === 'ACTIVE' ? 'error' : 'primary'} disabled={!managedAppUser.integrityValid} onClick={() => void toggleManagedAppStatus()}>{managedAppUser.status === 'ACTIVE' ? '사용자 정지' : '사용자 활성화'}</Button></Box></Box>
          </Card>
        )}
      </Box>
    </Drawer>
  )

  return (
    <Box>
      <PageHeader
        title="사용자 관리"
        action={<Button data-testid="user-create-button" variant="contained" startIcon={<AddRounded />} onClick={openCreate}>사용자 등록</Button>}
      />
      {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      <FilterCard>
        <Box component="form" onSubmit={search} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 180px auto' }, gap: 1.25 }}>
          <TextField size="small" label="이름 정확히 검색" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }} />
          <TextField size="small" label="연락처 정확히 검색" value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} />
          <FormControl size="small"><InputLabel>상태</InputLabel><Select label="상태" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as UserListParams['status'] }))}><MenuItem value="ALL">전체</MenuItem><MenuItem value="ACTIVE">ACTIVE</MenuItem><MenuItem value="INACTIVE">INACTIVE</MenuItem></Select></FormControl>
          <Stack direction="row" spacing={1}><Button type="submit" variant="contained">검색</Button><Button color="inherit" startIcon={<RefreshRounded />} onClick={resetFilters}>초기화</Button></Stack>
        </Box>
      </FilterCard>

      <Card>
        <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}><Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>사용자 {(pageData.totalElements + adminAccounts.length).toLocaleString()}명</Typography></Box>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 390px)', minHeight: 290 }}>
          <Table stickyHeader size="small" sx={{ minWidth: 1080, tableLayout: 'fixed' }}>
            <TableHead><TableRow><TableCell sx={{ width: '18%' }}>사용자</TableCell><TableCell sx={{ width: '14%' }}>연락처</TableCell><TableCell sx={{ width: '20%' }}>이메일</TableCell><TableCell sx={{ width: '10%' }}>상태</TableCell><TableCell sx={{ width: '12%' }}>무결성</TableCell><TableCell sx={{ width: '12%' }}>등록일</TableCell><TableCell align="right" sx={{ width: '14%' }}>최근 접속일</TableCell></TableRow></TableHead>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} align="center" sx={{ height: 180 }}><CircularProgress size={28} /></TableCell></TableRow>}
              {!loading && pageData.content.length === 0 && visibleAdminAccounts.length === 0 && <TableRow><TableCell colSpan={7} align="center" sx={{ height: 180, color: 'text.secondary' }}>조회된 사용자가 없습니다.</TableCell></TableRow>}
              {!loading && visibleAdminAccounts.map((account) => (
                <TableRow key={`admin-${account.userUid}`} hover tabIndex={0} className="interactive-row" sx={{ cursor: 'pointer' }} onClick={() => navigate(`/users/admin/${account.userUid}`)}>
                  <TableCell><Stack direction="row" spacing={1.2} sx={{ alignItems: 'center', minWidth: 0 }}><Avatar sx={{ width: 34, height: 34, bgcolor: '#e8efff', color: '#1f5ed7', fontSize: 14, fontWeight: 850 }}>{account.name.slice(0, 1)}</Avatar><Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 800 }}>{account.name}</Typography><Typography noWrap sx={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', color: 'text.secondary', fontSize: 11.5 }}>{account.loginId} · {account.role}</Typography></Box></Stack></TableCell>
                  <TableCell sx={{ color: 'text.disabled' }}>—</TableCell>
                  <TableCell sx={{ color: 'text.disabled' }}>—</TableCell>
                  <TableCell><StatusBadge dot status={account.status} /></TableCell>
                  <TableCell><StatusBadge dot label={account.integrityValid ? '정상' : '비정상'} tone={account.integrityValid ? 'positive' : 'danger'} minWidth={0} /></TableCell>
                  <TableCell>{formatKst(account.createdAt)}</TableCell>
                  <TableCell align="right"><Typography sx={{ color: 'text.secondary', fontSize: 11.5 }}>{account.lastLoginAt ? formatKst(account.lastLoginAt) : '접속 이력 없음'}</Typography></TableCell>
                </TableRow>
              ))}
              {!loading && pageData.content.map((user) => {
                return (
                  <TableRow key={user.userUid} hover tabIndex={0} className="interactive-row" onClick={() => navigate(`/users/app/${user.userUid}`)} sx={{ cursor: 'pointer', ...(!user.integrityValid ? { bgcolor: 'rgba(228, 81, 111, 0.09)', '&:hover': { bgcolor: 'rgba(228, 81, 111, 0.14)' } } : {}) }}>
                    <TableCell><Stack direction="row" spacing={1.2} sx={{ alignItems: 'center', minWidth: 0 }}><Avatar sx={{ width: 34, height: 34, bgcolor: user.integrityValid ? '#eaf7f1' : '#fdecef', color: user.integrityValid ? '#137653' : '#b52d49', fontSize: 14, fontWeight: 850 }}>{user.nameMasked.slice(0, 1)}</Avatar>{!user.integrityValid && <WarningAmberRounded color="error" fontSize="small" />}<Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 750 }}>{user.nameMasked}</Typography><Typography noWrap sx={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', color: 'text.secondary', fontFamily: 'monospace', fontSize: 10.5 }}>{user.userUid}</Typography></Box></Stack></TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{user.phoneMasked}</TableCell>
                    <TableCell><Typography noWrap>{user.emailMasked}</Typography></TableCell>
                    <TableCell><StatusBadge dot status={user.status} /></TableCell>
                    <TableCell><StatusBadge dot label={user.integrityValid ? '정상' : '비정상'} tone={user.integrityValid ? 'positive' : 'danger'} minWidth={0} /></TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatKst(user.createdAt).slice(0, 13)}</TableCell>
                    <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <PaginationBar page={params.page} size={params.size} totalElements={pageData.totalElements} onPageChange={(page) => setParams((current) => ({ ...current, page }))} onSizeChange={(size) => setParams((current) => ({ ...current, page: 0, size }))} />
      </Card>

      {detailDrawer}

      <Dialog open={Boolean(plainCandidate)} onClose={() => setPlainCandidate(null)} fullWidth maxWidth="sm">
        <DialogTitle>개인정보 원문 조회 승인</DialogTitle>
        <DialogContent><Alert severity="warning" sx={{ mb: 2 }}>원문 조회는 마스터키 복호화 후 수행되며 행위자·대상·사유가 USER_VIEW_PLAIN 감사 로그에 남습니다.</Alert><TextField autoFocus fullWidth required multiline minRows={3} label="조회 사유" value={plainReason} onChange={(event) => setPlainReason(event.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} helperText={`${plainReason.trim().length}/200 · 최소 2자`} /></DialogContent>
        <DialogActions><Button onClick={() => setPlainCandidate(null)}>취소</Button><Button data-testid="plain-view-confirm" variant="contained" color="warning" disabled={plainReason.trim().length < 2 || busyUserUid === plainCandidate?.userUid} onClick={() => void viewPlain()}>감사 기록 후 조회</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(plainUser)} onClose={() => setPlainUser(null)} fullWidth maxWidth="sm">
        <DialogTitle>개인정보 원문</DialogTitle>
        <DialogContent>{plainUser && <><Alert severity="error" sx={{ mb: 2 }}>민감정보입니다. 화면·브라우저 캐시·감사로그에는 원문을 저장하지 마세요.</Alert><InfoRow label="이름 원문" value={plainUser.name} /><InfoRow label="연락처 원문" value={plainUser.phone} /><InfoRow label="이메일 원문" value={plainUser.email} /><InfoRow label="암호화 버전" value={`enc_ver ${plainUser.encVer}`} /></>}</DialogContent>
        <DialogActions><Button data-testid="plain-view-close" variant="contained" onClick={() => setPlainUser(null)}>확인</Button></DialogActions>
      </Dialog>

      <Dialog open={formUser !== undefined} onClose={() => setFormUser(undefined)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={saveUser}><DialogTitle>{formUser ? '사용자 개인정보 수정' : '암호화 사용자 등록'}</DialogTitle><DialogContent>{!formUser && <Alert severity="info" sx={{ mt: 1, mb: 2 }}>연락처는 마스터키 AES-256-GCM으로 암호화하고, 비밀번호는 사용자별 Salt로 PBKDF2 해시한 뒤 저장합니다.</Alert>}<Stack spacing={2} sx={{ mt: formUser ? 1 : 0 }}><TextField required label="이름" value={form.name} error={Boolean(form.name) && !nameValid} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} slotProps={{ htmlInput: { maxLength: 64 } }} helperText="1~64자" /><TextField required label="연락처" placeholder="010-1234-5678" value={form.phone} error={Boolean(form.phone) && !phoneValid} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} slotProps={{ htmlInput: { maxLength: 20, pattern: '[0-9+()\\-\\s]{9,20}' } }} helperText={form.phone && !phoneValid ? '숫자 9~15자리의 연락처 형식을 확인하세요.' : '마스터키 AES-256-GCM 암호화 · HMAC 정확 검색'} /><TextField required type="email" label="이메일" value={form.email} error={Boolean(form.email) && !emailValid} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} slotProps={{ htmlInput: { maxLength: 254 } }} helperText={form.email && !emailValid ? '올바른 이메일 형식을 입력하세요.' : '마스터키 AES-256-GCM 암호화 저장'} />{!formUser && <TextField required type="password" label="초기 비밀번호" value={form.password} error={Boolean(form.password) && !passwordValid} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} slotProps={{ htmlInput: { minLength: 8, maxLength: 128 } }} helperText="8~128자 · 사용자별 16바이트 Salt · PBKDF2-HMAC-SHA256 210,000회 이상" />}</Stack></DialogContent><DialogActions><Button onClick={() => setFormUser(undefined)}>취소</Button><Button data-testid="user-save-button" type="submit" variant="contained" disabled={!formValid}>암호화 저장</Button></DialogActions></Box>
      </Dialog>

      <Dialog open={Boolean(passwordUser)} onClose={() => setPasswordUser(null)} fullWidth maxWidth="xs">
        <DialogTitle>비밀번호 재설정</DialogTitle><DialogContent><TextField autoFocus fullWidth type="password" label="새 비밀번호" value={newPassword} error={Boolean(newPassword) && (newPassword.length < 8 || newPassword.length > 128)} onChange={(event) => setNewPassword(event.target.value)} slotProps={{ htmlInput: { minLength: 8, maxLength: 128 } }} helperText="8~128자 · 새 Salt로 PBKDF2 해시를 생성하고 감사 로그를 기록합니다." sx={{ mt: 1 }} /></DialogContent><DialogActions><Button onClick={() => setPasswordUser(null)}>취소</Button><Button variant="contained" disabled={newPassword.length < 8 || newPassword.length > 128 || busyUserUid === passwordUser?.userUid} onClick={() => void resetPassword()}>재설정</Button></DialogActions>
      </Dialog>
    </Box>
  )
}

export default UserList
