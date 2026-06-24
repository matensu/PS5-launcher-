import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import { v4 as uuid } from 'uuid'
import {
  getDatabase,
  rowToGame,
  rowToProfile,
  rowToTrophy,
  rowToChallenge,
  addXp,
  unlockTrophy
} from '../database'
import { syncDetectedGames, launchGame } from '../launcher/gameDetector'
import { getRunningGame, stopRunningGame } from '../launcher/runningGame'
import {
  getSteamLibrary,
  enrichSteamLibraryNames,
  enrichSteamLibraryNamesWithTimeout,
  buildSteamLibraryResponse,
  syncSteamLibraryToDatabase,
  installSteamGame,
  isSteamAvailable,
  getSteamGameByAppId
} from '../launcher/steamLibrary'
import {
  getSteamToolsStatus,
  importSteamToolsFiles,
  addSteamToolsAppId,
  removeSteamToolsPlugin
} from '../launcher/steamTools'
import {
  getEpicLibrary,
  syncEpicLibraryToDatabase,
  isEpicAvailable,
  getEpicGameByAppName,
  launchEpicGameByAppName,
  installEpicGameByAppName,
  getEpicLauncherInfo
} from '../launcher/epicLibrary'
import { getSteamInstallStatus } from '../launcher/steamInstall'
import { enrichEpicLibraryImages, enrichEpicLibraryImagesWithTimeout } from '../launcher/epicMetadata'
import { getEpicInstallStatus } from '../launcher/epicInstall'
import { searchStore, openStorePurchase } from '../launcher/gameStore'
import {
  syncSteamAchievements,
  syncAllSteamAchievements,
  getAllTrophies,
  getTrophiesForGame,
  getTrophiesGroupedByGame,
  getTrophyStats,
  buildSteamAchievementList,
  syncSteamAchievementsByAppId
} from '../achievements/trophyService'
import { addGameSchema, updateProfileSchema, settingsSchema, launchGameSchema } from '../shared/validation'
import type { Settings } from '../shared/types'
import { XP_PER_TROPHY } from '../shared/types'
import { getAppSettings } from '../integrations/settingsHelper'
import {
  invalidateAllLibraryCaches,
  invalidateSteamCaches,
  invalidateEpicCaches,
  steamLibraryCache,
  epicLibraryCache,
  gamesListCache,
  steamGameCache,
  epicGameCache,
  storeSearchCache,
  statsCache
} from './libraryCache'
import {
  getDiscordStatus,
  openDiscord,
  ensureDiscordDesktopConnection
} from '../integrations/discord'
import {
  createSpotifyAuthRequest,
  disconnectSpotify,
  getSpotifyStatus,
  isSpotifyConnected,
  isSpotifyRunning,
  openSpotify,
  spotifyPlaybackControl
} from '../integrations/spotify'

export function createApiServer(port = 3847): ReturnType<typeof express> {
  const app = express()
  app.use(
    cors({
      origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'file://'
      ]
    })
  )
  app.use(express.json({ limit: '1mb' }))

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: err.message })
  })

  // Profile
  app.get('/api/profile', (_req, res) => {
    const db = getDatabase()
    const profile = db.prepare('SELECT * FROM profile LIMIT 1').get()
    res.json(rowToProfile(profile as Record<string, unknown>))
  })

  app.patch('/api/profile', (req, res) => {
    const parsed = updateProfileSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const db = getDatabase()
    const profile = db.prepare('SELECT * FROM profile LIMIT 1').get() as Record<string, unknown>

    if (parsed.data.username) {
      db.prepare('UPDATE profile SET username = ? WHERE id = ?').run(parsed.data.username, profile.id)
    }
    if (parsed.data.avatarUrl !== undefined) {
      db.prepare('UPDATE profile SET avatar_url = ? WHERE id = ?').run(parsed.data.avatarUrl || null, profile.id)
    }

    const updated = db.prepare('SELECT * FROM profile WHERE id = ?').get(profile.id)
    res.json(rowToProfile(updated as Record<string, unknown>))
  })

  // Steam library
  app.get('/api/steam/library', async (_req, res) => {
    try {
      if (!isSteamAvailable()) {
        return res.status(404).json({ error: 'Steam non détecté sur ce PC' })
      }
      const payload = await steamLibraryCache.getOrSetAsync('full', async () => {
        const library = getSteamLibrary()
        const enriched = await enrichSteamLibraryNamesWithTimeout(library, 1500)
        return buildSteamLibraryResponse(enriched)
      })
      res.json(payload)

      void enrichSteamLibraryNames(getSteamLibrary()).then((enriched) => {
        steamLibraryCache.set('full', buildSteamLibraryResponse(enriched), 300_000)
      })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.get('/api/steam/steamtools/status', (_req, res) => {
    res.json(getSteamToolsStatus())
  })

  app.post('/api/steam/steamtools/import', (req, res) => {
    const paths = (req.body as { paths?: string[] }).paths
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: 'Chemins de fichiers requis' })
    }
    const result = importSteamToolsFiles(paths)
    res.json(result)
  })

  app.post('/api/steam/steamtools/add', (req, res) => {
    const appId = String((req.body as { appId?: string | number }).appId ?? '')
    const result = addSteamToolsAppId(appId)
    if (!result.success) return res.status(400).json({ error: result.error })
    res.json(result)
  })

  app.delete('/api/steam/steamtools/:appId', (req, res) => {
    res.json(removeSteamToolsPlugin(req.params.appId))
  })

  app.get('/api/steam/library/:appId', async (req, res) => {
    if (!isSteamAvailable()) {
      return res.status(404).json({ error: 'Steam non détecté sur ce PC' })
    }
    const cacheKey = `game:${req.params.appId}`
    const game = await steamGameCache.getOrSetAsync(cacheKey, () =>
      getSteamGameByAppId(req.params.appId)
    )
    if (!game) return res.status(404).json({ error: 'Jeu introuvable' })
    res.json(game)
  })

  app.post('/api/steam/library/sync', async (_req, res) => {
    try {
      if (!isSteamAvailable()) {
        return res.status(404).json({ error: 'Steam non détecté sur ce PC' })
      }
      invalidateSteamCaches()
      const result = await syncSteamLibraryToDatabase()
      const achievementSync = syncAllSteamAchievements()
      res.json({ ...result, achievementSync })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.get('/api/steam/library/:appId/achievements', (req, res) => {
    const achievements = buildSteamAchievementList(req.params.appId)
    const unlocked = achievements.filter((a) => a.unlocked).length
    res.json({ achievements, unlocked, total: achievements.length })
  })

  app.post('/api/steam/library/:appId/achievements/sync', (req, res) => {
    const gameName = (req.body as { gameName?: string }).gameName
    syncSteamAchievementsByAppId(req.params.appId, gameName)
    const achievements = buildSteamAchievementList(req.params.appId)
    const unlocked = achievements.filter((a) => a.unlocked).length
    res.json({ achievements, unlocked, total: achievements.length })
  })

  app.post('/api/steam/library/:appId/install', async (req, res) => {
    const success = await installSteamGame(req.params.appId)
    if (!success) return res.status(500).json({ error: 'Impossible de lancer l\'installation' })
    invalidateSteamCaches()
    res.json({ success: true, status: getSteamInstallStatus(req.params.appId) })
  })

  app.get('/api/steam/library/:appId/install/status', (req, res) => {
    res.json(getSteamInstallStatus(req.params.appId))
  })

  // Epic library
  app.get('/api/epic/library', async (_req, res) => {
    if (!isEpicAvailable()) {
      return res.status(404).json({ error: 'Epic Games Launcher non détecté' })
    }
    const payload = await epicLibraryCache.getOrSetAsync('full', async () => {
      const games = await enrichEpicLibraryImagesWithTimeout(getEpicLibrary(), 1500)
      const installed = games.filter((g) => g.installed).length
      const launcher = getEpicLauncherInfo()
      return {
        games,
        stats: { total: games.length, installed, notInstalled: games.length - installed },
        launcher
      }
    })
    res.json(payload)

    void enrichEpicLibraryImages(getEpicLibrary()).then((games) => {
      const installed = games.filter((g) => g.installed).length
      epicLibraryCache.set(
        'full',
        {
          games,
          stats: { total: games.length, installed, notInstalled: games.length - installed },
          launcher: getEpicLauncherInfo()
        },
        300_000
      )
    })
  })

  app.post('/api/epic/library/sync', (_req, res) => {
    if (!isEpicAvailable()) {
      return res.status(404).json({ error: 'Epic Games Launcher non détecté' })
    }
    invalidateEpicCaches()
    res.json(syncEpicLibraryToDatabase())
  })

  app.get('/api/epic/library/:appName', async (req, res) => {
    const cacheKey = `game:${req.params.appName}`
    const cached = await epicGameCache.getOrSetAsync(cacheKey, async () => {
      const raw = getEpicGameByAppName(req.params.appName)
      if (!raw) return null
      const [game] = await enrichEpicLibraryImages([raw])
      return game
    })
    if (!cached) return res.status(404).json({ error: 'Jeu introuvable' })
    const db = getDatabase()
    const row = db
      .prepare(`SELECT id FROM games WHERE platform = 'epic' AND app_id = ?`)
      .get(req.params.appName) as { id: string } | undefined
    res.json({ ...cached, gameId: row?.id })
  })

  app.post('/api/epic/library/:appName/launch', async (req, res) => {
    const success = await launchEpicGameByAppName(req.params.appName)
    if (!success) return res.status(500).json({ error: 'Échec du lancement' })
    res.json({ success: true })
  })

  app.post('/api/epic/library/:appName/install', async (req, res) => {
    const success = await installEpicGameByAppName(req.params.appName)
    if (!success) return res.status(500).json({ error: 'Échec de l\'installation' })
    res.json({ success: true, status: getEpicInstallStatus(req.params.appName) })
  })

  app.get('/api/epic/library/:appName/install/status', (req, res) => {
    res.json(getEpicInstallStatus(req.params.appName))
  })

  // Store
  app.get('/api/store/search', async (req, res) => {
    const query = String(req.query.q ?? '')
    const platform = (req.query.platform as 'all' | 'steam' | 'epic') ?? 'all'
    const cacheKey = `${platform}:${query.toLowerCase().trim()}`
    try {
      const result = await storeSearchCache.getOrSetAsync(cacheKey, () => searchStore(query, platform))
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.post('/api/store/open', (req, res) => {
    const item = req.body as import('../shared/types').StoreGameItem
    if (!item?.platform) return res.status(400).json({ error: 'Article invalide' })
    openStorePurchase(item)
    res.json({ success: true })
  })

  // Games
  app.get('/api/games', (req, res) => {
    const installedOnly = req.query.installed === 'true'
    const cacheKey = installedOnly ? 'installed' : 'all'
    const games = gamesListCache.getOrSet(cacheKey, () => {
      const db = getDatabase()
      const sql = installedOnly
        ? `SELECT * FROM games WHERE install_path IS NOT NULL AND install_path != '' ORDER BY last_played DESC, name ASC`
        : `SELECT * FROM games ORDER BY last_played DESC, name ASC`
      return db.prepare(sql).all().map((g) => rowToGame(g as Record<string, unknown>))
    })
    res.json(games)
  })

  app.post('/api/games/sync', async (_req, res) => {
    invalidateAllLibraryCaches()
    const games = syncDetectedGames()
    let steamLibrary = { synced: 0, installed: 0, total: 0 }
    let epicLibrary = { synced: 0, installed: 0, total: 0 }
    if (isSteamAvailable()) {
      steamLibrary = await syncSteamLibraryToDatabase()
    }
    if (isEpicAvailable()) {
      epicLibrary = syncEpicLibraryToDatabase()
    }
    const achievementSync = syncAllSteamAchievements()
    res.json({ games, steamLibrary, epicLibrary, achievementSync })
  })

  app.post('/api/games', (req, res) => {
    const parsed = addGameSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const db = getDatabase()
    const id = uuid()
    const now = new Date().toISOString()
    const data = parsed.data

    db.prepare(`
      INSERT INTO games (id, name, platform, app_id, install_path, cover_url, banner_url, description, added_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.platform,
      data.appId ?? null,
      data.installPath ?? null,
      data.coverUrl || null,
      data.bannerUrl || null,
      data.description ?? null,
      now
    )

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id)
    gamesListCache.clear()
    res.status(201).json(rowToGame(game as Record<string, unknown>))
  })

  app.get('/api/games/:id', (req, res) => {
    const db = getDatabase()
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id)
    if (!game) return res.status(404).json({ error: 'Game not found' })
    res.json(rowToGame(game as Record<string, unknown>))
  })

  app.post('/api/games/:id/launch', async (req, res) => {
    const parsed = launchGameSchema.safeParse({ gameId: req.params.id })
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const success = await launchGame(req.params.id)
    if (!success) return res.status(500).json({ error: 'Failed to launch game' })
    gamesListCache.clear()
    statsCache.clear()
    res.json({ success: true })
  })

  app.get('/api/games/running', (_req, res) => {
    res.json({ running: getRunningGame() })
  })

  app.post('/api/games/:id/stop', async (req, res) => {
    const running = getRunningGame()
    if (!running || running.gameId !== req.params.id) {
      return res.status(404).json({ error: 'Game is not running' })
    }
    const stopped = await stopRunningGame(req.params.id)
    if (!stopped) return res.status(500).json({ error: 'Failed to stop game' })
    res.json({ success: true })
  })

  // Trophies
  app.get('/api/trophies', (_req, res) => {
    res.json(getAllTrophies())
  })

  app.get('/api/trophies/stats', (_req, res) => {
    res.json(getTrophyStats())
  })

  app.get('/api/trophies/grouped', (_req, res) => {
    res.json(getTrophiesGroupedByGame())
  })

  app.post('/api/trophies/sync-steam', (_req, res) => {
    const result = syncAllSteamAchievements()
    res.json(result)
  })

  app.get('/api/games/:id/trophies', (req, res) => {
    res.json(getTrophiesForGame(req.params.id))
  })

  app.post('/api/games/:id/trophies/sync', (req, res) => {
    const db = getDatabase()
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
    if (!game) return res.status(404).json({ error: 'Game not found' })
    if (game.platform !== 'steam' || !game.app_id) {
      return res.status(400).json({ error: 'Steam sync only available for Steam games' })
    }

    const trophies = syncSteamAchievements(req.params.id, game.app_id as string)
    res.json(trophies)
  })

  // Daily challenges
  app.get('/api/challenges', (_req, res) => {
    const db = getDatabase()
    const challenges = db.prepare(`SELECT * FROM daily_challenges WHERE expires_at > datetime('now')`).all()
    res.json(challenges.map((c) => rowToChallenge(c as Record<string, unknown>)))
  })

  app.patch('/api/challenges/:id/progress', (req, res) => {
    const { amount } = req.body as { amount?: number }
    if (typeof amount !== 'number' || amount < 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    const db = getDatabase()
    const challenge = db.prepare('SELECT * FROM daily_challenges WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
    if (!challenge) return res.status(404).json({ error: 'Challenge not found' })

    const newProgress = Math.min((challenge.progress as number) + amount, challenge.target as number)
    const completed = newProgress >= (challenge.target as number) ? 1 : 0

    db.prepare('UPDATE daily_challenges SET progress = ?, completed = ? WHERE id = ?').run(newProgress, completed, req.params.id)

    if (completed && !challenge.completed) {
      addXp(challenge.xp_reward as number)
    }

    const updated = db.prepare('SELECT * FROM daily_challenges WHERE id = ?').get(req.params.id)
    res.json(rowToChallenge(updated as Record<string, unknown>))
  })

  // Integrations — Discord & Spotify
  app.get('/api/integrations/media', async (_req, res) => {
    const settings = getAppSettings()
    const spotify =
      settings.spotifyEnabled
        ? await getSpotifyStatus(settings.spotifyClientId, true)
        : {
            connected: false,
            running: isSpotifyRunning(),
            source: 'none' as const,
            nowPlaying: { connected: false, isPlaying: false }
          }
    if (settings.discordEnabled && settings.discordRichPresence) {
      await ensureDiscordDesktopConnection(settings.discordAppId)
    }
    const discord = settings.discordEnabled
      ? getDiscordStatus()
      : { running: false, richPresenceConnected: false, desktopConnected: false }

    res.json({ spotify, discord })
  })

  app.get('/api/spotify/status', async (_req, res) => {
    const settings = getAppSettings()
    res.json(await getSpotifyStatus(settings.spotifyClientId, true))
  })

  app.get('/api/spotify/auth', (_req, res) => {
    const settings = getAppSettings()
    if (!settings.spotifyClientId.trim()) {
      return res.status(400).json({ error: 'Ajoutez un Client ID Spotify dans les paramètres' })
    }
    const { url } = createSpotifyAuthRequest(settings.spotifyClientId.trim())
    res.json({ url })
  })

  app.post('/api/spotify/disconnect', (_req, res) => {
    disconnectSpotify()
    res.json({ success: true })
  })

  app.post('/api/spotify/control', async (req, res) => {
    const action = req.body?.action as 'play' | 'pause' | 'next' | 'previous'
    if (!['play', 'pause', 'next', 'previous'].includes(action)) {
      return res.status(400).json({ error: 'Action invalide' })
    }
    const settings = getAppSettings()
    if (!settings.spotifyClientId) {
      return res.status(400).json({ error: 'Spotify non configuré' })
    }
    const success = await spotifyPlaybackControl(settings.spotifyClientId, action, true)
    if (!success) return res.status(500).json({ error: 'Contrôle Spotify impossible' })
    res.json({ success: true })
  })

  app.post('/api/spotify/open', (_req, res) => {
    openSpotify()
    res.json({ success: true })
  })

  app.get('/api/discord/status', async (_req, res) => {
    const settings = getAppSettings()
    if (settings.discordEnabled && settings.discordRichPresence) {
      await ensureDiscordDesktopConnection(settings.discordAppId)
    }
    res.json(getDiscordStatus())
  })

  app.post('/api/discord/connect', async (_req, res) => {
    const settings = getAppSettings()
    const connected = await ensureDiscordDesktopConnection(settings.discordAppId)
    res.json({ success: connected, ...getDiscordStatus() })
  })

  app.post('/api/discord/open', (_req, res) => {
    openDiscord()
    res.json({ success: true })
  })

  // Settings
  app.get('/api/settings', (_req, res) => {
    res.json(getAppSettings())
  })

  app.patch('/api/settings', (req, res) => {
    const parsed = settingsSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const db = getDatabase()
    for (const [key, value] of Object.entries(parsed.data)) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value))
    }

    const rows = db.prepare('SELECT * FROM settings').all() as { key: string; value: string }[]
    const settings: Partial<Settings> = {}
    for (const row of rows) {
      settings[row.key as keyof Settings] = JSON.parse(row.value)
    }
    res.json(settings)
  })

  // Stats
  app.get('/api/stats', async (_req, res) => {
    const payload = await statsCache.getOrSetAsync('dashboard', async () => {
    const db = getDatabase()
    const profile = db.prepare('SELECT * FROM profile LIMIT 1').get() as Record<string, unknown>
    const trophyStats = getTrophyStats()
    const recentGames = db.prepare('SELECT * FROM games ORDER BY last_played DESC LIMIT 5').all()
    const settings = getAppSettings()

    let media = undefined
    if (settings.spotifyEnabled || settings.discordEnabled) {
      if (settings.discordEnabled && settings.discordRichPresence) {
        await ensureDiscordDesktopConnection(settings.discordAppId)
      }
      const spotify = settings.spotifyEnabled
        ? await getSpotifyStatus(settings.spotifyClientId, true)
        : {
            connected: false,
            running: isSpotifyRunning(),
            source: 'none' as const,
            nowPlaying: { connected: false, isPlaying: false }
          }
      media = {
        spotify,
        discord: settings.discordEnabled
          ? getDiscordStatus()
          : { running: false, richPresenceConnected: false, desktopConnected: false }
      }
    }

    return {
      profile: rowToProfile(profile),
      trophies: trophyStats,
      recentGames: recentGames.map((g) => rowToGame(g as Record<string, unknown>)),
      media
    }
    })
    res.json(payload)
  })

  // Cloud API scaffold (local mock - replace with PostgreSQL in production)
  app.post('/api/cloud/register', (req, res) => {
    res.status(501).json({
      message: 'Cloud sync requires external PostgreSQL server. Configure CLOUD_API_URL in production.',
      mock: true
    })
  })

  app.post('/api/cloud/login', (_req, res) => {
    res.status(501).json({
      message: 'Cloud sync requires external PostgreSQL server.',
      mock: true
    })
  })

  app.listen(port, '127.0.0.1', () => {
    console.log(`[PC Console OS] API running on http://127.0.0.1:${port}`)
  })

  return app
}
