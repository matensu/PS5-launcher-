import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { TopNav } from '../components/TopNav'
import { TrophyNotificationStack } from '../components/TrophyNotification'
import { initGamepadManager } from '../services/gamepadManager'
import { useAppStore } from '../stores/appStore'
import { useRunningGame } from '../hooks/useRunningGame'

export function MainLayout(): JSX.Element {
  const navigationMode = useAppStore((s) => s.navigationMode)
  useRunningGame()

  useEffect(() => {
    initGamepadManager()
  }, [])

  useEffect(() => {
    document.body.classList.toggle('gamepad-mode', navigationMode === 'gamepad')
    return () => document.body.classList.remove('gamepad-mode')
  }, [navigationMode])

  return (
    <div className="w-full h-full relative overflow-hidden">
      <TopNav />
      <main className="pt-[52px] h-full overflow-hidden">
        <Outlet />
      </main>
      <TrophyNotificationStack />
    </div>
  )
}
