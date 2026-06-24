import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, RefreshCw, ChevronDown, Lock, CheckCircle2 } from 'lucide-react'
import { api } from '../services/api'
import { CinematicBackground } from '../components/CinematicBackground'
import type { TrophyTier } from '@shared/types'

const tierConfig: Record<TrophyTier, { color: string; label: string }> = {
  bronze: { color: 'text-trophy-bronze', label: 'Bronze' },
  silver: { color: 'text-trophy-silver', label: 'Argent' },
  gold: { color: 'text-trophy-gold', label: 'Or' },
  platinum: { color: 'text-trophy-platinum', label: 'Platine' }
}

export function TrophiesPage(): JSX.Element {
  const queryClient = useQueryClient()
  const [expandedGame, setExpandedGame] = useState<string | null>(null)

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['trophies-grouped'],
    queryFn: api.getTrophiesGrouped
  })

  const { data: stats } = useQuery({ queryKey: ['trophy-stats'], queryFn: api.getTrophyStats })

  const syncMutation = useMutation({
    mutationFn: api.syncAllSteamTrophies,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trophies-grouped'] })
      queryClient.invalidateQueries({ queryKey: ['trophy-stats'] })
      queryClient.invalidateQueries({ queryKey: ['trophies'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    }
  })


  return (
    <div className="relative h-full overflow-y-auto">
      <CinematicBackground showParticles />

      <div className="relative z-10 w-full px-10 py-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-light text-white">Trophées</h1>
            <p className="text-white/50 mt-1">Succès Steam synchronisés par jeu</p>
          </div>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm backdrop-blur-md transition-colors"
          >
            <RefreshCw size={16} className={syncMutation.isPending ? 'animate-spin' : ''} />
            Sync Steam
          </button>
        </div>

        {stats && (
          <motion.div
            className="widget-card mb-8 flex items-center justify-between"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-8">
              {(Object.keys(tierConfig) as TrophyTier[]).map((tier) => (
                <div key={tier} className="text-center">
                  <Trophy size={24} className={`mx-auto mb-1 ${tierConfig[tier].color}`} />
                  <p className="text-2xl font-bold text-white">{stats[tier]}</p>
                  <p className="text-xs text-white/40">{tierConfig[tier].label}</p>
                </div>
              ))}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-white">{stats.total}</p>
              <p className="text-white/40 text-sm">Total débloqués</p>
            </div>
          </motion.div>
        )}

        {isLoading ? (
          <p className="text-white/50 text-center py-20">Chargement...</p>
        ) : groups.length === 0 ? (
          <motion.div
            className="widget-card text-center py-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Trophy size={48} className="mx-auto text-white/20 mb-4" />
            <p className="text-white/60 mb-2">Aucun succès Steam synchronisé</p>
            <p className="text-white/40 text-sm mb-6">
              Scannez vos jeux depuis l&apos;accueil, puis synchronisez les succès Steam
            </p>
            <button
              onClick={() => syncMutation.mutate()}
              className="px-6 py-2.5 rounded-full bg-white text-black font-semibold text-sm"
            >
              Synchroniser maintenant
            </button>
          </motion.div>
        ) : (
          <div className="space-y-4 pb-10">
            {groups.map((group, i) => (
              <motion.div
                key={group.gameId}
                className="widget-card overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <button
                  className="w-full flex items-center gap-4 text-left"
                  onClick={() => setExpandedGame(expandedGame === group.gameId ? null : group.gameId)}
                >
                  {group.gameCover ? (
                    <img src={group.gameCover} alt="" className="w-12 h-16 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-16 rounded-lg bg-white/10" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white truncate">{group.gameName}</h3>
                    <p className="text-white/40 text-sm capitalize">{group.platform}</p>
                  </div>
                  <div className="text-right mr-2">
                    <p className="text-white font-semibold">
                      {group.unlocked}/{group.total}
                    </p>
                    <div className="w-24 h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-console-accent rounded-full"
                        style={{ width: `${group.total > 0 ? (group.unlocked / group.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`text-white/40 transition-transform ${expandedGame === group.gameId ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence>
                  {expandedGame === group.gameId && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/10">
                        {group.trophies.map((trophy) => (
                          <div
                            key={trophy.id}
                            className={`flex items-center gap-3 p-3 rounded-xl ${
                              trophy.unlocked ? 'bg-white/5' : 'opacity-40'
                            }`}
                          >
                            {trophy.icon ? (
                              <img src={trophy.icon} alt="" className="w-10 h-10 rounded-lg" />
                            ) : (
                              <Trophy size={20} className={tierConfig[trophy.tier].color} />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-white truncate">{trophy.name}</p>
                              <p className="text-xs text-white/40 truncate">{trophy.description}</p>
                            </div>
                            {trophy.unlocked ? (
                              <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                            ) : (
                              <Lock size={14} className="text-white/30 flex-shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
