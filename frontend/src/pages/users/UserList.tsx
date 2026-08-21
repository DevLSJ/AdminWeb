import { useState, type FormEvent } from 'react'
import {
  AddRounded,
  EditRounded,
  ManageAccountsRounded,
  PersonSearchRounded,
  TouchAppRounded,
  VisibilityRounded,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
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
  Typography,
} from '@mui/material'
import { InfoRow, PageHeader, PaginationBar } from '../../components/admin/AdminPage'
import { StatusBadge } from '../../components/common/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import { mockUsers } from '../../mocks/adminData'
import type { AppUser, UserStatus } from '../../types/api'
import { canChangeRole, type AuthResult, type AuthUser, type UserRole } from '../../types/auth'

const emptyForm = { name: '', phone: '', email: '', password: '' }

function UserList() {
  const { accounts, user: currentUser, updateAccountRole } = useAuth()
  const [users, setUsers] = useState(mockUsers)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(5)
  const [detailUser, setDetailUser] = useState<AppUser | null>(null)
  const [plainUser, setPlainUser] = useState<AppUser | null>(null)
  const [formUser, setFormUser] = useState<AppUser | null | undefined>(undefined)
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')
  const [roleResult, setRoleResult] = useState<AuthResult | null>(null)
  const [selectedUserUid, setSelectedUserUid] = useState<string | null>(null)
  const [pendingRole, setPendingRole] = useState<UserRole | ''>('')

  const roleOptions: UserRole[] = currentUser?.role === 'S.ADMIN'
    ? ['S.ADMIN', 'ADMIN', 'CLIENT']
    : ['ADMIN', 'CLIENT']
  const canEditAccount = (account: AuthUser) => roleOptions.some((role) => canChangeRole(currentUser, account, role))

  const pageContent = users.slice(page * pageSize, (page + 1) * pageSize)
  const selectedUser = users.find((user) => user.userUid === selectedUserUid) ?? null
  const selectedAccount = selectedUser?.loginId ? accounts.find((account) => account.loginId === selectedUser.loginId) ?? null : null
  const selectedAccountEditable = selectedAccount ? canEditAccount(selectedAccount) : false
  const formatRole = (role?: UserRole) => role === 'S.ADMIN' ? 'S.Admin' : role ?? '미연동'

  const selectUser = (user: AppUser) => {
    const account = user.loginId ? accounts.find((item) => item.loginId === user.loginId) : undefined
    setSelectedUserUid(user.userUid)
    setPendingRole(account?.role ?? '')
    setRoleResult(null)
  }

  const changeSelectedRole = () => {
    if (!selectedAccount || !pendingRole) return
    setRoleResult(updateAccountRole(selectedAccount.loginId, pendingRole))
  }

  const openForm = (user: AppUser | null) => {
    setFormUser(user)
    setForm(user ? { name: user.name, phone: user.phonePlain, email: user.emailPlain, password: '' } : emptyForm)
  }

  const saveUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (formUser) {
      setUsers((current) => current.map((user) => user.userUid === formUser.userUid ? { ...user, name: form.name, phonePlain: form.phone, phoneMasked: `${form.phone.slice(0, 4)}****-${form.phone.slice(-4)}`, emailPlain: form.email, emailMasked: `${form.email.slice(0, 2)}***@${form.email.split('@')[1] ?? 'example.com'}`, updatedAt: '2026-08-19 17:10:00', integrityValid: true } : user))
      setMessage('사용자 정보가 재암호화되고 검색 해시·무결성 해시가 재계산되었습니다.')
    } else {
      const created: AppUser = { userUid: `usr-${crypto.randomUUID().slice(0, 8)}`, name: form.name, phonePlain: form.phone, phoneMasked: `${form.phone.slice(0, 4)}****-${form.phone.slice(-4)}`, emailPlain: form.email, emailMasked: `${form.email.slice(0, 2)}***@${form.email.split('@')[1] ?? 'example.com'}`, status: 'ACTIVE', integrityValid: true, encVer: 1, createdAt: '2026-08-19 17:10:00', updatedAt: '2026-08-19 17:10:00' }
      setUsers((current) => [created, ...current])
      setPage(0)
      setMessage('사용자가 등록되었습니다. 비밀번호는 PBKDF2+Salt, 개인정보는 AES-256-GCM으로 보호됩니다.')
    }
    setFormUser(undefined)
  }

  const toggleStatus = (user: AppUser) => {
    const status: UserStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setUsers((current) => current.map((item) => item.userUid === user.userUid ? { ...item, status } : item))
    setMessage(`${user.name} 사용자가 ${status} 상태로 변경되었습니다.`)
  }

  return (
    <Box>
      <PageHeader title="사용자 관리" description="개인정보를 마스킹해 표시하고 사용자 상태·무결성·시스템 계정 권한을 관리합니다." action={<Button variant="contained" startIcon={<AddRounded />} onClick={() => openForm(null)}>사용자 등록</Button>} />
      {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}
      {roleResult && <Alert severity={roleResult.success ? 'success' : 'error'} onClose={() => setRoleResult(null)} sx={{ mb: 2 }}>{roleResult.message}</Alert>}
      <Card sx={{ mb: 2.5 }}>
        <Box sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><ManageAccountsRounded color="primary" /><Typography variant="h6">시스템 계정 권한</Typography></Box>
          <Typography sx={{ mt: 0.5, color: 'text.secondary', fontSize: 14, lineHeight: 1.65 }}>아래 사용자 행을 선택하면 로그인 계정과 현재 권한을 확인하고, 허용된 위계 내에서 권한을 변경할 수 있습니다.</Typography>
        </Box>
        {!selectedUser ? (
          <Box sx={{ display: 'grid', minHeight: 190, placeItems: 'center', borderTop: '1px solid', borderColor: 'divider', bgcolor: '#fbfcfe', textAlign: 'center' }}>
            <Box><TouchAppRounded sx={{ color: 'text.disabled', fontSize: 42 }} /><Typography sx={{ mt: 1, fontSize: 15, fontWeight: 700 }}>선택된 사용자가 없습니다.</Typography><Typography sx={{ mt: 0.5, color: 'text.secondary', fontSize: 13.5 }}>하단 목록에서 권한을 확인할 사용자 행을 선택하세요.</Typography></Box>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(150px, 1fr)) minmax(300px, 1.35fr)' }, gap: 2, alignItems: 'end', p: 2.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: '#fbfcfe' }}>
            <Box><Typography sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 700 }}>로그인 ID</Typography><Typography sx={{ mt: 0.7, fontSize: 15, fontWeight: 800 }}>{selectedAccount?.loginId ?? selectedUser.loginId ?? '계정 미연동'}</Typography></Box>
            <Box><Typography sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 700 }}>이름</Typography><Typography sx={{ mt: 0.7, fontSize: 15, fontWeight: 800 }}>{selectedUser.name}</Typography></Box>
            <Box><Typography sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 700 }}>현재 권한</Typography><Typography sx={{ mt: 0.7, fontSize: 15, fontWeight: 800 }}>{formatRole(selectedAccount?.role)}</Typography></Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <FormControl size="small" fullWidth disabled={!selectedAccountEditable}>
                <InputLabel>변경할 권한</InputLabel>
                <Select label="변경할 권한" value={pendingRole} onChange={(event) => setPendingRole(event.target.value as UserRole)}>
                  {roleOptions.map((role) => <MenuItem key={role} value={role}>{role === 'S.ADMIN' ? 'S.Admin' : role}</MenuItem>)}
                </Select>
              </FormControl>
              <Button variant="contained" disabled={!selectedAccountEditable || !pendingRole || pendingRole === selectedAccount?.role} onClick={changeSelectedRole} sx={{ minWidth: 104, whiteSpace: 'nowrap' }}>권한 변경</Button>
            </Stack>
            {!selectedAccountEditable && <Typography sx={{ gridColumn: { md: '4' }, color: 'text.secondary', fontSize: 13 }}>{selectedAccount?.loginId === currentUser?.loginId ? '현재 로그인한 계정은 변경할 수 없습니다.' : currentUser?.role === 'ADMIN' && selectedAccount?.role !== 'CLIENT' ? '일반 관리자는 다른 Admin 또는 S.Admin 계정을 변경할 수 없습니다.' : '이 계정의 권한을 변경할 수 없습니다.'}</Typography>}
          </Box>
        )}
      </Card>
      <Card>
        <TableContainer>
          <Table sx={{ minWidth: 1160, tableLayout: 'fixed', '& .MuiTableCell-root': { px: 2, py: 1.8, fontSize: 15 }, '& .MuiTableCell-head': { bgcolor: '#f8f9fc', color: 'text.secondary', fontSize: 14.5, fontWeight: 800, whiteSpace: 'nowrap' } }}>
            <TableHead><TableRow><TableCell sx={{ width: '17%' }}>사용자</TableCell><TableCell sx={{ width: '12%' }}>연락처</TableCell><TableCell sx={{ width: '16%' }}>이메일</TableCell><TableCell sx={{ width: '10%' }}>상태</TableCell><TableCell sx={{ width: '12%' }}>시스템 권한</TableCell><TableCell sx={{ width: '11%' }}>등록일</TableCell><TableCell align="right" sx={{ width: '22%' }}>관리</TableCell></TableRow></TableHead>
            <TableBody>{pageContent.map((user) => (
              <TableRow key={user.userUid} hover selected={selectedUserUid === user.userUid} tabIndex={0} onClick={() => selectUser(user)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectUser(user) } }} aria-selected={selectedUserUid === user.userUid} sx={{ cursor: 'pointer', '&.Mui-selected': { bgcolor: 'action.selected' } }}>
                <TableCell><Typography sx={{ fontSize: 15.5, fontWeight: 750 }}>{user.name}</Typography><Typography sx={{ mt: 0.25, color: 'text.secondary', fontSize: 13.5 }}>{user.loginId ? `${user.loginId} · ${user.userUid}` : user.userUid}</Typography></TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{user.phoneMasked}</TableCell>
                <TableCell>{user.emailMasked}</TableCell>
                <TableCell><StatusBadge status={user.status} /></TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatRole(user.loginId ? accounts.find((account) => account.loginId === user.loginId)?.role : undefined)}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{user.createdAt.split(' ')[0]}</TableCell>
                <TableCell align="right"><Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}><Button size="small" startIcon={<PersonSearchRounded />} onClick={() => setDetailUser(user)} sx={{ px: 1.4 }}>상세</Button><Button size="small" startIcon={<EditRounded />} onClick={() => openForm(user)} sx={{ px: 1.4 }}>수정</Button><Button size="small" onClick={() => toggleStatus(user)} sx={{ px: 1.6 }}>{user.status === 'ACTIVE' ? '정지' : '활성'}</Button></Stack></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </TableContainer>
        <PaginationBar page={page} size={pageSize} totalElements={users.length} onPageChange={setPage} onSizeChange={(size) => { setPageSize(size); setPage(0) }} />
      </Card>

      <Dialog open={Boolean(detailUser)} onClose={() => setDetailUser(null)} fullWidth maxWidth="sm"><DialogTitle>사용자 상세</DialogTitle><DialogContent>{detailUser && <><Alert severity={detailUser.integrityValid ? 'success' : 'error'} sx={{ mb: 2 }}>{detailUser.integrityValid ? '행 무결성 검증이 정상입니다.' : '행 무결성이 훼손되어 원문 조회를 차단해야 합니다.'}</Alert><InfoRow label="사용자 UID" value={detailUser.userUid} /><InfoRow label="이름" value={detailUser.name} /><InfoRow label="연락처" value={detailUser.phoneMasked} /><InfoRow label="이메일" value={detailUser.emailMasked} /><InfoRow label="상태" value={<StatusBadge status={detailUser.status} />} /><InfoRow label="암호화 버전" value={`enc_ver ${detailUser.encVer}`} /></>}</DialogContent><DialogActions><Button onClick={() => setDetailUser(null)}>닫기</Button><Button variant="contained" startIcon={<VisibilityRounded />} disabled={!detailUser?.integrityValid} onClick={() => { setPlainUser(detailUser); setDetailUser(null) }}>원문 보기</Button></DialogActions></Dialog>

      <Dialog open={Boolean(plainUser)} onClose={() => setPlainUser(null)} fullWidth maxWidth="sm"><DialogTitle>개인정보 원문 조회</DialogTitle><DialogContent>{plainUser && <><Alert severity="warning" sx={{ mb: 2 }}>ADMIN 전용 기능입니다. 마스터키로 복호화하며 USER_VIEW_PLAIN 감사로그가 자동 기록됩니다.</Alert><InfoRow label="이름" value={plainUser.name} /><InfoRow label="연락처 원문" value={plainUser.phonePlain} /><InfoRow label="이메일 원문" value={plainUser.emailPlain} /></>}</DialogContent><DialogActions><Button onClick={() => setPlainUser(null)}>확인</Button></DialogActions></Dialog>

      <Dialog open={formUser !== undefined} onClose={() => setFormUser(undefined)} fullWidth maxWidth="sm"><Box component="form" onSubmit={saveUser}><DialogTitle>{formUser ? '사용자 수정' : '사용자 등록'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField required label="이름" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /><TextField required label="연락처" placeholder="010-1234-5678" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} helperText="저장 시 AES-GCM 재암호화 및 HMAC 검색 해시를 생성합니다." /><TextField required type="email" label="이메일" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />{!formUser && <TextField required type="password" label="초기 비밀번호" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} helperText="새 Salt를 생성해 PBKDF2 단방향 해시로 저장합니다." />}</Stack></DialogContent><DialogActions><Button onClick={() => setFormUser(undefined)}>취소</Button><Button type="submit" variant="contained" disabled={!form.name || !form.phone || !form.email || (!formUser && !form.password)}>저장</Button></DialogActions></Box></Dialog>

    </Box>
  )
}

export default UserList
