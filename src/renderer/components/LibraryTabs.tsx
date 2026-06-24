import { NavLink, useLocation } from 'react-router-dom'

interface LibraryTabsProps {
  focused?: boolean
}

export function LibraryTabs({ focused = false }: LibraryTabsProps): JSX.Element {
  const location = useLocation()
  const isSteam =
    location.pathname === '/library' || location.pathname.startsWith('/library/game')
  const isEpic = location.pathname.startsWith('/library/epic')

  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-full text-sm font-medium transition-all ${
      active ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/15'
    } ${focused ? 'ring-2 ring-white/80' : ''}`

  return (
    <div
      className={`flex gap-2 mb-6 ${focused ? 'ring-2 ring-white/40 rounded-2xl p-1 w-fit' : ''}`}
      data-gamepad-zone="tabs"
    >
      <NavLink to="/library" className={tabClass(isSteam)}>
        Steam
        {focused && <span className="ml-2 text-[10px] opacity-60">L1/R1</span>}
      </NavLink>
      <NavLink to="/library/epic" className={tabClass(isEpic)}>
        Epic Games
      </NavLink>
    </div>
  )
}
