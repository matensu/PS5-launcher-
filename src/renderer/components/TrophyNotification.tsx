import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import type { TrophyTier } from '@shared/types'
import { useAppStore } from '../stores/appStore'
import { Trophy } from 'lucide-react'

const tierColors: Record<TrophyTier, string> = {
  bronze: 'text-trophy-bronze border-trophy-bronze',
  silver: 'text-trophy-silver border-trophy-silver',
  gold: 'text-trophy-gold border-trophy-gold',
  platinum: 'text-trophy-platinum border-trophy-platinum'
}

export function TrophyNotificationStack(): JSX.Element {
  const notifications = useAppStore((s) => s.notifications)
  const removeNotification = useAppStore((s) => s.removeNotification)
  const soundEnabled = useAppStore((s) => s.soundEnabled)

  useEffect(() => {
    if (notifications.length === 0) return
    const latest = notifications[notifications.length - 1]

    if (soundEnabled) {
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.1, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
        osc.start()
        osc.stop(ctx.currentTime + 0.5)
      } catch {
        // audio not available
      }
    }

    const timer = setTimeout(() => removeNotification(latest.id), 5000)
    return () => clearTimeout(timer)
  }, [notifications, removeNotification, soundEnabled])

  return (
    <div className="fixed top-12 right-6 z-[100] flex flex-col gap-3">
      <AnimatePresence>
        {notifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            className={`trophy-notification glass rounded-2xl p-4 flex items-center gap-4 border-l-4 ${tierColors[notif.tier]}`}
          >
            <div className={`p-3 rounded-full bg-white/5 ${tierColors[notif.tier]}`}>
              <Trophy size={24} />
            </div>
            <div>
              <p className="text-xs text-console-muted uppercase tracking-wider">Trophée débloqué</p>
              <p className="font-semibold">{notif.trophyName}</p>
              {notif.gameName && <p className="text-sm text-console-muted">{notif.gameName}</p>}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
