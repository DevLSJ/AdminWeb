import { ArrowForwardRounded, LockRounded } from '@mui/icons-material'
import { Box, Stack, Typography } from '@mui/material'
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
    <Stack spacing={compact ? 1 : 1.25}>
      {statuses.map((fromStatus) => {
        const transitions = keyStatusTransitions[fromStatus]

        return (
          <Box
            key={fromStatus}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '112px minmax(0, 1fr)' },
              alignItems: 'start',
              columnGap: 2,
              rowGap: 1,
              p: compact ? 1.25 : 1.75,
              borderRadius: 2,
              border: '1px solid',
              borderColor: currentStatus === fromStatus ? 'primary.light' : 'divider',
              bgcolor: currentStatus === fromStatus ? 'action.selected' : 'background.paper',
            }}
          >
            <StatusBadge status={fromStatus} minWidth={112} sx={{ width: 112, height: 30 }} />
            <Box>
              {transitions.length > 0 ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: `repeat(${Math.min(transitions.length, 4)}, minmax(142px, 1fr))` },
                    columnGap: 1.5,
                    rowGap: 1,
                  }}
                >
                  {transitions.map((toStatus) => (
                    <Box key={toStatus} sx={{ display: 'grid', gridTemplateColumns: '22px 112px', alignItems: 'center', gap: 0.75 }}>
                      <ArrowForwardRounded sx={{ color: 'text.secondary', fontSize: 20 }} />
                      <StatusBadge status={toStatus} minWidth={112} sx={{ width: 112, height: 30 }} />
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr)', alignItems: 'center', gap: 0.75, minHeight: 30, color: 'text.secondary' }}>
                  <LockRounded sx={{ fontSize: 18 }} />
                  <Typography sx={{ fontSize: 13 }}>최종 상태 · 추가 전이 없음</Typography>
                </Box>
              )}
              {!compact && (
                <Typography sx={{ mt: 1, color: 'text.secondary', fontSize: 12.5, lineHeight: 1.55 }}>
                  {keyStatusMetadata[fromStatus].description}
                </Typography>
              )}
              {!compact && fromStatus === 'ACTIVE' && (
                <Typography sx={{ mt: 0.5, color: 'primary.main', fontSize: 12.5, fontWeight: 650 }}>
                  ※ 배포됨 전이는 일반 상태 변경이 아닌 키 배포 기능에서 처리합니다.
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
    <Box>
      <Typography sx={{ mb: 2, color: 'text.secondary', fontSize: 13.5, lineHeight: 1.6 }}>
        KMIP 2.1의 Pre-Active·Active·Deactivated·Compromised·Destroyed를 표준 축으로 사용합니다. 재활성·만료·운영 중지·배포됨은 D’Guard 업무 정책 확장이며, 목록에 없는 전이는 서버에서 차단됩니다.
      </Typography>
      {content}
    </Box>
  )
}
