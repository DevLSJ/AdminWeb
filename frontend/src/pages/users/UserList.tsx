import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AddRounded,
  EditRounded,
  LockResetRounded,
  PersonSearchRounded,
  RefreshRounded,
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
  FormControl,
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
import {
  changeUserStatus,
  createUser,
  fetchAdminAccounts,
  fetchUserPage,
  fetchUserPlain,
  getApiErrorMessage,
  resetUserPassword,
  updateUser,
} from '../../api/kms'
import { FilterCard, InfoRow, PageHeader, PaginationBar } from '../../components/admin/AdminPage'
import { StatusBadge } from '../../components/common/StatusBadge'
import type { AdminAccount, AppUser, AppUserPlain, PageResponse, UserListParams, UserStatus } from '../../types/api'

const emptyPage: PageResponse<AppUser> = { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 }
const emptyForm = { name: '', phone: '', email: '', password: '' }
const initialParams: UserListParams = { name: '', phone: '', status: 'ALL', page: 0, size: 10 }

function formatKst(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

function UserList() {
  const [draft, setDraft] = useState(initialParams)
  const [params, setParams] = useState(initialParams)
  const [pageData, setPageData] = useState(emptyPage)
  const [loading, setLoading] = useState(true)
  const [busyUserUid, setBusyUserUid] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [detailUser, setDetailUser] = useState<AppUser | null>(null)
  const [plainCandidate, setPlainCandidate] = useState<AppUser | null>(null)
  const [plainReason, setPlainReason] = useState('')
  const [plainUser, setPlainUser] = useState<AppUserPlain | null>(null)
  const [formUser, setFormUser] = useState<AppUser | null | undefined>(undefined)
  const [form, setForm] = useState(emptyForm)
  const [passwordUser, setPasswordUser] = useState<AppUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([])

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
        await updateUser(formUser.userUid, { name: form.name, phone: form.phone, email: form.email })
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

  const toggleStatus = async (user: AppUser) => {
    const nextStatus: UserStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setBusyUserUid(user.userUid)
    setError('')
    try {
      await changeUserStatus(user.userUid, nextStatus)
      setMessage(`${user.nameMasked} 사용자를 ${nextStatus} 상태로 변경했습니다.`)
      await loadUsers(params)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '사용자 상태를 변경하지 못했습니다.'))
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

  return (
    <Box>
      <PageHeader
        title="사용자 관리"
        description="개인정보 원문을 DB에 남기지 않고 마스킹 조회·사유 기반 원문 조회·행 무결성 검증을 수행합니다."
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
        <Typography sx={{ mt: 1, color: 'text.secondary', fontSize: 12.5 }}>검색어는 복호화하지 않고 정규화된 HMAC 검색값으로 정확히 일치시킵니다.</Typography>
      </FilterCard>

      <Card>
        <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}><Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>사용자 {(pageData.totalElements + adminAccounts.length).toLocaleString()}명</Typography></Box>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 390px)', minHeight: 290 }}>
          <Table stickyHeader size="small" sx={{ minWidth: 1080, tableLayout: 'fixed' }}>
            <TableHead><TableRow><TableCell sx={{ width: '16%' }}>사용자</TableCell><TableCell sx={{ width: '15%' }}>연락처</TableCell><TableCell sx={{ width: '21%' }}>이메일</TableCell><TableCell sx={{ width: '10%' }}>상태</TableCell><TableCell sx={{ width: '12%' }}>무결성</TableCell><TableCell sx={{ width: '12%' }}>등록일</TableCell><TableCell align="right" sx={{ width: '24%' }}>관리</TableCell></TableRow></TableHead>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} align="center" sx={{ height: 180 }}><CircularProgress size={28} /></TableCell></TableRow>}
              {!loading && pageData.content.length === 0 && visibleAdminAccounts.length === 0 && <TableRow><TableCell colSpan={7} align="center" sx={{ height: 180, color: 'text.secondary' }}>조회된 사용자가 없습니다.</TableCell></TableRow>}
              {!loading && visibleAdminAccounts.map((account) => (
                <TableRow key={`admin-${account.userUid}`} hover className="interactive-row">
                  <TableCell><Typography sx={{ fontWeight: 800 }}>{account.name}</Typography><Typography noWrap sx={{ color: 'text.secondary', fontSize: 11.5 }}>{account.loginId} · {account.role}</Typography></TableCell>
                  <TableCell sx={{ color: 'text.disabled' }}>—</TableCell>
                  <TableCell sx={{ color: 'text.disabled' }}>—</TableCell>
                  <TableCell><StatusBadge status={account.status} /></TableCell>
                  <TableCell><StatusBadge label="LOGIN" tone="info" /></TableCell>
                  <TableCell>{formatKst(account.createdAt)}</TableCell>
                  <TableCell align="right"><Typography sx={{ color: 'text.secondary', fontSize: 12 }}>{account.lastLoginAt ? `최근 로그인 ${formatKst(account.lastLoginAt)}` : '로그인 이력 없음'}</Typography></TableCell>
                </TableRow>
              ))}
              {!loading && pageData.content.map((user) => {
                const busy = busyUserUid === user.userUid
                return (
                  <TableRow key={user.userUid} hover className="interactive-row" sx={!user.integrityValid ? { bgcolor: 'rgba(228, 81, 111, 0.09)', '&:hover': { bgcolor: 'rgba(228, 81, 111, 0.14)' } } : undefined}>
                    <TableCell><Stack direction="row" spacing={0.8} sx={{ alignItems: 'center' }}>{!user.integrityValid && <WarningAmberRounded color="error" fontSize="small" />}<Box><Typography sx={{ fontWeight: 750 }}>{user.nameMasked}</Typography><Typography noWrap sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: 11.5 }}>{user.userUid}</Typography></Box></Stack></TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{user.phoneMasked}</TableCell>
                    <TableCell><Typography noWrap>{user.emailMasked}</Typography></TableCell>
                    <TableCell><StatusBadge status={user.status} /></TableCell>
                    <TableCell><StatusBadge status={user.integrityValid ? 'VALID' : 'INVALID'} /></TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatKst(user.createdAt).slice(0, 13)}</TableCell>
                    <TableCell align="right"><Stack direction="row" spacing={0.25} sx={{ justifyContent: 'flex-end' }}>
                      <Tooltip title="마스킹 상세"><Button size="small" startIcon={<PersonSearchRounded />} onClick={() => setDetailUser(user)}>상세</Button></Tooltip>
                      <Tooltip title={user.integrityValid ? '원문 조회 감사기록 후 수정' : '무결성 위반으로 수정 차단'}><span><Button size="small" startIcon={<EditRounded />} disabled={!user.integrityValid || busy} onClick={() => void openEdit(user)}>수정</Button></span></Tooltip>
                      <Tooltip title="비밀번호 재설정"><span><Button size="small" aria-label="비밀번호 재설정" disabled={!user.integrityValid || busy} onClick={() => { setPasswordUser(user); setNewPassword('') }}><LockResetRounded fontSize="small" /></Button></span></Tooltip>
                      <Button size="small" disabled={!user.integrityValid || busy} onClick={() => void toggleStatus(user)}>{user.status === 'ACTIVE' ? '정지' : '활성'}</Button>
                    </Stack></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <PaginationBar page={params.page} size={params.size} totalElements={pageData.totalElements} onPageChange={(page) => setParams((current) => ({ ...current, page }))} onSizeChange={(size) => setParams((current) => ({ ...current, page: 0, size }))} />
      </Card>

      <Dialog open={Boolean(detailUser)} onClose={() => setDetailUser(null)} fullWidth maxWidth="sm">
        <DialogTitle>사용자 마스킹 상세</DialogTitle>
        <DialogContent>{detailUser && <>
          <Alert severity={detailUser.integrityValid ? 'success' : 'error'} sx={{ mb: 2 }}>{detailUser.integrityValid ? '암호문·IV·검색값·상태의 행 무결성이 정상입니다.' : '행 무결성이 훼손되어 원문 조회와 변경이 차단됩니다.'}</Alert>
          <InfoRow label="사용자 UID" value={detailUser.userUid} /><InfoRow label="이름" value={detailUser.nameMasked} /><InfoRow label="연락처" value={detailUser.phoneMasked} /><InfoRow label="이메일" value={detailUser.emailMasked} /><InfoRow label="상태" value={<StatusBadge status={detailUser.status} />} /><InfoRow label="암호화 버전" value={`enc_ver ${detailUser.encVer}`} /><InfoRow label="등록자" value={detailUser.createdBy} /><InfoRow label="수정 시각" value={`${formatKst(detailUser.updatedAt)} KST`} />
        </>}</DialogContent>
        <DialogActions><Button onClick={() => setDetailUser(null)}>닫기</Button><Button data-testid="plain-view-start" variant="contained" startIcon={<VisibilityRounded />} disabled={!detailUser?.integrityValid} onClick={() => { setPlainCandidate(detailUser); setPlainReason(''); setDetailUser(null) }}>원문 보기</Button></DialogActions>
      </Dialog>

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
        <Box component="form" onSubmit={saveUser}><DialogTitle>{formUser ? '사용자 개인정보 수정' : '암호화 사용자 등록'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField required label="이름" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} slotProps={{ htmlInput: { maxLength: 64 } }} /><TextField required label="연락처" placeholder="010-1234-5678" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} helperText="정규화된 연락처 HMAC으로 중복과 정확 검색을 처리합니다." /><TextField required type="email" label="이메일" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />{!formUser && <TextField required type="password" label="초기 비밀번호" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} slotProps={{ htmlInput: { minLength: 8, maxLength: 128 } }} helperText="8자 이상 · 사용자별 Salt와 PBKDF2-HMAC-SHA256 적용" />}</Stack></DialogContent><DialogActions><Button onClick={() => setFormUser(undefined)}>취소</Button><Button data-testid="user-save-button" type="submit" variant="contained" disabled={!form.name.trim() || !form.phone.trim() || !form.email.trim() || (!formUser && form.password.length < 8)}>암호화 저장</Button></DialogActions></Box>
      </Dialog>

      <Dialog open={Boolean(passwordUser)} onClose={() => setPasswordUser(null)} fullWidth maxWidth="xs">
        <DialogTitle>비밀번호 재설정</DialogTitle><DialogContent><TextField autoFocus fullWidth type="password" label="새 비밀번호" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} slotProps={{ htmlInput: { minLength: 8, maxLength: 128 } }} helperText="새 Salt로 PBKDF2 해시를 생성하고 감사 로그를 기록합니다." sx={{ mt: 1 }} /></DialogContent><DialogActions><Button onClick={() => setPasswordUser(null)}>취소</Button><Button variant="contained" disabled={newPassword.length < 8 || busyUserUid === passwordUser?.userUid} onClick={() => void resetPassword()}>재설정</Button></DialogActions>
      </Dialog>
    </Box>
  )
}

export default UserList
