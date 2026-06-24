import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGamepad } from './useGamepad'
import { useGridColumns, useGridFocus } from './useGridNavigation'

export type LibraryZone = 'tabs' | 'filters' | 'search' | 'grid'

interface UseLibraryGamepadOptions<T> {
  items: T[]
  filterCount: number
  filterIndex: number
  onFilterChange: (index: number) => void
  searchOpen: boolean
  onSearchOpenChange: (open: boolean) => void
  onGridConfirm: (item: T, index: number) => void
  onGridPlay?: (item: T, index: number) => void
  backPath?: string
  enabled?: boolean
}

export function useLibraryGamepad<T>({
  items,
  filterCount,
  filterIndex,
  onFilterChange,
  searchOpen,
  onSearchOpenChange,
  onGridConfirm,
  onGridPlay,
  backPath = '/',
  enabled = true
}: UseLibraryGamepadOptions<T>) {
  const navigate = useNavigate()
  const columns = useGridColumns()
  const { focusedIndex, setFocusedIndex, move } = useGridFocus(items.length, columns)
  const [zone, setZone] = useState<LibraryZone>('grid')
  const gridRefs = useRef<Map<number, HTMLElement>>(new Map())

  useEffect(() => {
    if (zone === 'grid') {
      const el = gridRefs.current.get(focusedIndex)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [focusedIndex, zone])

  const registerGridRef = useCallback((index: number, el: HTMLElement | null) => {
    if (el) gridRefs.current.set(index, el)
    else gridRefs.current.delete(index)
  }, [])

  useGamepad(
    {
      onNavigate: (dir) => {
        if (searchOpen) return

        if (zone === 'grid') {
          if (dir === 'up' && focusedIndex < columns) {
            setZone('search')
            return
          }
          move(dir)
          return
        }

        if (zone === 'search') {
          if (dir === 'down') setZone('grid')
          if (dir === 'up') setZone('filters')
          return
        }

        if (zone === 'filters') {
          if (dir === 'down') setZone('search')
          if (dir === 'left') onFilterChange(Math.max(0, filterIndex - 1))
          if (dir === 'right') onFilterChange(Math.min(filterCount - 1, filterIndex + 1))
          if (dir === 'up') setZone('tabs')
          return
        }

        if (zone === 'tabs') {
          if (dir === 'down') setZone('filters')
        }
      },
      onConfirm: () => {
        if (searchOpen) return
        if (zone === 'grid' && items[focusedIndex]) {
          onGridConfirm(items[focusedIndex], focusedIndex)
        }
        if (zone === 'search') onSearchOpenChange(true)
      },
      onBack: () => {
        if (searchOpen) {
          onSearchOpenChange(false)
          return
        }
        if (zone !== 'grid') {
          setZone('grid')
          return
        }
        navigate(backPath)
      },
      onSearch: () => {
        if (!searchOpen) {
          setZone('search')
          onSearchOpenChange(true)
        }
      }
    },
    enabled && !searchOpen
  )

  return {
    zone,
    setZone,
    focusedIndex,
    setFocusedIndex,
    columns,
    registerGridRef,
    isGridFocused: (index: number) => zone === 'grid' && focusedIndex === index,
    isFilterFocused: (index: number) => zone === 'filters' && filterIndex === index,
    isSearchFocused: zone === 'search',
    isTabsFocused: zone === 'tabs'
  }
}
