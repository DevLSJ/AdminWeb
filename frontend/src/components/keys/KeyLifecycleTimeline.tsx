import { HistoryRounded } from '@mui/icons-material'
import { Box, Card, Stack, Typography } from '@mui/material'
import type { KeyStatusHistory } from '../../types/api'
import { getStatusLabel } from '../../utils/status'
import { StatusBadge } from '../common/StatusBadge'

interface KeyLifecycleTimelineProps {
  histories: KeyStatusHistory[]
  sticky?: boolean
  maxHeight?: string | number
}

export function KeyLifecycleTimeline({ histories, sticky = false, maxHeight = 'calc(100vh - 190px)' }: KeyLifecycleTimelineProps) {
  return (
    <Card className="section-card" sx={{ position: sticky ? { xl: 'sticky' } : undefined, top: sticky ? { xl: 92 } : undefined, overflow: 'hidden' }}>
      <Box className="section-card-header" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 68px', alignItems: 'center', gap: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><HistoryRounded color="primary" /><Typography variant="h6">생명주기 타임라인</Typography></Stack>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}><StatusBadge label={`${histories.length}건`} tone="neutral" minWidth={0} /></Box>
      </Box>
      <Box className="timeline-scroll" sx={{ position: 'relative', maxHeight, minHeight: 360, overflowY: 'auto', p: 1.5, '&::before': histories.length > 1 ? { content: '""', position: 'absolute', left: 31, top: 35, bottom: 35, width: 2, bgcolor: 'divider' } : undefined }}>
        {histories.length === 0 && <Typography sx={{ py: 6, color: 'text.secondary', fontSize: 13, textAlign: 'center' }}>표시할 생명주기 이력이 없습니다.</Typography>}
        {histories.map((history, index) => (
          <Box key={history.id} className="timeline-entry" sx={{ position: 'relative', display: 'grid', gridTemplateColumns: '22px minmax(0,1fr)', gap: 1.1, px: 1, py: 1.4, mb: index === histories.length - 1 ? 0 : .4, border: '1px solid transparent' }}>
            <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <Box sx={{ zIndex: 1, width: 14, height: 14, mt: .45, flexShrink: 0, borderRadius: '50%', bgcolor: index === 0 ? 'primary.main' : 'background.paper', border: '2px solid', borderColor: index < 2 ? 'primary.main' : 'divider', boxShadow: '0 0 0 4px var(--mui-palette-background-paper)' }} />
            </Box>
            <Box sx={{ minWidth: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 68px', columnGap: 1, alignItems: 'center' }}>
              <Typography noWrap sx={{ fontWeight: 800, fontSize: 13.25 }}>{history.fromStatus ? `${getStatusLabel(history.fromStatus)} → ` : ''}{getStatusLabel(history.toStatus)}</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}><StatusBadge label={`v${history.keyVersion}`} tone="info" minWidth={0} /></Box>
              <Typography sx={{ gridColumn: '1 / -1', mt: .55, color: 'text.secondary', fontSize: 12.25, lineHeight: 1.55 }}>{history.reason}</Typography>
              <Typography sx={{ gridColumn: '1 / -1', mt: .6, color: 'text.disabled', fontSize: 11 }}>{history.changedAt} · {history.changedBy}</Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Card>
  )
}

export default KeyLifecycleTimeline
