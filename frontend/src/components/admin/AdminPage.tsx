import type { ReactNode } from 'react'
import {
  Box,
  Card,
  CardContent,
  FormControl,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Typography,
} from '@mui/material'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        mb: 3,
      }}
    >
      <Typography variant="h5">{title}</Typography>
      {action}
    </Box>
  )
}

interface FilterCardProps {
  children: ReactNode
}

export function FilterCard({ children }: FilterCardProps) {
  return (
    <Card className="section-card" sx={{ mb: 2.5, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      <CardContent sx={{ p: '20px !important' }}>{children}</CardContent>
    </Card>
  )
}

interface PaginationBarProps {
  page: number
  size: number
  totalElements: number
  onPageChange: (page: number) => void
  onSizeChange?: (size: number) => void
}

export function PaginationBar({
  page,
  size,
  totalElements,
  onPageChange,
  onSizeChange,
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalElements / size))

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', p: 2 }}
    >
      <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
        총 {totalElements.toLocaleString()}건 · {page + 1}/{totalPages} 페이지
      </Typography>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        {onSizeChange && (
          <FormControl size="small">
            <Select
              value={size}
              onChange={(event) => onSizeChange(Number(event.target.value))}
              aria-label="페이지당 행 수"
              sx={{ fontSize: 14 }}
            >
              {[5, 10, 20].map((option) => (
                <MenuItem key={option} value={option}>
                  {option}개씩
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Pagination
          count={totalPages}
          page={page + 1}
          onChange={(_event, value) => onPageChange(value - 1)}
          color="primary"
          size="small"
          showFirstButton
          showLastButton
        />
      </Stack>
    </Stack>
  )
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '120px 1fr', sm: '150px 1fr' }, gap: 2, py: 1.35 }}>
      <Typography sx={{ color: 'text.secondary', fontSize: 14, fontWeight: 600 }}>{label}</Typography>
      <Box sx={{ minWidth: 0, fontSize: 14.5, lineHeight: 1.6 }}>{value}</Box>
    </Box>
  )
}
