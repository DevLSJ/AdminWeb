import { useState, type FormEvent } from 'react'
import { AccountCircleRounded, LockResetRounded, SaveRounded, ShieldRounded } from '@mui/icons-material'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { PageHeader } from '../../components/admin/AdminPage'
import { StatusBadge } from '../../components/common/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import type { UserRole } from '../../types/auth'

const rolePresentation: Record<UserRole, { label: string; color: string; accent: string; description: string }> = {
  'S.ADMIN': { label: 'S.Admin', color: '#0d5fe7', accent: '#1647c8', description: '최고 관리자' },
  ADMIN: { label: 'Admin', color: '#1769e8', accent: '#315bd8', description: '시스템 관리자' },
  CLIENT: { label: 'Client', color: '#3979cf', accent: '#6c94dc', description: '일반 사용자' },
}

function Profile() {
  const { user, updateProfile, changePassword } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [passwordResult, setPasswordResult] = useState<{ success: boolean; message: string } | null>(null)

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    updateProfile(name.trim())
    setProfileMessage('프로필 이름이 변경되었습니다. 향후 /api/auth/me 응답과 동기화됩니다.')
  }

  const savePassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (newPassword !== confirmPassword) {
      setPasswordResult({ success: false, message: '새 비밀번호 확인이 일치하지 않습니다.' })
      return
    }
    const result = changePassword(currentPassword, newPassword)
    setPasswordResult(result)
    if (result.success) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  if (!user) return null
  const roleStyle = rolePresentation[user.role]

  return (
    <Box>
      <PageHeader title="프로필 관리" />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '340px minmax(0, 1fr)' }, gap: 2.5 }}>
        <Card>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4, textAlign: 'center', background: `linear-gradient(180deg, ${alpha(roleStyle.color, 0.09)} 0%, transparent 48%)` }}>
            <Avatar sx={{ width: 82, height: 82, bgcolor: alpha(roleStyle.color, 0.14), color: roleStyle.color, border: '3px solid', borderColor: alpha(roleStyle.accent, 0.28), boxShadow: `0 10px 28px ${alpha(roleStyle.color, 0.18)}` }}><AccountCircleRounded sx={{ fontSize: 52 }} /></Avatar>
            <Typography variant="h5" sx={{ mt: 2, color: roleStyle.color, fontWeight: 850, letterSpacing: '-0.025em', textShadow: `0 4px 16px ${alpha(roleStyle.color, 0.16)}` }}>{user.name}</Typography>
            <Typography sx={{ mt: 0.5, color: 'text.secondary' }}>{user.loginId}</Typography>
            <StatusBadge status={user.role} tone="info" icon={<ShieldRounded />} label={`${roleStyle.label} · ${roleStyle.description}`} sx={{ mt: 2 }} />
            <Divider flexItem sx={{ my: 3 }} />
            <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>사용자 UID</Typography>
            <Typography sx={{ mt: 0.5, fontFamily: 'monospace', fontSize: 13 }}>{user.userUid}</Typography>
          </CardContent>
        </Card>

        <Stack spacing={2.5}>
          <Card>
            <CardContent sx={{ p: 3.5 }}>
              <Typography variant="h6" sx={{ mb: 2.5 }}>기본정보</Typography>
              {profileMessage && <Alert severity="success" onClose={() => setProfileMessage('')} sx={{ mb: 2 }}>{profileMessage}</Alert>}
              <Box component="form" onSubmit={saveProfile}>
                <TextField fullWidth label="로그인 ID" value={user.loginId} disabled sx={{ mb: 2 }} />
                <TextField fullWidth required label="표시 이름" value={name} onChange={(event) => setName(event.target.value)} />
                <Button type="submit" variant="contained" startIcon={<SaveRounded />} disabled={!name.trim() || name.trim() === user.name} sx={{ mt: 2.5 }}>프로필 저장</Button>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: 3.5 }}>
              <Typography variant="h6">비밀번호 변경</Typography>
              <Typography sx={{ mt: 0.5, mb: 2.5, color: 'text.secondary', fontSize: 14, lineHeight: 1.65 }}>비밀번호 원문 조회 기능은 제공하지 않습니다. API 연동 시 새 Salt를 생성하고 PBKDF2로 재해시합니다.</Typography>
              {passwordResult && <Alert severity={passwordResult.success ? 'success' : 'error'} onClose={() => setPasswordResult(null)} sx={{ mb: 2 }}>{passwordResult.message}</Alert>}
              <Box component="form" onSubmit={savePassword}>
                <Stack spacing={2}>
                  <TextField required type="password" label="현재 비밀번호" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
                  <TextField required type="password" label="새 비밀번호" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} helperText="8자 이상 입력하세요." />
                  <TextField required type="password" label="새 비밀번호 확인" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                </Stack>
                <Button type="submit" variant="contained" startIcon={<LockResetRounded />} disabled={!currentPassword || newPassword.length < 8 || !confirmPassword} sx={{ mt: 2.5 }}>비밀번호 변경</Button>
              </Box>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Box>
  )
}

export default Profile
