import { existsSync, readFileSync } from 'fs'
import { join, normalize } from 'path'
import { homedir } from 'os'
import { execSync } from 'child_process'

export interface EpicLauncherInfo {
  installed: boolean
  launcherExe?: string
  manifestsPath?: string
  manifestsExist: boolean
  dataRoot?: string
}

function readWindowsRegistryValue(key: string, valueName: string): string | null {
  if (process.platform !== 'win32') return null
  try {
    const output = execSync(`reg query "${key}" /v "${valueName}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    })
    const match = output.match(new RegExp(`${valueName}\\s+REG_\\w+\\s+(.+)`))
    return match?.[1]?.trim().replace(/\//g, '\\') ?? null
  } catch {
    return null
  }
}

export function getEpicLauncherExe(): string | null {
  const fromRegistry = readWindowsRegistryValue(
    'HKCU\\Software\\Epic Games\\EOS',
    'ModSdkCommand'
  )
  if (fromRegistry && existsSync(fromRegistry)) return fromRegistry

  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Epic Games\\Launcher\\Portal\\Binaries\\Win64\\EpicGamesLauncher.exe',
          'C:\\Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win64\\EpicGamesLauncher.exe'
        ]
      : [
          join(homedir(), '.local', 'share', 'EpicGamesLauncher', 'EpicGamesLauncher'),
          '/Applications/Epic Games Launcher.app/Contents/MacOS/EpicGamesLauncher'
        ]

  return candidates.find((p) => existsSync(p)) ?? null
}

export function getEpicDataRoot(): string | null {
  const candidates =
    process.platform === 'win32'
      ? [join(process.env.ProgramData ?? 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher')]
      : [join(homedir(), '.config', 'Epic', 'EpicGamesLauncher')]

  return candidates.find((p) => existsSync(p)) ?? null
}

export function getEpicManifestsPath(): string | null {
  const fromRegistry = readWindowsRegistryValue(
    'HKCU\\Software\\Epic Games\\EOS',
    'ModSdkMetadataDir'
  )
  if (fromRegistry) return normalize(fromRegistry)

  const candidates =
    process.platform === 'win32'
      ? [
          join(process.env.ProgramData ?? 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests'),
          join(homedir(), 'AppData', 'Local', 'EpicGamesLauncher', 'Saved', 'Manifests')
        ]
      : [join(homedir(), '.config', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests')]

  const existing = candidates.find((p) => existsSync(p))
  if (existing) return existing

  const dataRoot = getEpicDataRoot()
  if (dataRoot) return join(dataRoot, 'Data', 'Manifests')

  return candidates[0] ?? null
}

export function getLauncherInstalledPath(): string | null {
  const candidates =
    process.platform === 'win32'
      ? [
          join(process.env.ProgramData ?? 'C:\\ProgramData', 'Epic', 'UnrealEngineLauncher', 'LauncherInstalled.dat'),
          join(process.env.ProgramData ?? 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'LauncherInstalled.dat')
        ]
      : [join(homedir(), '.config', 'Epic', 'EpicGamesLauncher', 'LauncherInstalled.dat')]

  return candidates.find((p) => existsSync(p)) ?? null
}

export function getEpicGameInstallRoots(): string[] {
  const roots = new Set<string>()

  if (process.platform === 'win32') {
    roots.add('C:\\Program Files\\Epic Games')
    roots.add('C:\\Program Files (x86)\\Epic Games')
    const programFiles = process.env.ProgramFiles
    const programFilesX86 = process.env['ProgramFiles(x86)']
    if (programFiles) roots.add(join(programFiles, 'Epic Games'))
    if (programFilesX86) roots.add(join(programFilesX86, 'Epic Games'))
  }

  const installedPath = getLauncherInstalledPath()
  if (installedPath) {
    try {
      const data = JSON.parse(readFileSync(installedPath, 'utf-8')) as {
        InstallationList?: Array<{ InstallLocation?: string }>
      }
      for (const item of data.InstallationList ?? []) {
        if (item.InstallLocation) {
          const parent = join(item.InstallLocation, '..')
          roots.add(normalize(parent))
        }
      }
    } catch {
      // ignore
    }
  }

  return [...roots].filter((p) => existsSync(p))
}

export function isEpicLauncherInstalled(): boolean {
  if (getEpicLauncherExe()) return true
  if (getEpicDataRoot()) return true
  if (process.platform === 'win32') {
    if (readWindowsRegistryValue('HKCU\\Software\\Epic Games\\EpicGamesLauncher', 'LauncherUsingEOSH')) {
      return true
    }
  }
  return false
}

export function getEpicLauncherInfo(): EpicLauncherInfo {
  const manifestsPath = getEpicManifestsPath() ?? undefined
  const installed = isEpicLauncherInstalled()

  return {
    installed,
    launcherExe: getEpicLauncherExe() ?? undefined,
    manifestsPath,
    manifestsExist: !!manifestsPath && existsSync(manifestsPath),
    dataRoot: getEpicDataRoot() ?? undefined
  }
}
