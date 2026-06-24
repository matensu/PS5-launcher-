import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Clock, Calendar, Building2, Star } from 'lucide-react'
import { api } from '../services/api'
import { CinematicBackground } from '../components/CinematicBackground'
import { GameFocusBar } from '../components/GameFocusBar'
import { GameAchievementsPanel } from '../components/GameAchievementsPanel'
import { InstallProgressModal, type InstallTarget } from '../components/InstallProgressModal'
import { useRunningGame, useStopGame } from '../hooks/useRunningGame'
import type { Game } from '@shared/types'

function formatPlayTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min jouées`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min jouées` : `${h}h jouées`
}

export function SteamGamePage(): JSX.Element {
  const { appId } = useParams<{ appId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [installTarget, setInstallTarget] = useState<InstallTarget | null>(null)
  const [isStopping, setIsStopping] = useState(false)
  const runningGame = useRunningGame()
  const { stopGame } = useStopGame()

  const { data: game, isLoading, error } = useQuery({
    queryKey: ['steam-game', appId],
    queryFn: () => api.getSteamGame(appId!),
    enabled: !!appId
  })

  const launchMutation = useMutation({
    mutationFn: async () => {
      if (game?.gameId) {
        await api.launchGame(game.gameId)
        await queryClient.invalidateQueries({ queryKey: ['running-game'] })
      } else if (game) {
        setInstallTarget({
          platform: 'steam',
          id: game.appId,
          gameName: game.name,
          coverUrl: game.coverUrl
        })
      }
    }
  })

  const isRunning = Boolean(game?.gameId && runningGame?.gameId === game.gameId)

  if (isLoading) {
    return (
      <div className="relative h-full">
        <CinematicBackground variant="home" showParticles />
        <div className="flex items-center justify-center h-full text-white/50">Chargement du jeu...</div>
      </div>
    )
  }

  if (error || !game) {
    return (
      <div className="relative h-full">
        <CinematicBackground variant="home" showParticles />
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-white/60">Jeu introuvable</p>
          <button
            onClick={() => navigate('/library')}
            className="px-4 py-2 rounded-full bg-white/10 text-white text-sm hover:bg-white/20"
          >
            Retour à la bibliothèque
          </button>
        </div>
      </div>
    )
  }

  const focusGame: Game = {
    id: game.gameId ?? game.appId,
    name: game.name,
    platform: 'steam',
    appId: game.appId,
    installPath: game.installPath,
    coverUrl: game.coverUrl,
    bannerUrl: game.bannerUrl,
    description: game.shortDescription,
    playTimeMinutes: game.playTimeMinutes,
    lastPlayed: game.lastPlayed,
    addedAt: new Date().toISOString()
  }

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <CinematicBackground
        imageUrl={game.bannerUrl ?? game.headerImage ?? game.coverUrl}
        variant="game"
        showParticles={false}
      />

      <button
        onClick={() => navigate('/library')}
        className="absolute top-20 left-10 z-20 flex items-center gap-2 px-3 py-2 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white text-sm backdrop-blur-md border border-white/10 transition-colors"
      >
        <ArrowLeft size={16} />
        Bibliothèque
      </button>

      <div className="flex-1 min-h-0 overflow-y-auto relative z-10">
        <div className="min-h-[45vh]" />

        <div className="px-10 pb-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <div className="flex flex-wrap gap-2 mb-4">
              {game.steamTools && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/30 text-violet-100 border border-violet-400/30">
                  SteamTools
                </span>
              )}
              {game.genres.slice(0, 4).map((genre) => (
                <span
                  key={genre}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white/70 border border-white/10"
                >
                  {genre}
                </span>
              ))}
            </div>

            <h1 className="text-5xl font-bold text-white tracking-tight mb-4" style={{ textShadow: '0 2px 24px rgba(0,0,0,0.6)' }}>
              {game.name}
            </h1>

            <div className="flex flex-wrap items-center gap-5 text-white/55 text-sm mb-6">
              {game.developers[0] && (
                <span className="flex items-center gap-1.5">
                  <Building2 size={14} />
                  {game.developers[0]}
                </span>
              )}
              {game.releaseDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} />
                  {game.releaseDate}
                </span>
              )}
              {game.playTimeMinutes > 0 && (
                <span className="flex items-center gap-1.5">
                  <Clock size={14} />
                  {formatPlayTime(game.playTimeMinutes)}
                </span>
              )}
              {game.metacriticScore && (
                <span className="flex items-center gap-1.5 text-emerald-300/90">
                  <Star size={14} />
                  Metacritic {game.metacriticScore}
                </span>
              )}
            </div>

            {game.shortDescription && (
              <p className="text-white/70 text-lg leading-relaxed max-w-3xl mb-8">{game.shortDescription}</p>
            )}
          </motion.div>

          <div className="flex flex-col lg:flex-row gap-8 items-end justify-between mb-10">
            <GameFocusBar
              game={focusGame}
              onPlay={() =>
                game.installed
                  ? launchMutation.mutate()
                  : setInstallTarget({
                      platform: 'steam',
                      id: game.appId,
                      gameName: game.name,
                      coverUrl: game.coverUrl
                    })
              }
              onStop={async () => {
                if (!game.gameId) return
                setIsStopping(true)
                try {
                  await stopGame(game.gameId)
                } finally {
                  setIsStopping(false)
                }
              }}
              isLaunching={launchMutation.isPending || installTarget?.id === game.appId}
              isStopping={isStopping}
              isRunning={isRunning}
              showMoreButton={false}
              showTitle={false}
            />
          </div>

          {game.screenshots.length > 0 && (
            <motion.section
              className="mb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h2 className="text-xl font-semibold text-white mb-4">Captures d&apos;écran</h2>
              <div className="flex gap-4 overflow-x-auto pb-2 scroll-smooth">
                {game.screenshots.map((url, i) => (
                  <img
                    key={url}
                    src={url}
                    alt={`Capture ${i + 1}`}
                    className="h-48 rounded-xl object-cover flex-shrink-0 border border-white/10 shadow-lg"
                    loading="lazy"
                  />
                ))}
              </div>
            </motion.section>
          )}

          {game.detailedDescription && (
            <motion.section
              className="widget-card max-w-4xl mb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <h2 className="text-xl font-semibold text-white mb-4">À propos</h2>
              <p className="text-white/60 text-sm leading-relaxed whitespace-pre-line">
                {game.detailedDescription.slice(0, 3000)}
                {game.detailedDescription.length > 3000 ? '...' : ''}
              </p>
            </motion.section>
          )}

          <GameAchievementsPanel
            appId={game.appId}
            gameName={game.name}
            gameId={game.gameId}
            variant="full"
          />
        </div>
      </div>

      <InstallProgressModal
        target={installTarget}
        onClose={() => setInstallTarget(null)}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['steam-game', appId] })
          queryClient.invalidateQueries({ queryKey: ['steam-library'] })
          queryClient.invalidateQueries({ queryKey: ['games'] })
        }}
      />
    </div>
  )
}
