import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { MainLayout } from './layouts/MainLayout'
import { LibraryPage } from './pages/LibraryPage'
import { GameHubPage } from './pages/GameHubPage'
import { TrophiesPage } from './pages/TrophiesPage'
import { ProfilePage } from './pages/ProfilePage'
import { ChallengesPage } from './pages/ChallengesPage'
import { SteamLibraryPage } from './pages/SteamLibraryPage'
import { SteamGamePage } from './pages/SteamGamePage'
import { EpicLibraryPage } from './pages/EpicLibraryPage'
import { EpicGamePage } from './pages/EpicGamePage'
import { StorePage } from './pages/StorePage'
import { SettingsPage } from './pages/SettingsPage'
import { useInitApp } from './hooks/useInitApp'
import './styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2 }
  }
})

function App(): JSX.Element {
  const { isReady } = useInitApp()

  if (!isReady) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-console-muted animate-pulse">Chargement de PC Console OS...</div>
      </div>
    )
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<LibraryPage />} />
          <Route path="game/:id" element={<GameHubPage />} />
          <Route path="trophies" element={<TrophiesPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="challenges" element={<ChallengesPage />} />
          <Route path="library" element={<SteamLibraryPage />} />
          <Route path="library/game/:appId" element={<SteamGamePage />} />
          <Route path="library/epic" element={<EpicLibraryPage />} />
          <Route path="library/epic/:appName" element={<EpicGamePage />} />
          <Route path="store" element={<StorePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
)
