import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'
import type { SpotifyNowPlaying } from './spotify'

const execFileAsync = promisify(execFile)

const integrationDir = dirname(fileURLToPath(import.meta.url))

function scriptPath(name: string): string {
  const candidates = [
    join(integrationDir, 'scripts', name),
    join(process.cwd(), 'src', 'integrations', 'scripts', name),
    join(process.cwd(), 'scripts', name)
  ]
  const found = candidates.find((p) => existsSync(p))
  if (!found) throw new Error(`Script introuvable: ${name}`)
  return found
}

export interface DesktopMediaSession {
  found: boolean
  appId?: string
  title?: string
  artist?: string
  album?: string
  isPlaying?: boolean
  positionMs?: number
  durationMs?: number
}

const VK = {
  play_pause: 0xb3,
  next: 0xb0,
  previous: 0xb1
} as const

function parseSpotifyWindowTitle(raw: string): { artist: string; title: string } {
  const normalized = raw.replace(/\s*[–—]\s*/g, ' - ').trim()
  const parts = normalized.split(' - ').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return { artist: parts[0], title: parts.slice(1).join(' - ') }
  }
  return { artist: '', title: raw.trim() }
}

async function runPowerShellFile(script: string, args: string[] = []): Promise<string> {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, ...args],
    { timeout: 8000, windowsHide: true, maxBuffer: 1024 * 512, encoding: 'utf8' }
  )
  return stdout.trim()
}

export async function getWindowsSpotifySession(): Promise<DesktopMediaSession | null> {
  if (process.platform !== 'win32') return null
  try {
    const output = await runPowerShellFile(scriptPath('spotify-window.ps1'))
    if (!output) return null
    const data = JSON.parse(output) as { found: boolean; rawTitle?: string }
    if (!data.found || !data.rawTitle) return null

    const { artist, title } = parseSpotifyWindowTitle(data.rawTitle)
    return {
      found: true,
      appId: 'Spotify',
      title,
      artist,
      isPlaying: true
    }
  } catch {
    return null
  }
}

export async function windowsSpotifyControl(
  action: 'play' | 'pause' | 'next' | 'previous'
): Promise<boolean> {
  if (process.platform !== 'win32') return false
  const vk =
    action === 'next' ? VK.next : action === 'previous' ? VK.previous : VK.play_pause
  try {
    await runPowerShellFile(scriptPath('media-key.ps1'), ['-Vk', String(vk)])
    return true
  } catch {
    return false
  }
}

async function getLinuxSpotifySession(): Promise<DesktopMediaSession | null> {
  if (process.platform === 'win32') return null
  try {
    const { stdout } = await execFileAsync(
      'playerctl',
      ['-p', 'spotify', 'metadata', '--format', '{{title}}|{{artist}}|{{album}}|{{status}}|{{position}}|{{mpris:length}}'],
      { timeout: 3000 }
    )
    const line = stdout.trim()
    if (!line) return null
    const [title, artist, album, status, position, length] = line.split('|')
    if (!title) return null
    return {
      found: true,
      appId: 'spotify',
      title,
      artist,
      album,
      isPlaying: status === 'Playing',
      positionMs: Number(position) / 1000,
      durationMs: Number(length) / 1000
    }
  } catch {
    return null
  }
}

export async function linuxSpotifyControl(
  action: 'play' | 'pause' | 'next' | 'previous'
): Promise<boolean> {
  const cmd =
    action === 'play'
      ? 'play'
      : action === 'pause'
        ? 'pause'
        : action === 'next'
          ? 'next'
          : 'previous'
  try {
    await execFileAsync('playerctl', ['-p', 'spotify', cmd], { timeout: 3000 })
    return true
  } catch {
    return false
  }
}

export async function getDesktopSpotifySession(): Promise<DesktopMediaSession | null> {
  if (process.platform === 'win32') return getWindowsSpotifySession()
  return getLinuxSpotifySession()
}

export async function desktopSpotifyControl(
  action: 'play' | 'pause' | 'next' | 'previous'
): Promise<boolean> {
  if (process.platform === 'win32') return windowsSpotifyControl(action)
  return linuxSpotifyControl(action)
}

export function desktopSessionToNowPlaying(
  session: DesktopMediaSession | null,
  running: boolean
): SpotifyNowPlaying {
  if (!session?.found || !session.title) {
    return { connected: running, isPlaying: false, deviceName: 'Spotify Desktop' }
  }
  return {
    connected: true,
    isPlaying: session.isPlaying ?? true,
    trackName: session.title,
    artistName: session.artist || undefined,
    albumName: session.album,
    progressMs: session.positionMs,
    durationMs: session.durationMs,
    deviceName: 'Spotify Desktop'
  }
}

export function isDesktopMediaSupported(): boolean {
  return process.platform === 'win32' || process.platform === 'linux'
}
