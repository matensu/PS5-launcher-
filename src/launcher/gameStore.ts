import { openEpicStoreProduct, openSteamStoreApp } from './launcherUrls'

export interface StoreGameItem {
  id: string
  name: string
  platform: 'steam' | 'epic'
  coverUrl?: string
  price?: string
  originalPrice?: string
  discountLabel?: string
  productSlug?: string
  appId?: string
  isFree?: boolean
}

export interface StoreSearchResult {
  games: StoreGameItem[]
  query?: string
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'PC-Console-OS/1.0' }
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function searchSteamStore(query: string): Promise<StoreGameItem[]> {
  if (!query.trim()) return getSteamFeatured()

  const encoded = encodeURIComponent(query.trim())
  const data = await fetchJson<{
    items?: Array<{
      id: number
      name: string
      tiny_image?: string
      price?: { final?: number; initial?: number; discount_percent?: number }
    }>
  }>(`https://store.steampowered.com/api/storesearch/?term=${encoded}&l=french&cc=FR`)

  return (data?.items ?? []).slice(0, 40).map((item) => ({
    id: `steam-${item.id}`,
    name: item.name,
    platform: 'steam' as const,
    appId: String(item.id),
    coverUrl: item.tiny_image,
    price: item.price?.final !== undefined ? formatCents(item.price.final) : undefined,
    originalPrice: item.price?.initial !== undefined ? formatCents(item.price.initial) : undefined,
    discountLabel: item.price?.discount_percent ? `-${item.price.discount_percent}%` : undefined,
    isFree: item.price?.final === 0
  }))
}

export async function getSteamFeatured(): Promise<StoreGameItem[]> {
  const data = await fetchJson<{
    specials?: { items?: Array<{ id: number; name: string; tiny_image?: string }> }
    top_sellers?: { items?: Array<{ id: number; name: string; tiny_image?: string }> }
    new_releases?: { items?: Array<{ id: number; name: string; tiny_image?: string }> }
  }>('https://store.steampowered.com/api/featuredcategories/?l=french&cc=FR')

  const items = [
    ...(data?.specials?.items ?? []),
    ...(data?.top_sellers?.items ?? []),
    ...(data?.new_releases?.items ?? [])
  ]

  const seen = new Set<number>()
  return items
    .filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
    .slice(0, 36)
    .map((item) => ({
      id: `steam-${item.id}`,
      name: item.name,
      platform: 'steam' as const,
      appId: String(item.id),
      coverUrl: item.tiny_image?.replace('116x65', '600x900').replace('292x136', '600x900') ?? item.tiny_image
    }))
}

export async function searchEpicStore(query: string): Promise<StoreGameItem[]> {
  if (!query.trim()) return getEpicFeatured()

  const encoded = encodeURIComponent(query.trim())
  const data = await fetchJson<{
    elements?: Array<{
      title?: string
      productSlug?: string
      keyImages?: Array<{ type?: string; url?: string }>
      price?: { totalPrice?: { fmtPrice?: { originalPrice?: string; discountPrice?: string } } }
      promotions?: { promotionalOffers?: Array<{ promotionalOffers?: Array<{ discountSetting?: { discountPercentage?: number } }> }> }
    }>
  }>(
    `https://store-site-backend-static.ak.epicgames.com/storefront/api/search/v2?q=${encoded}&country=FR&locale=fr&store=EGS`
  )

  return (data?.elements ?? []).slice(0, 40).map((el, i) => {
    const cover = el.keyImages?.find((k) => k.type === 'DieselGameBoxTall' || k.type === 'Thumbnail')?.url
    const discount = el.promotions?.promotionalOffers?.[0]?.promotionalOffers?.[0]?.discountSetting?.discountPercentage
    return {
      id: `epic-${el.productSlug ?? i}`,
      name: el.title ?? 'Jeu Epic',
      platform: 'epic' as const,
      productSlug: el.productSlug,
      coverUrl: cover,
      price: el.price?.totalPrice?.fmtPrice?.discountPrice,
      originalPrice: el.price?.totalPrice?.fmtPrice?.originalPrice,
      discountLabel: discount ? `-${Math.round(discount)}%` : undefined,
      isFree: el.price?.totalPrice?.fmtPrice?.discountPrice === '0' || el.price?.totalPrice?.fmtPrice?.discountPrice === 'Gratuit'
    }
  })
}

export async function getEpicFeatured(): Promise<StoreGameItem[]> {
  const [browse, free] = await Promise.all([
    fetchJson<{
      data?: {
        elements?: Array<{
          title?: string
          productSlug?: string
          keyImages?: Array<{ type?: string; url?: string }>
          price?: { totalPrice?: { fmtPrice?: { originalPrice?: string; discountPrice?: string } } }
        }>
      }
    }>(
      'https://store-site-backend-static-ipv4.ak.epicgames.com/storefront/api/browse/v2?category=1&count=24&country=FR&locale=fr&sortBy=releaseDate&sortOrder=DESC&allowCountries=FR'
    ),
    fetchJson<{
      data?: {
        Catalog?: {
          searchStore?: {
            elements?: Array<{
              title?: string
              productSlug?: string
              keyImages?: Array<{ type?: string; url?: string }>
              price?: { totalPrice?: { fmtPrice?: { originalPrice?: string; discountPrice?: string } } }
            }>
          }
        }
      }
    }>('https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=fr-FR&country=FR')
  ])

  const freeGames = free?.data?.Catalog?.searchStore?.elements ?? []
  const browseGames = browse?.data?.elements ?? []
  const combined = [...freeGames, ...browseGames]

  const seen = new Set<string>()
  return combined
    .filter((el) => {
      const key = el.productSlug ?? el.title ?? ''
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 36)
    .map((el, i) => {
      const cover = el.keyImages?.find((k) => k.type === 'DieselGameBoxTall' || k.type === 'Thumbnail')?.url
      return {
        id: `epic-${el.productSlug ?? i}`,
        name: el.title ?? 'Jeu Epic',
        platform: 'epic' as const,
        productSlug: el.productSlug,
        coverUrl: cover,
        price: el.price?.totalPrice?.fmtPrice?.discountPrice,
        originalPrice: el.price?.totalPrice?.fmtPrice?.originalPrice,
        isFree: el.price?.totalPrice?.fmtPrice?.discountPrice === '0' || el.price?.totalPrice?.fmtPrice?.discountPrice === 'Gratuit'
      }
    })
}

export async function searchStore(
  query: string,
  platform: 'all' | 'steam' | 'epic' = 'all'
): Promise<StoreSearchResult> {
  const q = query.trim()
  let games: StoreGameItem[] = []

  if (platform === 'all') {
    const [steam, epic] = await Promise.all([searchSteamStore(q), searchEpicStore(q)])
    games = [...steam, ...epic]
  } else if (platform === 'steam') {
    games = await searchSteamStore(q)
  } else {
    games = await searchEpicStore(q)
  }

  return { games, query: q || undefined }
}

export function openStorePurchase(item: StoreGameItem): void {
  if (item.platform === 'steam' && item.appId) {
    openSteamStoreApp(item.appId)
  } else if (item.platform === 'epic' && item.productSlug) {
    openEpicStoreProduct(item.productSlug)
  }
}

function formatCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`
}
