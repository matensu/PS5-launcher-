import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { useAppStore } from '../stores/appStore'
import type { RunningGameInfo } from '@shared/types'

export function useRunningGame(): RunningGameInfo | null {
  const setRunningGame = useAppStore((s) => s.setRunningGame)
  const runningGame = useAppStore((s) => s.runningGame)

  const { data } = useQuery({
    queryKey: ['running-game'],
    queryFn: async () => {
      const res = await api.getRunningGame()
      return res.running
    },
    refetchInterval: 2000,
    staleTime: 1000
  })

  useEffect(() => {
    setRunningGame(data ?? null)
  }, [data, setRunningGame])

  return runningGame
}

export function useStopGame(): {
  stopGame: (gameId: string) => Promise<void>
  isStopping: boolean
} {
  const queryClient = useQueryClient()
  const setRunningGame = useAppStore((s) => s.setRunningGame)

  const stop = async (gameId: string) => {
    await api.stopGame(gameId)
    setRunningGame(null)
    await queryClient.invalidateQueries({ queryKey: ['running-game'] })
  }

  return {
    stopGame: stop,
    isStopping: false
  }
}
