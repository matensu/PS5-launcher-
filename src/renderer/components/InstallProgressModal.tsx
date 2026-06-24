import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, CheckCircle2, X, AlertCircle } from 'lucide-react'
import { api } from '../services/api'

export interface InstallTarget {
  platform: 'steam' | 'epic'
  id: string
  gameName: string
  coverUrl?: string
}

interface InstallProgressModalProps {
  target: InstallTarget | null
  onClose: () => void
  onComplete?: () => void
}

type SteamStatus = Awaited<ReturnType<typeof api.getSteamInstallStatus>>
type EpicStatus = Awaited<ReturnType<typeof api.getEpicInstallStatus>>
type InstallStatus = SteamStatus | EpicStatus

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 o'
  const units = ['o', 'Ko', 'Mo', 'Go']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** i
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function phaseLabel(status: InstallStatus): string {
  if (status.phase === 'complete') return 'Installation terminée'
  if (status.phase === 'unavailable' || status.phase === 'error') {
    return status.message ?? 'Installation impossible'
  }
  if (status.phase === 'downloading') {
    if ('bytesTotal' in status && status.bytesTotal > 0) {
      return `${formatBytes(status.bytesDownloaded)} / ${formatBytes(status.bytesTotal)}`
    }
    return status.message ?? 'Téléchargement en cours...'
  }
  return status.message ?? 'Préparation...'
}

function isTerminal(status: InstallStatus): boolean {
  return status.phase === 'complete' || status.phase === 'unavailable' || status.phase === 'error'
}

export function InstallProgressModal({
  target,
  onClose,
  onComplete
}: InstallProgressModalProps): JSX.Element | null {
  const [status, setStatus] = useState<InstallStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (!target) {
      setStatus(null)
      setError(null)
      setStarting(false)
      completedRef.current = false
      return
    }

    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    const poll = async () => {
      try {
        const next =
          target.platform === 'steam'
            ? await api.getSteamInstallStatus(target.id)
            : await api.getEpicInstallStatus(target.id)
        if (cancelled) return
        setStatus(next)
        if (next.phase === 'complete' && !completedRef.current) {
          completedRef.current = true
          onCompleteRef.current?.()
        }
        if (isTerminal(next) && intervalId) {
          clearInterval(intervalId)
          intervalId = null
        }
      } catch {
        if (!cancelled) setError('Impossible de suivre la progression')
      }
    }

    const start = async () => {
      setStarting(true)
      setError(null)
      try {
        if (target.platform === 'steam') {
          const result = await api.installSteamGame(target.id)
          if (!cancelled) setStatus(result.status)
        } else {
          const result = await api.installEpicGame(target.id)
          if (!cancelled) setStatus(result.status)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Échec du démarrage')
        }
      } finally {
        if (!cancelled) setStarting(false)
      }
      if (!cancelled) {
        await poll()
        intervalId = setInterval(poll, 1500)
      }
    }

    void start()

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [target])

  const progress = status?.progress ?? (starting ? 5 : 0)
  const platformLabel = target?.platform === 'steam' ? 'Steam' : 'Epic Games'
  const done = status?.phase === 'complete'
  const failed = status?.phase === 'unavailable' || status?.phase === 'error' || !!error

  return (
    <AnimatePresence>
      {target && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#12121c]/95 border border-white/10 shadow-2xl overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4 p-5 border-b border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                {target.coverUrl ? (
                  <img
                    src={target.coverUrl}
                    alt=""
                    className="w-14 h-[4.5rem] rounded-lg object-cover border border-white/10 flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-[4.5rem] rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Download size={20} className="text-white/40" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs text-white/45 uppercase tracking-wide mb-0.5">{platformLabel}</p>
                  <h2 className="text-lg font-semibold text-white truncate">{target.gameName}</h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    failed ? 'bg-red-400' : done ? 'bg-emerald-400' : 'bg-white'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(progress, starting ? 5 : 0)}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>

              <div className="flex items-start gap-2 text-sm">
                {failed ? (
                  <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                ) : done ? (
                  <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <Download size={18} className="text-white/50 flex-shrink-0 mt-0.5 animate-pulse" />
                )}
                <div>
                  <p className="text-white/90 font-medium">
                    {error ?? (status ? phaseLabel(status) : 'Démarrage de l\'installation...')}
                  </p>
                  {!failed && !done && (
                    <p className="text-white/45 text-xs mt-1 leading-relaxed">
                      Le téléchargement s&apos;effectue en arrière-plan via {platformLabel}. Vous pouvez
                      rester dans PC Console OS pendant l&apos;installation.
                    </p>
                  )}
                </div>
              </div>

              {(done || failed) && (
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
                >
                  {done ? 'Fermer' : 'OK'}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
