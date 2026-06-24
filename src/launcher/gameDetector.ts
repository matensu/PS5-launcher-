import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { v4 as uuid } from 'uuid'
import type { Game, GamePlatform } from '../shared/types'
import { getDatabase, rowToGame } from '../database'
import { launchEpicGame, openUri } from './launcherUrls'
import { getEpicLibrary, getEpicGameByAppName } from './epicLibrary'
import { launchEpicGameDirect } from './epicLaunch'
import { getAppSettings } from '../integrations/settingsHelper'
import { setGamePresence } from '../integrations/discord'

interface DetectedGame {
  name: string
  platform: GamePlatform
  appId?: string
  installPath?: string
}

function getSteamPaths(): string[] {
  const paths: string[] = []
  if (process.platform === 'win32') {
    paths.push('C:\\Program Files (x86)\\Steam\\steamapps')
    paths.push('C:\\Program Files\\Steam\\steamapps')
    const programFiles = process.env['ProgramFiles(x86)'] ?? process.env.ProgramFiles
    if (programFiles) paths.push(join(programFiles, 'Steam', 'steamapps'))
  } else {
    paths.push(join(homedir(), '.steam', 'steam', 'steamapps'))
    paths.push(join(homedir(), '.local', 'share', 'Steam', 'steamapps'))
  }
  return paths.filter((p) => existsSync(p))
}

function parseSteamLibrary(steamappsPath: string): DetectedGame[] {
  const games: DetectedGame[] = []
  const commonPath = join(steamappsPath, 'common')
  const manifestPath = steamappsPath

  if (!existsSync(commonPath)) return games

  const manifests = readdirSync(manifestPath).filter((f) => f.startsWith('appmanifest_') && f.endsWith('.acf'))

  for (const manifest of manifests) {
    try {
      const content = readFileSync(join(manifestPath, manifest), 'utf-8')
      const appIdMatch = content.match(/"appid"\s+"(\d+)"/)
      const nameMatch = content.match(/"name"\s+"(.+?)"/)
      const installdirMatch = content.match(/"installdir"\s+"(.+?)"/)

      if (nameMatch && installdirMatch) {
        const installPath = join(commonPath, installdirMatch[1])
        if (existsSync(installPath)) {
          games.push({
            name: nameMatch[1],
            platform: 'steam',
            appId: appIdMatch?.[1],
            installPath
          })
        }
      }
    } catch {
      // skip invalid manifest
    }
  }

  return games
}

function getEpicManifests(): DetectedGame[] {
  return getEpicLibrary()
    .filter((g) => g.installed && g.installPath)
    .map((g) => ({
      name: g.name,
      platform: 'epic' as const,
      appId: g.appName,
      installPath: g.installPath
    }))
}

function getGogGames(): DetectedGame[] {
  const games: DetectedGame[] = []
  const gogPaths =
    process.platform === 'win32'
      ? [join(process.env.ProgramFiles ?? 'C:\\Program Files', 'GOG Galaxy', 'Games')]
      : [join(homedir(), 'Games'), '/usr/share/games']

  for (const basePath of gogPaths) {
    if (!existsSync(basePath)) continue
    try {
      for (const entry of readdirSync(basePath)) {
        const fullPath = join(basePath, entry)
        if (statSync(fullPath).isDirectory()) {
          games.push({ name: entry, platform: 'gog', installPath: fullPath })
        }
      }
    } catch {
      // skip
    }
  }

  return games
}

function getUbisoftGames(): DetectedGame[] {
  const games: DetectedGame[] = []
  const ubisoftPath =
    process.platform === 'win32'
      ? join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Ubisoft', 'Ubisoft Game Launcher', 'games')
      : join(homedir(), '.local', 'share', 'ubisoft', 'games')

  if (!existsSync(ubisoftPath)) return games

  try {
    for (const entry of readdirSync(ubisoftPath)) {
      const fullPath = join(ubisoftPath, entry)
      if (statSync(fullPath).isDirectory()) {
        games.push({ name: entry, platform: 'ubisoft', installPath: fullPath })
      }
    }
  } catch {
    // skip
  }

  return games
}

function getBattleNetGames(): DetectedGame[] {
  const games: DetectedGame[] = []
  const battleNetPath =
    process.platform === 'win32'
      ? join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Battle.net')
      : join(homedir(), '.local', 'share', 'Battle.net')

  if (!existsSync(battleNetPath)) return games

  const knownGames = ['World of Warcraft', 'Overwatch', 'Diablo IV', 'Hearthstone', 'StarCraft II']
  for (const name of knownGames) {
    const gamePath = join(battleNetPath, name)
    if (existsSync(gamePath)) {
      games.push({ name, platform: 'battlenet', installPath: gamePath })
    }
  }

  return games
}

export function detectAllGames(): DetectedGame[] {
  const detected: DetectedGame[] = []

  for (const steamPath of getSteamPaths()) {
    detected.push(...parseSteamLibrary(steamPath))
  }
  detected.push(...getEpicManifests())
  detected.push(...getGogGames())
  detected.push(...getUbisoftGames())
  detected.push(...getBattleNetGames())

  const seen = new Set<string>()
  return detected.filter((g) => {
    const key = `${g.platform}:${g.name}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function syncDetectedGames(): Game[] {
  const database = getDatabase()
  const detected = detectAllGames()
  const synced: Game[] = []

  for (const d of detected) {
    const existing = database
      .prepare(
        d.appId
          ? 'SELECT * FROM games WHERE platform = ? AND (app_id = ? OR name = ?)'
          : 'SELECT * FROM games WHERE platform = ? AND name = ?'
      )
      .get(...(d.appId ? [d.platform, d.appId, d.name] : [d.platform, d.name])) as Record<string, unknown> | undefined

    if (existing) {
      database.prepare('UPDATE games SET install_path = ?, app_id = ? WHERE id = ?').run(
        d.installPath ?? null,
        d.appId ?? null,
        existing.id
      )
      synced.push(rowToGame(database.prepare('SELECT * FROM games WHERE id = ?').get(existing.id) as Record<string, unknown>))
    } else {
      const id = uuid()
      const now = new Date().toISOString()
      const coverUrl =
        d.platform === 'steam' && d.appId
          ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${d.appId}/library_600x900.jpg`
          : undefined
      const bannerUrl =
        d.platform === 'steam' && d.appId
          ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${d.appId}/library_hero.jpg`
          : undefined

      database.prepare(`
        INSERT INTO games (id, name, platform, app_id, install_path, cover_url, banner_url, added_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, d.name, d.platform, d.appId ?? null, d.installPath ?? null, coverUrl ?? null, bannerUrl ?? null, now)

      synced.push(rowToGame(database.prepare('SELECT * FROM games WHERE id = ?').get(id) as Record<string, unknown>))
    }
  }

  const profile = database.prepare('SELECT * FROM profile LIMIT 1').get() as Record<string, unknown>
  const gameCount = database.prepare('SELECT COUNT(*) as c FROM games').get() as { c: number }
  database.prepare('UPDATE profile SET games_owned = ? WHERE id = ?').run(gameCount.c, profile.id)

  return synced
}

export async function launchGame(gameId: string): Promise<boolean> {
  const database = getDatabase()
  const game = database.prepare('SELECT * FROM games WHERE id = ?').get(gameId) as Record<string, unknown> | undefined
  if (!game) return false

  const { spawn } = await import('child_process')
  const platform = game.platform as GamePlatform
  const appId = game.app_id as string | undefined
  const installPath = game.install_path as string | undefined

  try {
    switch (platform) {
      case 'steam':
        if (appId) openUri(`steam://run/${appId}`)
        break
      case 'epic':
        if (appId) {
          const epicGame = getEpicGameByAppName(appId)
          if (epicGame) {
            await launchEpicGameDirect(epicGame)
          } else {
            launchEpicGame(appId)
          }
        }
        break
      default:
        if (installPath && existsSync(installPath)) {
          if (process.platform === 'win32') {
            spawn('explorer', [installPath], { detached: true, stdio: 'ignore' }).unref()
          } else {
            openUri(installPath)
          }
        }
    }

    const now = new Date().toISOString()
    database.prepare('UPDATE games SET last_played = ? WHERE id = ?').run(now, gameId)
    database.prepare('INSERT INTO play_sessions (id, game_id, started_at) VALUES (?, ?, ?)').run(uuid(), gameId, now)

    const settings = getAppSettings()
    if (settings.discordEnabled && settings.discordRichPresence) {
      void setGamePresence(settings.discordAppId, game.name as string)
    }

    return true
  } catch {
    return false
  }
}
