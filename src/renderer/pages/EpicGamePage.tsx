import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { api } from '../services/api'
import { CinematicBackground } from '../components/CinematicBackground'
import { GameFocusBar } from '../components/GameFocusBar'
import { InstallProgressModal, type InstallTarget } from '../components/InstallProgressModal'
import type { Game } from '@shared/types'

export function EpicGamePage(): JSX.Element {
  const { appName } = useParams<{ appName: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [installTarget, setInstallTarget] = useState<InstallTarget | null>(null)
  const decodedAppName = appName ? decodeURIComponent(appName) : ''

  const { data: game, isLoading } = useQuery({
    queryKey: ['epic-game', decodedAppName],
    queryFn: () => api.getEpicGame(decodedAppName),
    enabled: !!decodedAppName
  })

  const launchMutation = useMutation({
    mutationFn: () =>
      game?.gameId ? api.launchGame(game.gameId) : api.launchEpicGame(decodedAppName)
  })

  if (isLoading || !game) {
    return (
      <div className="relative h-full">
        <CinematicBackground variant="home" showParticles />
        <div className="flex items-center justify-center h-full text-white/50">Chargement...</div>
      </div>
    )
  }

  const focusGame: Game = {
    id: game.gameId ?? game.appName,
    name: game.name,
    platform: 'epic',
    appId: game.appName,
    installPath: game.installPath,
    coverUrl: game.coverUrl,
    bannerUrl: game.bannerUrl,
    playTimeMinutes: 0,
    addedAt: new Date().toISOString()
  }

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <CinematicBackground imageUrl={game.bannerUrl ?? game.coverUrl} variant="game" showParticles={false} />

      <button
        onClick={() => navigate('/library/epic')}
        className="absolute top-20 left-10 z-20 flex items-center gap-2 px-3 py-2 rounded-full bg-black/40 text-white/80 text-sm border border-white/10"
      >
        <ArrowLeft size={16} />
        Bibliothèque Epic
      </button>

      <div className="flex-1 min-h-0 overflow-y-auto relative z-10">
        <div className="min-h-[45vh]" />
        <div className="px-10 pb-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-500/30 text-white border border-white/20 mb-4 inline-block">
              Epic Games
            </span>
            <h1 className="text-5xl font-bold text-white mb-6">{game.name}</h1>
          </motion.div>

          <GameFocusBar
            game={focusGame}
            onPlay={() =>
              game.installed
                ? launchMutation.mutate()
                : setInstallTarget({
                    platform: 'epic',
                    id: game.appName,
                    gameName: game.name,
                    coverUrl: game.coverUrl
                  })
            }
            isLaunching={launchMutation.isPending || installTarget?.id === game.appName}
            showMoreButton={false}
            showTitle={false}
          />
        </div>
      </div>

      <InstallProgressModal
        target={installTarget}
        onClose={() => setInstallTarget(null)}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['epic-game', decodedAppName] })
          queryClient.invalidateQueries({ queryKey: ['epic-library'] })
          queryClient.invalidateQueries({ queryKey: ['games'] })
        }}
      />
    </div>
  )
}
