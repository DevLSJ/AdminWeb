export const PAGE_SIZE_OPTIONS = [10, 20, 30] as const

export function paginatedTableContainerSx(size: number, viewportOffset = 350) {
  const rowHeight = size >= 30 ? 34 : size >= 20 ? 38 : 46
  const tableHeight = 42 + rowHeight * size
  return {
    maxHeight: `min(${tableHeight}px, max(280px, calc(100vh - ${viewportOffset}px)))`,
    overflowY: 'auto',
    scrollbarGutter: 'stable',
    transition: 'max-height 240ms ease',
  } as const
}

export function paginatedTableCellSx(size: number) {
  const cellPaddingY = size >= 30 ? 0.42 : size >= 20 ? 0.55 : 0.72
  return {
    py: cellPaddingY,
    transition: 'padding 220ms ease, height 220ms ease',
  } as const
}
