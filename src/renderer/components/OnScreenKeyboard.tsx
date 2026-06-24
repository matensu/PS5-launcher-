import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Delete, Space, Check } from 'lucide-react'
import { useGamepad } from '../hooks/useGamepad'

const ROWS = [
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  '0123456789'.split(''),
  ['-', '_', '.', "'", ' ']
]

interface OnScreenKeyboardProps {
  open: boolean
  value: string
  onChange: (value: string) => void
  onClose: () => void
  onSubmit?: () => void
  title?: string
}

export function OnScreenKeyboard({
  open,
  value,
  onChange,
  onClose,
  onSubmit,
  title = 'Recherche'
}: OnScreenKeyboardProps): JSX.Element | null {
  const [row, setRow] = useState(0)
  const [col, setCol] = useState(0)

  const rowItems = ROWS[row] ?? []
  const actionCol = rowItems.length

  const applyChar = useCallback(
    (char: string) => {
      onChange(value + char)
    },
    [onChange, value]
  )

  useGamepad(
    {
    onNavigate: (dir) => {
      if (!open) return
      if (dir === 'left') setCol((c) => Math.max(0, c - 1))
      if (dir === 'right') setCol((c) => Math.min(actionCol, c + 1))
      if (dir === 'up') setRow((r) => Math.max(0, r - 1))
      if (dir === 'down') setRow((r) => Math.min(ROWS.length - 1, r + 1))
    },
    onConfirm: () => {
      if (!open) return
      if (col === actionCol) {
        onSubmit?.()
        return
      }
      const char = ROWS[row]?.[col]
      if (char === ' ') applyChar(' ')
      else if (char) applyChar(char.toLowerCase())
    },
    onBack: () => {
      if (!open) return
      if (value.length > 0) onChange(value.slice(0, -1))
      else onClose()
    }
  },
  open
  )

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="fixed bottom-0 left-0 right-0 z-[60] p-4 pb-6 bg-black/85 backdrop-blur-xl border-t border-white/10"
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-white/60">{title}</p>
            <span className="text-xs text-white/40">B = effacer · A = valider</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm mb-3 min-h-[40px] flex items-center">
            {value || <span className="text-white/35">Tapez votre recherche...</span>}
          </div>

          <div className="space-y-2">
            {ROWS.map((keys, r) => (
              <div key={r} className="flex flex-wrap gap-1.5 justify-center">
                {keys.map((key, c) => (
                  <button
                    key={`${r}-${key}`}
                    type="button"
                    onClick={() => {
                      if (key === ' ') applyChar(' ')
                      else applyChar(key.toLowerCase())
                    }}
                    className={`min-w-[36px] h-9 px-2 rounded-lg text-sm font-medium transition-all ${
                      row === r && col === c
                        ? 'bg-white text-black scale-105'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {key === ' ' ? <Space size={16} className="mx-auto" /> : key}
                  </button>
                ))}
                {r === ROWS.length - 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => onChange(value.slice(0, -1))}
                      className={`h-9 px-3 rounded-lg flex items-center gap-1 text-sm ${
                        row === r && col === actionCol
                          ? 'bg-white text-black'
                          : 'bg-white/10 text-white'
                      }`}
                    >
                      <Delete size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSubmit?.()}
                      className="h-9 px-4 rounded-lg bg-emerald-500/80 text-white text-sm font-semibold flex items-center gap-1"
                    >
                      <Check size={14} />
                      OK
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
