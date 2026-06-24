import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  Play,
  RefreshCw,
  HardDrive,
  CloudDownload,
  ArrowLeft,
  Clock,
  Upload,
  Puzzle
} from 'lucide-react'
import { api } from '../services/api'
import { CinematicBackground } from '../components/CinematicBackground'
import { LibraryTabs } from '../components/LibraryTabs'
import { InstallProgressModal, type InstallTarget } from '../components/InstallProgressModal'
import { ControllerSearchBar } from '../components/ControllerSearchBar'
import { useLibraryGamepad } from '../hooks/useLibraryGamepad'
import type { SteamLibraryGame } from '@shared/types'

type FilterMode = 'all' | 'installed' | 'not-installed' | 'steamtools'

function formatPlayTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
}

function GameCard({
  game,
  onOpen,
  onInstall,
  onPlay,
  isInstalling,
  isFocused
}: {
  game: SteamLibraryGame
  onOpen: () => void
  onInstall: () => void
  onPlay: () => void
  isInstalling: boolean
  isFocused?: boolean
}): JSX.Element {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
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
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="w-full h-full bg-white/10 flex items-center justify-center">
            <Play size={32} className="text-white/30" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {game.steamTools && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/80 text-white backdrop-blur-sm">
              SteamTools
            </span>
          )}
          {game.installed ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/80 text-white backdrop-blur-sm">
              Installé
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/80 text-white backdrop-blur-sm">
              Non installé
            </span>
          )}
        </div>

        {game.playTimeMinutes > 0 && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-[10px] text-white/80">
            <Clock size={10} />
            {formatPlayTime(game.playTimeMinutes)}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight mb-2">{game.name}</h3>

          {game.installed ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPlay()
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-white/90 transition-colors"
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
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold backdrop-blur-md border border-white/20 transition-colors disabled:opacity-50"
            >
              <Download size={14} />
              {isInstalling ? 'Installation...' : game.steamTools ? 'Installer via Steam' : 'Télécharger'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function SteamLibraryPage(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [installTarget, setInstallTarget] = useState<InstallTarget | null>(null)
  const [hoveredGame, setHoveredGame] = useState<SteamLibraryGame | null>(null)

  const [appIdInput, setAppIdInput] = useState('')
  const [importMessage, setImportMessage] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['steam-library'],
    queryFn: api.getSteamLibrary,
    staleTime: 60_000
  })

  const syncMutation = useMutation({
    mutationFn: api.syncSteamLibrary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['steam-library'] })
      queryClient.invalidateQueries({ queryKey: ['games'] })
      queryClient.invalidateQueries({ queryKey: ['trophies'] })
      refetch()
    }
  })

  const handleInstall = (game: SteamLibraryGame) => {
    setInstallTarget({
      platform: 'steam',
      id: game.appId,
      gameName: game.name,
      coverUrl: game.coverUrl
    })
  }

  const addSteamToolsMutation = useMutation({
    mutationFn: api.addSteamToolsApp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['steam-library'] })
      setAppIdInput('')
      setImportMessage('Plugin SteamTools ajouté — redémarrez Steam pour appliquer.')
      refetch()
    }
  })

  const importMutation = useMutation({
    mutationFn: async () => {
      if (window.electronAPI?.steamTools) {
        return window.electronAPI.steamTools.importPlugins()
      }
      return { imported: [], errors: ['Import disponible uniquement dans l\'application desktop'] }
    },
    onSuccess: (result) => {
      if (result.imported.length > 0) {
        setImportMessage(
          `${result.imported.length} fichier(s) importé(s) — redémarrez Steam pour appliquer.`
        )
        refetch()
        queryClient.invalidateQueries({ queryKey: ['steam-library'] })
      }
      if (result.errors.length > 0) {
        setImportMessage(result.errors.join(' · '))
      }
    }
  })

  const { data: installedGames = [] } = useQuery({
    queryKey: ['games', 'installed'],
    queryFn: () => api.getGames({ installedOnly: true })
  })

  const games = data?.games ?? []
  const stats = data?.stats ?? { total: 0, installed: 0, notInstalled: 0, steamTools: 0 }
  const steamToolsStatus = data?.steamTools

  const filteredGames = useMemo(() => {
    let list = games
    if (filter === 'installed') list = list.filter((g) => g.installed)
    if (filter === 'not-installed') list = list.filter((g) => !g.installed)
    if (filter === 'steamtools') list = list.filter((g) => g.steamTools)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((g) => g.name.toLowerCase().includes(q))
    }
    return list
  }, [games, filter, search])

  const handlePlay = async (game: SteamLibraryGame) => {
    const dbGame = installedGames.find((g) => g.appId === game.appId)
    if (dbGame) {
      await api.launchGame(dbGame.id)
    } else {
      handleInstall(game)
    }
  }

  const filters: { id: FilterMode; label: string; count: number }[] = [
    { id: 'all', label: 'Tous', count: stats.total },
    { id: 'installed', label: 'Installés', count: stats.installed },
    { id: 'not-installed', label: 'À télécharger', count: stats.notInstalled },
    { id: 'steamtools', label: 'SteamTools', count: stats.steamTools }
  ]

  const filterIndex = filters.findIndex((f) => f.id === filter)

  const { focusedIndex, registerGridRef, isGridFocused, isFilterFocused, isSearchFocused } =
    useLibraryGamepad({
      items: filteredGames,
      filterCount: filters.length,
      filterIndex: Math.max(0, filterIndex),
      onFilterChange: (i) => setFilter(filters[i]?.id ?? 'all'),
      searchOpen,
      onSearchOpenChange: setSearchOpen,
      onGridConfirm: (game) => navigate(`/library/game/${game.appId}`),
      backPath: '/'
    })

  const controllerFocusedGame = filteredGames[focusedIndex] ?? null
  const backgroundGame = controllerFocusedGame ?? hoveredGame

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <CinematicBackground
        imageUrl={backgroundGame?.bannerUrl ?? backgroundGame?.coverUrl}
        variant="home"
        blurAmount={64}
        showParticles
      />

      <div className="relative z-10 flex flex-col h-full pt-20 px-10 pb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-3 transition-colors"
            >
              <ArrowLeft size={16} />
              Retour à l&apos;accueil
            </button>
            <h1 className="text-4xl font-bold text-white tracking-tight">Bibliothèque Steam</h1>
            <p className="text-white/50 mt-1">
              {stats.total} jeux · {stats.installed} installés · {stats.steamTools} SteamTools
            </p>
            <p className="text-white/35 text-xs mt-1">Manette : Y = recherche · B = retour</p>
            {steamToolsStatus?.enabled && (
              <p className="text-white/35 text-xs mt-1 flex items-center gap-1.5">
                <Puzzle size={12} />
                {steamToolsStatus.pluginCount} plugin(s) dans stplug-in
                {steamToolsStatus.steamToolsRunning && ' · SteamTools actif'}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/20 hover:bg-violet-500/30 text-white text-sm font-medium backdrop-blur-md border border-violet-400/25 transition-colors disabled:opacity-50"
              >
                <Upload size={16} />
                Importer .lua / .manifest
              </button>
              <button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium backdrop-blur-md border border-white/15 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={16} className={syncMutation.isPending ? 'animate-spin' : ''} />
                Synchroniser
              </button>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                inputMode="numeric"
                placeholder="App ID Steam"
                value={appIdInput}
                onChange={(e) => setAppIdInput(e.target.value.replace(/\D/g, ''))}
                className="w-28 px-3 py-1.5 rounded-full bg-black/30 border border-white/10 text-white text-xs placeholder:text-white/40 focus:outline-none focus:border-white/30"
              />
              <button
                onClick={() => appIdInput && addSteamToolsMutation.mutate(appIdInput)}
                disabled={!appIdInput || addSteamToolsMutation.isPending}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/15 disabled:opacity-40"
              >
                Ajouter plugin
              </button>
            </div>
          </div>
        </div>

        <LibraryTabs />

        {importMessage && (
          <p className="text-sm text-violet-200/80 mb-4 px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-400/20">
            {importMessage}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex gap-2">
            {filters.map((f, i) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filter === f.id
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white'
                } ${isFilterFocused(i) ? 'ring-2 ring-white' : ''}`}
              >
                {f.label}
                <span className="ml-1.5 opacity-60">{f.count}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-[200px] max-w-md">
            <ControllerSearchBar
              value={search}
              onChange={setSearch}
              placeholder="Rechercher un jeu..."
              keyboardOpen={searchOpen}
              onKeyboardOpenChange={setSearchOpen}
              isFocused={isSearchFocused}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-white/50">Chargement de votre bibliothèque Steam...</div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <HardDrive size={48} className="text-white/30" />
            <p className="text-white/60 text-lg">Steam n&apos;a pas été détecté sur ce PC</p>
            <p className="text-white/40 text-sm max-w-md">
              Assurez-vous que Steam est installé et que vous êtes connecté à votre compte.
            </p>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white/50">
            <CloudDownload size={40} className="text-white/30" />
            <p>Aucun jeu trouvé avec ces filtres</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredGames.map((game, index) => (
                  <div
                    key={game.appId}
                    ref={(el) => registerGridRef(index, el)}
                    onMouseEnter={() => setHoveredGame(game)}
                    onMouseLeave={() => setHoveredGame(null)}
                  >
                    <GameCard
                      game={game}
                      onOpen={() => navigate(`/library/game/${game.appId}`)}
                      onInstall={() => handleInstall(game)}
                      onPlay={() => handlePlay(game)}
                      isInstalling={installTarget?.platform === 'steam' && installTarget.id === game.appId}
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
          queryClient.invalidateQueries({ queryKey: ['steam-library'] })
          queryClient.invalidateQueries({ queryKey: ['games'] })
          refetch()
        }}
      />
    </div>
  )
}
