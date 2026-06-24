import { getDatabase } from '../database'

export type IntegrationProvider = 'spotify' | 'discord'

export interface SpotifyTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
  scope: string
}

export function getIntegrationData<T>(provider: IntegrationProvider): T | null {
  const db = getDatabase()
  const row = db
    .prepare('SELECT data FROM integration_tokens WHERE provider = ?')
    .get(provider) as { data: string } | undefined
  if (!row) return null
  try {
    return JSON.parse(row.data) as T
  } catch {
    return null
  }
}

export function setIntegrationData(provider: IntegrationProvider, data: unknown): void {
  const db = getDatabase()
  db.prepare('INSERT OR REPLACE INTO integration_tokens (provider, data) VALUES (?, ?)').run(
    provider,
    JSON.stringify(data)
  )
}

export function clearIntegrationData(provider: IntegrationProvider): void {
  const db = getDatabase()
  db.prepare('DELETE FROM integration_tokens WHERE provider = ?').run(provider)
}
