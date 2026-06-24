import { NavLink } from 'react-router-dom'
import { Gamepad2, Trophy, User, Target, Settings, Layers } from 'lucide-react'
import { motion } from 'framer-motion'

const navItems = [
  { to: '/', icon: Gamepad2, label: 'Bibliothèque' },
  { to: '/trophies', icon: Trophy, label: 'Trophées' },
  { to: '/profile', icon: User, label: 'Profil' },
  { to: '/challenges', icon: Target, label: 'Défis' },
  { to: '/settings', icon: Settings, label: 'Paramètres' }
]

export function Sidebar(): JSX.Element {
  return (
    <nav className="fixed left-0 top-8 bottom-0 w-20 flex flex-col items-center py-8 gap-2 z-40">
      <div className="glass rounded-2xl p-3 flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}>
            {({ isActive }) => (
              <motion.div
                className={`relative p-3 rounded-xl transition-colors ${
                  isActive ? 'text-console-accent' : 'text-console-muted hover:text-console-text'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 bg-console-accent/20 rounded-xl glow-accent"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <item.icon size={22} className="relative z-10" />
                <span className="sr-only">{item.label}</span>
              </motion.div>
            )}
          </NavLink>
        ))}
      </div>

      <button
        onClick={() => window.electronAPI?.overlay.toggle()}
        className="mt-auto glass rounded-xl p-3 text-console-muted hover:text-console-accent transition-colors"
        title="Overlay (Ctrl+Shift+G)"
      >
        <Layers size={20} />
      </button>
    </nav>
  )
}
