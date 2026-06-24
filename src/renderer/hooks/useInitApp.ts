import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { applyTheme } from '../themes'
import { useAppStore } from '../stores/appStore'
import type { Settings } from '@shared/types'

const defaultSettings: Settings = {
  theme: 'ps5',
  soundEnabled: true,
  consoleMode: false,
  autoLaunch: false,
  fullscreen: true,
  overlayShortcut: 'CommandOrControl+Shift+G',
  steamToolsEnabled: true,
  discordEnabled: true,
  discordRichPresence: true,
  discordAppId: '',
  spotifyEnabled: true,
  spotifyClientId: '',
  showMediaInOverlay: true
}

export function useInitApp(): { isReady: boolean } {
  const setSettings = useAppStore((s) => s.setSettings)

  useEffect(() => {
    applyTheme('ps5')
    setSettings(defaultSettings)
  }, [setSettings])

  const { data: settings, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    retry: 5,
    retryDelay: 1000
  })

  useEffect(() => {
    if (!settings) return

    const merged = { ...defaultSettings, ...settings } as Settings
    setSettings(merged)
    applyTheme(merged.theme ?? 'ps5')

    if (merged.consoleMode && window.electronAPI) {
      window.electronAPI.console.setMode(true)
    }
  }, [settings, setSettings])

  useEffect(() => {
    if (isError) {
      console.warn('[PC Console OS] API indisponible, utilisation des paramètres par défaut')
    }
  }, [isError])

  return { isReady: true }
}
