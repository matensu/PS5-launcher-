import { useState, useEffect, useCallback } from 'react'

export function useGridColumns(minCardWidth = 148): number {
  const [columns, setColumns] = useState(5)

  useEffect(() => {
    const update = () => {
      const padding = 80
      const width = window.innerWidth - padding
      setColumns(Math.max(2, Math.floor(width / minCardWidth)))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [minCardWidth])

  return columns
}

export function gridIndexFromDirection(
  index: number,
  direction: 'up' | 'down' | 'left' | 'right',
  columns: number,
  total: number
): number {
  if (total <= 0) return 0
  const row = Math.floor(index / columns)
  const col = index % columns
  const maxRow = Math.floor((total - 1) / columns)

  switch (direction) {
    case 'left':
      if (col > 0) return index - 1
      return index
    case 'right':
      if (col < columns - 1 && index + 1 < total) return index + 1
      return index
    case 'up':
      if (row > 0) return index - columns
      return index
    case 'down':
      if (row < maxRow) return Math.min(index + columns, total - 1)
      return index
    default:
      return index
  }
}

export function useGridFocus(itemCount: number, columns: number) {
  const [focusedIndex, setFocusedIndex] = useState(0)

  useEffect(() => {
    if (focusedIndex >= itemCount && itemCount > 0) {
      setFocusedIndex(itemCount - 1)
    }
  }, [itemCount, focusedIndex])

  const move = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      setFocusedIndex((prev) => gridIndexFromDirection(prev, direction, columns, itemCount))
    },
    [columns, itemCount]
  )

  return { focusedIndex, setFocusedIndex, move }
}
