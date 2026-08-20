import { BlockRounded } from '@mui/icons-material'
import { Box, Button, Card, CardContent, Typography } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'

function Forbidden() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  return (
    <Card sx={{ maxWidth: 680, mx: 'auto', mt: 5 }}>
      <CardContent sx={{ display: 'flex', minHeight: 360, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4, textAlign: 'center' }}>
        <Box sx={{ display: 'grid', width: 72, height: 72, placeItems: 'center', borderRadius: 3, bgcolor: 'error.light', color: 'error.dark' }}><BlockRounded sx={{ fontSize: 36 }} /></Box>
        <Typography variant="h4" sx={{ mt: 2.5 }}>접근 권한이 없습니다</Typography>
        <Typography sx={{ mt: 1.2, color: 'text.secondary' }}>현재 역할로는 이 페이지를 사용할 수 없습니다.{from && ` 요청 경로: ${from}`}</Typography>
        <Button variant="contained" onClick={() => navigate('/', { replace: true })} sx={{ mt: 3 }}>대시보드로 이동</Button>
      </CardContent>
    </Card>
  )
}

export default Forbidden
