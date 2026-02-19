import { useState, useCallback, useRef } from 'react'

export interface DragSelection {
  startDate: string
  endDate: string
}

export function useDragSelect() {
  const [selection, setSelection] = useState<DragSelection | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<string | null>(null)

  const onDragStart = useCallback((dateStr: string) => {
    dragStartRef.current = dateStr
    setIsDragging(true)
    setSelection({ startDate: dateStr, endDate: dateStr })
  }, [])

  const onDragMove = useCallback((dateStr: string) => {
    if (!isDragging || !dragStartRef.current) return
    const start = dragStartRef.current
    // Ensure startDate <= endDate
    if (start <= dateStr) {
      setSelection({ startDate: start, endDate: dateStr })
    } else {
      setSelection({ startDate: dateStr, endDate: start })
    }
  }, [isDragging])

  const onDragEnd = useCallback((): DragSelection | null => {
    setIsDragging(false)
    dragStartRef.current = null
    const result = selection
    return result
  }, [selection])

  const clearSelection = useCallback(() => {
    setSelection(null)
    setIsDragging(false)
    dragStartRef.current = null
  }, [])

  return {
    selection,
    isDragging,
    onDragStart,
    onDragMove,
    onDragEnd,
    clearSelection,
  }
}
