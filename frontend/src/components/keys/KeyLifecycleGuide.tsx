import { ArrowForwardRounded, LockRounded } from '@mui/icons-material'
import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import type { KeyStatus } from '../../types/api'
import { keyStatusMetadata, keyStatusOrder, keyStatusTransitions } from '../../utils/keyLifecycle'
import { StatusBadge } from '../common/StatusBadge'

interface KeyLifecycleGuideProps {
  currentStatus?: KeyStatus
  compact?: boolean
}

export function KeyLifecycleGuide({ currentStatus, compact = false }: KeyLifecycleGuideProps) {
  const statuses = currentStatus ? [currentStatus] : keyStatusOrder
  const content = (
    <Stack spacing={1.25}>
      {statuses.map((fromStatus) => {
        const transitions = keyStatusTransitions[fromStatus]

        return (
          <Box
            key={fromStatus}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: compact ? '110px 1fr' : '130px 1fr' },
              alignItems: 'center',
              gap: 1.25,
              p: compact ? 1.25 : 1.5,
              borderRadius: 2,
              bgcolor: currentStatus === fromStatus ? 'action.selected' : 'action.hover',
            }}
          >
            <StatusBadge status={fromStatus} minWidth={92} />
            <Box>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.75 }}>
                {transitions.length > 0 ? transitions.map((toStatus) => (
                  <Stack key={toStatus} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <ArrowForwardRounded sx={{ color: 'text.secondary', fontSize: 17 }} />
                    <StatusBadge status={toStatus} minWidth={82} />
                    {fromStatus === 'ACTIVE' && toStatus === 'DISTRIBUTED' && (
                      <Typography sx={{ color: 'text.secondary', fontSize: 11.5 }}>(키 배포 기능)</Typography>
                    )}
                  </Stack>
                )) : (
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                    <LockRounded sx={{ fontSize: 16 }} />
                    <Typography sx={{ fontSize: 13 }}>최종 상태 · 추가 전이 없음</Typography>
                  </Stack>
                )}
              </Stack>
              {!compact && (
                <Typography sx={{ mt: 0.75, color: 'text.secondary', fontSize: 12.5 }}>
                  {keyStatusMetadata[fromStatus].description}
                </Typography>
              )}
            </Box>
          </Box>
        )
      })}
    </Stack>
  )

  if (compact) return content

  return (
    <Card sx={{ mb: 2.5 }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Typography variant="h6">키 상태 변화 목록</Typography>
        <Typography sx={{ mt: 0.5, mb: 2, color: 'text.secondary', fontSize: 13.5 }}>
          KMIP 상태 모델을 참고한 이 프로젝트의 허용 전이입니다. 목록에 없는 전이는 서버에서 차단됩니다.
        </Typography>
        {content}
      </CardContent>
    </Card>
  )
}
