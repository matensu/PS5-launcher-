import { motion, AnimatePresence } from 'framer-motion'
import { ParticleField } from './ParticleField'

interface CinematicBackgroundProps {
  imageUrl?: string
  fallbackGradient?: string
  blurAmount?: number
  showParticles?: boolean
  /** 'game' = fond net type PS5, 'home' = fond flouté */
  variant?: 'home' | 'game'
}

export function CinematicBackground({
  imageUrl,
  fallbackGradient,
  blurAmount = 48,
  showParticles = true,
  variant = 'home'
}: CinematicBackgroundProps): JSX.Element {
  const isGame = variant === 'game' && !!imageUrl

  return (
    <>
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <AnimatePresence mode="wait">
          {imageUrl ? (
            <motion.div
              key={imageUrl}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: isGame ? 1.04 : 1.12 }}
              animate={{ opacity: 1, scale: isGame ? 1 : 1.05 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
            >
              <img
                src={imageUrl}
                alt=""
                className="w-full h-full object-cover"
                style={{
                  filter: isGame
                    ? 'brightness(0.72) saturate(1.15)'
                    : `blur(${blurAmount}px) brightness(0.45) saturate(1.2)`
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="gradient"
              className="absolute inset-0"
              style={{ background: fallbackGradient ?? 'var(--theme-gradient), var(--color-bg)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            />
          )}
        </AnimatePresence>

        {!isGame && <div className="absolute inset-0 backdrop-blur-[2px] bg-[#0a0a14]/40" />}

        {isGame ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/40" />
            <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-[#08080f] via-[#08080f]/60 to-[#08080f]/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#08080f]/70 via-transparent to-[#08080f]/50" />
            <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-[#08080f] via-[#08080f]/80 to-transparent" />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 30%, rgba(0, 112, 209, 0.15) 0%, transparent 60%)'
              }}
            />
          </>
        )}
      </div>

      {showParticles && !isGame && <ParticleField count={40} />}
    </>
  )
}
