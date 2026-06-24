import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import {
  X,
  Trophy,
  Clock,
  Zap,
  Music,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Headphones,
  ExternalLink,
  BarChart3
} from 'lucide-react'
import { api } from '../services/api'
import { DiscordIcon } from '../components/DiscordIcon'
import { xpForNextLevel } from '@shared/types'
import type { TrophyTier } from '@shared/types'
import '../styles/globals.css'

const SLIDES = [
  { id: 'music', label: 'Musique', icon: Music },
  { id: 'discord', label: 'Discord' },
  { id: 'stats', label: 'Stats', icon: BarChart3 }
] as const

const tierColors: Record<TrophyTier, string> = {
  platinum: '#e5e4e2',
  gold: '#ffd700',
  silver: '#c0c0c0',
  bronze: '#cd7f32'
}

const SWIPE_THRESHOLD = 48

export function OverlayApp(): JSX.Element {
  const [slideIndex, setSlideIndex] = useState(0)
  const queryClient = useQueryClient()

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
    refetchInterval: 4000
  })

  const { data: media } = useQuery({
    queryKey: ['media'],
    queryFn: api.getMediaStatus,
    refetchInterval: 2500
  })

  const controlMutation = useMutation({
    mutationFn: api.spotifyControl,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    }
  })

  const goTo = useCallback((index: number) => {
    setSlideIndex((index + SLIDES.length) % SLIDES.length)
  }, [])

  const goNext = useCallback(() => goTo(slideIndex + 1), [goTo, slideIndex])
  const goPrev = useCallback(() => goTo(slideIndex - 1), [goTo, slideIndex])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD) goNext()
    else if (info.offset.x > SWIPE_THRESHOLD) goPrev()
  }

  const track = media?.spotify.nowPlaying
  const discord = media?.discord
  const profile = stats?.profile
  const trophies = stats?.trophies
  const xpInfo = profile ? xpForNextLevel(profile.xp) : null
  const activeSlide = SLIDES[slideIndex]

  return (
    <div className="w-full h-full min-h-0 bg-black/75 backdrop-blur-xl rounded-2xl border border-white/10 px-4 pt-4 pb-3 text-white flex flex-col select-none overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold tracking-widest text-white/90">PC CONSOLE OS</h2>
          <p className="text-[10px] text-white/40 mt-0.5">{activeSlide.label}</p>
        </div>
        <button
          onClick={() => window.electronAPI?.overlay.close()}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goPrev}
          className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          aria-label="Widget précédent"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex gap-1.5">
          {SLIDES.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === slideIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/25 hover:bg-white/40'
              }`}
              aria-label={slide.label}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          aria-label="Widget suivant"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden relative">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeSlide.id}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={onDragEnd}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0 flex flex-col"
          >
            {activeSlide.id === 'music' && (
              <MusicSlide
                track={track}
                running={media?.spotify.running}
                onControl={(action) => controlMutation.mutate(action)}
                isPending={controlMutation.isPending}
              />
            )}
            {activeSlide.id === 'discord' && (
              <DiscordSlide discord={discord} onOpen={() => api.openDiscord()} />
            )}
            {activeSlide.id === 'stats' && (
              <StatsSlide profile={profile} trophies={trophies} xpInfo={xpInfo} fps={60} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="text-[10px] text-white/35 text-center mt-2 pt-1 flex-shrink-0 leading-snug">
        Glissez ou ← → pour changer · Ctrl+Shift+G fermer
      </p>
    </div>
  )
}

function MusicSlide({
  track,
  running,
  onControl,
  isPending
}: {
  track?: { trackName?: string; artistName?: string; isPlaying?: boolean; albumArtUrl?: string }
  running?: boolean
  onControl: (action: 'play' | 'pause' | 'next' | 'previous') => void
  isPending: boolean
}): JSX.Element {
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex items-center gap-2 mb-2 flex-shrink-0">
        <Music size={18} className="text-[#1DB954]" />
        <span className="font-semibold text-sm">Spotify</span>
        {running && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1DB954]/20 text-[#1DB954] ml-auto">
            Actif
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center gap-2 overflow-y-auto">
        {track?.albumArtUrl ? (
          <img src={track.albumArtUrl} alt="" className="w-20 h-20 rounded-xl object-cover shadow-lg flex-shrink-0" />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-[#1DB954]/15 flex items-center justify-center flex-shrink-0">
            <Headphones size={32} className="text-[#1DB954]" />
          </div>
        )}

        {track?.trackName ? (
          <>
            <div className="min-w-0 w-full px-2">
              <p className="font-semibold truncate">{track.trackName}</p>
              <p className="text-sm text-white/50 truncate">{track.artistName}</p>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-shrink-0">
              <button
                onClick={() => onControl('previous')}
                disabled={isPending}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/15 disabled:opacity-50"
              >
                <SkipBack size={18} />
              </button>
              <button
                onClick={() => onControl(track.isPlaying ? 'pause' : 'play')}
                disabled={isPending}
                className="p-3.5 rounded-full bg-[#1DB954] text-black hover:bg-[#1ed760] disabled:opacity-50"
              >
                {track.isPlaying ? (
                  <Pause size={20} fill="currentColor" />
                ) : (
                  <Play size={20} fill="currentColor" className="ml-0.5" />
                )}
              </button>
              <button
                onClick={() => onControl('next')}
                disabled={isPending}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/15 disabled:opacity-50"
              >
                <SkipForward size={18} />
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-white/45 px-4">
            {running
              ? 'Lancez une lecture dans Spotify'
              : 'Ouvrez Spotify pour contrôler la musique'}
          </p>
        )}
      </div>

      <button
        onClick={() => api.openSpotify()}
        className="mt-2 flex-shrink-0 flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-white/70 border border-white/10"
      >
        <ExternalLink size={14} />
        Ouvrir Spotify
      </button>
    </div>
  )
}

function DiscordSlide({
  discord,
  onOpen
}: {
  discord?: {
    running?: boolean
    username?: string
    richPresenceConnected?: boolean
    currentGame?: string
  }
  onOpen: () => void
}): JSX.Element {
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex items-center gap-2 mb-2 flex-shrink-0">
        <DiscordIcon size={18} />
        <span className="font-semibold text-sm">Discord</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div
          className={`w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden ${
            discord?.running ? '' : 'opacity-40 grayscale'
          }`}
        >
          <DiscordIcon size={80} className="w-20 h-20" />
        </div>

        <div className="text-center">
          <p className="font-semibold">
            {discord?.running
              ? discord.username
                ? `Connecté — ${discord.username}`
                : 'Discord actif'
              : 'Discord fermé'}
          </p>
          <p className="text-sm text-white/45 mt-1 max-w-[260px]">
            {discord?.currentGame ??
              (discord?.running ? 'En ligne' : 'Ouvrez Discord pour chatter')}
          </p>
          {discord?.running && (
            <span className="inline-flex items-center gap-1.5 mt-3 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              En ligne
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onOpen}
        className="mt-2 flex-shrink-0 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-sm font-semibold"
      >
        <ExternalLink size={16} />
        {discord?.running ? 'Ouvrir Discord' : 'Lancer Discord'}
      </button>
    </div>
  )
}

function StatsSlide({
  profile,
  trophies,
  xpInfo,
  fps
}: {
  profile?: { level: number; totalPlayTimeMinutes: number; username: string }
  trophies?: { total: number; platinum: number; gold: number; silver: number; bronze: number }
  xpInfo?: { progress: number; current: number; needed: number }
  fps: number
}): JSX.Element {
  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto gap-2">
      <div className="flex items-center gap-2 mb-1 flex-shrink-0">
        <BarChart3 size={18} className="text-blue-400" />
        <span className="font-semibold text-sm">Statistiques</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
          <Zap size={16} className="text-green-400 mb-1" />
          <p className="text-2xl font-bold">{fps}</p>
          <p className="text-[10px] text-white/40">FPS</p>
        </div>
        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
          <Clock size={16} className="text-blue-400 mb-1" />
          <p className="text-2xl font-bold">
            {profile ? Math.floor(profile.totalPlayTimeMinutes / 60) : 0}h
          </p>
          <p className="text-[10px] text-white/40">Temps de jeu</p>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-white/5 border border-white/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-yellow-400" />
            <span className="text-sm font-medium">Trophées</span>
          </div>
          <span className="text-lg font-bold">{trophies?.total ?? 0}</span>
        </div>
        <div className="flex justify-between">
          {(['platinum', 'gold', 'silver', 'bronze'] as TrophyTier[]).map((tier) => (
            <div key={tier} className="flex flex-col items-center gap-0.5">
              <Trophy size={18} style={{ color: tierColors[tier] }} />
              <span className="text-sm font-semibold">{trophies?.[tier] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      {profile && xpInfo && (
        <div className="p-3 rounded-xl bg-white/5 border border-white/5 mt-auto">
          <div className="flex justify-between text-xs text-white/50 mb-1.5">
            <span>{profile.username}</span>
            <span>Niveau {profile.level}</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${xpInfo.progress}%` }}
            />
          </div>
          <p className="text-[10px] text-white/35 mt-1 text-right">
            {Math.round(xpInfo.progress)}% · {xpInfo.current}/{xpInfo.needed} XP
          </p>
        </div>
      )}
    </div>
  )
}
