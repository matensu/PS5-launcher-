import { create } from 'zustand'
import type { Settings, AchievementNotification } from '@shared/types'

interface AppState {
  settings: Settings | null
  setSettings: (settings: Settings) => void
  soundEnabled: boolean
  notifications: AchievementNotification[]
  addNotification: (notification: AchievementNotification) => void
  removeNotification: (id: string) => void
  focusedIndex: number
  setFocusedIndex: (index: number) => void
  navigationMode: 'gamepad' | 'keyboard'
  setNavigationMode: (mode: 'gamepad' | 'keyboard') => void
}

export const useAppStore = create<AppState>((set) => ({
  settings: null,
  setSettings: (settings) => set({ settings, soundEnabled: settings.soundEnabled }),
  soundEnabled: true,
  notifications: [],
  addNotification: (notification) =>
    set((state) => ({ notifications: [...state.notifications, notification] })),
  removeNotification: (id) =>
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),
  focusedIndex: 0,
  setFocusedIndex: (index) => set({ focusedIndex: index }),
  navigationMode: 'keyboard',
  setNavigationMode: (mode) => set({ navigationMode: mode })
}))
