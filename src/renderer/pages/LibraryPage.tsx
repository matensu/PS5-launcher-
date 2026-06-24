import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { api } from '../services/api'
import { CinematicBackground } from '../components/CinematicBackground'
import { GameTopStrip } from '../components/GameTopStrip'
import { GameFocusBar } from '../components/GameFocusBar'
import { DashboardWidgets } from '../components/DashboardWidgets'
import { useGamepad } from '../hooks/useGamepad'
import { useRunningGame, useStopGame } from '../hooks/useRunningGame'
import { useAppStore } from '../stores/appStore'
import type { Game } from '@shared/types'

export function LibraryPage(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [bgRotateIndex, setBgRotateIndex] = useState(0)
  const setGlobalFocus = useAppStore((s) => s.setFocusedIndex)

  const { data: games = [], isLoading } = useQuery({
    queryKey: ['games', 'installed'],
    queryFn: () => api.getGames({ installedOnly: true })
  })

  const syncMutation = useMutation({
    mutationFn: api.syncGames,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] })
      queryClient.invalidateQueries({ queryKey: ['trophies'] })
      queryClient.invalidateQueries({ queryKey: ['trophy-stats'] })
      queryClient.invalidateQueries({ queryKey: ['trophies-grouped'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    }
  })

  const launchMutation = useMutation({
    mutationFn: api.launchGame,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['running-game'] })
      useAppStore.getState().setLauncherHasFocus(false)
    }
  })
  const { stopGame } = useStopGame()
  const [isStopping, setIsStopping] = useState(false)
  const runningGame = useRunningGame()

  const maxStripIndex = games.length
  const isMenu = focusedIndex === -1
  const isLibraryTile = focusedIndex === games.length
  const isGameFocus = focusedIndex >= 0 && focusedIndex < games.length
  const focusedGame = isGameFocus ? games[focusedIndex] : null

  const menuBgGame = games[bgRotateIndex % Math.max(games.length, 1)]
  const backgroundUrl = isGameFocus
    ? (focusedGame?.bannerUrl ?? focusedGame?.coverUrl)
    : isMenu && games.length > 0
      ? (menuBgGame?.bannerUrl ?? menuBgGame?.coverUrl)
      : undefined

  useEffect(() => {
    if (!isMenu || games.length <= 1) return
    const timer = setInterval(() => {
      setBgRotateIndex((i) => (i + 1) % games.length)
    }, 9000)
    return () => clearInterval(timer)
  }, [isMenu, games.length])

  const scrollFocus = useCallback(
    (index: number) => {
      const clamped = Math.max(-1, Math.min(maxStripIndex, index))
      setFocusedIndex(clamped)
      setGlobalFocus(Math.max(0, clamped))
    },
    [maxStripIndex, setGlobalFocus]
  )

  useGamepad({
    onNavigate: (dir) => {
      if (dir === 'left') scrollFocus(focusedIndex - 1)
      if (dir === 'right') scrollFocus(focusedIndex + 1)
      if (dir === 'up' && focusedIndex >= 0) scrollFocus(-1)
      if (dir === 'down' && focusedIndex === -1 && games.length > 0) scrollFocus(0)
    },
    onConfirm: () => {
      if (isLibraryTile) {
        navigate('/library')
        return
      }
      if (isGameFocus && focusedGame) {
        if (runningGame?.gameId === focusedGame.id) {
          void handleStop(focusedGame)
        } else {
          handleLaunch(focusedGame)
        }
      }
    },
    onBack: () => {
      if (focusedIndex > -1) scrollFocus(-1)
    }
  })

  useEffect(() => {
    if (games.length > 0 && focusedIndex >= games.length && focusedIndex !== maxStripIndex) {
      setFocusedIndex(0)
    }
  }, [games.length, focusedIndex, maxStripIndex])

  const handleLaunch = async (game: Game) => {
    await launchMutation.mutateAsync(game.id)
  }

  const handleStop = async (game: Game) => {
    setIsStopping(true)
    try {
      await stopGame(game.id)
    } finally {
      setIsStopping(false)
    }
  }

  const scannerButton = (
    <button
      onClick={() => syncMutation.mutate()}
      disabled={syncMutation.isPending}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white/70 text-xs backdrop-blur-md border border-white/10 transition-colors"
    >
      <RefreshCw size={12} className={syncMutation.isPending ? 'animate-spin' : ''} />
      Scanner
    </button>
  )

  return (
    <div className="relative z-10 h-full flex flex-col overflow-hidden">
      <CinematicBackground
        imageUrl={backgroundUrl}
        variant={isGameFocus ? 'game' : 'home'}
        blurAmount={56}
      />

      {isLoading ? (
        <div className="flex items-center justify-center flex-1 text-white/50">Chargement...</div>
      ) : games.length === 0 ? (
        <motion.div
          className="flex flex-col items-center justify-center flex-1 gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-white/60 text-lg">Aucun jeu détecté</p>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="px-8 py-3 rounded-full bg-white/20 hover:bg-white/30 text-white font-semibold flex items-center gap-2 backdrop-blur-xl border border-white/20"
          >
            <RefreshCw size={18} className={syncMutation.isPending ? 'animate-spin' : ''} />
            Scanner Steam & launchers
          </button>
        </motion.div>
      ) : (
        <>
          <div className="flex-1 min-h-0" />

          <div className="relative z-10">
            <div className="flex justify-start px-10 mb-2">{scannerButton}</div>

            <div className="flex flex-col items-start px-10 pb-10 gap-6 w-full">
              <div className="w-full max-w-4xl">
                <GameTopStrip games={games} focusedIndex={focusedIndex} onFocus={setFocusedIndex} />
              </div>

              {isMenu ? (
                <motion.div
                  className="flex flex-col items-start gap-6 w-full max-w-4xl"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <div>
                    <h1 className="text-5xl font-bold text-white leading-tight tracking-tight mb-2">
                      Accueil
                    </h1>
                    <p className="text-white/55 text-base">
                      {games.length} jeux · Sélectionnez un jeu pour commencer
                    </p>
                  </div>
                  <DashboardWidgets />
                </motion.div>
              ) : isGameFocus && focusedGame ? (
                <div className="w-full">
                  <GameFocusBar
                    game={focusedGame}
                    onPlay={() => handleLaunch(focusedGame)}
                    onStop={() => handleStop(focusedGame)}
                    onDetails={() => navigate(`/game/${focusedGame.id}`)}
                    isLaunching={launchMutation.isPending}
                    isStopping={isStopping}
                    isRunning={runningGame?.gameId === focusedGame.id}
                  />
                </div>
              ) : isLibraryTile ? (
                <motion.div
                  className="text-white/70 text-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  Appuyez sur <span className="text-white font-semibold">A</span> pour ouvrir la bibliothèque
                </motion.div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
