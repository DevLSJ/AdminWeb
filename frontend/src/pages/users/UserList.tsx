import { ResizableTable as Table } from '../../components/admin/ResizableTable'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  AddRounded,
  ArrowBackRounded,
  CloseRounded,
  EditRounded,
  LockResetRounded,
  SearchRounded,
  VisibilityRounded,
  WarningAmberRounded,
} from '@mui/icons-material'
import {
  Alert,
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
  LinearProgress,
  Select,
  Stack,
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
  fetchAdminAccount,
  fetchManagedUserPage,
  fetchUser,
  fetchUserPlain,
  getApiErrorMessage,
  resetUserPassword,
  resetAdminAccountPassword,
  updateAdminAccount,
  updateUser,
} from '../../api/kms'
import { InfoRow, PageHeader, PaginationBar } from '../../components/admin/AdminPage'
import { managementTableSx, managementTableContainerSx } from '../../components/admin/managementTable'
import { SearchFilterForm } from '../../components/admin/SearchFilterForm'
import { StatusBadge } from '../../components/common/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import type { AdminAccount, AppUser, AppUserPlain, ManagedUser, PageResponse, UserListParams } from '../../types/api'
import { useLocation, useNavigate } from 'react-router-dom'

type EditableRole = 'ADMIN' | 'CLIENT'
type UserForm = { name: string; phone: string; email: string; password: string; passwordConfirm: string; role: EditableRole }

const emptyPage: PageResponse<ManagedUser> = { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 }
const emptyForm: UserForm = { name: '', phone: '', email: '', password: '', passwordConfirm: '', role: 'CLIENT' }
const initialParams: UserListParams = { name: '', phone: '', email: '', status: 'ALL', page: 0, size: 10 }
const validPassword = (value: string) => value.length >= 8 && value.length <= 128 && /[^\p{L}\p{N}\s]/u.test(value)
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
  const requestSequence = useRef(0)
  const [draft, setDraft] = useState(initialParams)
  const [params, setParams] = useState(initialParams)
  const [pageData, setPageData] = useState(emptyPage)
  const [detailLoading, setDetailLoading] = useState(false)
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
  const [managedAdmin, setManagedAdmin] = useState<AdminAccount | null>(null)
  const [managedAppUser, setManagedAppUser] = useState<AppUser | null>(null)
  const [adminName, setAdminName] = useState('')
  const [adminRole, setAdminRole] = useState<EditableRole>('CLIENT')
  const [adminPhone, setAdminPhone] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminEditOpen, setAdminEditOpen] = useState(false)
  const [adminPasswordOpen, setAdminPasswordOpen] = useState(false)
  const [managedPassword, setManagedPassword] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setParams((current) => {
      if (current.name === draft.name && current.phone === draft.phone && current.email === draft.email && current.status === draft.status) return current
      return { ...current, name: draft.name, phone: draft.phone, email: draft.email, status: draft.status, page: 0 }
    }), 300)
    return () => window.clearTimeout(timer)
  }, [draft])

  useEffect(() => { if (location.search.includes('create=1')) { setForm(emptyForm); setFormUser(null) } }, [location.search])

  const phoneDigits = form.phone.replace(/\D/g, '')
  const nameValid = form.name.trim().length >= 1 && form.name.trim().length <= 64
  const phoneValid = phonePattern.test(form.phone) && phoneDigits.length >= 9 && phoneDigits.length <= 15
  const emailValid = form.email.length <= 254 && emailPattern.test(form.email.trim())
  const passwordValid = validPassword(form.password)
  const formValid = nameValid && phoneValid && emailValid && (Boolean(formUser) || (passwordValid && form.password === form.passwordConfirm))
  const canAssignAdmin = sessionUser?.role === 'S.ADMIN'
  const adminPhoneDigits = adminPhone.replace(/\D/g, '')
  const adminPhoneValid = !adminPhone || (phonePattern.test(adminPhone) && adminPhoneDigits.length >= 9 && adminPhoneDigits.length <= 15)
  const adminEmailValid = !adminEmail || (adminEmail.length <= 254 && emailPattern.test(adminEmail.trim()))

  const pathParts = location.pathname.split('/').filter(Boolean)
  const detailKind = pathParts[1]
  const detailUid = pathParts[2]
  const isDetailRoute = (detailKind === 'admin' || detailKind === 'app') && Boolean(detailUid)

  const loadUsers = useCallback(async (nextParams: UserListParams) => {
    const sequence = ++requestSequence.current
    setLoading(true)
    setError('')
    try {
      const result = await fetchManagedUserPage(nextParams)
      if (sequence === requestSequence.current) setPageData(result)
    } catch (requestError) {
      if (sequence === requestSequence.current) setError(getApiErrorMessage(requestError, '사용자 목록을 불러오지 못했습니다.'))
    } finally {
      if (sequence === requestSequence.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers(params)
  }, [loadUsers, params])

  useEffect(() => {
    let active = true
    setManagedAdmin(null)
    setManagedAppUser(null)
    if (!isDetailRoute || !detailUid) { setDetailLoading(false); return }
    setError('')
    setDetailLoading(true)
    const request = detailKind === 'admin'
      ? fetchAdminAccount(detailUid).then((account) => { if (!active) return; setManagedAdmin(account); setAdminName(account.name); if (account.role !== 'S.ADMIN') setAdminRole(account.role) })
      : fetchUser(detailUid).then((appUser) => { if (active) setManagedAppUser(appUser) })
    void request.catch((requestError) => { if (active) setError(getApiErrorMessage(requestError, '사용자 상세를 불러오지 못했습니다.')) }).finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [detailKind, detailUid, isDetailRoute])

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
      setForm({ name: plain.name, phone: plain.phone, email: plain.email, password: '', passwordConfirm: '', role: user.role })
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
    if (!formValid) return
    try {
      if (formUser) {
        const updated = await updateUser(formUser.userUid, { name: form.name, phone: form.phone, email: form.email, role: form.role })
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
    if (!passwordUser || !validPassword(newPassword)) return
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
  const canManageAppUser = (account: AppUser) => sessionUser?.role === 'S.ADMIN' || (sessionUser?.role === 'ADMIN' && account.role === 'CLIENT')

  const openAdminEdit = () => {
    if (!managedAdmin) return
    setAdminName(managedAdmin.name)
    setAdminPhone('')
    setAdminEmail('')
    if (managedAdmin.role !== 'S.ADMIN') setAdminRole(managedAdmin.role)
    setAdminEditOpen(true)
  }

  const saveManagedAdmin = async () => {
    if (!managedAdmin || !canManageAdmin(managedAdmin)) return
    try {
      const updated = await updateAdminAccount(managedAdmin.userUid, {
        name: adminName.trim(),
        role: managedAdmin.role === 'S.ADMIN' ? null : adminRole,
        phone: adminPhone.trim() || null,
        email: adminEmail.trim() || null,
      })
      setManagedAdmin(updated)
      setAdminEditOpen(false)
      setMessage('관리 계정 정보와 AES-256-GCM 암호화 연락처를 서버 DB에 반영했습니다.')
      await loadUsers(params)
    } catch (requestError) { setError(getApiErrorMessage(requestError, '관리 계정을 수정하지 못했습니다.')) }
  }

  const toggleManagedAdminStatus = async () => {
    if (!managedAdmin || !canManageAdmin(managedAdmin)) return
    try {
      const updated = await changeAdminAccountStatus(managedAdmin.userUid, managedAdmin.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
      setManagedAdmin(updated)
      setMessage(`계정을 ${updated.status === 'ACTIVE' ? '활성화' : '정지'}했습니다.`)
      await loadUsers(params)
    } catch (requestError) { setError(getApiErrorMessage(requestError, '계정 상태를 변경하지 못했습니다.')) }
  }

  const resetManagedAdminPassword = async () => {
    if (!managedAdmin || !validPassword(managedPassword) || !canManageAdmin(managedAdmin)) return
    try {
      await resetAdminAccountPassword(managedAdmin.userUid, managedPassword)
      setManagedPassword('')
      setAdminPasswordOpen(false)
      setMessage('새 Salt와 PBKDF2 해시로 로그인 비밀번호를 재설정했습니다.')
    } catch (requestError) { setError(getApiErrorMessage(requestError, '로그인 비밀번호를 재설정하지 못했습니다.')) }
  }

  const toggleManagedAppStatus = async () => {
    if (!managedAppUser || !canManageAppUser(managedAppUser)) return
    try {
      const updated = await changeUserStatus(managedAppUser.userUid, managedAppUser.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
      setManagedAppUser(updated)
      setMessage(`사용자를 ${updated.status === 'ACTIVE' ? '활성화' : '정지'}했습니다.`)
      await loadUsers(params)
    } catch (requestError) { setError(getApiErrorMessage(requestError, '사용자 상태를 변경하지 못했습니다.')) }
  }

  const accountManageable = managedAdmin ? canManageAdmin(managedAdmin) : false
  const appAccountManageable = managedAppUser ? canManageAppUser(managedAppUser) : false
  const closeDetail = () => navigate('/users')
  const detailDrawer = (
    <Drawer anchor="right" open={isDetailRoute} onClose={closeDetail} slotProps={{ backdrop: { sx: { bgcolor: 'rgba(20,29,48,.34)', backdropFilter: 'blur(5px)' } }, paper: { sx: { top: { sm: 24 }, bottom: { sm: 'auto' }, width: { xs: '100%', sm: 700 }, maxWidth: '100%', height: { xs: '100%', sm: 'auto' }, maxHeight: { sm: 'calc(100% - 48px)' }, borderRadius: { sm: '16px 0 0 16px' }, boxShadow: '-24px 0 64px rgba(25,42,78,.2)' } } }}>
      <Box sx={{ overflowY: 'auto', p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, pb: 2, mb: 2.5, borderBottom: '2px solid', borderColor: 'divider' }}><Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}><Button color="inherit" startIcon={<ArrowBackRounded />} onClick={closeDetail}>사용자 목록</Button><Box sx={{ height: 34, borderLeft: '2px solid', borderColor: 'divider' }} /><Box sx={{ minWidth: 0 }}><Typography variant="h5" noWrap>{managedAdmin?.loginId ?? managedAppUser?.nameMasked ?? '사용자'}</Typography></Box></Stack><IconButton aria-label="사용자 상세 닫기" onClick={closeDetail}><CloseRounded /></IconButton></Box>
        {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}
        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
        {detailLoading && <Box sx={{ display: 'grid', minHeight: 240, placeItems: 'center' }}><CircularProgress /></Box>}
        {managedAdmin && !detailLoading && (
          <Card className="section-card">
            <Box className="section-card-header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><Typography variant="h6">사용자 정보 및 제어</Typography><StatusBadge dot label={managedAdmin.integrityValid ? '정상' : '비정상'} tone={managedAdmin.integrityValid ? 'positive' : 'danger'} minWidth={0} /></Box>
            <Box sx={{ p: 2.5 }}><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, columnGap: 3 }}><InfoRow label="이름" value={managedAdmin.name} /><InfoRow label="로그인 ID" value={managedAdmin.loginId} /><InfoRow label="권한" value={managedAdmin.role} /><InfoRow label="상태" value={<StatusBadge dot status={managedAdmin.status} minWidth={0} />} /><InfoRow label="연락처" value={managedAdmin.phoneMasked ?? '미등록'} /><InfoRow label="이메일" value={managedAdmin.emailMasked ?? '미등록'} /><InfoRow label="등록일" value={formatKst(managedAdmin.createdAt)} /><InfoRow label="최근 접속일" value={managedAdmin.lastLoginAt ? formatKst(managedAdmin.lastLoginAt) : '접속 이력 없음'} /></Box>{!accountManageable && <Alert severity="info" sx={{ mt: 2 }}>ADMIN은 CLIENT 계정만 수정할 수 있으며 S.ADMIN은 모든 계정을 관리할 수 있습니다.</Alert>}<Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)' }, gap: 1, mt: 2 }}><Button variant="contained" startIcon={<EditRounded />} disabled={!managedAdmin.integrityValid || !accountManageable} onClick={openAdminEdit}>상세 수정</Button><Button variant="outlined" startIcon={<VisibilityRounded />} disabled>개인정보 원문 조회</Button><Button variant="outlined" startIcon={<LockResetRounded />} disabled={!managedAdmin.integrityValid || !accountManageable} onClick={() => { setManagedPassword(''); setAdminPasswordOpen(true) }}>비밀번호 재설정</Button><Button variant="outlined" color={managedAdmin.status === 'ACTIVE' ? 'error' : 'primary'} disabled={!managedAdmin.integrityValid || !accountManageable || sessionUser?.loginId === managedAdmin.loginId} onClick={() => void toggleManagedAdminStatus()}>{managedAdmin.status === 'ACTIVE' ? '사용자 정지' : '사용자 활성화'}</Button></Box></Box>
          </Card>
        )}
        {managedAppUser && !detailLoading && (
          <Card className="section-card">
            <Box className="section-card-header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><Typography variant="h6">사용자 정보 및 제어</Typography><StatusBadge dot label={managedAppUser.integrityValid ? '정상' : '비정상'} tone={managedAppUser.integrityValid ? 'positive' : 'danger'} minWidth={0} /></Box>
            <Box sx={{ p: 2.5 }}><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, columnGap: 3 }}><InfoRow label="이름" value={managedAppUser.nameMasked} /><InfoRow label="권한" value={managedAppUser.role} /><InfoRow label="상태" value={<StatusBadge dot status={managedAppUser.status} minWidth={0} />} /><InfoRow label="연락처" value={managedAppUser.phoneMasked} /><InfoRow label="이메일" value={managedAppUser.emailMasked} /><InfoRow label="등록일" value={formatKst(managedAppUser.createdAt)} /></Box>{!appAccountManageable && <Alert severity="info" sx={{ mt: 2 }}>ADMIN은 CLIENT 계정만 수정할 수 있으며 S.ADMIN은 모든 계정을 관리할 수 있습니다.</Alert>}<Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)' }, gap: 1, mt: 2 }}><Button variant="contained" startIcon={<EditRounded />} disabled={!managedAppUser.integrityValid || !appAccountManageable} onClick={() => void openEdit(managedAppUser)}>상세 수정</Button><Button variant="outlined" startIcon={<VisibilityRounded />} disabled={!managedAppUser.integrityValid || !appAccountManageable} onClick={() => { setPlainCandidate(managedAppUser); setPlainReason('') }}>개인정보 원문 조회</Button><Button variant="outlined" startIcon={<LockResetRounded />} disabled={!managedAppUser.integrityValid || !appAccountManageable} onClick={() => { setPasswordUser(managedAppUser); setNewPassword('') }}>비밀번호 재설정</Button><Button variant="outlined" color={managedAppUser.status === 'ACTIVE' ? 'error' : 'primary'} disabled={!managedAppUser.integrityValid || !appAccountManageable} onClick={() => void toggleManagedAppStatus()}>{managedAppUser.status === 'ACTIVE' ? '사용자 정지' : '사용자 활성화'}</Button></Box></Box>
          </Card>
        )}
      </Box>
    </Drawer>
  )

  return (
    <Box className="list-page">
      <PageHeader
        title="사용자 관리"
        reserveDescription
        action={(sessionUser?.role === 'ADMIN' || sessionUser?.role === 'S.ADMIN') && <Button data-testid="user-create-button" variant="contained" startIcon={<AddRounded />} onClick={openCreate}>사용자 등록</Button>}
      />
      {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      <SearchFilterForm columns={3} onSearch={search} onReset={resetFilters}>
          <TextField size="small" label="이름 검색" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }} />
          <TextField size="small" label="연락처 정확 검색" value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} />
          <TextField size="small" label="이메일 검색" value={draft.email ?? ''} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} />
      </SearchFilterForm>

      <Card className="list-results" aria-busy={loading} sx={{ position: 'relative' }}>
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
        <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}><Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>사용자 {pageData.totalElements.toLocaleString()}명</Typography></Box>
        <TableContainer sx={managementTableContainerSx}>
          <Table stickyHeader size="small" sx={[managementTableSx, { '& .MuiTableCell-body': { fontSize: 14, lineHeight: 1.55 }, '& .MuiTableCell-head': { fontSize: 14, fontWeight: 750 } }]}>
            <TableHead><TableRow><TableCell>#</TableCell><TableCell sx={{ width: 150 }}>사용자</TableCell><TableCell sx={{ width: 160 }}>연락처</TableCell><TableCell sx={{ width: 195 }}>이메일</TableCell><TableCell sx={{ width: 95 }}>권한</TableCell><TableCell sx={{ width: 95 }}>상태</TableCell><TableCell sx={{ width: 95 }}>무결성</TableCell><TableCell sx={{ width: 150 }}>등록일</TableCell><TableCell align="center" sx={{ width: 160 }}>최근 접속일</TableCell></TableRow></TableHead>
            <TableBody>
              {loading && pageData.content.length === 0 && <TableRow><TableCell colSpan={9} align="center" sx={{ height: 180 }}><CircularProgress size={28} /></TableCell></TableRow>}
              {!loading && pageData.content.length === 0 && <TableRow><TableCell colSpan={9} align="center" sx={{ height: 180, color: 'text.secondary' }}>조회된 사용자가 없습니다.</TableCell></TableRow>}
              {pageData.content.map((user, index) => {
                const isAdminAccount = user.accountType === 'ADMIN_ACCOUNT'
                return (
                  <TableRow key={`${user.accountType}-${user.userUid}`} hover tabIndex={0} className="interactive-row" onClick={() => navigate(`/users/${isAdminAccount ? 'admin' : 'app'}/${user.userUid}`)} sx={{ cursor: 'pointer', ...(!user.integrityValid ? { bgcolor: 'rgba(228, 81, 111, 0.09)', '&:hover': { bgcolor: 'rgba(228, 81, 111, 0.14)' } } : {}) }}>
                    <TableCell>{params.page * params.size + index + 1}</TableCell>
                    <TableCell><Stack direction="row" spacing={1.2} sx={{ alignItems: 'center', minWidth: 0 }}>{!user.integrityValid && <WarningAmberRounded color="error" fontSize="small" />}<Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 800, fontSize: 16 }}>{user.nameDisplay}</Typography></Box></Stack></TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: user.phoneMasked ? 'inherit' : 'text.disabled' }}>{user.phoneMasked ?? '—'}</TableCell>
                    <TableCell><Typography noWrap sx={{ color: user.emailMasked ? 'inherit' : 'text.disabled' }}>{user.emailMasked ?? '—'}</Typography></TableCell>
                    <TableCell><Typography sx={{ color: user.role === 'S.ADMIN' ? 'primary.main' : 'text.primary', fontSize: 12, fontWeight: 800 }}>{user.role}</Typography></TableCell>
                    <TableCell><StatusBadge dot status={user.status} /></TableCell>
                    <TableCell><StatusBadge dot label={user.integrityValid ? '정상' : '비정상'} tone={user.integrityValid ? 'positive' : 'danger'} minWidth={0} /></TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatKst(user.createdAt).slice(0, 13)}</TableCell>
                    <TableCell align="center" sx={{ color: user.lastLoginAt ? 'text.secondary' : 'text.disabled' }}>{user.lastLoginAt ? formatKst(user.lastLoginAt) : '—'}</TableCell>
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
        <Box component="form" onSubmit={saveUser}>
          <DialogTitle>{formUser ? '사용자 상세 수정' : '암호화 사용자 등록'}</DialogTitle>
          <DialogContent>
            {!formUser && <Alert severity="info" sx={{ mt: 1, mb: 2 }}>연락처 : AES-256-GCM 암호화 / 비밀번호 : 사용자별 Salt 적용 후 PBKDF2 저장</Alert>}
            <Stack spacing={2} sx={{ mt: formUser ? 1 : 0 }}>
              <FormControl fullWidth><InputLabel>권한</InputLabel><Select label="권한" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as EditableRole }))}>{canAssignAdmin && <MenuItem value="ADMIN">ADMIN</MenuItem>}<MenuItem value="CLIENT">CLIENT</MenuItem></Select></FormControl>
              <TextField required label="이름" value={form.name} error={Boolean(form.name) && !nameValid} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} slotProps={{ htmlInput: { maxLength: 64 } }} helperText="1~64자" />
              <TextField required label="연락처" placeholder="010-1234-5678" value={form.phone} error={Boolean(form.phone) && !phoneValid} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} slotProps={{ htmlInput: { maxLength: 20, pattern: '[0-9+()\\-\\s]{9,20}' } }} helperText={form.phone && !phoneValid ? '숫자 9~15자리의 연락처 형식을 확인하세요.' : '마스터키 AES-256-GCM 암호화 · HMAC 정확 검색'} />
              <TextField required type="email" label="이메일" value={form.email} error={Boolean(form.email) && !emailValid} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} slotProps={{ htmlInput: { maxLength: 254 } }} helperText={form.email && !emailValid ? '올바른 이메일 형식을 입력하세요.' : '마스터키 AES-256-GCM 암호화 저장'} />
              {!formUser && <TextField required type="password" label="초기 비밀번호" value={form.password} error={Boolean(form.password) && !passwordValid} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} slotProps={{ htmlInput: { minLength: 8, maxLength: 128 } }} helperText="8~128자 · 특수문자 1개 이상 포함" />}
              {!formUser && <TextField required type="password" label="비밀번호 확인" value={form.passwordConfirm} error={Boolean(form.passwordConfirm) && form.passwordConfirm !== form.password} helperText={form.passwordConfirm && form.passwordConfirm !== form.password ? "비밀번호가 일치하지 않습니다." : "초기 비밀번호를 다시 입력하세요."} onChange={(event) => setForm((current) => ({ ...current, passwordConfirm: event.target.value }))} />}
            </Stack>
          </DialogContent>
          <DialogActions><Button onClick={() => setFormUser(undefined)}>취소</Button><Button data-testid="user-save-button" type="submit" variant="contained" disabled={!formValid}>암호화 저장</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={adminEditOpen} onClose={() => setAdminEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>사용자 상세 수정</DialogTitle>
        <DialogContent><Alert severity="info" sx={{ mt: 1, mb: 2 }}>새 연락처·이메일을 입력하면 AES-256-GCM으로 암호화됩니다. 비워 두면 기존 값을 유지합니다.</Alert><Stack spacing={2}><TextField required label="이름" value={adminName} onChange={(event) => setAdminName(event.target.value)} slotProps={{ htmlInput: { maxLength: 64 } }} />{managedAdmin?.role === 'S.ADMIN' ? <Alert severity="info">S.ADMIN은 시스템 최고 관리자 전용 권한으로 변경할 수 없습니다.</Alert> : <FormControl fullWidth><InputLabel>권한</InputLabel><Select label="권한" value={adminRole} onChange={(event) => setAdminRole(event.target.value as EditableRole)}>{canAssignAdmin && <MenuItem value="ADMIN">ADMIN</MenuItem>}<MenuItem value="CLIENT">CLIENT</MenuItem></Select></FormControl>}<TextField label="새 연락처" placeholder={managedAdmin?.phoneMasked ?? '010-1234-5678'} value={adminPhone} error={!adminPhoneValid} onChange={(event) => setAdminPhone(event.target.value)} slotProps={{ htmlInput: { maxLength: 20 } }} helperText={adminPhone && !adminPhoneValid ? '숫자 9~15자리의 연락처 형식을 확인하세요.' : `현재 ${managedAdmin?.phoneMasked ?? '미등록'} · 비우면 유지`} /><TextField type="email" label="새 이메일" placeholder={managedAdmin?.emailMasked ?? 'user@example.com'} value={adminEmail} error={!adminEmailValid} onChange={(event) => setAdminEmail(event.target.value)} slotProps={{ htmlInput: { maxLength: 254 } }} helperText={adminEmail && !adminEmailValid ? '올바른 이메일 형식을 입력하세요.' : `현재 ${managedAdmin?.emailMasked ?? '미등록'} · 비우면 유지`} /></Stack></DialogContent>
        <DialogActions><Button onClick={() => setAdminEditOpen(false)}>취소</Button><Button variant="contained" disabled={!adminName.trim() || !adminPhoneValid || !adminEmailValid} onClick={() => void saveManagedAdmin()}>암호화 저장</Button></DialogActions>
      </Dialog>

      <Dialog open={adminPasswordOpen} onClose={() => setAdminPasswordOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>비밀번호 재설정</DialogTitle><DialogContent><TextField autoFocus fullWidth type="password" label="새 비밀번호" value={managedPassword} error={Boolean(managedPassword) && (!validPassword(managedPassword))} onChange={(event) => setManagedPassword(event.target.value)} slotProps={{ htmlInput: { minLength: 8, maxLength: 128 } }} helperText="8~128자 · 특수문자 포함 · 새 Salt와 PBKDF2-HMAC-SHA256 적용" sx={{ mt: 1 }} /></DialogContent><DialogActions><Button onClick={() => setAdminPasswordOpen(false)}>취소</Button><Button variant="contained" disabled={!validPassword(managedPassword)} onClick={() => void resetManagedAdminPassword()}>재설정</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(passwordUser)} onClose={() => setPasswordUser(null)} fullWidth maxWidth="xs">
        <DialogTitle>비밀번호 재설정</DialogTitle><DialogContent><TextField autoFocus fullWidth type="password" label="새 비밀번호" value={newPassword} error={Boolean(newPassword) && (!validPassword(newPassword))} onChange={(event) => setNewPassword(event.target.value)} slotProps={{ htmlInput: { minLength: 8, maxLength: 128 } }} helperText="8~128자 · 특수문자 포함 · 새 Salt로 PBKDF2 해시를 생성하고 감사 로그를 기록합니다." sx={{ mt: 1 }} /></DialogContent><DialogActions><Button onClick={() => setPasswordUser(null)}>취소</Button><Button variant="contained" disabled={!validPassword(newPassword) || busyUserUid === passwordUser?.userUid} onClick={() => void resetPassword()}>재설정</Button></DialogActions>
      </Dialog>
    </Box>
  )
}

export default UserList
