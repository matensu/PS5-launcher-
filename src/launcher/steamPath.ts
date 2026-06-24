import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export function getSteamRoot(): string | null {
  const candidates: string[] = []
  if (process.platform === 'win32') {
    candidates.push('C:\\Program Files (x86)\\Steam')
    candidates.push('C:\\Program Files\\Steam')
    const programFiles = process.env['ProgramFiles(x86)'] ?? process.env.ProgramFiles
    if (programFiles) candidates.push(join(programFiles, 'Steam'))
  } else {
    candidates.push(join(homedir(), '.steam', 'steam'))
    candidates.push(join(homedir(), '.local', 'share', 'Steam'))
  }
  return candidates.find((p) => existsSync(join(p, 'steamapps'))) ?? null
}

export function getSteamExe(): string | null {
  const root = getSteamRoot()
  if (!root) return null
  const exe = process.platform === 'win32' ? join(root, 'steam.exe') : join(root, 'steam.sh')
  return existsSync(exe) ? exe : null
}

export function getSteamappsPaths(steamRoot: string): string[] {
  const paths = [join(steamRoot, 'steamapps')]
  const libraryFoldersPath = join(steamRoot, 'steamapps', 'libraryfolders.vdf')
  if (!existsSync(libraryFoldersPath)) return paths

  try {
    const content = readFileSync(libraryFoldersPath, 'utf-8')
    const pathMatches = content.matchAll(/"path"\s+"([^"]+)"/g)
    for (const match of pathMatches) {
      const libPath = match[1].replace(/\\\\/g, '\\')
      const steamapps = join(libPath, 'steamapps')
      if (existsSync(steamapps)) paths.push(steamapps)
    }
  } catch {
    // ignore
  }
  return [...new Set(paths)]
}

export function getSteamConfigPath(steamRoot: string): string {
  return join(steamRoot, 'config')
}

export function getStPluginPath(steamRoot: string): string {
  return join(steamRoot, 'config', 'stplug-in')
}

export function getStDepotCachePath(steamRoot: string): string {
  return join(steamRoot, 'config', 'depotcache')
}
