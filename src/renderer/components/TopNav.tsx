import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Search, Settings, User, Music } from 'lucide-react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

export function TopNav(): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const [time, setTime] = useState(new Date())
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: api.getProfile })
  const { data: media } = useQuery({
    queryKey: ['media'],
    queryFn: api.getMediaStatus,
    refetchInterval: 8000
  })

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const isGames = location.pathname === '/' || location.pathname.startsWith('/game')
  const isLibrary =
    location.pathname === '/library' ||
    location.pathname.startsWith('/library/') ||
    location.pathname.startsWith('/library/epic')
  const isStore = location.pathname === '/store'
  const nowPlaying = media?.spotify.nowPlaying

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-8 pt-3 pb-2">
      <div className="flex items-center justify-between drag-region">
        <nav className="flex items-center gap-8 no-drag">
          <NavLink to="/" className="relative">
            <span
              className={`text-lg font-semibold transition-opacity ${
                isGames ? 'text-white opacity-100' : 'text-white/50 hover:text-white/80'
              }`}
            >
              Jeux
            </span>
            {isGames && (
              <motion.div
                layoutId="nav-tab"
                className="absolute -bottom-1 left-0 right-0 h-0.5 bg-white rounded-full"
              />
            )}
          </NavLink>
          <NavLink to="/library" className="relative">
            <span
              className={`text-lg font-semibold transition-opacity ${
                isLibrary ? 'text-white opacity-100' : 'text-white/50 hover:text-white/80'
              }`}
            >
              Bibliothèque
            </span>
            {isLibrary && (
              <motion.div
                layoutId="nav-tab"
                className="absolute -bottom-1 left-0 right-0 h-0.5 bg-white rounded-full"
              />
            )}
          </NavLink>
          <NavLink to="/store" className="relative">
            <span
              className={`text-lg font-semibold transition-opacity ${
                isStore ? 'text-white opacity-100' : 'text-white/50 hover:text-white/80'
              }`}
            >
              Boutique
            </span>
            {isStore && (
              <motion.div
                layoutId="nav-tab"
                className="absolute -bottom-1 left-0 right-0 h-0.5 bg-white rounded-full"
              />
            )}
          </NavLink>
          <NavLink to="/trophies" className="relative">
            <span
              className={`text-lg font-semibold transition-opacity ${
                location.pathname === '/trophies' ? 'text-white opacity-100' : 'text-white/50 hover:text-white/80'
              }`}
            >
              Trophées
            </span>
            {location.pathname === '/trophies' && (
              <motion.div
                layoutId="nav-tab"
                className="absolute -bottom-1 left-0 right-0 h-0.5 bg-white rounded-full"
              />
            )}
          </NavLink>
        </nav>

        <div className="flex items-center gap-5 no-drag">
          {nowPlaying?.isPlaying && nowPlaying.trackName && (
            <button
              onClick={() => navigate('/')}
              className="hidden lg:flex items-center gap-2 max-w-[220px] px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              title={`${nowPlaying.trackName} — ${nowPlaying.artistName}`}
            >
              {nowPlaying.albumArtUrl ? (
                <img src={nowPlaying.albumArtUrl} alt="" className="w-6 h-6 rounded object-cover" />
              ) : (
                <Music size={14} className="text-[#1DB954]" />
              )}
              <span className="text-xs text-white/80 truncate">{nowPlaying.trackName}</span>
            </button>
          )}
          <button
            onClick={() => navigate('/store')}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/80 hover:text-white"
            title="Boutique"
          >
            <Search size={20} />
          </button>
          <NavLink
            to="/settings"
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/80 hover:text-white"
          >
            <Settings size={20} />
          </NavLink>
          <NavLink
            to="/profile"
            className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors overflow-hidden"
          >
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <User size={18} className="text-white/80" />
            )}
          </NavLink>
          <span className="text-sm text-white/70 font-medium tabular-nums min-w-[70px] text-right">
            {time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      <style>{`
        .drag-region { -webkit-app-region: drag; }
        .no-drag { -webkit-app-region: no-drag; }
      `}</style>
    </header>
  )
}
