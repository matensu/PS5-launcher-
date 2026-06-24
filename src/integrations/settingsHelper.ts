import { getDatabase } from '../database'
import type { Settings } from '../shared/types'

const SETTINGS_DEFAULTS: Settings = {
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

export function getAppSettings(): Settings {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM settings').all() as { key: string; value: string }[]
  const settings: Partial<Settings> = {}
  for (const row of rows) {
    settings[row.key as keyof Settings] = JSON.parse(row.value)
  }
  return { ...SETTINGS_DEFAULTS, ...settings }
}
