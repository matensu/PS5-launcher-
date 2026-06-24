import { createHash, randomBytes } from 'crypto'
import { openUri } from '../launcher/launcherUrls'
import {
  clearIntegrationData,
  getIntegrationData,
  setIntegrationData,
  type SpotifyTokens
} from './integrationStore'
import { getSpotifyExe, isProcessRunning } from './processUtils'
import {
  desktopSessionToNowPlaying,
  desktopSpotifyControl,
  getDesktopSpotifySession,
  isDesktopMediaSupported
} from './mediaDesktop'

export type SpotifyConnectionSource = 'desktop' | 'api' | 'none'

export const SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:3848/callback/spotify'
export const SPOTIFY_SCOPES =
  'user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-private'

export interface SpotifyNowPlaying {
  connected: boolean
  isPlaying: boolean
  trackName?: string
  artistName?: string
  albumName?: string
  albumArtUrl?: string
  progressMs?: number
  durationMs?: number
  deviceName?: string
}

export interface SpotifyStatus {
  connected: boolean
  running: boolean
  source: SpotifyConnectionSource
  nowPlaying: SpotifyNowPlaying
}

let pendingAuth: { verifier: string; state: string; clientId: string } | null = null

function base64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function createSpotifyAuthRequest(clientId: string): { url: string; state: string } {
  const verifier = base64Url(randomBytes(32))
  const challenge = base64Url(createHash('sha256').update(verifier).digest())
  const state = base64Url(randomBytes(16))

  pendingAuth = { verifier, state, clientId }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state
  })

  return {
    url: `https://accounts.spotify.com/authorize?${params.toString()}`,
    state
  }
}

export function validateSpotifyCallback(state: string): { verifier: string; clientId: string } | null {
  if (!pendingAuth || pendingAuth.state !== state) return null
  const { verifier, clientId } = pendingAuth
  pendingAuth = null
  return { verifier, clientId }
}

async function spotifyTokenRequest(body: URLSearchParams): Promise<SpotifyTokens | null> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!res.ok) return null
  const data = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    scope: string
  }
  const existing = getIntegrationData<SpotifyTokens>('spotify')
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? existing?.refreshToken ?? '',
    expiresAt: Date.now() + data.expires_in * 1000 - 60_000,
    scope: data.scope
  }
}

export async function exchangeSpotifyCode(
  code: string,
  verifier: string,
  clientId: string
): Promise<boolean> {
  const tokens = await spotifyTokenRequest(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      client_id: clientId,
      code_verifier: verifier
    })
  )
  if (!tokens?.refreshToken) return false
  setIntegrationData('spotify', tokens)
  return true
}

async function refreshSpotifyAccessToken(clientId: string): Promise<string | null> {
  const tokens = getIntegrationData<SpotifyTokens>('spotify')
  if (!tokens?.refreshToken) return null

  if (tokens.expiresAt > Date.now()) return tokens.accessToken

  const refreshed = await spotifyTokenRequest(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: clientId
    })
  )
  if (!refreshed) return null
  setIntegrationData('spotify', refreshed)
  return refreshed.accessToken
}

export async function getSpotifyAccessToken(clientId: string): Promise<string | null> {
  if (!clientId.trim()) return null
  return refreshSpotifyAccessToken(clientId.trim())
}

export function disconnectSpotify(): void {
  clearIntegrationData('spotify')
  pendingAuth = null
}

export function isSpotifyConnected(): boolean {
  return getIntegrationData<SpotifyTokens>('spotify') !== null
}

export function isSpotifyDesktopConnected(): boolean {
  return isSpotifyRunning()
}

export function isSpotifyRunning(): boolean {
  return isProcessRunning('Spotify.exe')
}

export function openSpotify(): void {
  if (isSpotifyRunning()) {
    openUri('spotify:')
    return
  }
  const exe = getSpotifyExe()
  if (exe) {
    import('child_process').then(({ spawn }) => {
      spawn(exe, [], { detached: true, stdio: 'ignore' }).unref()
    })
    return
  }
  openUri('spotify:')
}

async function getSpotifyNowPlayingFromApi(clientId: string): Promise<SpotifyNowPlaying | null> {
  const token = await getSpotifyAccessToken(clientId)
  if (!token) return null

  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${token}` }
  })

  if (res.status === 204) return { connected: true, isPlaying: false }
  if (!res.ok) return null

  const data = (await res.json()) as {
    is_playing: boolean
    progress_ms?: number
    item?: {
      name: string
      duration_ms: number
      album?: { name: string; images?: Array<{ url: string }> }
      artists?: Array<{ name: string }>
    }
    device?: { name: string }
  }

  const item = data.item
  if (!item) return { connected: true, isPlaying: data.is_playing }

  return {
    connected: true,
    isPlaying: data.is_playing,
    trackName: item.name,
    artistName: item.artists?.map((a) => a.name).join(', '),
    albumName: item.album?.name,
    albumArtUrl: item.album?.images?.[0]?.url,
    progressMs: data.progress_ms,
    durationMs: item.duration_ms,
    deviceName: data.device?.name
  }
}

export async function getSpotifyNowPlaying(
  clientId: string,
  preferDesktop = true
): Promise<SpotifyNowPlaying> {
  const running = isSpotifyRunning()

  if (preferDesktop && isDesktopMediaSupported() && running) {
    const session = await getDesktopSpotifySession()
    const desktop = desktopSessionToNowPlaying(session, running)
    if (desktop.trackName) return desktop
    if (session?.found || running) {
      return { ...desktop, connected: true }
    }
  }

  if (clientId.trim()) {
    const api = await getSpotifyNowPlayingFromApi(clientId)
    if (api) return api
  }

  return {
    connected: running || isSpotifyConnected(),
    isPlaying: false
  }
}

export async function getSpotifyStatus(
  clientId: string,
  preferDesktop = true
): Promise<SpotifyStatus> {
  const running = isSpotifyRunning()
  let source: SpotifyConnectionSource = 'none'

  if (preferDesktop && isDesktopMediaSupported() && running) {
    const session = await getDesktopSpotifySession()
    const nowPlaying = desktopSessionToNowPlaying(session, running)
    if (nowPlaying.trackName || session?.found) {
      source = 'desktop'
      return { connected: true, running, source, nowPlaying }
    }
    if (running) {
      source = 'desktop'
      return { connected: true, running, source, nowPlaying }
    }
  }

  const nowPlaying = await getSpotifyNowPlaying(clientId, false)
  if (nowPlaying.trackName || (clientId && isSpotifyConnected())) {
    source = 'api'
    return { connected: nowPlaying.connected, running, source, nowPlaying }
  }

  return {
    connected: running,
    running,
    source,
    nowPlaying
  }
}

export async function spotifyPlaybackControl(
  clientId: string,
  action: 'play' | 'pause' | 'next' | 'previous',
  preferDesktop = true
): Promise<boolean> {
  if (preferDesktop && isDesktopMediaSupported() && isSpotifyRunning()) {
    const ok = await desktopSpotifyControl(action)
    if (ok) return true
  }

  const token = await getSpotifyAccessToken(clientId)
  if (!token) return false

  const endpoints: Record<typeof action, { method: string; path: string }> = {
    play: { method: 'PUT', path: '/me/player/play' },
    pause: { method: 'PUT', path: '/me/player/pause' },
    next: { method: 'POST', path: '/me/player/next' },
    previous: { method: 'POST', path: '/me/player/previous' }
  }

  const { method, path } = endpoints[action]
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` }
  })
  return res.ok || res.status === 204
}
