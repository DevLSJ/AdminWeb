import { useEffect, useMemo, useState } from 'react'
import { ChevronLeftRounded, ChevronRightRounded, EventRounded } from '@mui/icons-material'
import { Box, IconButton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'

interface LargeDateCalendarProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const weekDays = ['일', '월', '화', '수', '목', '금', '토']

function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fromIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function LargeDateCalendar({ value, onChange, disabled = false }: LargeDateCalendarProps) {
  const selected = value ? fromIsoDate(value) : new Date()
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1))
  const today = useMemo(() => {
    const current = new Date()
    return new Date(current.getFullYear(), current.getMonth(), current.getDate())
  }, [])

  useEffect(() => {
    if (value) setVisibleMonth(new Date(selected.getFullYear(), selected.getMonth(), 1))
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const days = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
    const start = new Date(first)
    start.setDate(1 - first.getDay())
    return Array.from({ length: 42 }, (_value, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      return date
    })
  }, [visibleMonth])

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, overflow: 'hidden', bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.25, py: 0.75, borderBottom: '1px solid', borderColor: 'divider', bgcolor: (theme) => alpha(theme.palette.primary.main, 0.035) }}>
        <IconButton size="small" aria-label="이전 달" disabled={disabled} onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeftRounded /></IconButton>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}><EventRounded color="primary" sx={{ fontSize: 18 }} /><Typography sx={{ fontSize: 15, fontWeight: 800 }}>{visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월</Typography></Box>
        <IconButton size="small" aria-label="다음 달" disabled={disabled} onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRightRounded /></IconButton>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', px: 0.8, pt: 0.6 }}>
        {weekDays.map((day, index) => <Typography key={day} sx={{ py: 0.6, color: index === 0 ? 'error.main' : index === 6 ? 'secondary.main' : 'text.secondary', textAlign: 'center', fontSize: 11.5, fontWeight: 800 }}>{day}</Typography>)}
        {days.map((date) => {
          const iso = toIsoDate(date)
          const outside = date.getMonth() !== visibleMonth.getMonth()
          const past = date <= today
          const active = iso === value
          return (
            <Box
              component="button"
              type="button"
              key={iso}
              disabled={disabled || past}
              aria-label={`${iso}${active ? ' 선택됨' : ''}`}
              onClick={() => onChange(iso)}
              sx={{ display: 'grid', minWidth: 0, height: 36, m: 0.3, placeItems: 'center', border: 0, borderRadius: 1.5, bgcolor: active ? 'primary.main' : 'transparent', color: active ? 'primary.contrastText' : outside || past ? 'text.disabled' : 'text.primary', cursor: disabled || past ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: active ? 800 : 600, transition: 'background-color 160ms ease, transform 160ms ease', '&:hover': disabled || past ? undefined : { bgcolor: active ? 'primary.dark' : 'action.hover', transform: 'translateY(-1px)' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 1 } }}
            >
              {date.getDate()}
            </Box>
          )
        })}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.5, py: 0.9, borderTop: '1px solid', borderColor: 'divider' }}><Typography sx={{ color: 'text.secondary', fontSize: 11.5 }}>만료일 선택</Typography><Typography sx={{ color: value ? 'primary.main' : 'text.disabled', fontSize: 11.5, fontWeight: 800 }}>{value || '날짜를 선택하세요'}</Typography></Box>
    </Box>
  )
}
