export type GamePlatform =
  | 'steam'
  | 'epic'
  | 'gog'
  | 'ubisoft'
  | 'battlenet'
  | 'manual'

export type TrophyTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface Game {
  id: string
  name: string
  platform: GamePlatform
  appId?: string
  installPath?: string
  coverUrl?: string
  bannerUrl?: string
  description?: string
  playTimeMinutes: number
  lastPlayed?: string
  addedAt: string
}

export interface SteamLibraryGame {
  appId: string
  name: string
  installed: boolean
  installPath?: string
  playTimeMinutes: number
  lastPlayed?: string
  coverUrl: string
  bannerUrl: string
  steamTools?: boolean
  hasPlugin?: boolean
  hasManifest?: boolean
}

export interface SteamGameDetails extends SteamLibraryGame {
  gameId?: string
  shortDescription?: string
  detailedDescription?: string
  headerImage?: string
  screenshots: string[]
  developers: string[]
  publishers: string[]
  releaseDate?: string
  genres: string[]
  metacriticScore?: number
}

export interface SteamAchievementDetail {
  steamAchievementId: string
  name: string
  description: string
  tier: TrophyTier
  icon?: string
  unlocked: boolean
  unlockedAt?: string
  rarityPercent?: number
}

export interface EpicLibraryGame {
  appName: string
  name: string
  installed: boolean
  installPath?: string
  coverUrl?: string
  bannerUrl?: string
  catalogNamespace?: string
  catalogItemId?: string
  productSlug?: string
}

export interface StoreGameItem {
  id: string
  name: string
  platform: 'steam' | 'epic'
  coverUrl?: string
  price?: string
  originalPrice?: string
  discountLabel?: string
  productSlug?: string
  appId?: string
  isFree?: boolean
}

export interface Trophy {
  id: string
  gameId?: string
  name: string
  description: string
  tier: TrophyTier
  icon?: string
  unlocked: boolean
  unlockedAt?: string
  isCustom: boolean
  steamAchievementId?: string
}

export interface Profile {
  id: string
  username: string
  avatarUrl?: string
  level: number
  xp: number
  totalPlayTimeMinutes: number
  gamesOwned: number
  trophiesUnlocked: number
  createdAt: string
}

export interface DailyChallenge {
  id: string
  title: string
  description: string
  target: number
  progress: number
  xpReward: number
  completed: boolean
  expiresAt: string
}

export interface AchievementNotification {
  id: string
  trophyId: string
  trophyName: string
  tier: TrophyTier
  gameName?: string
  timestamp: string
}

export interface ThemeId {
  id: 'ps5' | 'xbox' | 'nintendo' | 'cyberpunk' | 'minimal'
}

export interface Settings {
  theme: ThemeId['id']
  soundEnabled: boolean
  consoleMode: boolean
  autoLaunch: boolean
  fullscreen: boolean
  overlayShortcut: string
  steamToolsEnabled: boolean
  discordEnabled: boolean
  discordRichPresence: boolean
  discordAppId: string
  spotifyEnabled: boolean
  spotifyClientId: string
  showMediaInOverlay: boolean
}

export interface SpotifyNowPlaying {
  connected: boolean
  isPlaying: boolean
  trackName?: string
  artistName?: string
  albumName?: string
  albumArtUrl?: string
  progressMs?: number
  durationMs?: number
  deviceName?: string
}

export interface DiscordStatus {
  running: boolean
  richPresenceConnected: boolean
  desktopConnected: boolean
  username?: string
  currentGame?: string
}

export interface SpotifyStatus {
  connected: boolean
  running: boolean
  source: 'desktop' | 'api' | 'none'
  nowPlaying: SpotifyNowPlaying
}

export interface MediaStatus {
  spotify: SpotifyStatus
  discord: DiscordStatus
}

export interface CloudUser {
  id: string
  email: string
  username: string
}

export const XP_PER_LEVEL = 1000
export const XP_PER_HOUR = 50
export const XP_PER_ACHIEVEMENT = 25
export const XP_PER_TROPHY: Record<TrophyTier, number> = {
  bronze: 15,
  silver: 30,
  gold: 60,
  platinum: 150
}

export function calculateLevel(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1
}

export function xpForNextLevel(xp: number): { current: number; needed: number; progress: number } {
  const level = calculateLevel(xp)
  const levelStart = (level - 1) * XP_PER_LEVEL
  const current = xp - levelStart
  return { current, needed: XP_PER_LEVEL, progress: (current / XP_PER_LEVEL) * 100 }
}
