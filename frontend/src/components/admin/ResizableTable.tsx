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
      const beginResize = () => {
        // Read layout once per gesture, then only write the changed column each frame.
        const widths = headers.map((cell) => cell.getBoundingClientRect().width)
        const otherWidth = widths.reduce((sum, value) => sum + value, 0) - widths[index]
        headers.forEach((cell, i) => { cell.style.width = `${widths[i]}px`; cell.style.minWidth = `${widths[i]}px` })
        table.style.tableLayout = 'fixed'
        table.style.minWidth = '0'
        return (width: number) => {
          const nextWidth = Math.max(72, Math.min(width, 1200))
          header.style.width = `${nextWidth}px`
          header.style.minWidth = `${nextWidth}px`
          table.style.width = `${otherWidth + nextWidth}px`
          handle.setAttribute('aria-valuenow', String(Math.round(nextWidth)))
        }
      }
      let stopDrag: (() => void) | undefined
      const down = (event: PointerEvent) => {
        event.preventDefault()
        event.stopPropagation()
        stopDrag?.()
        const start = event.clientX
        const width = header.getBoundingClientRect().width
        const resize = beginResize()
        let pendingWidth = width
        let frame = 0
        handle.setPointerCapture(event.pointerId)
        const move = (next: PointerEvent) => {
          pendingWidth = width + next.clientX - start
          if (!frame) frame = requestAnimationFrame(() => { frame = 0; resize(pendingWidth) })
        }
        const stop = () => {
          if (frame) { cancelAnimationFrame(frame); frame = 0; resize(pendingWidth) }
          handle.removeEventListener('pointermove', move)
          handle.removeEventListener('pointerup', stop)
          handle.removeEventListener('pointercancel', stop)
          stopDrag = undefined
        }
        stopDrag = stop
        handle.addEventListener('pointermove', move)
        handle.addEventListener('pointerup', stop)
        handle.addEventListener('pointercancel', stop)
      }
      handle.addEventListener('pointerdown', down)
      handle.addEventListener('click', (event) => event.stopPropagation())
      handle.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault(); event.stopPropagation()
          const width = header.getBoundingClientRect().width
          beginResize()(width + (event.key === 'ArrowRight' ? 16 : -16))
        }
      })
      if (getComputedStyle(header).position === 'static') header.style.position = 'relative'
      header.appendChild(handle)
      cleanups.push(() => { stopDrag?.(); handle.remove() })
    })
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [])
  return <Table {...props} ref={ref} />
}
