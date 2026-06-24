import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { v4 as uuid } from 'uuid'
import { getDatabase } from '../database'
import { launchEpicGame } from './launcherUrls'
import { startEpicInstall } from './epicInstall'
import { launchEpicGameDirect } from './epicLaunch'
import {
  getEpicManifestsPath,
  getEpicGameInstallRoots,
  getLauncherInstalledPath,
  isEpicLauncherInstalled,
  getEpicLauncherInfo
} from './epicPath'

export { getEpicLauncherInfo, isEpicLauncherInstalled }

export interface EpicLibraryEntry {
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

interface EpicManifest {
  AppName?: string
  DisplayName?: string
  InstallLocation?: string
  CatalogNamespace?: string
  CatalogItemId?: string
  KeyImages?: Array<{ Type?: string; Url?: string }>
  CustomAttributes?: Array<{ Key?: string; Value?: string }>
}

function getInstalledAppNames(): Set<string> {
  const installedSet = new Set<string>()
  const installedPath = getLauncherInstalledPath()
  if (!installedPath) return installedSet

  try {
    const data = JSON.parse(readFileSync(installedPath, 'utf-8')) as {
      InstallationList?: Array<{ AppName?: string; InstallLocation?: string }>
    }
    for (const item of data.InstallationList ?? []) {
      if (item.AppName) installedSet.add(item.AppName)
    }
  } catch {
    // ignore
  }
  return installedSet
}

function scanEgstoreGames(installedSet: Set<string>): EpicLibraryEntry[] {
  const entries: EpicLibraryEntry[] = []

  for (const root of getEpicGameInstallRoots()) {
    let dirs: string[] = []
    try {
      dirs = readdirSync(root, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name !== 'Launcher' && d.name !== 'DirectXRedist')
        .map((d) => d.name)
    } catch {
      continue
    }

    for (const dirName of dirs) {
      const installPath = join(root, dirName)
      const egstorePath = join(installPath, '.egstore')
      if (!existsSync(egstorePath)) continue

      const displayName = dirName.replace(/([a-z])([A-Z])/g, '$1 $2')
      const appName = dirName

      entries.push({
        appName,
        name: displayName,
        installed: true,
        installPath,
        productSlug: dirName.toLowerCase()
      })
      installedSet.add(appName)
    }
  }

  return entries
}
function pickCoverImage(keyImages?: EpicManifest['KeyImages']): string | undefined {
  if (!keyImages?.length) return undefined
  const priority = ['DieselGameBoxTall', 'Thumbnail', 'DieselGameBox', 'OfferImageWide', 'OfferImageTall']
  for (const type of priority) {
    const img = keyImages.find((k) => k.Type === type && k.Url)
    if (img?.Url) return img.Url
  }
  return keyImages.find((k) => k.Url)?.Url
}

function pickBannerImage(keyImages?: EpicManifest['KeyImages']): string | undefined {
  if (!keyImages?.length) return undefined
  const img = keyImages.find((k) => (k.Type === 'OfferImageWide' || k.Type === 'DieselGameBox') && k.Url)
  return img?.Url ?? pickCoverImage(keyImages)
}

function readProductSlug(manifest: EpicManifest): string | undefined {
  const slugAttr = manifest.CustomAttributes?.find((a) => a.Key === 'CloudSaveFolder' || a.Key === 'FolderName')
  if (slugAttr?.Value) return slugAttr.Value.toLowerCase()

  const display = manifest.DisplayName?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return display || undefined
}

function parseManifestFile(filePath: string): EpicManifest | null {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as EpicManifest
  } catch {
    return null
  }
}

export function getEpicLibrary(): EpicLibraryEntry[] {
  const manifestsPath = getEpicManifestsPath()
  const installedSet = getInstalledAppNames()
  const entries = new Map<string, EpicLibraryEntry>()

  if (manifestsPath && existsSync(manifestsPath)) {
    for (const file of readdirSync(manifestsPath).filter((f) => f.endsWith('.item'))) {
      const manifest = parseManifestFile(join(manifestsPath, file))
      if (!manifest?.AppName || !manifest.DisplayName) continue

      const installPath = manifest.InstallLocation
      const installed =
        installedSet.has(manifest.AppName) ||
        (!!installPath && existsSync(installPath))

      entries.set(manifest.AppName, {
        appName: manifest.AppName,
        name: manifest.DisplayName,
        installed,
        installPath: installed && installPath && existsSync(installPath) ? installPath : undefined,
        coverUrl: pickCoverImage(manifest.KeyImages),
        bannerUrl: pickBannerImage(manifest.KeyImages),
        catalogNamespace: manifest.CatalogNamespace,
        catalogItemId: manifest.CatalogItemId,
        productSlug: readProductSlug(manifest)
      })
    }
  }

  for (const scanned of scanEgstoreGames(installedSet)) {
    if (!entries.has(scanned.appName)) {
      entries.set(scanned.appName, scanned)
    }
  }

  return [...entries.values()].sort((a, b) => {
    if (a.installed !== b.installed) return a.installed ? -1 : 1
    return a.name.localeCompare(b.name, 'fr')
  })
}

export function isEpicAvailable(): boolean {
  return isEpicLauncherInstalled()
}

export function syncEpicLibraryToDatabase(): { synced: number; installed: number; total: number } {
  const database = getDatabase()
  const entries = getEpicLibrary()
  let synced = 0
  let installedCount = 0

  for (const entry of entries) {
    if (entry.installed) installedCount++

    const existing = database
      .prepare(`SELECT * FROM games WHERE platform = 'epic' AND app_id = ?`)
      .get(entry.appName) as Record<string, unknown> | undefined

    if (existing) {
      database
        .prepare(
          `UPDATE games SET name = ?, install_path = ?, cover_url = ?, banner_url = ? WHERE id = ?`
        )
        .run(entry.name, entry.installPath ?? null, entry.coverUrl ?? null, entry.bannerUrl ?? null, existing.id)
    } else {
      const id = uuid()
      const now = new Date().toISOString()
      database.prepare(`
        INSERT INTO games (id, name, platform, app_id, install_path, cover_url, banner_url, added_at)
        VALUES (?, ?, 'epic', ?, ?, ?, ?, ?)
      `).run(id, entry.name, entry.appName, entry.installPath ?? null, entry.coverUrl ?? null, entry.bannerUrl ?? null, now)
    }
    synced++
  }

  return { synced, installed: installedCount, total: entries.length }
}

export async function launchEpicGameByAppName(appName: string): Promise<boolean> {
  const game = getEpicGameByAppName(appName)
  if (!game) {
    try {
      launchEpicGame(appName)
      return true
    } catch {
      return false
    }
  }
  return launchEpicGameDirect(game)
}

export async function installEpicGameByAppName(appName: string): Promise<boolean> {
  const result = await startEpicInstall(appName)
  return result.success
}

export function getEpicGameByAppName(appName: string): EpicLibraryEntry | null {
  return getEpicLibrary().find((g) => g.appName === appName) ?? null
}
