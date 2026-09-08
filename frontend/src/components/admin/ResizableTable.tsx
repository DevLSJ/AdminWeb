import { useEffect, useRef } from 'react'
import { Table, type TableProps } from '@mui/material'

/** Shared column resizing for all administrative tables. */
export function ResizableTable(props: TableProps) {
  const ref = useRef<HTMLTableElement>(null)
  useEffect(() => {
    const table = ref.current
    if (!table) return
    const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead tr:first-child th'))
    const cleanups: Array<() => void> = []
    headers.forEach((header, index) => {
      const handle = document.createElement('span')
      handle.className = 'column-resize-handle'
      handle.role = 'separator'
      handle.tabIndex = 0
      handle.setAttribute('aria-orientation', 'vertical')
      handle.setAttribute('aria-label', `${header.textContent} 열 너비 조절`)
      const resize = (width: number) => {
        const widths = headers.map((cell) => cell.getBoundingClientRect().width)
        widths[index] = Math.max(72, Math.min(width, 1200))
        headers.forEach((cell, i) => { cell.style.width = `${widths[i]}px`; cell.style.minWidth = `${widths[i]}px` })
        table.style.tableLayout = 'fixed'
        table.style.width = `${widths.reduce((sum, value) => sum + value, 0)}px`
        table.style.minWidth = '0'
        handle.setAttribute('aria-valuenow', String(Math.round(widths[index])))
      }
      const down = (event: PointerEvent) => {
        event.preventDefault()
        event.stopPropagation()
        const start = event.clientX
        const width = header.getBoundingClientRect().width
        handle.setPointerCapture(event.pointerId)
        const move = (next: PointerEvent) => resize(width + next.clientX - start)
        const stop = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', stop); handle.removeEventListener('pointercancel', stop) }
        handle.addEventListener('pointermove', move)
        handle.addEventListener('pointerup', stop)
        handle.addEventListener('pointercancel', stop)
        cleanups.push(stop)
      }
      handle.addEventListener('pointerdown', down)
      handle.addEventListener('click', (event) => event.stopPropagation())
      handle.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault(); event.stopPropagation()
          resize(header.getBoundingClientRect().width + (event.key === 'ArrowRight' ? 16 : -16))
        }
      })
      if (getComputedStyle(header).position === 'static') header.style.position = 'relative'
      header.appendChild(handle)
      cleanups.push(() => handle.remove())
    })
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [])
  return <Table {...props} ref={ref} />
}
