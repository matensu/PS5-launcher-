import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { api } from '../services/api'
import { CinematicBackground } from '../components/CinematicBackground'
import { GameFocusBar } from '../components/GameFocusBar'
import { GameAchievementsPanel } from '../components/GameAchievementsPanel'

export function GameHubPage(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', id],
    queryFn: () => api.getGame(id!),
    enabled: !!id
  })

  const launchMutation = useMutation({ mutationFn: () => api.launchGame(id!) })

  if (isLoading || !game) {
    return (
      <div className="relative h-full">
        <CinematicBackground variant="home" showParticles />
        <div className="flex items-center justify-center h-full text-white/50">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <CinematicBackground
        imageUrl={game.bannerUrl ?? game.coverUrl}
        variant="game"
        showParticles={false}
      />

      <button
        onClick={() => navigate('/')}
        className="absolute top-20 left-10 z-20 flex items-center gap-2 px-3 py-2 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white text-sm backdrop-blur-md border border-white/10 transition-colors"
      >
        <ArrowLeft size={16} />
        Accueil
      </button>

      <div className="flex-1 min-h-0 overflow-y-auto relative z-10">
        <div className="min-h-[40vh]" />

        <div className="px-10 pb-10 space-y-6">
          <GameFocusBar
            game={game}
            onPlay={() => launchMutation.mutate()}
            isLaunching={launchMutation.isPending}
            showMoreButton={false}
          />

          {game.platform === 'steam' && game.appId && (
            <GameAchievementsPanel
              appId={game.appId}
              gameName={game.name}
              gameId={game.id}
              variant="full"
            />
          )}
        </div>
      </div>
    </div>
  )
}
