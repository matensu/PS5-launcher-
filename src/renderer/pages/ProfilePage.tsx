import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { User, Trophy, Gamepad2, Clock, Star } from 'lucide-react'
import { api } from '../services/api'
import { xpForNextLevel } from '@shared/types'
import { CinematicBackground } from '../components/CinematicBackground'

export function ProfilePage(): JSX.Element {
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: api.getProfile })
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: api.getStats })

  if (!profile) {
    return (
      <div className="relative h-full">
        <CinematicBackground showParticles />
        <div className="flex items-center justify-center h-full text-white/50">Chargement...</div>
      </div>
    )
  }

  const xpInfo = xpForNextLevel(profile.xp)
  const totalHours = Math.floor(profile.totalPlayTimeMinutes / 60)

  return (
    <div className="relative h-full overflow-y-auto">
      <CinematicBackground showParticles />

      <div className="relative z-10 w-full px-10 py-8">
        <motion.h1
          className="text-3xl font-light text-white mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Profil
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="widget-card mb-6"
        >
          <div className="flex items-center gap-10">
            <div className="w-36 h-36 rounded-full bg-console-accent/20 flex items-center justify-center border-2 border-white/20 shadow-[0_0_40px_rgba(0,112,209,0.3)] flex-shrink-0">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <User size={56} className="text-white/60" />
              )}
            </div>

            <div className="flex-1">
              <h2 className="text-4xl font-semibold text-white">{profile.username}</h2>
              <div className="flex items-center gap-3 mt-3">
                <Star className="text-trophy-gold" size={22} />
                <span className="text-2xl font-semibold text-white">Niveau {profile.level}</span>
              </div>

              <div className="mt-6 max-w-xl">
                <div className="flex justify-between text-sm text-white/50 mb-2">
                  <span>{xpInfo.current} XP</span>
                  <span>{xpInfo.needed} XP pour le niveau suivant</span>
                </div>
                <div className="h-2.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                  <motion.div
                    className="h-full bg-gradient-to-r from-console-accent to-blue-300 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${xpInfo.progress}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-4 gap-5 mb-6">
          {[
            { icon: Trophy, color: 'text-trophy-gold', value: profile.trophiesUnlocked, label: 'Trophées débloqués' },
            { icon: Gamepad2, color: 'text-console-accent', value: profile.gamesOwned, label: 'Jeux possédés' },
            { icon: Clock, color: 'text-white/60', value: `${totalHours}h`, label: 'Temps de jeu total' },
            { icon: Star, color: 'text-trophy-platinum', value: profile.xp.toLocaleString(), label: 'XP totale' }
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              className="widget-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <stat.icon className={`${stat.color} mb-3`} size={28} />
              <p className="text-3xl font-bold text-white">{stat.value}</p>
              <p className="text-white/40 text-sm mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {stats?.recentGames && stats.recentGames.length > 0 && (
          <motion.div
            className="widget-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-lg font-semibold text-white mb-5">Jeux récents</h2>
            <div className="grid grid-cols-5 gap-4">
              {stats.recentGames.map((game) => (
                <div
                  key={game.id}
                  className="flex flex-col items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  {game.coverUrl ? (
                    <img src={game.coverUrl} alt="" className="w-24 h-36 object-cover rounded-lg shadow-lg" />
                  ) : (
                    <div className="w-24 h-36 rounded-lg bg-white/10" />
                  )}
                  <div className="text-center min-w-0 w-full">
                    <p className="font-medium text-white text-sm truncate">{game.name}</p>
                    <p className="text-xs text-white/40 capitalize">{game.platform}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
