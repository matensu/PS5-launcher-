import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { RefreshCw, CheckCircle2, Lock, Trophy } from 'lucide-react'
import { api } from '../services/api'
import type { TrophyTier } from '@shared/types'

const tierColors: Record<TrophyTier, string> = {
  bronze: 'text-trophy-bronze',
  silver: 'text-trophy-silver',
  gold: 'text-trophy-gold',
  platinum: 'text-trophy-platinum'
}

const tierBg: Record<TrophyTier, string> = {
  bronze: 'bg-amber-700/20 border-amber-600/30',
  silver: 'bg-slate-400/15 border-slate-300/25',
  gold: 'bg-yellow-500/15 border-yellow-400/30',
  platinum: 'bg-cyan-400/15 border-cyan-300/30'
}

type AchievementFilter = 'all' | 'unlocked' | 'locked'

interface GameAchievementsPanelProps {
  appId: string
  gameName?: string
  gameId?: string
  variant?: 'compact' | 'full'
  className?: string
}

function formatUnlockDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

export function GameAchievementsPanel({
  appId,
  gameName,
  gameId,
  variant = 'full',
  className = ''
}: GameAchievementsPanelProps): JSX.Element {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<AchievementFilter>('all')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['steam-achievements', appId],
    queryFn: () => api.getSteamAchievements(appId)
  })

  const syncMutation = useMutation({
    mutationFn: () => api.syncSteamAchievements(appId, gameName),
    onSuccess: () => {
      refetch()
      if (gameId) {
        queryClient.invalidateQueries({ queryKey: ['game-trophies', gameId] })
      }
      queryClient.invalidateQueries({ queryKey: ['trophies-grouped'] })
      queryClient.invalidateQueries({ queryKey: ['trophy-stats'] })
    }
  })

  const achievements = data?.achievements ?? []
  const unlocked = data?.unlocked ?? 0
  const total = data?.total ?? 0
  const progress = total > 0 ? Math.round((unlocked / total) * 100) : 0

  const filtered = useMemo(() => {
    if (filter === 'unlocked') return achievements.filter((a) => a.unlocked)
    if (filter === 'locked') return achievements.filter((a) => !a.unlocked)
    return achievements
  }, [achievements, filter])

  const filters: { id: AchievementFilter; label: string }[] = [
    { id: 'all', label: `Tous (${total})` },
    { id: 'unlocked', label: `Débloqués (${unlocked})` },
    { id: 'locked', label: `Verrouillés (${total - unlocked})` }
  ]

  const isCompact = variant === 'compact'

  return (
    <motion.section
      className={`widget-card ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Trophy size={20} className="text-trophy-gold" />
            Succès Steam
          </h2>
          {total > 0 && (
            <p className="text-white/45 text-sm mt-1">
              {unlocked} / {total} débloqués · {progress}%
            </p>
          )}
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 text-sm border border-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
          Synchroniser
        </button>
      </div>

      {total > 0 && (
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-5">
          <motion.div
            className="h-full bg-gradient-to-r from-trophy-bronze via-trophy-silver to-trophy-gold rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
      )}

      {total > 0 && (
        <div className="flex gap-2 mb-5">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f.id
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-white/60 hover:text-white hover:bg-white/15'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-white/40 text-sm py-8 text-center">Chargement des succès...</p>
      ) : total === 0 ? (
        <div className="text-center py-10">
          <Trophy size={36} className="mx-auto text-white/20 mb-3" />
          <p className="text-white/50 text-sm mb-1">Aucun succès détecté pour ce jeu</p>
          <p className="text-white/30 text-xs max-w-md mx-auto">
            Lancez le jeu au moins une fois via Steam, puis cliquez sur Synchroniser pour importer vos succès.
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-3 overflow-y-auto pr-1 ${
            isCompact
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-h-[35vh]'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          }`}
        >
          {filtered.map((achievement) => (
            <div
              key={achievement.steamAchievementId}
              className={`flex gap-3 p-3 rounded-xl border transition-colors ${
                achievement.unlocked
                  ? `bg-white/5 border-white/10 ${tierBg[achievement.tier]}`
                  : 'bg-black/20 border-white/5 opacity-55'
              }`}
            >
              <div className="relative flex-shrink-0">
                {achievement.icon ? (
                  <img
                    src={achievement.icon}
                    alt=""
                    className={`w-12 h-12 rounded-lg object-cover ${!achievement.unlocked ? 'grayscale' : ''}`}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                    <Trophy size={20} className={tierColors[achievement.tier]} />
                  </div>
                )}
                <span
                  className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${
                    achievement.unlocked ? 'bg-emerald-500' : 'bg-white/20'
                  }`}
                >
                  {achievement.unlocked ? (
                    <CheckCircle2 size={10} className="text-white" />
                  ) : (
                    <Lock size={8} className="text-white/70" />
                  )}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white leading-tight mb-0.5">{achievement.name}</p>
                <p className="text-xs text-white/45 leading-snug line-clamp-2 mb-1.5">
                  {achievement.description}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <span className={`font-medium uppercase tracking-wide ${tierColors[achievement.tier]}`}>
                    {achievement.tier}
                  </span>
                  {achievement.rarityPercent !== undefined && (
                    <span className="text-white/35">{achievement.rarityPercent.toFixed(1)}% des joueurs</span>
                  )}
                  {achievement.unlocked && achievement.unlockedAt && (
                    <span className="text-emerald-400/80">{formatUnlockDate(achievement.unlockedAt)}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.section>
  )
}
