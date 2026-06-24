import { Minus, Square, X } from 'lucide-react'

export function TitleBar(): JSX.Element {
  return (
    <div className="fixed top-0 left-0 right-0 h-8 flex items-center justify-between px-4 z-50 glass drag-region">
      <span className="text-xs text-console-muted font-medium tracking-wider">PC CONSOLE OS</span>
      <div className="flex gap-1 no-drag">
        <button
          onClick={() => window.electronAPI?.window.minimize()}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          aria-label="Minimiser"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => window.electronAPI?.window.maximize()}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          aria-label="Agrandir"
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => window.electronAPI?.window.close()}
          className="p-1.5 rounded hover:bg-red-500/80 transition-colors"
          aria-label="Fermer"
        >
          <X size={14} />
        </button>
      </div>
      <style>{`
        .drag-region { -webkit-app-region: drag; }
        .no-drag { -webkit-app-region: no-drag; }
      `}</style>
    </div>
  )
}
