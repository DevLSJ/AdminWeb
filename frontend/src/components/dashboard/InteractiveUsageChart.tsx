import { useEffect, useState } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import type { DashboardTrend, DashboardTrendPoint } from '../../types/api'

const series = [
  { field: 'encryptions' as const, label: '암호화', color: '#2478e8' },
  { field: 'decryptions' as const, label: '복호화', color: '#28ad73' },
  { field: 'keysCreated' as const, label: '키 생성', color: '#eea325' },
]

interface InteractiveUsageChartProps {
  trend: DashboardTrend | null
  detailed?: boolean
}

function formatPeriod(period: string) {
  const [, month, day] = period.split('-')
  return day ? `${month}.${day}` : period
}

function AccessibleSummary({ point }: { point: DashboardTrendPoint }) {
  return (
    <Typography component="span" sx={{ position: 'absolute', width: 1, height: 1, p: 0, m: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
      {point.period}, 암호화 {point.encryptions}건, 복호화 {point.decryptions}건, 키 생성 {point.keysCreated}건
    </Typography>
  )
}

export function InteractiveUsageChart({ trend, detailed = false }: InteractiveUsageChartProps) {
  const points = trend?.points ?? []
  const [activeIndex, setActiveIndex] = useState(Math.max(points.length - 1, 0))
  useEffect(() => setActiveIndex(Math.max(points.length - 1, 0)), [points.length])

  if (!points.length) {
    return <Box sx={{ display: 'grid', height: detailed ? 360 : 255, placeItems: 'center', color: 'text.secondary' }}>조회 기간의 키 사용 기록이 없습니다.</Box>
  }

  const width = Math.max(detailed ? 980 : 720, points.length * (detailed ? 58 : 44))
  const chartTop = detailed ? 48 : 40
  const chartBottom = detailed ? 300 : 205
  const chartHeight = chartBottom - chartTop
  const maxValue = Math.max(1, ...points.flatMap((point) => series.map(({ field }) => point[field])))
  const roundedMax = Math.max(5, Math.ceil(maxValue / 5) * 5)
  const xFor = (index: number) => 54 + index * ((width - 86) / Math.max(1, points.length - 1))
  const yFor = (value: number) => chartBottom - (value / roundedMax) * chartHeight
  const pathFor = (field: typeof series[number]['field']) => points.map((point, index) => `${index ? 'L' : 'M'} ${xFor(index)} ${yFor(point[field])}`).join(' ')
  const selected = points[Math.min(activeIndex, points.length - 1)]
  const activeX = xFor(activeIndex)
  const tooltipLeft = `${Math.min(88, Math.max(12, (activeX / width) * 100))}%`
  const labelEvery = Math.max(1, Math.ceil(points.length / (detailed ? 12 : 8)))

  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={{ xs: 1.5, sm: 2.5 }} useFlexGap sx={{ mt: 1.5, mb: 1.25, flexWrap: 'wrap' }}>
        {series.map((item) => (
          <Stack key={item.field} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <Box sx={{ width: 20, height: 3, bgcolor: item.color }} />
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary', fontWeight: 700 }}>{item.label}</Typography>
          </Stack>
        ))}
      </Stack>

      <Box className="usage-chart-scroll" sx={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
        <Box sx={{ position: 'relative', minWidth: width, width: '100%' }}>
          <Box
            sx={{
              position: 'absolute',
              zIndex: 3,
              top: detailed ? 58 : 50,
              left: tooltipLeft,
              minWidth: detailed ? 190 : 164,
              p: detailed ? 1.5 : 1.15,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              boxShadow: '0 12px 30px rgba(28,54,98,.16)',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              transition: 'left 180ms cubic-bezier(.16,1,.3,1)',
            }}
          >
            <Typography sx={{ fontSize: 11.5, color: 'text.secondary', fontWeight: 800 }}>{selected.period}</Typography>
            <Stack spacing={0.45} sx={{ mt: 0.7 }}>
              {series.map((item) => <Stack key={item.field} direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}><Typography sx={{ fontSize: 11.5, color: item.color, fontWeight: 750 }}>{item.label}</Typography><Typography sx={{ fontSize: 11.5, fontWeight: 850 }}>{selected[item.field].toLocaleString()}건</Typography></Stack>)}
            </Stack>
          </Box>

          <Box component="svg" viewBox={`0 0 ${width} ${detailed ? 345 : 246}`} sx={{ display: 'block', width: '100%', height: detailed ? 345 : 246 }}>
            {[0, .25, .5, .75, 1].map((ratio) => {
              const y = chartBottom - ratio * chartHeight
              return <g key={ratio}><line x1="54" x2={width - 32} y1={y} y2={y} stroke="currentColor" opacity=".1" /><text x="45" y={y + 4} textAnchor="end" fill="currentColor" opacity=".56" fontSize="10">{Math.round(roundedMax * ratio)}</text></g>
            })}
            <line x1={activeX} x2={activeX} y1={chartTop} y2={chartBottom} stroke="#1769e8" strokeWidth="1.5" opacity=".72" />
            {series.map((item, seriesIndex) => (
              <g key={item.field} className="kms-chart-series" style={{ animationDelay: `${seriesIndex * 90}ms` }}>
                <path d={pathFor(item.field)} fill="none" stroke={item.color} strokeWidth={detailed ? 3 : 2.5} strokeLinecap="round" strokeLinejoin="round" />
                {points.map((point, index) => <circle key={`${item.field}-${point.period}`} className={index === activeIndex ? 'kms-chart-point is-active' : 'kms-chart-point'} cx={xFor(index)} cy={yFor(point[item.field])} r={index === activeIndex ? 5 : 3.25} fill="var(--mui-palette-background-paper, #fff)" stroke={item.color} strokeWidth={index === activeIndex ? 3 : 2} />)}
              </g>
            ))}
            {points.map((point, index) => {
              const x = xFor(index)
              const showLabel = index % labelEvery === 0 || index === points.length - 1
              return <g key={point.period}><rect role="button" tabIndex={0} aria-label={`${point.period} 데이터 선택`} x={x - Math.max(16, (width - 86) / Math.max(1, points.length - 1) / 2)} y={chartTop - 4} width={Math.max(32, (width - 86) / Math.max(1, points.length - 1))} height={chartHeight + 12} fill="transparent" onMouseEnter={() => setActiveIndex(index)} onClick={() => setActiveIndex(index)} onFocus={() => setActiveIndex(index)} />{showLabel && <text x={x} y={chartBottom + 25} textAnchor="middle" fill="currentColor" opacity={index === activeIndex ? 1 : .55} fontSize="10.5" fontWeight={index === activeIndex ? 800 : 500}>{formatPeriod(point.period)}</text>}</g>
            })}
          </Box>
          <AccessibleSummary point={selected} />
        </Box>
      </Box>
    </Box>
  )
}
