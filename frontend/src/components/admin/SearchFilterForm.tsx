import type { FormEventHandler, ReactNode } from 'react'
import { Box, Button, Stack } from '@mui/material'
import { FilterCard } from './AdminPage'

export function SearchFilterForm({ children, columns = 2, onSearch, onReset, extraFilters }: {
  children: ReactNode
  columns?: 2 | 3 | 4 | 6
  extraFilters?: ReactNode
  onSearch: FormEventHandler<HTMLFormElement>
  onReset: () => void
}) {
  return (
    <FilterCard>
      <Box component="form" aria-label="검색 조건" onSubmit={onSearch}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: `repeat(${Math.min(columns, 3)}, minmax(0, 1fr))`, xl: `repeat(${columns}, minmax(0, 1fr))` }, gap: 1.5 }}>
          {children}
        </Box>
        {extraFilters}
        <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'flex-end', '& > button': { width: 96, minWidth: 96, height: 40, px: 2, fontSize: 14, fontWeight: 700 } }}>
          <Button type="submit" variant="contained">검색</Button>
          <Button type="button" variant="outlined" color="inherit" onClick={onReset}>초기화</Button>
        </Stack>
      </Box>
    </FilterCard>
  )
}
