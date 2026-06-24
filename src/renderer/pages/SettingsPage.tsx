import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Monitor, Volume2, Rocket, Maximize, Palette, Puzzle, Music } from 'lucide-react'
import { DiscordIcon } from '../components/DiscordIcon'
import { api } from '../services/api'
import { themes, applyTheme } from '../themes'
import { useAppStore } from '../stores/appStore'
import { CinematicBackground } from '../components/CinematicBackground'
import type { Settings } from '@shared/types'

export function SettingsPage(): JSX.Element {
  const queryClient = useQueryClient()
  const setSettings = useAppStore((s) => s.setSettings)

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings
  })

  const { data: spotifyStatus } = useQuery({
    queryKey: ['spotify-status'],
    queryFn: api.getSpotifyStatus,
    refetchInterval: 10_000
  })

  const updateMutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setSettings(data as Settings)
      if (data.theme) applyTheme(data.theme)
    }
  })

  const toggle = (key: keyof Settings, value: boolean) => {
    updateMutation.mutate({ [key]: value })

    if (key === 'steamToolsEnabled') {
      queryClient.invalidateQueries({ queryKey: ['steam-library'] })
    }

    if (key === 'consoleMode' && window.electronAPI) {
      window.electronAPI.console.setMode(value)
    }
    if (key === 'fullscreen' && window.electronAPI) {
      if (value) window.electronAPI.window.toggleFullscreen()
    }
  }

  const selectTheme = (themeId: Settings['theme']) => {
    updateMutation.mutate({ theme: themeId })
    applyTheme(themeId)
  }

  const updateField = (key: keyof Settings, value: string | boolean) => {
    updateMutation.mutate({ [key]: value })
  }

  const connectSpotify = async () => {
    try {
      const { url } = await api.startSpotifyAuth()
      await window.electronAPI?.app.openExternal(url)
    } catch (err) {
      console.error(err)
    }
  }

  const disconnectSpotify = useMutation({
    mutationFn: api.disconnectSpotify,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spotify-status'] })
      queryClient.invalidateQueries({ queryKey: ['media'] })
    }
  })

  return (
    <div className="relative h-full overflow-y-auto">
      <CinematicBackground showParticles />

      <div className="relative z-10 w-full px-10 py-8">
        <motion.h1
          className="text-3xl font-light text-white mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Paramètres
        </motion.h1>

        <div className="grid grid-cols-2 gap-6">
          <motion.section
            className="widget-card col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
              <Palette size={20} />
              Thème
            </h2>
            <div className="grid grid-cols-5 gap-4">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => selectTheme(theme.id)}
                  className={`rounded-xl p-5 text-center transition-all border ${
                    settings?.theme === theme.id
                      ? 'ring-2 ring-white border-white/30 bg-white/10'
                      : 'border-white/10 hover:bg-white/5'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-full mx-auto mb-3 shadow-lg"
                    style={{ background: theme.colors.accent }}
                  />
                  <p className="text-sm text-white font-medium">{theme.name}</p>
                </button>
              ))}
            </div>
          </motion.section>

          <motion.section
            className="widget-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-lg font-semibold text-white mb-4">Général</h2>
            <div className="space-y-1">
              <SettingToggle
                icon={<Volume2 size={20} />}
                label="Sons UI"
                description="Effets sonores de l'interface"
                checked={settings?.soundEnabled ?? true}
                onChange={(v) => toggle('soundEnabled', v)}
              />
              <SettingToggle
                icon={<Maximize size={20} />}
                label="Plein écran"
                description="Lancer en mode plein écran"
                checked={settings?.fullscreen ?? true}
                onChange={(v) => toggle('fullscreen', v)}
              />
              <SettingToggle
                icon={<Rocket size={20} />}
                label="Lancement automatique"
                description="Démarrer avec le système"
                checked={settings?.autoLaunch ?? false}
                onChange={(v) => toggle('autoLaunch', v)}
              />
            </div>
          </motion.section>

          <motion.section
            className="widget-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Puzzle size={20} />
              SteamTools
            </h2>
            <p className="text-white/40 text-sm mb-5 leading-relaxed">
              Détecte les jeux ajoutés via SteamTools (plugins .lua dans{' '}
              <code className="text-white/50">config/stplug-in</code>) et permet d&apos;importer des
              manifests depuis la bibliothèque.
            </p>
            <SettingToggle
              icon={<Puzzle size={20} />}
              label="Compatibilité SteamTools"
              description="Inclure les jeux des plugins stplug-in"
              checked={settings?.steamToolsEnabled ?? true}
              onChange={(v) => toggle('steamToolsEnabled', v)}
            />
          </motion.section>

          <motion.section
            className="widget-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Monitor size={20} />
              Mode Console
            </h2>
            <p className="text-white/40 text-sm mb-5 leading-relaxed">
              Transforme votre PC en console de salon : plein écran, interface masquée, expérience immersive.
              Compatible Windows 11, Arch Linux, Hyprland, KDE Plasma et GNOME.
            </p>
            <SettingToggle
              icon={<Monitor size={20} />}
              label="Activer le mode Console"
              description="Expérience console au démarrage"
              checked={settings?.consoleMode ?? false}
              onChange={(v) => toggle('consoleMode', v)}
            />
            <SettingToggle
              icon={<Monitor size={20} />}
              label="Médias dans l'overlay"
              description="Carrousel Spotify, Discord et stats (Ctrl+Shift+G, flèches ← →)"
              checked={settings?.showMediaInOverlay ?? true}
              onChange={(v) => toggle('showMediaInOverlay', v)}
            />
            <p className="text-xs text-white/30 mt-4">
              Raccourci overlay : Ctrl + Shift + G · Manette : bouton central (Guide/PS) ou Start/Options
            </p>
          </motion.section>

          <motion.section
            className="widget-card col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
          >
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Music size={20} className="text-[#1DB954]" />
              Spotify
            </h2>
            <p className="text-white/40 text-sm mb-4 leading-relaxed">
              Détection automatique de l&apos;application Spotify de bureau sur Windows (aucune connexion requise).
              Lancez Spotify et jouez une piste — les contrôles apparaissent sur l&apos;accueil.
            </p>
            <SettingToggle
              icon={<Music size={20} />}
              label="Intégration Spotify"
              description="Widget et contrôles sur l'accueil"
              checked={settings?.spotifyEnabled ?? true}
              onChange={(v) => toggle('spotifyEnabled', v)}
            />
            <details className="mt-4 pt-4 border-t border-white/5">
              <summary className="text-sm text-white/50 cursor-pointer hover:text-white/70">
                Connexion API avancée (optionnel)
              </summary>
              <p className="text-white/35 text-xs mt-3 mb-3 leading-relaxed">
                Uniquement si la détection bureau ne suffit pas (pochette HD, autre appareil). Client ID sur{' '}
                <button
                  type="button"
                  onClick={() => void window.electronAPI?.app.openExternal('https://developer.spotify.com/dashboard')}
                  className="text-[#1DB954] hover:underline"
                >
                  developer.spotify.com
                </button>
                , redirect : <code className="text-white/45">http://127.0.0.1:3848/callback/spotify</code>
              </p>
              <input
                defaultValue={settings?.spotifyClientId ?? ''}
                onBlur={(e) => updateField('spotifyClientId', e.target.value)}
                placeholder="Client ID (optionnel)"
                className="w-full px-4 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#1DB954]/50"
              />
              <div className="flex items-center gap-3 mt-3">
                {spotifyStatus?.source === 'api' && spotifyStatus.connected ? (
                  <>
                    <span className="text-sm text-[#1DB954]">API connectée</span>
                    <button
                      onClick={() => disconnectSpotify.mutate()}
                      className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm border border-white/10"
                    >
                      Déconnecter
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => void connectSpotify()}
                    disabled={!settings?.spotifyClientId?.trim()}
                    className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm border border-white/10 disabled:opacity-40"
                  >
                    Connecter via API
                  </button>
                )}
              </div>
            </details>
          </motion.section>

          <motion.section
            className="widget-card col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <DiscordIcon size={22} />
              Discord
            </h2>
            <p className="text-white/40 text-sm mb-4 leading-relaxed">
              Connexion directe au client Discord de bureau (IPC local). Détection automatique quand Discord est ouvert.
              Pour le statut « Joue à… », ajoutez un Application ID (optionnel) depuis{' '}
              <button
                type="button"
                onClick={() => void window.electronAPI?.app.openExternal('https://discord.com/developers/applications')}
                className="text-[#5865F2] hover:underline"
              >
                discord.com/developers
              </button>
              .
            </p>
            <SettingToggle
              icon={<DiscordIcon size={20} />}
              label="Intégration Discord"
              description="Détection et ouverture rapide"
              checked={settings?.discordEnabled ?? true}
              onChange={(v) => toggle('discordEnabled', v)}
            />
            <SettingToggle
              icon={<DiscordIcon size={20} />}
              label="Rich Presence"
              description="Statut « en jeu » automatique"
              checked={settings?.discordRichPresence ?? true}
              onChange={(v) => toggle('discordRichPresence', v)}
            />
            <div className="py-4">
              <label className="text-sm text-white/60 block mb-2">Application ID (optionnel — Rich Presence)</label>
              <input
                defaultValue={settings?.discordAppId ?? ''}
                onBlur={(e) => updateField('discordAppId', e.target.value)}
                placeholder="123456789012345678"
                className="w-full px-4 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#5865F2]/50"
              />
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  )
}

function SettingToggle({
  icon,
  label,
  description,
  checked,
  onChange
}: {
  icon: React.ReactNode
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}): JSX.Element {
  return (
    <div className="flex items-center justify-between py-4 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-4">
        <div className="text-white/50">{icon}</div>
        <div>
          <p className="font-medium text-white">{label}</p>
          <p className="text-sm text-white/40">{description}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${
          checked ? 'bg-console-accent' : 'bg-white/20'
        }`}
        role="switch"
        aria-checked={checked}
      >
        <div
          className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
