import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Play, RefreshCw, HardDrive, CloudDownload, ArrowLeft, ExternalLink, Square } from 'lucide-react'
import { api } from '../services/api'
import { CinematicBackground } from '../components/CinematicBackground'
import { LibraryTabs } from '../components/LibraryTabs'
import { InstallProgressModal, type InstallTarget } from '../components/InstallProgressModal'
import { ControllerSearchBar } from '../components/ControllerSearchBar'
import { useLibraryGamepad } from '../hooks/useLibraryGamepad'
import { useRunningGame, useStopGame } from '../hooks/useRunningGame'
import type { EpicLibraryGame } from '@shared/types'

type FilterMode = 'all' | 'installed' | 'not-installed'

const FILTERS: { id: FilterMode; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'installed', label: 'Installés' },
  { id: 'not-installed', label: 'À installer' }
]

function EpicGameCard({
  game,
  onOpen,
  onInstall,
  onPlay,
  onStop,
  isInstalling,
  isStopping,
  isRunning,
  isFocused
}: {
  game: EpicLibraryGame
  onOpen: () => void
  onInstall: () => void
  onPlay: () => void
  onStop: () => void
  isInstalling: boolean
  isStopping?: boolean
  isRunning?: boolean
  isFocused?: boolean
}): JSX.Element {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <motion.div
      layout
      onClick={onOpen}
      className={`group relative rounded-2xl overflow-hidden bg-white/5 border transition-all cursor-pointer ${
        isFocused
          ? 'border-white ring-2 ring-white scale-[1.03] z-10 shadow-[0_0_32px_rgba(255,255,255,0.2)]'
          : 'border-white/10 hover:border-white/25'
      }`}
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
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {isRunning && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/80 text-white backdrop-blur-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              En cours
            </span>
          )}
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
            isRunning ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onStop()
                }}
                disabled={isStopping}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/25 text-red-100 text-xs font-bold border border-red-400/30 disabled:opacity-50"
              >
                <Square size={14} fill="currentColor" />
                {isStopping ? 'Fermeture...' : 'Quitter'}
              </button>
            ) : (
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
            )
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
  const [searchOpen, setSearchOpen] = useState(false)
  const [installTarget, setInstallTarget] = useState<InstallTarget | null>(null)
  const [hoveredGame, setHoveredGame] = useState<EpicLibraryGame | null>(null)
  const [stoppingAppName, setStoppingAppName] = useState<string | null>(null)
  const runningGame = useRunningGame()
  const { stopGame } = useStopGame()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['epic-library'],
    queryFn: api.getEpicLibrary,
    staleTime: 300_000,
    gcTime: 600_000,
    refetchOnMount: 'always',
    refetchInterval: (query) => {
      const games = query.state.data?.games
      if (!games?.some((g) => !g.coverUrl)) return false
      return 4000
    }
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

  const filterIndex = FILTERS.findIndex((f) => f.id === filter)

  const { focusedIndex, registerGridRef, isGridFocused, isFilterFocused, isSearchFocused, isTabsFocused } =
    useLibraryGamepad({
      items: filteredGames,
      filterCount: FILTERS.length,
      filterIndex: Math.max(0, filterIndex),
      onFilterChange: (i) => setFilter(FILTERS[i]?.id ?? 'all'),
      searchOpen,
      onSearchOpenChange: setSearchOpen,
      onGridConfirm: (game) => navigate(`/library/epic/${encodeURIComponent(game.appName)}`),
      backPath: '/'
    })

  const controllerFocusedGame = filteredGames[focusedIndex] ?? null
  const backgroundGame = controllerFocusedGame ?? hoveredGame

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
      queryClient.invalidateQueries({ queryKey: ['running-game'] })
    } else {
      await api.launchEpicGame(game.appName)
    }
  }

  const handleStop = async (game: EpicLibraryGame) => {
    const dbGame = installedGames.find((g) => g.appId === game.appName && g.platform === 'epic')
    if (!dbGame) return
    setStoppingAppName(game.appName)
    try {
      await stopGame(dbGame.id)
    } finally {
      setStoppingAppName(null)
    }
  }

  const runningAppName = installedGames.find((g) => g.id === runningGame?.gameId)?.appId

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <CinematicBackground
        imageUrl={backgroundGame?.bannerUrl ?? backgroundGame?.coverUrl}
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

        <LibraryTabs focused={isTabsFocused} />

        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight">Bibliothèque Epic Games</h1>
            <p className="text-white/50 mt-1">
              {stats.total} jeux · {stats.installed} installés · {stats.notInstalled} à installer
            </p>
            <p className="text-white/35 text-xs mt-1">
              Manette : L1/R1 onglets & filtres · Y recherche · B retour · Options overlay
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
            {FILTERS.map((f, i) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filter === f.id
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-white/70'
                } ${isFilterFocused(i) ? 'ring-2 ring-white' : ''}`}
              >
                {f.label}{' '}
                <span className="opacity-60 ml-1">
                  {f.id === 'all'
                    ? stats.total
                    : f.id === 'installed'
                      ? stats.installed
                      : stats.notInstalled}
                </span>
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[200px] max-w-md">
            <ControllerSearchBar
              value={search}
              onChange={setSearch}
              placeholder="Rechercher..."
              keyboardOpen={searchOpen}
              onKeyboardOpenChange={setSearchOpen}
              isFocused={isSearchFocused}
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
                {filteredGames.map((game, index) => (
                  <div
                    key={game.appName}
                    ref={(el) => registerGridRef(index, el)}
                    onMouseEnter={() => setHoveredGame(game)}
                    onMouseLeave={() => setHoveredGame(null)}
                  >
                    <EpicGameCard
                      game={game}
                      onOpen={() => navigate(`/library/epic/${encodeURIComponent(game.appName)}`)}
                      onInstall={() => handleInstall(game)}
                      onPlay={() => handlePlay(game)}
                      onStop={() => handleStop(game)}
                      isInstalling={
                        installTarget?.platform === 'epic' && installTarget.id === game.appName
                      }
                      isStopping={stoppingAppName === game.appName}
                      isRunning={runningAppName === game.appName}
                      isFocused={isGridFocused(index)}
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
