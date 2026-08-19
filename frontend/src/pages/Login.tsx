import { useState, type FormEvent } from 'react'
import { KeyRounded, LockOutlined, PersonOutlineRounded } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'

const mockCredentials = {
  username: 'admin',
  password: 'admin',
  token: 'mock-jwt-token',
}

interface LoginProps {
  onLogin: () => void
}

function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (username === mockCredentials.username && password === mockCredentials.password) {
      localStorage.setItem('token', mockCredentials.token)
      setError(false)
      onLogin()
      navigate('/', { replace: true })
      return
    }

    setError(true)
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
        bgcolor: '#fdf4f9',
        p: 2,
        '&::before': {
          position: 'absolute',
          top: '-24%',
          left: '-12%',
          width: 520,
          height: 520,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232, 47, 126, 0.19), transparent 68%)',
          content: '""',
        },
        '&::after': {
          position: 'absolute',
          right: '-10%',
          bottom: '-30%',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(118, 82, 184, 0.18), transparent 68%)',
          content: '""',
        },
      }}
    >
      <Card
        sx={{
          zIndex: 1,
          width: '100%',
          maxWidth: 430,
          borderRadius: 3,
          boxShadow: '0 28px 70px rgba(96, 37, 77, 0.15)',
        }}
      >
        <Box
          sx={{
            height: 6,
            background: 'linear-gradient(90deg, #e72f7e 0%, #a34bc1 100%)',
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
                background: 'linear-gradient(135deg, #e72f7e 0%, #8d4fc4 100%)',
                boxShadow: '0 12px 24px rgba(217, 47, 129, 0.24)',
                color: 'common.white',
              }}
            >
              <KeyRounded sx={{ fontSize: 28 }} />
            </Box>
            <Typography variant="h4">D&apos;Guard KMS</Typography>
            <Typography sx={{ mt: 1, color: 'text.secondary', fontSize: 15 }}>
              통합 키 관리 시스템 관리자 로그인
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            {error && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2, fontSize: 14 }}>
                아이디 또는 비밀번호가 올바르지 않습니다
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
                setError(false)
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
                setError(false)
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
              variant="contained"
              size="large"
              sx={{
                mt: 3,
                py: 1.35,
                background: 'linear-gradient(90deg, #e72f7e 0%, #b23fa6 100%)',
                boxShadow: '0 10px 22px rgba(217, 47, 129, 0.22)',
                '&:hover': {
                  boxShadow: '0 12px 26px rgba(217, 47, 129, 0.3)',
                },
              }}
            >
              로그인
            </Button>

            <Box
              sx={{
                mt: 3,
                borderRadius: 2,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.055),
                px: 2,
                py: 1.25,
                textAlign: 'center',
              }}
            >
              <Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>
                목업 계정&nbsp;&nbsp; <strong>admin</strong> / <strong>admin</strong>
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

export default Login
