import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
  const location = useLocation()
  const columns = useGridColumns()
  const { focusedIndex, setFocusedIndex, move } = useGridFocus(items.length, columns)
  const [zone, setZone] = useState<LibraryZone>('grid')
  const gridRefs = useRef<Map<number, HTMLElement>>(new Map())

  const isEpic = location.pathname.startsWith('/library/epic')

  const switchTab = useCallback(
    (direction: 'left' | 'right') => {
      if (direction === 'left' && isEpic) navigate('/library')
      if (direction === 'right' && !isEpic) navigate('/library/epic')
    },
    [isEpic, navigate]
  )

  const switchFilter = useCallback(
    (direction: 'left' | 'right') => {
      if (direction === 'left') {
        onFilterChange(Math.max(0, filterIndex - 1))
      } else {
        onFilterChange(Math.min(filterCount - 1, filterIndex + 1))
      }
    },
    [filterCount, filterIndex, onFilterChange]
  )

  useEffect(() => {
    if (zone === 'grid' && items.length > 0) {
      const el = gridRefs.current.get(focusedIndex)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [focusedIndex, zone, items.length])

  useEffect(() => {
    if (focusedIndex >= items.length && items.length > 0) {
      setFocusedIndex(items.length - 1)
    }
  }, [items.length, focusedIndex, setFocusedIndex])

  const registerGridRef = useCallback((index: number, el: HTMLElement | null) => {
    if (el) gridRefs.current.set(index, el)
    else gridRefs.current.delete(index)
  }, [])

  useGamepad(
    {
      onBumperLeft: () => {
        if (searchOpen) return
        if (zone === 'tabs' || zone === 'grid') switchTab('left')
        else switchFilter('left')
      },
      onBumperRight: () => {
        if (searchOpen) return
        if (zone === 'tabs' || zone === 'grid') switchTab('right')
        else switchFilter('right')
      },
      onNavigate: (dir) => {
        if (searchOpen) return

        if (zone === 'grid') {
          if (dir === 'up') {
            if (focusedIndex < columns) {
              setZone('filters')
              return
            }
          }
          if (items.length > 0) move(dir)
          return
        }

        if (zone === 'search') {
          if (dir === 'down') setZone('grid')
          if (dir === 'up') setZone('filters')
          return
        }

        if (zone === 'filters') {
          if (dir === 'down') setZone('grid')
          if (dir === 'up') setZone('tabs')
          if (dir === 'left') switchFilter('left')
          if (dir === 'right') switchFilter('right')
          return
        }

        if (zone === 'tabs') {
          if (dir === 'down') setZone('filters')
          if (dir === 'left') switchTab('left')
          if (dir === 'right') switchTab('right')
        }
      },
      onConfirm: () => {
        if (searchOpen) return
        if (zone === 'grid' && items[focusedIndex]) {
          onGridConfirm(items[focusedIndex], focusedIndex)
          return
        }
        if (zone === 'search') {
          onSearchOpenChange(true)
          return
        }
        if (zone === 'tabs') {
          switchTab(isEpic ? 'left' : 'right')
        }
      },
      onBack: () => {
        if (searchOpen) {
          onSearchOpenChange(false)
          return
        }
        if (zone === 'grid') {
          navigate(backPath)
          return
        }
        if (zone === 'search') {
          setZone('grid')
          return
        }
        if (zone === 'filters') {
          setZone('grid')
          return
        }
        if (zone === 'tabs') {
          setZone('filters')
        }
      },
      onSearch: () => {
        if (!searchOpen) {
          setZone('search')
          onSearchOpenChange(true)
        }
      }
    },
    enabled,
    100
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
