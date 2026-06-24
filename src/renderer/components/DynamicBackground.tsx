import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface DynamicBackgroundProps {
  /** 0–1, réduit l'intensité derrière une image de jeu */
  intensity?: number
}

function AuroraCanvas({ intensity = 1 }: { intensity?: number }): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0
    let animationId = 0

    const resize = (): void => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const draw = (): void => {
      if (document.hidden) {
        animationId = requestAnimationFrame(draw)
        return
      }

      frame += 0.006
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)

      const blobs = [
        { cx: 0.25, cy: 0.35, r: 0.55, hue: 210, phase: 0 },
        { cx: 0.75, cy: 0.55, r: 0.5, hue: 270, phase: 1.2 },
        { cx: 0.5, cy: 0.75, r: 0.45, hue: 195, phase: 2.4 },
        { cx: 0.85, cy: 0.2, r: 0.35, hue: 320, phase: 3.1 }
      ]

      const alphaMul = intensity

      for (const blob of blobs) {
        const x =
          (blob.cx + Math.sin(frame + blob.phase) * 0.1 + Math.cos(frame * 0.7 + blob.phase) * 0.05) *
          width
        const y =
          (blob.cy + Math.cos(frame * 0.9 + blob.phase) * 0.08 + Math.sin(frame * 0.5 + blob.phase) * 0.06) *
          height
        const radius = blob.r * Math.min(width, height)

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, `hsla(${blob.hue}, 90%, 58%, ${0.32 * alphaMul})`)
        gradient.addColorStop(0.4, `hsla(${blob.hue + 20}, 75%, 48%, ${0.14 * alphaMul})`)
        gradient.addColorStop(1, 'hsla(240, 60%, 20%, 0)')

        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, width, height)
      }

      animationId = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationId)
    }
  }, [intensity])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden />
}

const ORBS = [
  {
    size: 720,
    top: '8%',
    left: '-12%',
    color: 'rgba(0, 112, 209, 0.45)',
    duration: 22,
    x: [0, 120, 60, 0],
    y: [0, 80, 40, 0],
    scale: [1, 1.25, 1.1, 1]
  },
  {
    size: 560,
    bottom: '0%',
    right: '-8%',
    color: 'rgba(120, 60, 220, 0.38)',
    duration: 28,
    x: [0, -100, -50, 0],
    y: [0, -70, -35, 0],
    scale: [1, 1.2, 1.05, 1]
  },
  {
    size: 420,
    top: '45%',
    left: '55%',
    color: 'rgba(0, 180, 220, 0.28)',
    duration: 18,
    x: [0, -60, 30, 0],
    y: [0, 50, -20, 0],
    scale: [1, 1.15, 0.95, 1]
  }
] as const

export function DynamicBackground({ intensity = 1 }: DynamicBackgroundProps): JSX.Element {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ opacity: intensity }}>
      <div className="absolute inset-0 bg-[#06060e]" />
      <AuroraCanvas intensity={intensity} />

      {ORBS.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-3xl"
          style={{
            width: orb.size,
            height: orb.size,
            top: 'top' in orb ? orb.top : undefined,
            left: 'left' in orb ? orb.left : undefined,
            bottom: 'bottom' in orb ? orb.bottom : undefined,
            right: 'right' in orb ? orb.right : undefined,
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 68%)`
          }}
          animate={{
            x: [...orb.x],
            y: [...orb.y],
            scale: [...orb.scale]
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      ))}

      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(125deg, transparent 28%, rgba(255,255,255,0.07) 48%, transparent 68%)'
        }}
        animate={{ x: ['-40%', '140%'] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
      />

      <div
        className="absolute inset-0 opacity-50"
        style={{ background: 'var(--theme-gradient)' }}
      />
    </div>
  )
}
