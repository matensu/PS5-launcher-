import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Search, ShoppingBag, ExternalLink } from 'lucide-react'
import { api } from '../services/api'
import { CinematicBackground } from '../components/CinematicBackground'
import type { StoreGameItem } from '@shared/types'

type StorePlatform = 'all' | 'steam' | 'epic'

function StoreCard({
  game,
  onBuy
}: {
  game: StoreGameItem
  onBuy: () => void
}): JSX.Element {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <motion.div
      layout
      className="group rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/25 transition-colors"
    >
      <div className="aspect-[3/4] relative overflow-hidden">
        {!imgFailed && game.coverUrl ? (
          <img
            src={game.coverUrl}
            alt={game.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center ${
              game.platform === 'steam' ? 'bg-blue-900/40' : 'bg-gray-800/60'
            }`}
          >
            <ShoppingBag size={32} className="text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
        <div className="absolute top-2 left-2">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
              game.platform === 'steam' ? 'bg-blue-600/80' : 'bg-gray-600/80'
            } text-white`}
          >
            {game.platform === 'steam' ? 'Steam' : 'Epic'}
          </span>
        </div>
        {game.discountLabel && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
            {game.discountLabel}
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-sm font-semibold text-white line-clamp-2 mb-2">{game.name}</h3>
          <div className="flex items-center justify-between gap-2 mb-2">
            {game.isFree ? (
              <span className="text-emerald-400 text-sm font-bold">Gratuit</span>
            ) : (
              <div className="text-sm">
                {game.price && <span className="text-white font-semibold">{game.price}</span>}
                {game.originalPrice && game.originalPrice !== game.price && (
                  <span className="text-white/40 line-through text-xs ml-2">{game.originalPrice}</span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onBuy}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-white/90"
          >
            <ExternalLink size={14} />
            Acheter
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export function StorePage(): JSX.Element {
  const [platform, setPlatform] = useState<StorePlatform>('all')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['store', query, platform],
    queryFn: () => api.searchStore(query, platform),
    staleTime: 120_000
  })

  const buyMutation = useMutation({ mutationFn: api.openStorePurchase })

  const games = data?.games ?? []

  const platformFilters: { id: StorePlatform; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'steam', label: 'Steam' },
    { id: 'epic', label: 'Epic Games' }
  ]

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setQuery(search.trim())
  }

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <CinematicBackground variant="home" blurAmount={72} showParticles />

      <div className="relative z-10 flex flex-col h-full pt-20 px-10 pb-8">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-white tracking-tight mb-1">Boutique</h1>
          <p className="text-white/50">Achetez des jeux sur Steam et Epic Games</p>
        </div>

        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex gap-2">
            {platformFilters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setPlatform(f.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  platform === f.id ? 'bg-white text-black' : 'bg-white/10 text-white/70'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[240px] max-w-lg relative flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un jeu..."
                className="w-full pl-10 pr-4 py-2.5 rounded-full bg-black/30 border border-white/10 text-white text-sm"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-medium border border-white/15"
            >
              Chercher
            </button>
          </div>
        </form>

        {isLoading || isFetching ? (
          <div className="flex-1 flex items-center justify-center text-white/50">Chargement de la boutique...</div>
        ) : games.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/50 gap-3">
            <ShoppingBag size={40} className="text-white/25" />
            <p>Aucun résultat — essayez une autre recherche</p>
            <button onClick={() => refetch()} className="text-sm text-white/70 hover:text-white underline">
              Recharger les suggestions
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <p className="text-white/40 text-sm mb-4">
              {query ? `Résultats pour « ${query} »` : 'Suggestions et promotions'} · {games.length} jeux
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {games.map((game) => (
                <StoreCard key={game.id} game={game} onBuy={() => buyMutation.mutate(game)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
