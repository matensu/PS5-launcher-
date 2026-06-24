import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { getEpicManifestsPath, isEpicLauncherInstalled } from './epicPath'
import { installEpicGame } from './launcherUrls'

export type EpicInstallPhase =
  | 'unavailable'
  | 'starting'
  | 'downloading'
  | 'complete'
  | 'error'

export interface EpicInstallStatus {
  appName: string
  phase: EpicInstallPhase
  progress: number
  gameName?: string
  installPath?: string
  message?: string
}

const activeEpicInstalls = new Set<string>()

function parseManifestFile(filePath: string): {
  AppName?: string
  DisplayName?: string
  InstallLocation?: string
} | null {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as {
      AppName?: string
      DisplayName?: string
      InstallLocation?: string
    }
  } catch {
    return null
  }
}

export function getEpicInstallStatus(appName: string): EpicInstallStatus {
  const manifestsPath = getEpicManifestsPath()
  if (!manifestsPath || !existsSync(manifestsPath)) {
    return {
      appName,
      phase: activeEpicInstalls.has(appName) ? 'starting' : 'unavailable',
      progress: activeEpicInstalls.has(appName) ? 10 : 0,
      message: activeEpicInstalls.has(appName)
        ? 'Démarrage via Epic Games...'
        : 'Epic Games Launcher non détecté'
    }
  }

  for (const file of readdirSync(manifestsPath).filter((f) => f.endsWith('.item'))) {
    const manifest = parseManifestFile(join(manifestsPath, file))
    if (manifest?.AppName !== appName) continue

    const installPath = manifest.InstallLocation
    const installed = !!installPath && existsSync(installPath)

    if (installed) {
      activeEpicInstalls.delete(appName)
      return {
        appName,
        phase: 'complete',
        progress: 100,
        gameName: manifest.DisplayName,
        installPath,
        message: 'Installation terminée'
      }
    }

    if (activeEpicInstalls.has(appName)) {
      return {
        appName,
        phase: 'downloading',
        progress: 40,
        gameName: manifest.DisplayName,
        message: 'Téléchargement via Epic Games Launcher...'
      }
    }
  }

  if (activeEpicInstalls.has(appName)) {
    return {
      appName,
      phase: 'downloading',
      progress: 15,
      message: 'Téléchargement en cours via Epic...'
    }
  }

  return {
    appName,
    phase: 'starting',
    progress: 0,
    message: 'En attente...'
  }
}

export async function startEpicInstall(appName: string): Promise<{ success: boolean; error?: string }> {
  if (!isEpicLauncherInstalled()) {
    return { success: false, error: 'Epic Games Launcher non détecté' }
  }

  activeEpicInstalls.add(appName)

  try {
    installEpicGame(appName)
    return { success: true }
  } catch {
    activeEpicInstalls.delete(appName)
    return { success: false, error: 'Impossible de lancer l\'installation Epic' }
  }
}

export function clearEpicInstallTracking(appName: string): void {
  activeEpicInstalls.delete(appName)
}
