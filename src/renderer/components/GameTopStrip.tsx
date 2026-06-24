import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { LayoutGrid, Play, Library } from 'lucide-react'
import type { Game } from '@shared/types'

const TILE_NORMAL = 100
const TILE_FOCUSED = 128

interface GameTopStripProps {
  games: Game[]
  focusedIndex: number
  onFocus: (index: number) => void
  showLibraryTile?: boolean
}

function SquareTile({
  size,
  isFocused,
  children,
  className = ''
}: {
  size: number
  isFocused: boolean
  children: React.ReactNode
  className?: string
}): JSX.Element {
  return (
    <motion.div
      className={`rounded-2xl overflow-hidden flex-shrink-0 ${className}`}
      animate={{
        width: size,
        height: size
      }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      style={{
        boxShadow: isFocused ? '0 0 32px rgba(255,255,255,0.25)' : 'none'
      }}
    >
      <div
        className={`w-full h-full ${isFocused ? 'ring-[3px] ring-white' : 'ring-1 ring-white/10'} rounded-2xl overflow-hidden`}
      >
        {children}
      </div>
    </motion.div>
  )
}

function GameCover({ url, name, isFocused }: { url?: string; name: string; isFocused: boolean }): JSX.Element {
  const [failed, setFailed] = useState(false)

  if (!url || failed) {
    return (
      <div className="w-full h-full bg-white/15 flex items-center justify-center aspect-square">
        <Play size={isFocused ? 36 : 28} className="text-white/50" />
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={name}
      className="w-full h-full object-cover aspect-square"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

export function GameTopStrip({ games, focusedIndex, onFocus, showLibraryTile = true }: GameTopStripProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const container = scrollRef.current
    if (!container || focusedIndex < 0) return
    const item = container.children[focusedIndex + 1] as HTMLElement | undefined
    item?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [focusedIndex])

  return (
    <div className="w-full py-2">
      <div
        ref={scrollRef}
        className="flex items-end gap-5 overflow-x-auto scroll-smooth px-2 pb-2 justify-start"
        style={{ scrollbarWidth: 'none', minHeight: TILE_FOCUSED + 8 }}
      >
        <button
          onClick={() => onFocus(-1)}
          className={`flex-shrink-0 transition-opacity ${
            focusedIndex === -1 ? 'opacity-100' : 'opacity-40 hover:opacity-65'
          }`}
        >
          <SquareTile
            size={focusedIndex === -1 ? TILE_FOCUSED : TILE_NORMAL}
            isFocused={focusedIndex === -1}
            className="bg-white/10 backdrop-blur-md"
          >
            <div className="w-full h-full flex items-center justify-center">
              <LayoutGrid size={focusedIndex === -1 ? 36 : 30} className="text-white" />
            </div>
          </SquareTile>
        </button>

        {games.map((game, index) => {
          const isFocused = index === focusedIndex
          const size = isFocused ? TILE_FOCUSED : TILE_NORMAL

          return (
            <button
              key={game.id}
              onClick={() => onFocus(index)}
              className={`flex-shrink-0 transition-opacity ${
                isFocused ? 'opacity-100 z-10' : 'opacity-40 hover:opacity-65'
              }`}
            >
              <SquareTile size={size} isFocused={isFocused}>
                <GameCover url={game.coverUrl} name={game.name} isFocused={isFocused} />
              </SquareTile>
            </button>
          )
        })}

        {showLibraryTile && (
        <button
          onClick={() => onFocus(games.length)}
          className={`flex-shrink-0 transition-opacity ${
            focusedIndex === games.length ? 'opacity-100 z-10' : 'opacity-40 hover:opacity-70'
          }`}
          title="Bibliothèque"
        >
          <SquareTile
            size={focusedIndex === games.length ? TILE_FOCUSED : TILE_NORMAL}
            isFocused={focusedIndex === games.length}
            className="bg-white/10 backdrop-blur-md"
          >
            <div className="w-full h-full flex items-center justify-center">
              <Library size={focusedIndex === games.length ? 36 : 30} className="text-white" />
            </div>
          </SquareTile>
        </button>
        )}
      </div>
    </div>
  )
}
