import { useEffect, useState, type FormEvent } from 'react'
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
import { fetchOwnProfile, saveOwnProfile, getApiErrorMessage, type OwnProfile } from '../../api/kms'
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
  const [profileError, setProfileError] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [savedProfile, setSavedProfile] = useState<OwnProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)

  useEffect(() => {
    let active = true
    setProfileLoading(true)
    void fetchOwnProfile().then((profile) => {
      if (!active) return
      setName(profile.name); setPhone(profile.phone ?? ''); setEmail(profile.email ?? ''); setSavedProfile(profile)
    }).catch((error) => { if (active) setProfileError(getApiErrorMessage(error, '프로필을 불러오지 못했습니다.')) })
      .finally(() => { if (active) setProfileLoading(false) })
    return () => { active = false }
  }, [user?.userUid])
  const [passwordResult, setPasswordResult] = useState<{ success: boolean; message: string } | null>(null)

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileError(''); setProfileMessage('')
    if (phone.trim() && (!/^[0-9+()\-\s]{9,20}$/.test(phone.trim()) || !/^[0-9]{9,15}$/.test(phone.replace(/\D/g, '')))) {
      setProfileError('전화번호는 숫자 9~15자리로 입력하세요.'); return
    }
    setProfileSaving(true)
    try {
      const profile = await saveOwnProfile({ name: name.trim(), phone: phone.trim() || null, email: email.trim() || null })
      setSavedProfile(profile); setName(profile.name); setPhone(profile.phone ?? ''); setEmail(profile.email ?? '')
      updateProfile(profile.name)
      setProfileMessage('프로필을 저장했습니다.')
    } catch (error) { setProfileError(getApiErrorMessage(error, '프로필을 저장하지 못했습니다.')) }
    finally { setProfileSaving(false) }
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
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '280px minmax(0, 1fr)' }, alignItems: 'start', gap: 2.5 }}>
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

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))' }, gap: 2.5, alignItems: 'stretch', '& > .MuiCard-root': { display: 'flex', flexDirection: 'column' } }}>
          <Card>
            <CardContent sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" sx={{ mb: 2.5 }}>기본정보</Typography>
              {profileMessage && <Alert severity="success" onClose={() => setProfileMessage('')} sx={{ mb: 2 }}>{profileMessage}</Alert>}
              {profileError && <Alert severity="error" onClose={() => setProfileError('')} sx={{ mb: 2 }}>{profileError}</Alert>}
              <Box component="form" onSubmit={(event) => void saveProfile(event)} sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box component="fieldset" disabled={profileLoading || profileSaving} sx={{ border: 0, p: 0, m: 0, minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <TextField slotProps={{ inputLabel: { shrink: true } }} fullWidth label="로그인 ID" value={user.loginId} disabled sx={{ mb: 2 }} />
                <TextField slotProps={{ inputLabel: { shrink: true } }} fullWidth required label="표시 이름" value={name} onChange={(event) => setName(event.target.value)} />
                <TextField fullWidth type="email" label="이메일" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { maxLength: 254 } }} sx={{ mt: 2 }} />
                <TextField fullWidth type="tel" label="전화번호" autoComplete="tel" placeholder="010-1234-5678" value={phone} onChange={(event) => setPhone(event.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { maxLength: 20 } }} helperText="연락처를 비워 두면 기존 정보가 유지됩니다." sx={{ mt: 2 }} />
                <Box sx={{ flex: 1, minHeight: 20 }} />
                <Button type="submit" variant="contained" startIcon={<SaveRounded />} disabled={profileLoading || profileSaving || !savedProfile || !name.trim() || (name.trim() === savedProfile.name && phone === (savedProfile.phone ?? '') && email === (savedProfile.email ?? ''))} sx={{ alignSelf: 'flex-start' }}>{profileLoading ? '불러오는 중…' : profileSaving ? '저장 중…' : '프로필 저장'}</Button>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" sx={{ mb: 2.5 }}>비밀번호 변경</Typography>
              {passwordResult && <Alert severity={passwordResult.success ? 'success' : 'error'} onClose={() => setPasswordResult(null)} sx={{ mb: 2 }}>{passwordResult.message}</Alert>}
              <Box component="form" onSubmit={savePassword} sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Stack spacing={2}>
                  <TextField slotProps={{ inputLabel: { shrink: true } }} required type="password" label="현재 비밀번호" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
                  <TextField slotProps={{ inputLabel: { shrink: true } }} required type="password" label="새 비밀번호" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                  <TextField slotProps={{ inputLabel: { shrink: true } }} required type="password" label="새 비밀번호 확인" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                </Stack>
                <Typography sx={{ mt: 2, color: 'text.secondary', fontSize: 12, lineHeight: 1.65 }}>새 비밀번호는 8자 이상 입력하세요. 비밀번호 원문은 조회할 수 없습니다.</Typography>
                <Box sx={{ flex: 1, minHeight: 20 }} />
                <Button type="submit" variant="contained" startIcon={<LockResetRounded />} disabled={!currentPassword || newPassword.length < 8 || !confirmPassword} sx={{ alignSelf: 'flex-start' }}>비밀번호 변경</Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  )
}

export default Profile
