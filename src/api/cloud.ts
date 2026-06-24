/**
 * Cloud sync service scaffold.
 * Production deployment requires PostgreSQL + JWT auth server.
 *
 * Environment variables:
 * - CLOUD_API_URL: External API base URL
 * - CLOUD_JWT_SECRET: Shared secret for token validation
 */

export interface CloudSyncPayload {
  profile: Record<string, unknown>
  settings: Record<string, unknown>
  trophies: Record<string, unknown>[]
  timestamp: string
}

export async function syncToCloud(_payload: CloudSyncPayload, _token: string): Promise<boolean> {
  // Implement with fetch to CLOUD_API_URL when cloud server is deployed
  console.warn('[Cloud] Sync not configured. Set CLOUD_API_URL to enable.')
  return false
}

export async function pullFromCloud(_token: string): Promise<CloudSyncPayload | null> {
  return null
}
