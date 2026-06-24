import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Trophy, Target, Clock, Gamepad2 } from 'lucide-react'
import { api } from '../services/api'
import { xpForNextLevel } from '@shared/types'
import type { TrophyTier } from '@shared/types'
import { MediaWidgets } from './MediaWidgets'

const tierColors: Record<TrophyTier, string> = {
  platinum: '#e5e4e2',
  gold: '#ffd700',
  silver: '#c0c0c0',
  bronze: '#cd7f32'
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
}

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } }
}

export function DashboardWidgets(): JSX.Element {
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: api.getStats })
  const { data: challenges = [] } = useQuery({ queryKey: ['challenges'], queryFn: api.getChallenges })
  const { data: trophyStats } = useQuery({ queryKey: ['trophy-stats'], queryFn: api.getTrophyStats })

  const profile = stats?.profile
  const xpInfo = profile ? xpForNextLevel(profile.xp) : null
  const activeChallenge = challenges.find((c) => !c.completed)

  return (
    <motion.div
      className="grid grid-cols-12 gap-4 w-full"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item} className="col-span-3 widget-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Trophées</h3>
          <span className="text-white/50 text-sm">Total : {trophyStats?.total ?? 0}</span>
        </div>
        <div className="flex justify-between items-end">
          {(['platinum', 'gold', 'silver', 'bronze'] as TrophyTier[]).map((tier) => (
            <div key={tier} className="flex flex-col items-center gap-1">
              <Trophy size={28} style={{ color: tierColors[tier] }} />
              <span className="text-xl font-bold text-white">{trophyStats?.[tier] ?? 0}</span>
            </div>
          ))}
        </div>
        {profile && xpInfo && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex justify-between text-xs text-white/50 mb-1.5">
              <span>Niveau {profile.level}</span>
              <span>{Math.round(xpInfo.progress)}%</span>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${xpInfo.progress}%` }}
                transition={{ duration: 1 }}
              />
            </div>
          </div>
        )}
        <Link to="/trophies" className="block mt-3 text-xs text-white/40 hover:text-white/70 transition-colors">
          Voir tous les trophées →
        </Link>
      </motion.div>

      <motion.div variants={item} className="col-span-3 widget-card">
        <h3 className="text-white font-semibold mb-3">Profil</h3>
        {profile ? (
          <>
            <p className="text-2xl font-bold text-white">{profile.username}</p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <Gamepad2 size={18} className="text-white/40 mb-1" />
                <p className="text-lg font-semibold text-white">{profile.gamesOwned}</p>
                <p className="text-xs text-white/40">Jeux</p>
              </div>
              <div>
                <Clock size={18} className="text-white/40 mb-1" />
                <p className="text-lg font-semibold text-white">{Math.floor(profile.totalPlayTimeMinutes / 60)}h</p>
                <p className="text-xs text-white/40">Jouées</p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-white/40 text-sm">Chargement...</p>
        )}
        <Link to="/profile" className="block mt-3 text-xs text-white/40 hover:text-white/70 transition-colors">
          Voir le profil →
        </Link>
      </motion.div>

      <motion.div variants={item} className="col-span-3 widget-card">
        <div className="flex items-center gap-2 mb-3">
          <Target size={18} className="text-console-accent" />
          <h3 className="text-white font-semibold">Défi du jour</h3>
        </div>
        {activeChallenge ? (
          <>
            <p className="text-white font-medium">{activeChallenge.title}</p>
            <p className="text-white/50 text-sm mt-1">{activeChallenge.description}</p>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-white/40 mb-1">
                <span>
                  {activeChallenge.progress}/{activeChallenge.target}
                </span>
                <span>+{activeChallenge.xpReward} XP</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-console-accent rounded-full transition-all"
                  style={{
                    width: `${Math.min((activeChallenge.progress / activeChallenge.target) * 100, 100)}%`
                  }}
                />
              </div>
            </div>
          </>
        ) : (
          <p className="text-white/40 text-sm">Tous les défis complétés !</p>
        )}
        <Link to="/challenges" className="block mt-3 text-xs text-white/40 hover:text-white/70 transition-colors">
          Tous les défis →
        </Link>
      </motion.div>

      <motion.div variants={item} className="col-span-3 widget-card">
        <h3 className="text-white font-semibold mb-3">Récents</h3>
        <div className="space-y-2">
          {(stats?.recentGames ?? []).slice(0, 3).map((game) => (
            <div key={game.id} className="flex items-center gap-3">
              {game.coverUrl && (
                <img src={game.coverUrl} alt="" className="w-8 h-10 rounded-md object-cover" />
              )}
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{game.name}</p>
                <p className="text-xs text-white/40 capitalize">{game.platform}</p>
              </div>
            </div>
          ))}
          {(stats?.recentGames ?? []).length === 0 && (
            <p className="text-white/40 text-sm">Aucun jeu récent</p>
          )}
        </div>
      </motion.div>

      <MediaWidgets />
    </motion.div>
  )
}
