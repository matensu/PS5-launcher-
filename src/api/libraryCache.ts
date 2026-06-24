import { MemoryCache } from '../shared/memoryCache'

export const steamLibraryCache = new MemoryCache<unknown>(90_000)
export const epicLibraryCache = new MemoryCache<unknown>(90_000)
export const gamesListCache = new MemoryCache<unknown>(20_000)
export const steamGameCache = new MemoryCache<unknown>(120_000)
export const epicGameCache = new MemoryCache<unknown>(120_000)
export const storeSearchCache = new MemoryCache<unknown>(300_000)
export const statsCache = new MemoryCache<unknown>(15_000)

export function invalidateAllLibraryCaches(): void {
  steamLibraryCache.clear()
  epicLibraryCache.clear()
  gamesListCache.clear()
  steamGameCache.clear()
  epicGameCache.clear()
}

export function invalidateSteamCaches(): void {
  steamLibraryCache.clear()
  steamGameCache.clear()
  gamesListCache.clear()
}

export function invalidateEpicCaches(): void {
  epicLibraryCache.clear()
  epicGameCache.clear()
  gamesListCache.clear()
}
