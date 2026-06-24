import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  size: number
  speedX: number
  speedY: number
  opacity: number
  pulse: number
  pulseSpeed: number
}

interface ParticleFieldProps {
  count?: number
  className?: string
}

export function ParticleField({ count = 55, className = '' }: ParticleFieldProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId = 0
    let particles: Particle[] = []

    const resize = (): void => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const init = (): void => {
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2.2 + 0.4,
        speedX: (Math.random() - 0.5) * 0.35,
        speedY: (Math.random() - 0.5) * 0.35 - 0.08,
        opacity: Math.random() * 0.45 + 0.08,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.02 + 0.008
      }))
    }

    const draw = (): void => {
      if (document.hidden) {
        animationId = requestAnimationFrame(draw)
        return
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!
        p.x += p.speedX
        p.y += p.speedY
        p.pulse += p.pulseSpeed

        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        const alpha = p.opacity * (0.6 + Math.sin(p.pulse) * 0.4)

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(160, 200, 255, ${alpha})`
        ctx.fill()

        let links = 0
        for (let j = i + 1; j < particles.length && links < 3; j++) {
          const q = particles[j]!
          const dx = p.x - q.x
          const dy = p.y - q.y
          const dist = dx * dx + dy * dy
          if (dist < 120 * 120) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(q.x, q.y)
            ctx.strokeStyle = `rgba(100, 160, 255, ${0.05 * (1 - Math.sqrt(dist) / 120)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
            links++
          }
        }
      }

      animationId = requestAnimationFrame(draw)
    }

    resize()
    init()
    draw()

    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationId)
    }
  }, [count])

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none ${className}`}
      aria-hidden
    />
  )
}
