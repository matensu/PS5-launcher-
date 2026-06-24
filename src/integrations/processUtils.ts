import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export function isProcessRunning(imageName: string): boolean {
  if (process.platform === 'win32') {
    try {
      const output = execSync(`tasklist /FI "IMAGENAME eq ${imageName}" /NH`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      })
      return output.toLowerCase().includes(imageName.toLowerCase())
    } catch {
      return false
    }
  }
  try {
    execSync(`pgrep -x ${imageName.replace('.exe', '')}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export function findExecutable(candidates: string[]): string | null {
  return candidates.find((p) => existsSync(p)) ?? null
}

export function getDiscordExe(): string | null {
  if (process.platform !== 'win32') return null
  const local = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
  return findExecutable([
    join(local, 'Discord', 'app-1.0.9', 'Discord.exe'),
    join(local, 'Discord', 'Update.exe')
  ])
}

export function getSpotifyExe(): string | null {
  if (process.platform !== 'win32') return null
  const appData = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming')
  return findExecutable([join(appData, 'Spotify', 'Spotify.exe')])
}
