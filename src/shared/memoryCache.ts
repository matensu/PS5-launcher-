interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class MemoryCache<T> {
  private store = new Map<string, CacheEntry<T>>()

  constructor(private defaultTtlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs)
    })
  }

  getOrSet(key: string, factory: () => T, ttlMs?: number): T {
    const cached = this.get(key)
    if (cached !== undefined) return cached
    const value = factory()
    this.set(key, value, ttlMs)
    return value
  }

  async getOrSetAsync(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get(key)
    if (cached !== undefined) return cached
    const value = await factory()
    this.set(key, value, ttlMs)
    return value
  }

  invalidate(keyOrPattern: string | RegExp): void {
    if (typeof keyOrPattern === 'string') {
      this.store.delete(keyOrPattern)
      return
    }
    for (const key of this.store.keys()) {
      if (keyOrPattern.test(key)) this.store.delete(key)
    }
  }

  clear(): void {
    this.store.clear()
  }
}
