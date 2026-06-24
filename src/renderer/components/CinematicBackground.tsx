import { motion, AnimatePresence } from 'framer-motion'
import { ParticleField } from './ParticleField'
import { DynamicBackground } from './DynamicBackground'

interface CinematicBackgroundProps {
  imageUrl?: string
  fallbackGradient?: string
  blurAmount?: number
  showParticles?: boolean
  /** Fond animé aurora + orbes — true par défaut */
  animatedBackground?: boolean
  /** 'game' = image nette type PS5, 'home' = image floutée */
  variant?: 'home' | 'game'
}

export function CinematicBackground({
  imageUrl,
  fallbackGradient,
  blurAmount = 48,
  showParticles = true,
  animatedBackground = true,
  variant = 'home'
}: CinematicBackgroundProps): JSX.Element {
  const isGame = variant === 'game' && !!imageUrl
  const auroraIntensity = isGame ? 0.45 : 1

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
      {animatedBackground && <DynamicBackground intensity={auroraIntensity} />}

      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          {imageUrl ? (
            <motion.div
              key={imageUrl}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: isGame ? 1.05 : 1.1 }}
              animate={{
                opacity: 1,
                scale: isGame ? [1, 1.06, 1] : [1.05, 1.14, 1.05],
                x: isGame ? [0, 12, 0] : [0, -8, 0]
              }}
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: 0.8 },
                scale: { duration: 22, repeat: Infinity, ease: 'easeInOut' },
                x: { duration: 30, repeat: Infinity, ease: 'easeInOut' }
              }}
            >
              <img
                src={imageUrl}
                alt=""
                className="w-full h-full object-cover"
                style={{
                  filter: isGame
                    ? 'brightness(0.75) saturate(1.2)'
                    : `blur(${blurAmount}px) brightness(0.5) saturate(1.3)`
                }}
              />
            </motion.div>
          ) : fallbackGradient ? (
            <motion.div
              key="gradient"
              className="absolute inset-0"
              style={{ background: fallbackGradient }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            />
          ) : null}
        </AnimatePresence>

        {!isGame && imageUrl && (
          <div className="absolute inset-0 bg-[#0a0a14]/30" />
        )}

        {isGame ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/30" />
            <div className="absolute bottom-0 left-0 right-0 h-[50%] bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-[#08080f]/90 via-[#08080f]/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#08080f]/50 via-transparent to-[#08080f]/35" />
            <motion.div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 25%, rgba(0, 112, 209, 0.25) 0%, transparent 55%)'
              }}
              animate={{ opacity: [0.2, 0.45, 0.2] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        )}
      </div>

      {showParticles && (
        <ParticleField count={isGame ? 35 : 70} className="absolute inset-0 z-[2]" />
      )}
    </div>
  )
}
