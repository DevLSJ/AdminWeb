import { Box, Stack, Typography } from '@mui/material'
import type { KeyStatus } from '../../types/api'
import { getCanonicalKeyStatus, keyStatusMetadata } from '../../utils/keyLifecycle'
import { StatusBadge } from '../common/StatusBadge'

interface KeyLifecycleGuideProps {
  currentStatus?: KeyStatus
  compact?: boolean
}

const lifecycleStages = [
  { title: '생성', status: 'CREATED' as const, description: '키 생성 요청 시 안전하게 생성하고 고유 식별자와 v1을 부여합니다. 생성된 키 재료는 보호된 저장소에 보관되고 등록 절차에서 자동 활성화됩니다.' },
  { title: '사용 가능', status: 'ACTIVE' as const, description: '암호화와 복호화 요청에 사용할 수 있습니다. 언제든 비활성화하여 사용을 중지할 수 있으며 설정된 주기에 따라 새 버전으로 갱신됩니다.' },
  { title: '사용 중지', status: 'DEACTIVATED' as const, description: '암호화와 복호화 요청은 모두 차단됩니다. 다시 활성화할 수 있고, 사용 중지 중에도 설정된 회전 주기와 버전 이력은 유지됩니다.' },
  { title: '침해', status: 'COMPROMISED' as const, description: '노출 또는 유출이 의심되는 보안 상태입니다. 모든 사용과 재활성화를 차단하고 폐기만 허용합니다.' },
  { title: '삭제', status: 'DESTROYED' as const, description: '즉시 폐기를 확인하면 모든 버전의 원시 키를 제로화합니다. 키는 복구할 수 없으며 운영 메타데이터와 감사 이력은 무결성 검증을 위해 보존됩니다.' },
]

export function KeyLifecycleGuide({ currentStatus, compact = false }: KeyLifecycleGuideProps) {
  if (compact && currentStatus) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1.5, border: '1px solid', borderColor: 'primary.light', borderRadius: 2, bgcolor: 'action.selected' }}>
        <StatusBadge status={currentStatus} minWidth={96} />
        <Typography sx={{ color: 'text.secondary', fontSize: 12.75, lineHeight: 1.55 }}>{keyStatusMetadata[currentStatus].description}</Typography>
      </Box>
    )
  }

  const canonicalCurrent = currentStatus ? getCanonicalKeyStatus(currentStatus) : undefined
  return (
    <Box>
      <Typography sx={{ mb: 2, color: 'text.secondary', fontSize: 13.5, lineHeight: 1.6 }}>
        목록과 상세 화면은 생성됨·활성화·비활성·침해·폐기의 5개 상태만 사용합니다. 배포는 상태가 아닌 별도 운영 이력으로 기록됩니다.
      </Typography>
      <Stack spacing={1.25}>
        {lifecycleStages.map((stage) => (
          <Box key={stage.status} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '110px 120px minmax(0, 1fr)' }, alignItems: 'start', gap: 1.5, p: 1.75, border: '1px solid', borderColor: canonicalCurrent === stage.status ? 'primary.light' : 'divider', borderRadius: 2, bgcolor: canonicalCurrent === stage.status ? 'action.selected' : 'background.paper' }}>
            <Typography sx={{ pt: 0.45, fontSize: 13.5, fontWeight: 800 }}>{stage.title}</Typography>
            <StatusBadge status={stage.status} minWidth={104} />
            <Typography sx={{ color: 'text.secondary', fontSize: 12.5, lineHeight: 1.6 }}>{stage.description}</Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
