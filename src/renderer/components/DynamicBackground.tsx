import { motion } from 'framer-motion'

export function DynamicBackground(): JSX.Element {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute w-[800px] h-[800px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)',
          top: '10%',
          left: '-10%'
        }}
        animate={{
          x: [0, 100, 50, 0],
          y: [0, 50, 100, 0],
          scale: [1, 1.2, 1.1, 1]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full opacity-15"
        style={{
          background: 'radial-gradient(circle, var(--color-accent-glow) 0%, transparent 70%)',
          bottom: '5%',
          right: '-5%'
        }}
        animate={{
          x: [0, -80, -40, 0],
          y: [0, -60, -30, 0],
          scale: [1, 1.15, 1.05, 1]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'var(--theme-gradient)',
          opacity: 0.6
        }}
      />
    </div>
  )
}
