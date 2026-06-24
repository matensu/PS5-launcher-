import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Music,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  ExternalLink,
  Headphones
} from 'lucide-react'
import { api } from '../services/api'
import { DiscordIcon } from './DiscordIcon'

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } }
}

function formatMs(ms?: number): string {
  if (!ms) return '0:00'
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function MediaWidgets(): JSX.Element {
  const queryClient = useQueryClient()
  const { data: media } = useQuery({
    queryKey: ['media'],
    queryFn: api.getMediaStatus,
    refetchInterval: 3000
  })

  const controlMutation = useMutation({
    mutationFn: api.spotifyControl,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    }
  })

  const spotify = media?.spotify
  const discord = media?.discord
  const track = spotify?.nowPlaying
  const progress =
    track?.durationMs && track.progressMs
      ? Math.min((track.progressMs / track.durationMs) * 100, 100)
      : 0

  return (
    <>
      <motion.div variants={item} className="col-span-6 widget-card overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Music size={18} className="text-[#1DB954]" />
            <h3 className="text-white font-semibold">Spotify</h3>
          </div>
          <div className="flex items-center gap-2">
            {spotify?.source === 'desktop' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 font-medium">
                App de bureau
              </span>
            )}
            {spotify?.running && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1DB954]/20 text-[#1DB954] font-medium">
                Actif
              </span>
            )}
            <button
              onClick={() => api.openSpotify()}
              className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              title="Ouvrir Spotify"
            >
              <ExternalLink size={14} />
            </button>
          </div>
        </div>

        {track?.connected && track.trackName ? (
          <div className="flex gap-4">
            {track.albumArtUrl ? (
              <img
                src={track.albumArtUrl}
                alt=""
                className="w-20 h-20 rounded-xl object-cover shadow-lg flex-shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-[#1DB954]/20 flex items-center justify-center flex-shrink-0">
                <Headphones size={28} className="text-[#1DB954]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold truncate">{track.trackName}</p>
              <p className="text-white/50 text-sm truncate">{track.artistName}</p>
              <p className="text-white/30 text-xs truncate mt-0.5">{track.albumName}</p>

              {track.durationMs ? (
                <div className="mt-3">
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1DB954] rounded-full transition-all duration-1000"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-white/30 mt-1 tabular-nums">
                    <span>{formatMs(track.progressMs)}</span>
                    <span>{formatMs(track.durationMs)}</span>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => controlMutation.mutate('previous')}
                  className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                >
                  <SkipBack size={16} />
                </button>
                <button
                  onClick={() => controlMutation.mutate(track.isPlaying ? 'pause' : 'play')}
                  className="p-2.5 rounded-full bg-[#1DB954] text-black hover:bg-[#1ed760] transition-colors"
                >
                  {track.isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                </button>
                <button
                  onClick={() => controlMutation.mutate('next')}
                  className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                >
                  <SkipForward size={16} />
                </button>
              </div>
            </div>
          </div>
        ) : track?.connected || spotify?.running ? (
          <div className="flex items-center gap-3 text-white/50 text-sm">
            <Headphones size={20} className="text-white/30" />
            <p>Spotify ouvert — lancez une lecture dans l&apos;application</p>
          </div>
        ) : (
          <div className="text-white/50 text-sm">
            <p>Ouvrez l&apos;application Spotify sur votre PC pour afficher et contrôler la musique automatiquement.</p>
          </div>
        )}
      </motion.div>

      <motion.div variants={item} className="col-span-6 widget-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DiscordIcon size={18} />
            <h3 className="text-white font-semibold">Discord</h3>
          </div>
          <button
            onClick={() => api.openDiscord()}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            title="Ouvrir Discord"
          >
            <ExternalLink size={14} />
          </button>
        </div>

        <div className="flex items-start gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden ${
              discord?.running ? '' : 'opacity-40 grayscale'
            }`}
          >
            <DiscordIcon size={56} className="w-14 h-14" />
          </div>
          <div className="flex-1">
            <p className="text-white font-medium">
              {discord?.running
                ? discord.username
                  ? `Connecté — ${discord.username}`
                  : 'Discord est actif'
                : 'Discord non lancé'}
            </p>
            <p className="text-white/45 text-sm mt-1 leading-relaxed">
              {discord?.richPresenceConnected
                ? `Connexion bureau active${discord.currentGame ? ` — ${discord.currentGame}` : ''}`
                : discord?.running
                  ? 'Client de bureau détecté — lancez un jeu pour le statut « en jeu » (optionnel : Application ID dans les paramètres)'
                  : 'Ouvrez Discord pour discuter avec vos amis en jouant'}
            </p>
            {discord?.running && (
              <span className="inline-flex items-center gap-1.5 mt-3 text-xs text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                En ligne
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </>
  )
}
