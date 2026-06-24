import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { v4 as uuid } from 'uuid'
import { getDatabase } from '../database'
import { getSteamRoot, getSteamappsPaths } from './steamPath'
import { startSteamInstall } from './steamInstall'
import { getSteamToolsPlugins, isSteamToolsEnabledInSettings } from './steamTools'
import { loadAppListMap, saveNameToCache } from './steamAppNames'

export interface SteamLibraryEntry {
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

export interface SteamGameStoreInfo {
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

export interface SteamGameDetails extends SteamLibraryEntry, SteamGameStoreInfo {
  gameId?: string
}

const SKIP_APP_IDS = new Set(['228980', '1070560', '1391110', '1628350'])
const PLACEHOLDER_PREFIX = 'Jeu Steam '

function isPlaceholderName(name: string): boolean {
  return name.startsWith(PLACEHOLDER_PREFIX)
}

function parseVdfValue(content: string, key: string): string | null {
  const regex = new RegExp(`"${key}"\\s+"([^"]*)"`, 'i')
  return content.match(regex)?.[1] ?? null
}

function findVdfBlock(content: string, key: string): string | null {
  const re = new RegExp(`"${key}"\\s*\\{`, 'i')
  const match = re.exec(content)
  if (!match) return null

  let depth = 1
  let i = match.index + match[0].length
  const start = i

  while (i < content.length && depth > 0) {
    const ch = content[i]
    if (ch === '{') depth++
    else if (ch === '}') depth--
    i++
  }

  return depth === 0 ? content.slice(start, i - 1) : null
}

function parseOwnedAppIds(localconfigPath: string): Map<string, { playTimeMinutes: number; lastPlayed?: string }> {
  const apps = new Map<string, { playTimeMinutes: number; lastPlayed?: string }>()
  if (!existsSync(localconfigPath)) return apps

  try {
    const content = readFileSync(localconfigPath, 'utf-8')
    const appsSection = findVdfBlock(content, 'apps')
    if (!appsSection) return apps

    const appBlocks = appsSection.matchAll(/"(\d+)"\s*\{([^{}]*)\}/g)
    for (const block of appBlocks) {
      const appId = block[1]
      const inner = block[2]
      const playtimeMatch = inner.match(/"Playtime"\s+"(\d+)"/i) ?? inner.match(/"playtime_forever"\s+"(\d+)"/i)
      const lastPlayedMatch = inner.match(/"LastPlayed"\s+"(\d+)"/i)
      const playTimeMinutes = playtimeMatch ? Math.floor(Number(playtimeMatch[1]) / 60) : 0
      const lastPlayed = lastPlayedMatch ? new Date(Number(lastPlayedMatch[1]) * 1000).toISOString() : undefined
      apps.set(appId, { playTimeMinutes, lastPlayed })
    }
  } catch {
    // ignore
  }
  return apps
}

function getLocalConfigPaths(steamRoot: string): string[] {
  const userdataPath = join(steamRoot, 'userdata')
  if (!existsSync(userdataPath)) return []

  return readdirSync(userdataPath)
    .filter((id) => /^\d+$/.test(id) && id !== '0')
    .map((id) => join(userdataPath, id, 'config', 'localconfig.vdf'))
    .filter((p) => existsSync(p))
}

function readLibraryCacheName(steamRoot: string, appId: string): string | null {
  const cachePath = join(steamRoot, 'appcache', 'librarycache', `${appId}.json`)
  if (!existsSync(cachePath)) return null

  try {
    const raw = readFileSync(cachePath, 'utf-8')
    const data = JSON.parse(raw) as unknown
    const entries = Array.isArray(data) ? data : [data]

    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue
      const obj = entry as Record<string, unknown>
      const common = obj.common as Record<string, unknown> | undefined
      if (common?.name && typeof common.name === 'string') return common.name
      if (typeof obj.name === 'string') return obj.name

      const appinfo = obj.appinfo as Record<string, unknown> | undefined
      const appCommon = appinfo?.common as Record<string, unknown> | undefined
      if (appCommon?.name && typeof appCommon.name === 'string') return appCommon.name
    }
  } catch {
    // ignore
  }
  return null
}

function getNameFromManifests(steamappsPaths: string[], appId: string): string | null {
  for (const steamappsPath of steamappsPaths) {
    const manifestPath = join(steamappsPath, `appmanifest_${appId}.acf`)
    if (!existsSync(manifestPath)) continue
    try {
      const content = readFileSync(manifestPath, 'utf-8')
      const name = parseVdfValue(content, 'name')
      if (name) return name
    } catch {
      // skip
    }
  }
  return null
}

function getCachedNameFromDb(appId: string): string | null {
  try {
    const database = getDatabase()
    const row = database
      .prepare(`SELECT name FROM games WHERE platform = 'steam' AND app_id = ?`)
      .get(appId) as { name: string } | undefined
    if (row?.name && !isPlaceholderName(row.name)) return row.name
  } catch {
    // ignore
  }
  return null
}

function persistSteamName(appId: string, name: string): void {
  saveNameToCache(appId, name)
  try {
    const database = getDatabase()
    database
      .prepare(
        `UPDATE games SET name = ? WHERE platform = 'steam' AND app_id = ? AND (name LIKE 'Jeu Steam %' OR name = ?)`
      )
      .run(name, appId, name)
  } catch {
    // ignore
  }
}

function getInstalledGames(steamappsPaths: string[]): Map<string, { name: string; installPath: string }> {
  const installed = new Map<string, { name: string; installPath: string }>()

  for (const steamappsPath of steamappsPaths) {
    const commonPath = join(steamappsPath, 'common')
    if (!existsSync(commonPath)) continue

    for (const manifest of readdirSync(steamappsPath).filter((f) => f.startsWith('appmanifest_') && f.endsWith('.acf'))) {
      try {
        const content = readFileSync(join(steamappsPath, manifest), 'utf-8')
        const appId = parseVdfValue(content, 'appid')
        const name = parseVdfValue(content, 'name')
        const installdir = parseVdfValue(content, 'installdir')
        if (!appId || !name || !installdir) continue

        const installPath = join(commonPath, installdir)
        if (existsSync(installPath)) {
          installed.set(appId, { name, installPath })
        }
      } catch {
        // skip
      }
    }
  }
  return installed
}

async function fetchStoreName(appId: string, lang = 'french'): Promise<string | null> {
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appId}&l=${lang}`,
      {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'PC-Console-OS/1.0' }
      }
    )
    if (!res.ok) return null
    const json = (await res.json()) as Record<string, { success?: boolean; data?: { name?: string } }>
    const entry = json[appId]
    if (!entry?.success || !entry.data?.name) return null
    return entry.data.name
  } catch {
    return null
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function fetchSteamStoreDetails(appId: string): Promise<SteamGameStoreInfo | null> {
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appId}&l=french`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return null

    const json = (await res.json()) as Record<
      string,
      {
        success?: boolean
        data?: {
          name?: string
          short_description?: string
          detailed_description?: string
          header_image?: string
          screenshots?: Array<{ path_full: string }>
          developers?: string[]
          publishers?: string[]
          release_date?: { date?: string }
          genres?: Array<{ description: string }>
          metacritic?: { score: number }
        }
      }
    >

    const entry = json[appId]
    if (!entry?.success || !entry.data) return null
    const d = entry.data

    return {
      shortDescription: d.short_description,
      detailedDescription: d.detailed_description ? stripHtml(d.detailed_description) : undefined,
      headerImage: d.header_image,
      screenshots: (d.screenshots ?? []).map((s) => s.path_full).filter(Boolean),
      developers: d.developers ?? [],
      publishers: d.publishers ?? [],
      releaseDate: d.release_date?.date,
      genres: (d.genres ?? []).map((g) => g.description),
      metacriticScore: d.metacritic?.score
    }
  } catch {
    return null
  }
}

export function getSteamLibrary(): SteamLibraryEntry[] {
  const steamRoot = getSteamRoot()
  if (!steamRoot) return []

  const steamappsPaths = getSteamappsPaths(steamRoot)
  const installedMap = getInstalledGames(steamappsPaths)

  const ownedApps = new Map<string, { playTimeMinutes: number; lastPlayed?: string }>()
  for (const configPath of getLocalConfigPaths(steamRoot)) {
    const apps = parseOwnedAppIds(configPath)
    for (const [appId, meta] of apps) {
      const existing = ownedApps.get(appId)
      if (!existing || meta.playTimeMinutes > existing.playTimeMinutes) {
        ownedApps.set(appId, meta)
      }
    }
  }

  for (const appId of installedMap.keys()) {
    if (!ownedApps.has(appId)) ownedApps.set(appId, { playTimeMinutes: 0 })
  }

  const steamToolsPlugins = isSteamToolsEnabledInSettings() ? getSteamToolsPlugins() : []
  const steamToolsMap = new Map(steamToolsPlugins.map((p) => [p.appId, p]))

  for (const appId of steamToolsMap.keys()) {
    if (!ownedApps.has(appId)) ownedApps.set(appId, { playTimeMinutes: 0 })
  }

  const entries: SteamLibraryEntry[] = []

  for (const [appId, meta] of ownedApps) {
    if (SKIP_APP_IDS.has(appId)) continue

    const installed = installedMap.get(appId)
    const plugin = steamToolsMap.get(appId)
    const name =
      installed?.name ??
      getCachedNameFromDb(appId) ??
      readLibraryCacheName(steamRoot, appId) ??
      getNameFromManifests(steamappsPaths, appId) ??
      `${PLACEHOLDER_PREFIX}${appId}`

    entries.push({
      appId,
      name,
      installed: !!installed,
      installPath: installed?.installPath,
      playTimeMinutes: meta.playTimeMinutes,
      lastPlayed: meta.lastPlayed,
      coverUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
      bannerUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_hero.jpg`,
      steamTools: !!plugin,
      hasPlugin: !!plugin,
      hasManifest: plugin?.hasManifest
    })
  }

  return entries.sort((a, b) => {
    if (a.installed !== b.installed) return a.installed ? -1 : 1
    if (a.lastPlayed && b.lastPlayed) return b.lastPlayed.localeCompare(a.lastPlayed)
    return a.name.localeCompare(b.name, 'fr')
  })
}

async function resolveNameForEntry(entry: SteamLibraryEntry, appList: Map<string, string>): Promise<void> {
  if (!isPlaceholderName(entry.name)) return

  const fromDb = getCachedNameFromDb(entry.appId)
  if (fromDb) {
    entry.name = fromDb
    return
  }

  const fromList = appList.get(entry.appId)
  if (fromList) {
    entry.name = fromList
    persistSteamName(entry.appId, fromList)
    return
  }

  const name = (await fetchStoreName(entry.appId)) ?? (await fetchStoreName(entry.appId, 'english'))
  if (name) {
    entry.name = name
    persistSteamName(entry.appId, name)
  }
}

export async function enrichSteamLibraryNames(entries: SteamLibraryEntry[]): Promise<SteamLibraryEntry[]> {
  const enriched = entries.map((e) => ({ ...e }))
  const needsName = enriched.filter((e) => isPlaceholderName(e.name))
  if (needsName.length === 0) return enriched

  let appList: Map<string, string>
  try {
    appList = await loadAppListMap()
  } catch {
    appList = new Map()
  }

  const BATCH = 8

  for (let i = 0; i < needsName.length; i += BATCH) {
    await Promise.all(needsName.slice(i, i + BATCH).map((entry) => resolveNameForEntry(entry, appList)))
  }

  return enriched
}

export function buildSteamLibraryResponse(entries: SteamLibraryEntry[]): {
  games: SteamLibraryEntry[]
  stats: { total: number; installed: number; notInstalled: number; steamTools: number }
  steamTools: ReturnType<typeof getSteamToolsStatus>
} {
  const installed = entries.filter((g) => g.installed).length
  const steamTools = entries.filter((g) => g.steamTools).length
  return {
    games: entries,
    stats: {
      total: entries.length,
      installed,
      notInstalled: entries.length - installed,
      steamTools
    },
    steamTools: getSteamToolsStatus()
  }
}

export async function enrichSteamLibraryNamesWithTimeout(
  entries: SteamLibraryEntry[],
  timeoutMs = 1500
): Promise<SteamLibraryEntry[]> {
  return Promise.race([
    enrichSteamLibraryNames(entries),
    new Promise<SteamLibraryEntry[]>((resolve) => {
      setTimeout(() => resolve(entries.map((e) => ({ ...e }))), timeoutMs)
    })
  ])
}

export async function getSteamGameByAppId(appId: string): Promise<SteamGameDetails | null> {
  const library = getSteamLibrary()
  const entry = library.find((g) => g.appId === appId)
  if (!entry) return null

  const [enriched] = await enrichSteamLibraryNames([entry])
  const storeInfo = await fetchSteamStoreDetails(appId)

  if (storeInfo && isPlaceholderName(enriched.name)) {
    const storeName = await fetchStoreName(appId)
    if (storeName) {
      enriched.name = storeName
      persistSteamName(appId, storeName)
    }
  }

  const database = getDatabase()
  const dbGame = database
    .prepare(`SELECT id FROM games WHERE platform = 'steam' AND app_id = ?`)
    .get(appId) as { id: string } | undefined

  return {
    ...enriched,
    ...storeInfo,
    screenshots: storeInfo?.screenshots ?? [],
    developers: storeInfo?.developers ?? [],
    publishers: storeInfo?.publishers ?? [],
    genres: storeInfo?.genres ?? [],
    gameId: dbGame?.id
  }
}

export async function syncSteamLibraryToDatabase(): Promise<{
  synced: number
  installed: number
  total: number
}> {
  const database = getDatabase()
  const entries = await enrichSteamLibraryNames(getSteamLibrary())
  let synced = 0
  let installedCount = 0

  for (const entry of entries) {
    if (entry.installed) installedCount++

    const existing = database
      .prepare('SELECT * FROM games WHERE platform = ? AND app_id = ?')
      .get('steam', entry.appId) as Record<string, unknown> | undefined

    if (existing) {
      database
        .prepare(
          `UPDATE games SET name = ?, install_path = ?, cover_url = ?, banner_url = ?,
           play_time_minutes = ?, last_played = COALESCE(?, last_played) WHERE id = ?`
        )
        .run(
          entry.name,
          entry.installPath ?? null,
          entry.coverUrl,
          entry.bannerUrl,
          entry.playTimeMinutes,
          entry.lastPlayed ?? null,
          existing.id
        )
    } else {
      const id = uuid()
      const now = new Date().toISOString()
      database.prepare(`
        INSERT INTO games (id, name, platform, app_id, install_path, cover_url, banner_url, play_time_minutes, last_played, added_at)
        VALUES (?, ?, 'steam', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        entry.name,
        entry.appId,
        entry.installPath ?? null,
        entry.coverUrl,
        entry.bannerUrl,
        entry.playTimeMinutes,
        entry.lastPlayed ?? null,
        now
      )
    }
    synced++
  }

  const profile = database.prepare('SELECT * FROM profile LIMIT 1').get() as Record<string, unknown>
  database.prepare('UPDATE profile SET games_owned = ? WHERE id = ?').run(entries.length, profile.id)

  return { synced, installed: installedCount, total: entries.length }
}

export async function installSteamGame(appId: string): Promise<boolean> {
  const result = await startSteamInstall(appId)
  return result.success
}

export function isSteamAvailable(): boolean {
  return getSteamRoot() !== null
}

export function getSteamRootPath(): string | null {
  return getSteamRoot()
}
