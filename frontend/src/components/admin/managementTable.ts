import type { SxProps, Theme } from '@mui/material/styles'

/** The same cell geometry applies to headers and rows, including after column resizing. */
export const managementTableSx: SxProps<Theme> = {
  width: '100%',
  minWidth: 1140,
  tableLayout: 'fixed',
  '& .MuiTableCell-root': {
    px: 2, py: 1.25, height: 56, boxSizing: 'border-box',
    verticalAlign: 'middle', borderBottom: '1px solid', borderColor: 'divider',
    fontSize: 13, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis',
  },
  '& .MuiTableCell-head': {
    height: 42, py: 1, bgcolor: (theme) => theme.palette.mode === 'light' ? '#eef0f4' : '#282d38',
    color: 'text.secondary', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
  },
  '& .MuiTableCell-body .MuiTypography-root': { fontSize: 13, lineHeight: 1.5 },
  '& .MuiTableCell-body .table-secondary': { fontSize: 11, color: 'text.secondary' },
  '& .MuiTableCell-root:first-of-type': {
    width: 64, textAlign: 'center', color: 'text.secondary', fontSize: 12,
    fontWeight: 400, fontVariantNumeric: 'tabular-nums',
  },
  '& tbody tr.interactive-row:hover': { transform: 'none', boxShadow: 'none' },
  '& tbody tr:last-child td': { borderBottom: 0 },
}

export const managementTableContainerSx = {
  maxHeight: 'max(320px, calc(100vh - 370px))',
  overflow: 'auto',
} as const
