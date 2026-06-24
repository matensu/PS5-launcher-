import { Outlet } from 'react-router-dom'
import { TopNav } from '../components/TopNav'
import { TrophyNotificationStack } from '../components/TrophyNotification'

export function MainLayout(): JSX.Element {
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
