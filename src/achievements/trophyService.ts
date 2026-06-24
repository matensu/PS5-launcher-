import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { v4 as uuid } from 'uuid'
import { getDatabase, rowToGame, rowToTrophy, unlockTrophy, addXp } from '../database'
import type { Game, Trophy, TrophyTier } from '../shared/types'
import { XP_PER_TROPHY } from '../shared/types'

interface SteamAchievement {
  apiname: string
  achieved: number
  unlocktime?: number
  name?: string
  description?: string
  icon?: string
}

interface AchievementMeta {
  apiname: string
  name: string
  description: string
  icon?: string
  percent?: number
}

interface TrophyGroup {
  gameId: string
  gameName: string
  gameCover?: string
  gameBanner?: string
  platform: string
  appId?: string
  unlocked: number
  total: number
  trophies: Trophy[]
}

function getSteamRoots(): string[] {
  const roots: string[] = []
  if (process.platform === 'win32') {
    roots.push('C:\\Program Files (x86)\\Steam')
    roots.push('C:\\Program Files\\Steam')
    const pf = process.env['ProgramFiles(x86)'] ?? process.env.ProgramFiles
    if (pf) roots.push(join(pf, 'Steam'))
  } else {
    roots.push(join(homedir(), '.steam', 'steam'))
    roots.push(join(homedir(), '.local', 'share', 'Steam'))
  }
  return roots.filter((p) => existsSync(p))
}

function getSteamUserDataPaths(): string[] {
  const paths: string[] = []
  for (const root of getSteamRoots()) {
    const userdata = join(root, 'userdata')
    if (existsSync(userdata)) paths.push(userdata)
  }
  return paths
}

function getSteamUserIds(): string[] {
  const ids = new Set<string>()
  for (const userdata of getSteamUserDataPaths()) {
    for (const dir of readdirSync(userdata)) {
      if (/^\d{17}$/.test(dir)) ids.add(dir)
    }
  }
  return [...ids]
}

function humanizeApiName(apiName: string): string {
  return apiName
    .replace(/^ACHIEVEMENT_/i, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function mapPercentToTier(percent?: number): TrophyTier {
  if (percent === undefined) return 'bronze'
  if (percent < 5) return 'gold'
  if (percent < 20) return 'silver'
  return 'bronze'
}

function parseLibraryCacheAchievements(steamRoot: string, appId: string): Map<string, AchievementMeta> {
  const meta = new Map<string, AchievementMeta>()
  const paths = [
    join(steamRoot, 'appcache', 'librarycache', `${appId}.json`),
    join(steamRoot, 'appcache', 'librarycache', `${appId}`, 'achievement_progress.json')
  ]

  for (const userId of getSteamUserIds()) {
    paths.push(join(steamRoot, 'userdata', userId, 'config', 'librarycache', `${appId}.json`))
  }

  for (const filePath of paths) {
    if (!existsSync(filePath)) continue
    try {
      const raw = readFileSync(filePath, 'utf-8')
      const data = JSON.parse(raw) as Record<string, unknown>
      extractAchievementMeta(data, meta, appId)
    } catch {
      // skip invalid cache
    }
  }

  return meta
}

function extractAchievementMeta(
  node: unknown,
  meta: Map<string, AchievementMeta>,
  appId: string,
  depth = 0
): void {
  if (!node || depth > 12) return

  if (Array.isArray(node)) {
    for (const item of node) extractAchievementMeta(item, meta, appId, depth + 1)
    return
  }

  if (typeof node !== 'object') return
  const obj = node as Record<string, unknown>

  const apiName =
    (obj.strID as string) ??
    (obj.apiname as string) ??
    (obj.name as string)

  const displayName =
    (obj.strName as string) ??
    (obj.displayName as string) ??
    (obj.localized_name as string)

  if (apiName && displayName && typeof displayName === 'string') {
    const description =
      (obj.strDescription as string) ??
      (obj.description as string) ??
      (obj.localized_desc as string) ??
      ''

    const iconHash = (obj.strImage as string) ?? (obj.icon as string) ?? (obj.icon_normal as string)
    const percent = typeof obj.flAchieved === 'number' ? obj.flAchieved : undefined

    meta.set(apiName, {
      apiname: apiName,
      name: displayName,
      description,
      icon: iconHash
        ? `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appId}/${iconHash}.jpg`
        : undefined,
      percent
    })
  }

  for (const value of Object.values(obj)) {
    extractAchievementMeta(value, meta, appId, depth + 1)
  }
}

function readSteamStatsAchievements(appId: string): SteamAchievement[] {
  const achievements: SteamAchievement[] = []

  for (const userdata of getSteamUserDataPaths()) {
    for (const userId of readdirSync(userdata)) {
      if (!/^\d+$/.test(userId)) continue

      const statsPath = join(userdata, userId, 'stats', `${appId}.json`)
      if (!existsSync(statsPath)) continue

      try {
        const data = JSON.parse(readFileSync(statsPath, 'utf-8')) as {
          achievements?: Array<{ apiname: string; achieved: number; unlocktime?: number }>
        }

        for (const ach of data.achievements ?? []) {
          achievements.push({
            apiname: ach.apiname,
            achieved: ach.achieved,
            unlocktime: ach.unlocktime
          })
        }
      } catch {
        // skip
      }
    }
  }

  const seen = new Set<string>()
  return achievements.filter((a) => {
    if (seen.has(a.apiname)) return false
    seen.add(a.apiname)
    return true
  })
}

function enrichAchievements(appId: string, raw: SteamAchievement[]): SteamAchievement[] {
  const metaMaps: Map<string, AchievementMeta>[] = []
  for (const root of getSteamRoots()) {
    metaMaps.push(parseLibraryCacheAchievements(root, appId))
  }

  return raw.map((ach) => {
    let meta: AchievementMeta | undefined
    for (const map of metaMaps) {
      meta = map.get(ach.apiname)
      if (meta) break
    }

    return {
      ...ach,
      name: meta?.name ?? humanizeApiName(ach.apiname),
      description: meta?.description ?? 'Succès Steam',
      icon: meta?.icon
    }
  })
}

export function syncSteamAchievements(gameId: string, steamAppId: string): Trophy[] {
  const database = getDatabase()
  const achievementList = buildSteamAchievementList(steamAppId)
  if (achievementList.length === 0) return []

  const synced: Trophy[] = []
  let newlyUnlocked = 0

  for (const ach of achievementList) {
    const existing = database
      .prepare('SELECT * FROM trophies WHERE game_id = ? AND steam_achievement_id = ?')
      .get(gameId, ach.steamAchievementId) as Record<string, unknown> | undefined

    if (existing) {
      database.prepare(`
        UPDATE trophies SET name = ?, description = ?, icon = ?, tier = ?
        WHERE id = ?
      `).run(ach.name, ach.description, ach.icon ?? null, ach.tier, existing.id)

      if (ach.unlocked && !existing.unlocked) {
        database.prepare('UPDATE trophies SET unlocked = 1, unlocked_at = ? WHERE id = ?').run(
          ach.unlockedAt ?? new Date().toISOString(),
          existing.id
        )
        const unlocked = unlockTrophy(existing.id as string)
        if (unlocked) {
          addXp(XP_PER_TROPHY[unlocked.tier])
          synced.push(unlocked)
          newlyUnlocked++
        }
      } else {
        synced.push(
          rowToTrophy(
            database.prepare('SELECT * FROM trophies WHERE id = ?').get(existing.id) as Record<string, unknown>
          )
        )
      }
    } else {
      const trophyId = uuid()

      database.prepare(`
        INSERT INTO trophies (id, game_id, name, description, tier, icon, steam_achievement_id, unlocked, unlocked_at, is_custom)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        trophyId,
        gameId,
        ach.name,
        ach.description,
        ach.tier,
        ach.icon ?? null,
        ach.steamAchievementId,
        ach.unlocked ? 1 : 0,
        ach.unlocked ? (ach.unlockedAt ?? new Date().toISOString()) : null
      )

      if (ach.unlocked) {
        addXp(XP_PER_TROPHY[ach.tier])
        newlyUnlocked++
      }

      synced.push(
        rowToTrophy(database.prepare('SELECT * FROM trophies WHERE id = ?').get(trophyId) as Record<string, unknown>)
      )
    }
  }

  checkCustomTrophies(newlyUnlocked)
  return synced.sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1
    return a.name.localeCompare(b.name, 'fr')
  })
}

export function syncAllSteamAchievements(): { synced: number; games: number } {
  const database = getDatabase()
  const steamGames = database
    .prepare("SELECT * FROM games WHERE platform = 'steam' AND app_id IS NOT NULL")
    .all() as Record<string, unknown>[]

  let totalSynced = 0
  for (const game of steamGames) {
    const trophies = syncSteamAchievements(game.id as string, game.app_id as string)
    totalSynced += trophies.length
  }

  return { synced: totalSynced, games: steamGames.length }
}

export function checkCustomTrophies(_newAchievements = 0): void {
  const database = getDatabase()
  const profile = database.prepare('SELECT * FROM profile LIMIT 1').get() as Record<string, unknown>
  const totalPlayTime = Number(profile.total_play_time_minutes ?? 0)
  const gameCount = (database.prepare('SELECT COUNT(*) as c FROM games').get() as { c: number }).c
  const steamAchievements = (
    database.prepare(
      'SELECT COUNT(*) as c FROM trophies WHERE steam_achievement_id IS NOT NULL AND unlocked = 1'
    ).get() as { c: number }
  ).c

  const checks: { name: string; condition: boolean }[] = [
    { name: 'Marathonien', condition: totalPlayTime >= 6000 },
    { name: 'Explorateur', condition: gameCount >= 50 },
    { name: 'Collectionneur', condition: steamAchievements >= 1000 },
    { name: 'Premier pas', condition: gameCount >= 1 }
  ]

  for (const check of checks) {
    if (!check.condition) continue
    const trophy = database
      .prepare('SELECT * FROM trophies WHERE name = ? AND is_custom = 1')
      .get(check.name) as Record<string, unknown> | undefined
    if (trophy && !trophy.unlocked) {
      const unlocked = unlockTrophy(trophy.id as string)
      if (unlocked) addXp(XP_PER_TROPHY[unlocked.tier])
    }
  }
}

export function getTrophiesForGame(gameId: string): Trophy[] {
  const database = getDatabase()
  return database
    .prepare('SELECT * FROM trophies WHERE game_id = ? ORDER BY unlocked DESC, name ASC')
    .all(gameId)
    .map((row) => rowToTrophy(row as Record<string, unknown>))
}

export function getAllTrophies(): Trophy[] {
  const database = getDatabase()
  return database
    .prepare('SELECT * FROM trophies ORDER BY unlocked_at DESC, name ASC')
    .all()
    .map((row) => rowToTrophy(row as Record<string, unknown>))
}

export function getTrophiesGroupedByGame(): TrophyGroup[] {
  const database = getDatabase()
  const games = database
    .prepare("SELECT * FROM games WHERE platform = 'steam' ORDER BY name ASC")
    .all() as Record<string, unknown>[]

  const groups: TrophyGroup[] = []

  for (const gameRow of games) {
    const game = rowToGame(gameRow)
    const trophies = getTrophiesForGame(game.id)
    if (trophies.length === 0) continue

    groups.push({
      gameId: game.id,
      gameName: game.name,
      gameCover: game.coverUrl,
      gameBanner: game.bannerUrl,
      platform: game.platform,
      appId: game.appId,
      unlocked: trophies.filter((t) => t.unlocked).length,
      total: trophies.length,
      trophies
    })
  }

  const customTrophies = database
    .prepare('SELECT * FROM trophies WHERE is_custom = 1')
    .all()
    .map((row) => rowToTrophy(row as Record<string, unknown>))

  if (customTrophies.length > 0) {
    groups.unshift({
      gameId: 'custom',
      gameName: 'Trophées PC Console OS',
      unlocked: customTrophies.filter((t) => t.unlocked).length,
      total: customTrophies.length,
      platform: 'manual',
      trophies: customTrophies
    })
  }

  return groups
}

export function getTrophyStats(): {
  bronze: number
  silver: number
  gold: number
  platinum: number
  total: number
} {
  const database = getDatabase()
  const tiers = ['bronze', 'silver', 'gold', 'platinum'] as const
  const stats = { bronze: 0, silver: 0, gold: 0, platinum: 0, total: 0 }

  for (const tier of tiers) {
    const count = (
      database.prepare('SELECT COUNT(*) as c FROM trophies WHERE tier = ? AND unlocked = 1').get(tier) as {
        c: number
      }
    ).c
    stats[tier] = count
    stats.total += count
  }

  return stats
}

export type { TrophyGroup }

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

function collectAchievementMeta(steamAppId: string): Map<string, AchievementMeta> {
  const metaMap = new Map<string, AchievementMeta>()
  for (const root of getSteamRoots()) {
    for (const [key, value] of parseLibraryCacheAchievements(root, steamAppId)) {
      if (!metaMap.has(key)) metaMap.set(key, value)
    }
  }
  return metaMap
}

export function buildSteamAchievementList(steamAppId: string): SteamAchievementDetail[] {
  const metaMap = collectAchievementMeta(steamAppId)
  const stats = readSteamStatsAchievements(steamAppId)
  const statsMap = new Map(stats.map((s) => [s.apiname, s]))

  const apiNames = new Set([...metaMap.keys(), ...stats.map((s) => s.apiname)])

  if (apiNames.size === 0) return []

  const list: SteamAchievementDetail[] = []

  for (const apiname of apiNames) {
    const meta = metaMap.get(apiname)
    const stat = statsMap.get(apiname)
    const tier = mapPercentToTier(meta?.percent)

    list.push({
      steamAchievementId: apiname,
      name: meta?.name ?? humanizeApiName(apiname),
      description: meta?.description || 'Succès Steam',
      tier,
      icon: meta?.icon,
      unlocked: stat?.achieved === 1,
      unlockedAt:
        stat?.achieved === 1 && stat.unlocktime
          ? new Date(stat.unlocktime * 1000).toISOString()
          : undefined,
      rarityPercent: meta?.percent
    })
  }

  return list.sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1
    return a.name.localeCompare(b.name, 'fr')
  })
}

export function ensureSteamGameRecord(steamAppId: string, name?: string): string {
  const database = getDatabase()
  const existing = database
    .prepare(`SELECT id FROM games WHERE platform = 'steam' AND app_id = ?`)
    .get(steamAppId) as { id: string } | undefined

  if (existing) return existing.id

  const id = uuid()
  const now = new Date().toISOString()
  const gameName = name ?? `Jeu Steam ${steamAppId}`
  const coverUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${steamAppId}/library_600x900.jpg`
  const bannerUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${steamAppId}/library_hero.jpg`

  database.prepare(`
    INSERT INTO games (id, name, platform, app_id, cover_url, banner_url, added_at)
    VALUES (?, ?, 'steam', ?, ?, ?, ?)
  `).run(id, gameName, steamAppId, coverUrl, bannerUrl, now)

  return id
}

export function syncSteamAchievementsByAppId(steamAppId: string, gameName?: string): Trophy[] {
  const gameId = ensureSteamGameRecord(steamAppId, gameName)
  return syncSteamAchievements(gameId, steamAppId)
}
