import { ConstructionRounded } from '@mui/icons-material'
import { Box, Card, CardContent, Typography } from '@mui/material'

interface PlaceholderPageProps {
  title: string
  description: string
}

function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  const mockData = {
    status: '목업 준비 중',
    message: 'API 연동 전 화면 구조와 컴포넌트를 구성할 영역입니다.',
  }

  return (
    <Box>
      <Typography variant="h5">{title}</Typography>
      <Typography sx={{ mt: 0.75, mb: 3, color: 'text.secondary', fontSize: 14 }}>
        {description}
      </Typography>
      <Card>
        <CardContent
          sx={{
            display: 'flex',
            minHeight: 360,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              width: 64,
              height: 64,
              mb: 2,
              placeItems: 'center',
              borderRadius: 3,
              bgcolor: 'primary.light',
              color: 'primary.main',
            }}
          >
            <ConstructionRounded sx={{ fontSize: 30 }} />
          </Box>
          <Typography variant="h6">{mockData.status}</Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary', fontSize: 14 }}>
            {mockData.message}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}

export default PlaceholderPage
