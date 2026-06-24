import { Search } from 'lucide-react'
import { OnScreenKeyboard } from './OnScreenKeyboard'

interface ControllerSearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  keyboardOpen: boolean
  onKeyboardOpenChange: (open: boolean) => void
  isFocused?: boolean
}

export function ControllerSearchBar({
  value,
  onChange,
  placeholder = 'Rechercher...',
  keyboardOpen,
  onKeyboardOpenChange,
  isFocused = false
}: ControllerSearchBarProps): JSX.Element {
  return (
    <>
      <button
        type="button"
        onClick={() => onKeyboardOpenChange(true)}
        className={`w-full flex items-center gap-3 pl-10 pr-4 py-2 rounded-full text-sm text-left transition-all relative ${
          isFocused
            ? 'bg-white/20 border-2 border-white text-white ring-2 ring-white/30'
            : 'bg-black/30 border border-white/10 text-white/80 hover:border-white/25'
        }`}
      >
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <span className={value ? 'text-white' : 'text-white/40'}>
          {value || placeholder}
        </span>
        {isFocused && (
          <span className="ml-auto text-[10px] text-white/50 uppercase tracking-wide">Y</span>
        )}
      </button>

      <OnScreenKeyboard
        open={keyboardOpen}
        value={value}
        onChange={onChange}
        onClose={() => onKeyboardOpenChange(false)}
        onSubmit={() => onKeyboardOpenChange(false)}
        title="Rechercher un jeu"
      />
    </>
  )
}
