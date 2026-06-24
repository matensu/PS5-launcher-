import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { getSteamExe, getSteamRoot, getSteamappsPaths } from './steamPath'

export type SteamInstallPhase =
  | 'unavailable'
  | 'starting'
  | 'queued'
  | 'downloading'
  | 'installing'
  | 'complete'
  | 'error'

export interface SteamInstallStatus {
  appId: string
  phase: SteamInstallPhase
  progress: number
  bytesDownloaded: number
  bytesTotal: number
  gameName?: string
  installPath?: string
  message?: string
}

const activeInstalls = new Set<string>()

function parseVdfValue(content: string, key: string): string | null {
  const regex = new RegExp(`"${key}"\\s+"([^"]*)"`, 'i')
  return content.match(regex)?.[1] ?? null
}

function parseManifest(appId: string, steamappsPath: string): SteamInstallStatus | null {
  const manifestPath = join(steamappsPath, `appmanifest_${appId}.acf`)
  if (!existsSync(manifestPath)) return null

  try {
    const content = readFileSync(manifestPath, 'utf-8')
    const name = parseVdfValue(content, 'name') ?? undefined
    const installdir = parseVdfValue(content, 'installdir')
    const stateFlags = Number.parseInt(parseVdfValue(content, 'StateFlags') ?? '0', 10)
    const bytesDownloaded = Number.parseInt(parseVdfValue(content, 'BytesDownloaded') ?? '0', 10)
    const bytesTotal = Number.parseInt(parseVdfValue(content, 'BytesToDownload') ?? '0', 10)

    const commonPath = join(steamappsPath, 'common')
    const installPath = installdir ? join(commonPath, installdir) : undefined
    const installed = (stateFlags & 4) === 4 && installPath && existsSync(installPath)

    if (installed) {
      return {
        appId,
        phase: 'complete',
        progress: 100,
        bytesDownloaded: bytesTotal || bytesDownloaded,
        bytesTotal: bytesTotal || bytesDownloaded,
        gameName: name,
        installPath
      }
    }

    if (bytesTotal > 0) {
      const progress = Math.min(99, Math.round((bytesDownloaded / bytesTotal) * 100))
      return {
        appId,
        phase: 'downloading',
        progress,
        bytesDownloaded,
        bytesTotal,
        gameName: name,
        message: 'Téléchargement en cours...'
      }
    }

    if (stateFlags > 0 || activeInstalls.has(appId)) {
      return {
        appId,
        phase: 'installing',
        progress: 5,
        bytesDownloaded: 0,
        bytesTotal: 0,
        gameName: name,
        message: 'Préparation de l\'installation...'
      }
    }

    return {
      appId,
      phase: 'queued',
      progress: 0,
      bytesDownloaded: 0,
      bytesTotal: 0,
      gameName: name,
      message: 'En attente dans Steam...'
    }
  } catch {
    return null
  }
}

export function getSteamInstallStatus(appId: string): SteamInstallStatus {
  const root = getSteamRoot()
  if (!root) {
    return {
      appId,
      phase: 'unavailable',
      progress: 0,
      bytesDownloaded: 0,
      bytesTotal: 0,
      message: 'Steam non détecté'
    }
  }

  for (const steamappsPath of getSteamappsPaths(root)) {
    const status = parseManifest(appId, steamappsPath)
    if (status) {
      if (status.phase === 'complete') activeInstalls.delete(appId)
      return status
    }
  }

  if (activeInstalls.has(appId)) {
    return {
      appId,
      phase: 'starting',
      progress: 0,
      bytesDownloaded: 0,
      bytesTotal: 0,
      message: 'Démarrage de l\'installation...'
    }
  }

  return {
    appId,
    phase: 'queued',
    progress: 0,
    bytesDownloaded: 0,
    bytesTotal: 0,
    message: 'Prêt à installer'
  }
}

export async function startSteamInstall(appId: string): Promise<{ success: boolean; error?: string }> {
  const steamExe = getSteamExe()
  if (!steamExe) {
    return { success: false, error: 'Steam non trouvé sur ce PC' }
  }

  activeInstalls.add(appId)

  try {
    const uri = `steam://install/${appId}`
    if (process.platform === 'win32') {
      spawn(steamExe, ['-silent', uri], { detached: true, stdio: 'ignore' }).unref()
    } else {
      spawn(steamExe, [uri], { detached: true, stdio: 'ignore' }).unref()
    }
    return { success: true }
  } catch {
    activeInstalls.delete(appId)
    return { success: false, error: 'Impossible de lancer l\'installation' }
  }
}

export function clearSteamInstallTracking(appId: string): void {
  activeInstalls.delete(appId)
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 o'
  const units = ['o', 'Ko', 'Mo', 'Go']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** i
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatInstallProgress(status: SteamInstallStatus): string {
  if (status.phase === 'complete') return 'Installation terminée'
  if (status.bytesTotal > 0) {
    return `${formatBytes(status.bytesDownloaded)} / ${formatBytes(status.bytesTotal)}`
  }
  return status.message ?? 'Installation en cours...'
}
