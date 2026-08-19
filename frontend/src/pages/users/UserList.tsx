import { useMemo, useState, type FormEvent } from 'react'
import {
  AddRounded,
  EditRounded,
  KeyRounded,
  LockResetRounded,
  PersonSearchRounded,
  SearchRounded,
  VisibilityRounded,
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
  Typography,
} from '@mui/material'
import { FilterCard, InfoRow, PageHeader, PaginationBar, StatusChip } from '../../components/admin/AdminPage'
import { mockUsers } from '../../mocks/adminData'
import type { AppUser, UserListParams, UserStatus } from '../../types/api'

const defaultParams: UserListParams = { name: '', status: 'ALL', phone: '', page: 0, size: 5 }
const emptyForm = { name: '', phone: '', email: '', password: '' }

function UserList() {
  const [params, setParams] = useState(defaultParams)
  const [users, setUsers] = useState(mockUsers)
  const [detailUser, setDetailUser] = useState<AppUser | null>(null)
  const [plainUser, setPlainUser] = useState<AppUser | null>(null)
  const [formUser, setFormUser] = useState<AppUser | null | undefined>(undefined)
  const [passwordUser, setPasswordUser] = useState<AppUser | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')

  const filteredUsers = useMemo(() => users.filter((user) => {
    const nameMatched = !params.name.trim() || user.name.includes(params.name.trim())
    const phoneMatched = !params.phone.trim() || user.phonePlain === params.phone.trim()
    return nameMatched && phoneMatched && (params.status === 'ALL' || user.status === params.status)
  }), [params, users])
  const pageContent = filteredUsers.slice(params.page * params.size, (params.page + 1) * params.size)

  const updateParam = <K extends keyof UserListParams>(key: K, value: UserListParams[K]) => setParams((current) => ({ ...current, [key]: value, page: key === 'page' ? Number(value) : 0 }))

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
      <PageHeader title="사용자 관리" description="개인정보는 마스킹해 표시하고 연락처는 HMAC 검색 해시를 이용한 정확검색만 지원합니다." action={<Button variant="contained" startIcon={<AddRounded />} onClick={() => openForm(null)}>사용자 등록</Button>} />
      {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}
      <FilterCard>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.2fr 1.4fr 0.8fr auto' }, gap: 1.5, alignItems: 'start' }}>
          <TextField size="small" label="이름" value={params.name} onChange={(event) => updateParam('name', event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }} />
          <TextField size="small" label="연락처 정확검색" placeholder="010-1234-5678" value={params.phone} onChange={(event) => updateParam('phone', event.target.value)} helperText="부분검색 불가 · phone_hash 정확 일치" />
          <FormControl size="small"><InputLabel>상태</InputLabel><Select label="상태" value={params.status} onChange={(event) => updateParam('status', event.target.value as UserListParams['status'])}><MenuItem value="ALL">전체</MenuItem><MenuItem value="ACTIVE">활성</MenuItem><MenuItem value="INACTIVE">정지</MenuItem></Select></FormControl>
          <Button color="inherit" onClick={() => setParams(defaultParams)}>초기화</Button>
        </Box>
      </FilterCard>
      <Card>
        <TableContainer><Table sx={{ minWidth: 1000 }}><TableHead><TableRow sx={{ bgcolor: '#f8f9fc' }}><TableCell>사용자</TableCell><TableCell>연락처</TableCell><TableCell>이메일</TableCell><TableCell>상태</TableCell><TableCell>암호화 버전</TableCell><TableCell>무결성</TableCell><TableCell>등록일</TableCell><TableCell align="right">관리</TableCell></TableRow></TableHead><TableBody>{pageContent.map((user) => <TableRow key={user.userUid} hover><TableCell><Typography sx={{ fontWeight: 700 }}>{user.name}</Typography><Typography sx={{ color: 'text.secondary', fontSize: 11 }}>{user.userUid}</Typography></TableCell><TableCell>{user.phoneMasked}</TableCell><TableCell>{user.emailMasked}</TableCell><TableCell><StatusChip status={user.status} /></TableCell><TableCell>enc_ver {user.encVer}</TableCell><TableCell>{user.integrityValid ? <Chip label="정상" color="success" size="small" variant="outlined" /> : <Chip icon={<WarningAmberRounded />} label="위반" color="error" size="small" />}</TableCell><TableCell>{user.createdAt.split(' ')[0]}</TableCell><TableCell align="right"><Button size="small" startIcon={<PersonSearchRounded />} onClick={() => setDetailUser(user)}>상세</Button><Button size="small" startIcon={<EditRounded />} onClick={() => openForm(user)}>수정</Button><Button size="small" onClick={() => toggleStatus(user)}>{user.status === 'ACTIVE' ? '정지' : '활성'}</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer>
        <PaginationBar page={params.page} size={params.size} totalElements={filteredUsers.length} onPageChange={(page) => updateParam('page', page)} onSizeChange={(size) => updateParam('size', size)} />
      </Card>

      <Dialog open={Boolean(detailUser)} onClose={() => setDetailUser(null)} fullWidth maxWidth="sm"><DialogTitle>사용자 상세</DialogTitle><DialogContent>{detailUser && <><Alert severity={detailUser.integrityValid ? 'success' : 'error'} sx={{ mb: 2 }}>{detailUser.integrityValid ? '행 무결성 검증이 정상입니다.' : '행 무결성이 훼손되어 원문 조회를 차단해야 합니다.'}</Alert><InfoRow label="사용자 UID" value={detailUser.userUid} /><InfoRow label="이름" value={detailUser.name} /><InfoRow label="연락처" value={detailUser.phoneMasked} /><InfoRow label="이메일" value={detailUser.emailMasked} /><InfoRow label="상태" value={<StatusChip status={detailUser.status} />} /><InfoRow label="암호화 버전" value={`enc_ver ${detailUser.encVer}`} /></>}</DialogContent><DialogActions><Button onClick={() => setDetailUser(null)}>닫기</Button><Button startIcon={<LockResetRounded />} onClick={() => { setPasswordUser(detailUser); setDetailUser(null) }}>비밀번호 재설정</Button><Button variant="contained" startIcon={<VisibilityRounded />} disabled={!detailUser?.integrityValid} onClick={() => { setPlainUser(detailUser); setDetailUser(null) }}>원문 보기</Button></DialogActions></Dialog>

      <Dialog open={Boolean(plainUser)} onClose={() => setPlainUser(null)} fullWidth maxWidth="sm"><DialogTitle>개인정보 원문 조회</DialogTitle><DialogContent>{plainUser && <><Alert severity="warning" sx={{ mb: 2 }}>ADMIN 전용 기능입니다. 마스터키로 복호화하며 USER_VIEW_PLAIN 감사로그가 자동 기록됩니다.</Alert><InfoRow label="이름" value={plainUser.name} /><InfoRow label="연락처 원문" value={plainUser.phonePlain} /><InfoRow label="이메일 원문" value={plainUser.emailPlain} /></>}</DialogContent><DialogActions><Button onClick={() => setPlainUser(null)}>확인</Button></DialogActions></Dialog>

      <Dialog open={formUser !== undefined} onClose={() => setFormUser(undefined)} fullWidth maxWidth="sm"><Box component="form" onSubmit={saveUser}><DialogTitle>{formUser ? '사용자 수정' : '사용자 등록'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField required label="이름" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /><TextField required label="연락처" placeholder="010-1234-5678" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} helperText="저장 시 AES-GCM 재암호화 및 HMAC 검색 해시를 생성합니다." /><TextField required type="email" label="이메일" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />{!formUser && <TextField required type="password" label="초기 비밀번호" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} helperText="새 Salt를 생성해 PBKDF2 단방향 해시로 저장합니다." />}</Stack></DialogContent><DialogActions><Button onClick={() => setFormUser(undefined)}>취소</Button><Button type="submit" variant="contained" disabled={!form.name || !form.phone || !form.email || (!formUser && !form.password)}>저장</Button></DialogActions></Box></Dialog>

      <Dialog open={Boolean(passwordUser)} onClose={() => setPasswordUser(null)} fullWidth maxWidth="xs"><DialogTitle>비밀번호 재설정</DialogTitle><DialogContent><Alert severity="info" sx={{ mb: 2 }}>기존 비밀번호 원문은 조회할 수 없습니다. 새 Salt와 PBKDF2 해시를 생성합니다.</Alert><TextField fullWidth type="password" label="새 비밀번호" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><KeyRounded /></InputAdornment> } }} /></DialogContent><DialogActions><Button onClick={() => setPasswordUser(null)}>취소</Button><Button variant="contained" disabled={newPassword.length < 8} onClick={() => { setMessage(`${passwordUser?.name} 사용자의 비밀번호가 재설정되었습니다.`); setPasswordUser(null); setNewPassword('') }}>재설정</Button></DialogActions></Dialog>
    </Box>
  )
}

export default UserList
