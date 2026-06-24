import { existsSync, readFileSync, readdirSync, mkdirSync, copyFileSync, unlinkSync, writeFileSync } from 'fs'
import { join, basename, extname } from 'path'
import { execSync } from 'child_process'
import {
  getSteamRoot,
  getStPluginPath,
  getStDepotCachePath
} from './steamPath'
import { getDatabase } from '../database'

export interface SteamToolsPlugin {
  appId: string
  fileName: string
  filePath: string
  depotIds: string[]
  hasManifest: boolean
}

export interface SteamToolsStatus {
  enabled: boolean
  available: boolean
  steamRoot: string | null
  pluginPath: string | null
  depotCachePath: string | null
  pluginCount: number
  gameCount: number
  steamToolsRunning: boolean
}

export interface SteamToolsImportResult {
  imported: Array<{ type: 'lua' | 'manifest'; fileName: string; appId?: string }>
  errors: string[]
}

export function isSteamToolsEnabledInSettings(): boolean {
  try {
    const db = getDatabase()
    const row = db.prepare("SELECT value FROM settings WHERE key = 'steamToolsEnabled'").get() as
      | { value: string }
      | undefined
    if (!row) return true
    return JSON.parse(row.value) as boolean
  } catch {
    return true
  }
}

function isSteamToolsProcessRunning(): boolean {
  if (process.platform !== 'win32') return false
  try {
    const output = execSync('tasklist /FI "IMAGENAME eq SteamTools.exe" /NH', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    })
    return output.toLowerCase().includes('steamtools.exe')
  } catch {
    return false
  }
}

function parseLuaAppIds(content: string): { appIds: string[]; depotIds: string[] } {
  const appIds: string[] = []
  const depotIds: string[] = []

  const addAppMatches = content.matchAll(/addappid\s*\(\s*(\d+)(?:\s*,\s*([^)]+))?\s*\)/gi)
  for (const match of addAppMatches) {
    const id = match[1]
    const hasExtraArgs = match[2] !== undefined
    if (!hasExtraArgs) {
      if (!appIds.includes(id)) appIds.push(id)
    } else if (!depotIds.includes(id)) {
      depotIds.push(id)
    }
  }

  return { appIds, depotIds }
}

function inferAppIdFromFileName(fileName: string): string | null {
  const base = basename(fileName, extname(fileName))
  if (/^\d+$/.test(base)) return base
  const match = base.match(/(\d{4,})/)
  return match?.[1] ?? null
}

function hasManifestForApp(steamRoot: string, appId: string, depotIds: string[]): boolean {
  const depotCache = getStDepotCachePath(steamRoot)
  if (!existsSync(depotCache)) return false

  const files = readdirSync(depotCache)
  if (files.some((f) => f.startsWith(`${appId}_`) || f === `${appId}.manifest`)) return true
  return depotIds.some((depot) => files.some((f) => f.startsWith(`${depot}_`) || f.includes(depot)))
}

export function getSteamToolsPlugins(): SteamToolsPlugin[] {
  if (!isSteamToolsEnabledInSettings()) return []

  const steamRoot = getSteamRoot()
  if (!steamRoot) return []

  const pluginPath = getStPluginPath(steamRoot)
  if (!existsSync(pluginPath)) return []

  const plugins: SteamToolsPlugin[] = []
  const seenAppIds = new Set<string>()

  for (const fileName of readdirSync(pluginPath)) {
    const lower = fileName.toLowerCase()
    if (!lower.endsWith('.lua') && !lower.endsWith('.st')) continue

    const filePath = join(pluginPath, fileName)
    let appId: string | null = inferAppIdFromFileName(fileName)
    let depotIds: string[] = []

    if (lower.endsWith('.lua')) {
      try {
        const content = readFileSync(filePath, 'utf-8')
        const parsed = parseLuaAppIds(content)
        depotIds = parsed.depotIds
        if (parsed.appIds.length > 0) appId = parsed.appIds[0]
      } catch {
        // skip unreadable
      }
    }

    if (!appId) continue
    if (seenAppIds.has(appId)) continue
    seenAppIds.add(appId)

    plugins.push({
      appId,
      fileName,
      filePath,
      depotIds,
      hasManifest: hasManifestForApp(steamRoot, appId, depotIds)
    })
  }

  return plugins
}

export function getSteamToolsAppIds(): Set<string> {
  return new Set(getSteamToolsPlugins().map((p) => p.appId))
}

export function getSteamToolsStatus(): SteamToolsStatus {
  const enabled = isSteamToolsEnabledInSettings()
  const steamRoot = getSteamRoot()
  const plugins = enabled ? getSteamToolsPlugins() : []

  return {
    enabled,
    available: steamRoot !== null && existsSync(getStPluginPath(steamRoot)),
    steamRoot,
    pluginPath: steamRoot ? getStPluginPath(steamRoot) : null,
    depotCachePath: steamRoot ? getStDepotCachePath(steamRoot) : null,
    pluginCount: plugins.length,
    gameCount: plugins.length,
    steamToolsRunning: isSteamToolsProcessRunning()
  }
}

function ensureDirs(steamRoot: string): { pluginPath: string; depotCachePath: string } {
  const pluginPath = getStPluginPath(steamRoot)
  const depotCachePath = getStDepotCachePath(steamRoot)
  mkdirSync(pluginPath, { recursive: true })
  mkdirSync(depotCachePath, { recursive: true })
  return { pluginPath, depotCachePath }
}

export function importSteamToolsFiles(sourcePaths: string[]): SteamToolsImportResult {
  const result: SteamToolsImportResult = { imported: [], errors: [] }
  const steamRoot = getSteamRoot()
  if (!steamRoot) {
    result.errors.push('Steam non détecté')
    return result
  }

  const { pluginPath, depotCachePath } = ensureDirs(steamRoot)

  for (const sourcePath of sourcePaths) {
    if (!existsSync(sourcePath)) {
      result.errors.push(`Fichier introuvable : ${sourcePath}`)
      continue
    }

    const ext = extname(sourcePath).toLowerCase()
    const fileName = basename(sourcePath)

    try {
      if (ext === '.lua') {
        const dest = join(pluginPath, fileName)
        copyFileSync(sourcePath, dest)
        const content = readFileSync(dest, 'utf-8')
        const { appIds } = parseLuaAppIds(content)
        result.imported.push({
          type: 'lua',
          fileName,
          appId: appIds[0] ?? inferAppIdFromFileName(fileName) ?? undefined
        })
      } else if (ext === '.manifest') {
        const dest = join(depotCachePath, fileName)
        copyFileSync(sourcePath, dest)
        result.imported.push({
          type: 'manifest',
          fileName,
          appId: inferAppIdFromFileName(fileName) ?? undefined
        })
      } else {
        result.errors.push(`Type non supporté : ${fileName}`)
      }
    } catch (err) {
      result.errors.push(`Erreur pour ${fileName} : ${(err as Error).message}`)
    }
  }

  return result
}

export function addSteamToolsAppId(appId: string): { success: boolean; filePath?: string; error?: string } {
  if (!/^\d+$/.test(appId)) return { success: false, error: 'App ID invalide' }

  const steamRoot = getSteamRoot()
  if (!steamRoot) return { success: false, error: 'Steam non détecté' }

  const { pluginPath } = ensureDirs(steamRoot)
  const fileName = `${appId}.lua`
  const filePath = join(pluginPath, fileName)

  const content = `addappid(${appId})\n`
  try {
    writeFileSync(filePath, content, 'utf-8')
    return { success: true, filePath }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export function removeSteamToolsPlugin(appId: string): { success: boolean; removed: string[] } {
  const steamRoot = getSteamRoot()
  if (!steamRoot) return { success: false, removed: [] }

  const pluginPath = getStPluginPath(steamRoot)
  if (!existsSync(pluginPath)) return { success: true, removed: [] }

  const removed: string[] = []
  for (const plugin of getSteamToolsPlugins()) {
    if (plugin.appId === appId) {
      try {
        unlinkSync(plugin.filePath)
        removed.push(plugin.fileName)
      } catch {
        // skip
      }
    }
  }

  return { success: removed.length > 0, removed }
}
