import { NavLink, useLocation } from 'react-router-dom'

export function LibraryTabs(): JSX.Element {
  const location = useLocation()
  const isSteam =
    location.pathname === '/library' || location.pathname.startsWith('/library/game')
  const isEpic = location.pathname.startsWith('/library/epic')

  return (
    <div className="flex gap-2 mb-6">
      <NavLink
        to="/library"
        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          isSteam ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/15'
        }`}
      >
        Steam
      </NavLink>
      <NavLink
        to="/library/epic"
        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          isEpic ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/15'
        }`}
      >
        Epic Games
      </NavLink>
    </div>
  )
}
