import type { EpicLibraryEntry } from './epicLibrary'

const imageCache = new Map<string, { coverUrl?: string; bannerUrl?: string }>()

function pickImages(keyImages?: Array<{ type?: string; url?: string }>): {
  coverUrl?: string
  bannerUrl?: string
} {
  if (!keyImages?.length) return {}
  const cover =
    keyImages.find((k) => k.type === 'DieselGameBoxTall' && k.url)?.url ??
    keyImages.find((k) => k.type === 'Thumbnail' && k.url)?.url ??
    keyImages.find((k) => k.type === 'DieselGameBox' && k.url)?.url
  const banner =
    keyImages.find((k) => k.type === 'OfferImageWide' && k.url)?.url ??
    keyImages.find((k) => k.type === 'DieselGameBox' && k.url)?.url ??
    cover
  return { coverUrl: cover, bannerUrl: banner }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function fetchBySlug(slug: string): Promise<{ coverUrl?: string; bannerUrl?: string }> {
  const cached = imageCache.get(`slug:${slug}`)
  if (cached) return cached

  const data = await fetchJson<{
    data?: {
      keyImages?: Array<{ type?: string; url?: string }>
    }
  }>(
    `https://store-site-backend-static.ak.epicgames.com/api/en-US/content/products/${encodeURIComponent(slug)}`
  )

  const images = pickImages(data?.data?.keyImages)
  if (images.coverUrl) imageCache.set(`slug:${slug}`, images)
  return images
}

async function fetchBySearch(name: string): Promise<{ coverUrl?: string; bannerUrl?: string }> {
  const cacheKey = `name:${name.toLowerCase()}`
  const cached = imageCache.get(cacheKey)
  if (cached) return cached

  const encoded = encodeURIComponent(name.trim())
  const data = await fetchJson<{
    elements?: Array<{
      title?: string
      keyImages?: Array<{ type?: string; url?: string }>
    }>
  }>(
    `https://store-site-backend-static.ak.epicgames.com/storefront/api/search/v2?q=${encoded}&country=FR&locale=fr&store=EGS`
  )

  const normalized = name.toLowerCase().trim()
  const match =
    data?.elements?.find((el) => el.title?.toLowerCase().trim() === normalized) ??
    data?.elements?.[0]

  const images = pickImages(match?.keyImages)
  if (images.coverUrl) imageCache.set(cacheKey, images)
  return images
}

export async function enrichEpicEntryImages(
  entry: EpicLibraryEntry
): Promise<EpicLibraryEntry> {
  if (entry.coverUrl && entry.bannerUrl) return entry

  let images: { coverUrl?: string; bannerUrl?: string } = {}

  if (entry.productSlug) {
    images = await fetchBySlug(entry.productSlug)
  }
  if (!images.coverUrl) {
    images = await fetchBySearch(entry.name)
  }

  return {
    ...entry,
    coverUrl: entry.coverUrl ?? images.coverUrl,
    bannerUrl: entry.bannerUrl ?? images.bannerUrl ?? images.coverUrl
  }
}

export async function enrichEpicLibraryImages(
  entries: EpicLibraryEntry[]
): Promise<EpicLibraryEntry[]> {
  const needsEnrich = entries.filter((e) => !e.coverUrl)
  if (needsEnrich.length === 0) return entries

  const enriched = await Promise.all(
    entries.map(async (entry) => {
      if (entry.coverUrl) return entry
      return enrichEpicEntryImages(entry)
    })
  )

  return enriched
}

export async function enrichEpicLibraryImagesWithTimeout(
  entries: EpicLibraryEntry[],
  timeoutMs = 1500
): Promise<EpicLibraryEntry[]> {
  return Promise.race([
    enrichEpicLibraryImages(entries),
    new Promise<EpicLibraryEntry[]>((resolve) => {
      setTimeout(() => resolve(entries), timeoutMs)
    })
  ])
}
