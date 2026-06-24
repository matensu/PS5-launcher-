import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import { getDbPath } from '../database'

let memoryCache: Map<string, string> | null = null

function getCachePath(): string {
  const userData = app?.getPath?.('userData') ?? dirname(getDbPath())
  return join(userData, 'steam-name-cache.json')
}

function getLegacyCachePath(): string {
  const userData = app?.getPath?.('userData') ?? dirname(getDbPath())
  return join(userData, 'steam-app-list.json')
}

function readCacheFile(path: string): Map<string, string> | null {
  if (!existsSync(path)) return null
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as {
      apps?: Record<string, string>
      fetchedAt?: number
    }
    if (raw.apps && typeof raw.apps === 'object') {
      return new Map(Object.entries(raw.apps))
    }
  } catch {
    // ignore
  }
  return null
}

function loadFromDisk(): Map<string, string> {
  const map = readCacheFile(getCachePath()) ?? new Map<string, string>()

  const legacy = readCacheFile(getLegacyCachePath())
  if (legacy) {
    for (const [appId, name] of legacy) {
      if (!map.has(appId)) map.set(appId, name)
    }
  }

  return map
}

function persistToDisk(): void {
  if (!memoryCache) return
  const cachePath = getCachePath()
  mkdirSync(dirname(cachePath), { recursive: true })
  writeFileSync(
    cachePath,
    JSON.stringify({ updatedAt: Date.now(), apps: Object.fromEntries(memoryCache) }),
    'utf-8'
  )
}

/** Cache local des noms Steam (remplit via l'API Store, plus de liste globale Steam). */
export async function loadAppListMap(): Promise<Map<string, string>> {
  if (!memoryCache) {
    memoryCache = loadFromDisk()
  }
  return memoryCache
}

export function getAppNameFromCache(appId: string): string | null {
  return memoryCache?.get(appId) ?? null
}

export function saveNameToCache(appId: string, name: string): void {
  if (!name.trim()) return
  if (!memoryCache) memoryCache = loadFromDisk()
  if (memoryCache.get(appId) === name) return
  memoryCache.set(appId, name)
  persistToDisk()
}

export async function resolveSteamAppName(appId: string): Promise<string | null> {
  const map = await loadAppListMap()
  return map.get(appId) ?? null
}
