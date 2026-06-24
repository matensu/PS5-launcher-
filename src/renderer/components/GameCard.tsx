import { motion } from 'framer-motion'
import type { Game } from '@shared/types'
import { Play, Clock } from 'lucide-react'

interface GameCardProps {
  game: Game
  isFocused?: boolean
  onSelect: () => void
  onLaunch: () => void
}

function formatPlayTime(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
}

export function GameCard({ game, isFocused, onSelect, onLaunch }: GameCardProps): JSX.Element {
  return (
    <motion.div
      className={`relative flex-shrink-0 w-52 cursor-pointer gpu-accelerated ${
        isFocused ? 'focused z-10' : ''
      }`}
      onClick={onSelect}
      onDoubleClick={onLaunch}
      whileHover={{ scale: 1.05, y: -8 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden glass">
        {game.coverUrl ? (
          <img
            src={game.coverUrl}
            alt={game.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-console-card">
            <Play size={40} className="text-console-muted" />
          </div>
        )}

        {isFocused && (
          <motion.div
            className="absolute inset-0 border-2 border-console-accent rounded-2xl"
            layoutId="game-focus"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-sm font-semibold truncate">{game.name}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-console-muted">
            <span className="capitalize">{game.platform}</span>
            {game.playTimeMinutes > 0 && (
              <>
                <span>•</span>
                <Clock size={10} />
                <span>{formatPlayTime(game.playTimeMinutes)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
