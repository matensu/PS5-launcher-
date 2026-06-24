import { motion } from 'framer-motion'
import { MoreHorizontal, Trophy } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import type { Game } from '@shared/types'

interface GameFocusBarProps {
  game: Game
  onPlay: () => void
  onDetails?: () => void
  isLaunching?: boolean
  showMoreButton?: boolean
  showTitle?: boolean
}

function formatPlayTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min jouées`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min jouées` : `${h}h jouées`
}

export function GameFocusBar({
  game,
  onPlay,
  onDetails,
  isLaunching,
  showMoreButton = true,
  showTitle = true
}: GameFocusBarProps): JSX.Element {
  const { data: trophies = [] } = useQuery({
    queryKey: ['game-trophies', game.id],
    queryFn: () => api.getGameTrophies(game.id)
  })

  const unlocked = trophies.filter((t) => t.unlocked).length
  const total = trophies.length
  const progress = total > 0 ? Math.round((unlocked / total) * 100) : 0

  const platformLabel: Record<string, string> = {
    steam: 'Steam',
    epic: 'Epic Games',
    gog: 'GOG',
    ubisoft: 'Ubisoft Connect',
    battlenet: 'Battle.net',
    manual: 'Manuel'
  }

  const isInstalled = !!game.installPath

  return (
    <motion.div
      className="flex flex-row items-end justify-between gap-8 w-full"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="flex-1 min-w-0">
        {showTitle && (
          <>
            <motion.h1
              key={game.id}
              className="text-5xl font-bold text-white leading-tight tracking-tight mb-2"
              style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35 }}
            >
              {game.name}
            </motion.h1>

            <p className="text-white/55 text-base mb-5">
              {game.playTimeMinutes > 0
                ? formatPlayTime(game.playTimeMinutes)
                : platformLabel[game.platform] ?? game.platform}
            </p>
          </>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={onPlay}
            disabled={isLaunching}
            className={`min-w-[200px] px-10 py-3.5 rounded-full font-semibold text-base transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 ${
              isInstalled
                ? 'bg-white text-black hover:bg-white/90'
                : 'bg-white/20 hover:bg-white/30 backdrop-blur-xl border border-white/20 text-white'
            }`}
          >
            {isLaunching ? 'Lancement...' : isInstalled ? 'Jouer' : 'Télécharger'}
          </button>
          {showMoreButton && onDetails && (
            <button
              onClick={onDetails}
              className="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white transition-all"
              aria-label="Plus d'options"
            >
              <MoreHorizontal size={22} />
            </button>
          )}
        </div>
      </div>

      <motion.div
        className="w-[280px] flex-shrink-0 rounded-2xl overflow-hidden bg-black/40 backdrop-blur-2xl border border-white/10"
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
      >
        <div className="p-4 flex gap-4">
          {game.coverUrl && (
            <img
              src={game.coverUrl}
              alt=""
              className="w-20 h-28 object-cover rounded-lg flex-shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-0.5">
              {platformLabel[game.platform] ?? game.platform}
            </p>
            <p className="text-white text-sm font-medium truncate mb-3">{game.name}</p>
            <div className="flex items-center gap-2 mb-2">
              <Trophy size={14} className="text-trophy-gold flex-shrink-0" />
              <span className="text-white/70 text-xs">
                {total > 0 ? `${unlocked}/${total} succès` : 'Aucun succès'}
              </span>
            </div>
            <div className="h-1 bg-white/15 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white/70 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
            </div>
            <p className="text-white/40 text-xs mt-1">{progress}%</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
