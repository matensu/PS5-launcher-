export const API_BASE = 'http://127.0.0.1:3847/api'

export interface SteamInstallStatus {
  appId: string
  phase: 'unavailable' | 'starting' | 'queued' | 'downloading' | 'installing' | 'complete' | 'error'
  progress: number
  bytesDownloaded: number
  bytesTotal: number
  gameName?: string
  installPath?: string
  message?: string
}

export interface EpicInstallStatus {
  appName: string
  phase: 'unavailable' | 'starting' | 'downloading' | 'complete' | 'error'
  progress: number
  gameName?: string
  installPath?: string
  message?: string
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error ?? 'Request failed')
  }
  return res.json() as Promise<T>
}

export const api = {
  getProfile: () => request<import('@shared/types').Profile>('/profile'),
  updateProfile: (data: { username?: string; avatarUrl?: string }) =>
    request<import('@shared/types').Profile>('/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  getGames: (opts?: { installedOnly?: boolean }) =>
    request<import('@shared/types').Game[]>(
      opts?.installedOnly ? '/games?installed=true' : '/games'
    ),

  getSteamLibrary: () =>
    request<{
      games: import('@shared/types').SteamLibraryGame[]
      stats: { total: number; installed: number; notInstalled: number; steamTools: number }
      steamTools: {
        enabled: boolean
        available: boolean
        pluginCount: number
        gameCount: number
        steamToolsRunning: boolean
      }
    }>('/steam/library'),
  getSteamToolsStatus: () =>
    request<{
      enabled: boolean
      available: boolean
      steamRoot: string | null
      pluginPath: string | null
      depotCachePath: string | null
      pluginCount: number
      gameCount: number
      steamToolsRunning: boolean
    }>('/steam/steamtools/status'),
  importSteamTools: (paths: string[]) =>
    request<{
      imported: Array<{ type: 'lua' | 'manifest'; fileName: string; appId?: string }>
      errors: string[]
    }>('/steam/steamtools/import', { method: 'POST', body: JSON.stringify({ paths }) }),
  addSteamToolsApp: (appId: string) =>
    request<{ success: boolean; filePath?: string }>('/steam/steamtools/add', {
      method: 'POST',
      body: JSON.stringify({ appId })
    }),
  getSteamGame: (appId: string) =>
    request<import('@shared/types').SteamGameDetails>(`/steam/library/${appId}`),
  getSteamAchievements: (appId: string) =>
    request<{
      achievements: import('@shared/types').SteamAchievementDetail[]
      unlocked: number
      total: number
    }>(`/steam/library/${appId}/achievements`),
  syncSteamAchievements: (appId: string, gameName?: string) =>
    request<{
      achievements: import('@shared/types').SteamAchievementDetail[]
      unlocked: number
      total: number
    }>(`/steam/library/${appId}/achievements/sync`, {
      method: 'POST',
      body: JSON.stringify({ gameName })
    }),
  syncSteamLibrary: () =>
    request<{
      synced: number
      installed: number
      total: number
      achievementSync: { synced: number; games: number }
    }>('/steam/library/sync', { method: 'POST' }),
  installSteamGame: (appId: string) =>
    request<{ success: boolean; status: SteamInstallStatus }>(`/steam/library/${appId}/install`, {
      method: 'POST'
    }),
  getSteamInstallStatus: (appId: string) =>
    request<SteamInstallStatus>(`/steam/library/${appId}/install/status`),

  getEpicLibrary: () =>
    request<{
      games: import('@shared/types').EpicLibraryGame[]
      stats: { total: number; installed: number; notInstalled: number }
      launcher?: {
        installed: boolean
        manifestsExist: boolean
        launcherExe?: string
      }
    }>('/epic/library'),
  syncEpicLibrary: () =>
    request<{ synced: number; installed: number; total: number }>('/epic/library/sync', { method: 'POST' }),
  getEpicGame: (appName: string) =>
    request<import('@shared/types').EpicLibraryGame & { gameId?: string }>(
      `/epic/library/${encodeURIComponent(appName)}`
    ),
  launchEpicGame: (appName: string) =>
    request<{ success: boolean }>(`/epic/library/${encodeURIComponent(appName)}/launch`, { method: 'POST' }),
  installEpicGame: (appName: string) =>
    request<{ success: boolean; status: EpicInstallStatus }>(
      `/epic/library/${encodeURIComponent(appName)}/install`,
      { method: 'POST' }
    ),
  getEpicInstallStatus: (appName: string) =>
    request<EpicInstallStatus>(`/epic/library/${encodeURIComponent(appName)}/install/status`),

  searchStore: (query: string, platform: 'all' | 'steam' | 'epic' = 'all') =>
    request<{ games: import('@shared/types').StoreGameItem[]; query?: string }>(
      `/store/search?q=${encodeURIComponent(query)}&platform=${platform}`
    ),
  openStorePurchase: (item: import('@shared/types').StoreGameItem) =>
    request<{ success: boolean }>('/store/open', { method: 'POST', body: JSON.stringify(item) }),
  syncGames: () =>
    request<{ games: import('@shared/types').Game[]; achievementSync: { synced: number; games: number } }>(
      '/games/sync',
      { method: 'POST' }
    ),
  getGame: (id: string) => request<import('@shared/types').Game>(`/games/${id}`),
  addGame: (data: Record<string, unknown>) =>
    request<import('@shared/types').Game>('/games', { method: 'POST', body: JSON.stringify(data) }),
  launchGame: (id: string) => request<{ success: boolean }>(`/games/${id}/launch`, { method: 'POST' }),

  getTrophies: () => request<import('@shared/types').Trophy[]>('/trophies'),
  getTrophyStats: () =>
    request<{ bronze: number; silver: number; gold: number; platinum: number; total: number }>('/trophies/stats'),
  getGameTrophies: (gameId: string) => request<import('@shared/types').Trophy[]>(`/games/${gameId}/trophies`),
  syncGameTrophies: (gameId: string) =>
    request<import('@shared/types').Trophy[]>(`/games/${gameId}/trophies/sync`, { method: 'POST' }),
  syncAllSteamTrophies: () =>
    request<{ synced: number; games: number }>('/trophies/sync-steam', { method: 'POST' }),
  getTrophiesGrouped: () =>
    request<
      Array<{
        gameId: string
        gameName: string
        gameCover?: string
        gameBanner?: string
        platform: string
        appId?: string
        unlocked: number
        total: number
        trophies: import('@shared/types').Trophy[]
      }>
    >('/trophies/grouped'),

  getChallenges: () => request<import('@shared/types').DailyChallenge[]>('/challenges'),
  updateChallengeProgress: (id: string, amount: number) =>
    request<import('@shared/types').DailyChallenge>(`/challenges/${id}/progress`, {
      method: 'PATCH',
      body: JSON.stringify({ amount })
    }),

  getSettings: () => request<import('@shared/types').Settings>('/settings'),
  updateSettings: (data: Partial<import('@shared/types').Settings>) =>
    request<import('@shared/types').Settings>('/settings', { method: 'PATCH', body: JSON.stringify(data) }),

  getStats: () =>
    request<{
      profile: import('@shared/types').Profile
      trophies: { bronze: number; silver: number; gold: number; platinum: number; total: number }
      recentGames: import('@shared/types').Game[]
      media?: import('@shared/types').MediaStatus
    }>('/stats'),

  getMediaStatus: () => request<import('@shared/types').MediaStatus>('/integrations/media'),
  getSpotifyStatus: () => request<import('@shared/types').SpotifyStatus>('/spotify/status'),
  startSpotifyAuth: () => request<{ url: string }>('/spotify/auth'),
  disconnectSpotify: () => request<{ success: boolean }>('/spotify/disconnect', { method: 'POST' }),
  spotifyControl: (action: 'play' | 'pause' | 'next' | 'previous') =>
    request<{ success: boolean }>('/spotify/control', {
      method: 'POST',
      body: JSON.stringify({ action })
    }),
  openSpotify: () => request<{ success: boolean }>('/spotify/open', { method: 'POST' }),
  getDiscordStatus: () => request<import('@shared/types').DiscordStatus>('/discord/status'),
  openDiscord: () => request<{ success: boolean }>('/discord/open', { method: 'POST' })
}
