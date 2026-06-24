import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Play, RefreshCw, Search, HardDrive, CloudDownload, ArrowLeft, ExternalLink } from 'lucide-react'
import { api } from '../services/api'
import { CinematicBackground } from '../components/CinematicBackground'
import { LibraryTabs } from '../components/LibraryTabs'
import { InstallProgressModal, type InstallTarget } from '../components/InstallProgressModal'
import type { EpicLibraryGame } from '@shared/types'

type FilterMode = 'all' | 'installed' | 'not-installed'

function EpicGameCard({
  game,
  onOpen,
  onInstall,
  onPlay,
  isInstalling
}: {
  game: EpicLibraryGame
  onOpen: () => void
  onInstall: () => void
  onPlay: () => void
  isInstalling: boolean
}): JSX.Element {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <motion.div
      layout
      onClick={onOpen}
      className="group relative rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/25 transition-colors cursor-pointer"
    >
      <div className="aspect-[3/4] relative overflow-hidden">
        {!imgFailed && game.coverUrl ? (
          <img
            src={game.coverUrl}
            alt={game.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
            <span className="text-white/30 text-xs font-bold">EPIC</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        <div className="absolute top-2 right-2">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur-sm ${
              game.installed ? 'bg-emerald-500/80 text-white' : 'bg-amber-500/80 text-white'
            }`}
          >
            {game.installed ? 'Installé' : 'Non installé'}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-sm font-semibold text-white line-clamp-2 mb-2">{game.name}</h3>
          {game.installed ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPlay()
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white text-black text-xs font-bold"
            >
              <Play size={14} fill="currentColor" />
              Jouer
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onInstall()
              }}
              disabled={isInstalling}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/20 text-white text-xs font-bold border border-white/20 disabled:opacity-50"
            >
              <Download size={14} />
              {isInstalling ? 'Installation...' : 'Installer'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function EpicLibraryPage(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')
  const [installTarget, setInstallTarget] = useState<InstallTarget | null>(null)
  const [focusedGame, setFocusedGame] = useState<EpicLibraryGame | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['epic-library'],
    queryFn: api.getEpicLibrary
  })

  const syncMutation = useMutation({
    mutationFn: api.syncEpicLibrary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epic-library'] })
      queryClient.invalidateQueries({ queryKey: ['games'] })
      refetch()
    }
  })

  const { data: installedGames = [] } = useQuery({
    queryKey: ['games', 'installed'],
    queryFn: () => api.getGames({ installedOnly: true })
  })

  const games = data?.games ?? []
  const stats = data?.stats ?? { total: 0, installed: 0, notInstalled: 0 }
  const launcher = data?.launcher

  const filteredGames = useMemo(() => {
    let list = games
    if (filter === 'installed') list = list.filter((g) => g.installed)
    if (filter === 'not-installed') list = list.filter((g) => !g.installed)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((g) => g.name.toLowerCase().includes(q))
    }
    return list
  }, [games, filter, search])

  const handleInstall = (game: EpicLibraryGame) => {
    setInstallTarget({
      platform: 'epic',
      id: game.appName,
      gameName: game.name,
      coverUrl: game.coverUrl
    })
  }

  const handlePlay = async (game: EpicLibraryGame) => {
    const dbGame = installedGames.find((g) => g.appId === game.appName && g.platform === 'epic')
    if (dbGame) {
      await api.launchGame(dbGame.id)
    } else {
      await api.launchEpicGame(game.appName)
    }
  }

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <CinematicBackground
        imageUrl={focusedGame?.bannerUrl ?? focusedGame?.coverUrl}
        variant="home"
        blurAmount={64}
        showParticles
      />

      <div className="relative z-10 flex flex-col h-full pt-20 px-10 pb-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-3 w-fit"
        >
          <ArrowLeft size={16} />
          Accueil
        </button>

        <LibraryTabs />

        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight">Bibliothèque Epic Games</h1>
            <p className="text-white/50 mt-1">
              {stats.total} jeux · {stats.installed} installés · {stats.notInstalled} à installer
            </p>
          </div>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm border border-white/15 disabled:opacity-50"
          >
            <RefreshCw size={16} className={syncMutation.isPending ? 'animate-spin' : ''} />
            Synchroniser
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex gap-2">
            {(
              [
                { id: 'all' as const, label: 'Tous', count: stats.total },
                { id: 'installed' as const, label: 'Installés', count: stats.installed },
                { id: 'not-installed' as const, label: 'À installer', count: stats.notInstalled }
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  filter === f.id ? 'bg-white text-black' : 'bg-white/10 text-white/70'
                }`}
              >
                {f.label} <span className="opacity-60 ml-1">{f.count}</span>
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[200px] max-w-md relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-10 pr-4 py-2 rounded-full bg-black/30 border border-white/10 text-white text-sm"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-white/50">Chargement Epic Games...</div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <HardDrive size={48} className="text-white/30" />
            <p className="text-white/60">Epic Games Launcher non détecté</p>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 max-w-lg mx-auto">
            <CloudDownload size={40} className="text-white/30" />
            <p className="text-white/70 font-medium">Aucun jeu Epic dans votre bibliothèque</p>
            <p className="text-white/45 text-sm leading-relaxed">
              {launcher?.installed
                ? 'Le launcher Epic est détecté. Ouvrez Epic Games Launcher, connectez-vous et réclamez ou installez des jeux, puis cliquez sur Synchroniser.'
                : 'Installez Epic Games Launcher sur ce PC pour afficher votre bibliothèque.'}
            </p>
            {launcher?.installed && (
              <button
                onClick={() =>
                  void window.electronAPI?.app.openExternal('com.epicgames.launcher://store/')
                }
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm border border-white/15 transition-colors"
              >
                <ExternalLink size={16} />
                Ouvrir la boutique Epic
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredGames.map((game) => (
                  <div
                    key={game.appName}
                    onMouseEnter={() => setFocusedGame(game)}
                    onMouseLeave={() => setFocusedGame(null)}
                  >
                    <EpicGameCard
                      game={game}
                      onOpen={() => navigate(`/library/epic/${encodeURIComponent(game.appName)}`)}
                      onInstall={() => handleInstall(game)}
                      onPlay={() => handlePlay(game)}
                      isInstalling={
                        installTarget?.platform === 'epic' && installTarget.id === game.appName
                      }
                    />
                  </div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      <InstallProgressModal
        target={installTarget}
        onClose={() => setInstallTarget(null)}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['epic-library'] })
          queryClient.invalidateQueries({ queryKey: ['games'] })
          refetch()
        }}
      />
    </div>
  )
}
