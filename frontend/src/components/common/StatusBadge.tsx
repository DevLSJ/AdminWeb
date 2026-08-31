import type { ReactElement, ReactNode } from 'react'
import { Chip } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { getStatusLabel } from '../../utils/status'

export type SemanticTone = 'positive' | 'warning' | 'neutral' | 'danger' | 'accent' | 'info' | 'dark'

const semanticColors: Record<SemanticTone, { background: string; text: string; border: string }> = {
  positive: { background: '#eaf7f1', text: '#137653', border: '#bde7d6' },
  warning: { background: '#fff5df', text: '#946000', border: '#f2d79b' },
  neutral: { background: '#f1f3f6', text: '#596273', border: '#dce1e8' },
  danger: { background: '#fdecef', text: '#b52d49', border: '#f4c4ce' },
  accent: { background: '#fbeaf3', text: '#a91d61', border: '#efc2d8' },
  info: { background: '#e8f6fd', text: '#1875a9', border: '#b9e2f5' },
  dark: { background: '#30343b', text: '#ffffff', border: '#30343b' },
}

const statusToneMap: Record<string, SemanticTone> = {
  ACTIVE: 'positive',
  REACTIVATED: 'accent',
  DEACTIVATED: 'warning',
  DEPLOYED: 'positive',
  DISTRIBUTED: 'positive',
  Y: 'positive',
  SUCCESS: 'positive',
  VALID: 'positive',
  CREATED: 'info',
  DEPLOYING: 'warning',
  ROTATED: 'warning',
  IN_PROGRESS: 'warning',
  PENDING: 'warning',
  INACTIVE: 'neutral',
  EXPIRED: 'warning',
  DEPRECATED: 'neutral',
  ROLLED_BACK: 'neutral',
  N: 'neutral',
  CLIENT: 'neutral',
  DECRYPT_ONLY: 'neutral',
  DEPLOY_FAILED: 'danger',
  COMPROMISED: 'danger',
  DESTROYED: 'dark',
  FAILURE: 'danger',
  INVALID: 'danger',
  'S.ADMIN': 'danger',
  ADMIN: 'accent',
}

function getSemanticTone(status: string): SemanticTone {
  return statusToneMap[status] ?? 'neutral'
}

interface StatusBadgeProps {
  status?: string
  label?: ReactNode
  tone?: SemanticTone
  icon?: ReactElement
  minWidth?: number | string
  sx?: SxProps<Theme>
}

export function StatusBadge({ status = '', label, tone, icon, minWidth = 62, sx }: StatusBadgeProps) {
  const colors = semanticColors[tone ?? getSemanticTone(status)]
  return (
    <Chip
      icon={icon}
      label={label ?? getStatusLabel(status)}
      size="small"
      sx={[
        {
          minWidth,
          height: 27,
          border: '1px solid',
          borderColor: colors.border,
          bgcolor: colors.background,
          color: colors.text,
          fontSize: 12.5,
          fontWeight: 750,
          '& .MuiChip-icon': { color: 'inherit', fontSize: 16 },
          '& .MuiChip-label': { px: 1.1 },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  )
}

export default StatusBadge
