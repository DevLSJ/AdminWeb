import { useState, type FormEvent } from 'react'
import { KeyRounded, LockOutlined, PersonOutlineRounded } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { login, isInitializing } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      const result = await login({ loginId: username, password })
      if (result.success) {
        setError('')
        navigate('/', { replace: true })
        return
      }
      setError(result.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (isInitializing) {
    return <Box sx={{ display: 'grid', minHeight: '100vh', placeItems: 'center' }}><CircularProgress /></Box>
  }

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #edf4ff 0%, #f7faff 52%, #e7f0ff 100%)',
        p: 2,
        '&::before': {
          position: 'absolute',
          top: '-24%',
          left: '-12%',
          width: 520,
          height: 520,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(13, 95, 231, 0.22), transparent 68%)',
          content: '""',
        },
        '&::after': {
          position: 'absolute',
          right: '-10%',
          bottom: '-30%',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(22, 71, 200, 0.18), transparent 68%)',
          content: '""',
        },
      }}
    >
      <Card
        sx={{
          zIndex: 1,
          width: '100%',
          maxWidth: 430,
          overflow: 'hidden',
          border: '1px solid rgba(87, 132, 214, .18)',
          borderRadius: 2.5,
          boxShadow: '0 28px 72px rgba(26, 74, 157, 0.17)',
        }}
      >
        <Box
          sx={{
            height: 6,
            background: 'linear-gradient(90deg, #0d5fe7 0%, #2f7df4 100%)',
          }}
        />
        <CardContent sx={{ px: { xs: 3, sm: 5 }, py: { xs: 4, sm: 5 } }}>
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Box
              sx={{
                display: 'grid',
                width: 54,
                height: 54,
                mx: 'auto',
                mb: 2,
                placeItems: 'center',
                borderRadius: 3,
                background: 'linear-gradient(135deg, #0d5fe7 0%, #1647c8 100%)',
                boxShadow: '0 12px 26px rgba(13, 95, 231, 0.26)',
                color: 'common.white',
              }}
            >
              <KeyRounded sx={{ fontSize: 28 }} />
            </Box>
            <Typography variant="h4">D&apos;Guard KMS</Typography>
            <Typography sx={{ mt: 1, color: 'text.secondary', fontSize: 15 }}>
              통합 키 관리 시스템 로그인
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            {error && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2, fontSize: 14 }}>
                {error}
              </Alert>
            )}

            <TextField
              fullWidth
              autoFocus
              id="username"
              label="아이디"
              placeholder="아이디를 입력하세요"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value)
                setError('')
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutlineRounded sx={{ color: 'text.secondary', fontSize: 21 }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              id="password"
              label="비밀번호"
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setError('')
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Button
              fullWidth
              type="submit"
              disabled={submitting || !username.trim() || !password}
              variant="contained"
              size="large"
              sx={{
                mt: 3,
                py: 1.35,
                background: 'linear-gradient(90deg, #0d5fe7 0%, #286fdc 100%)',
                boxShadow: '0 10px 22px rgba(13, 95, 231, 0.24)',
                '&:hover': {
                  boxShadow: '0 12px 28px rgba(13, 95, 231, 0.34)',
                },
              }}
            >
              {submitting ? '로그인 중…' : '로그인'}
            </Button>

          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

export default Login
