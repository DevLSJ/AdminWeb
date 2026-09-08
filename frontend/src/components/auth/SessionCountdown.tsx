import { Chip } from '@mui/material'
import { useAuth } from '../../hooks/useAuth'
import { useAuthTimer } from '../../hooks/useAuthTimer'

export function SessionCountdown() {
  const { token, expireSession } = useAuth()
  const { formattedTime, remainingSeconds } = useAuthTimer(token, expireSession)
  return (
    <Chip
      aria-label={`세션 남은 시간 ${formattedTime}`}
      label={formattedTime}
      color={remainingSeconds <= 60 ? 'error' : remainingSeconds <= 300 ? 'warning' : 'default'}
      size="small"
      variant={remainingSeconds <= 300 ? 'filled' : 'outlined'}
      sx={{ minWidth: 66, fontVariantNumeric: 'tabular-nums', '& .MuiChip-label': { px: 1 } }}
    />
  )
}
