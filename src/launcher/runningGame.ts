import type { GamePlatform, RunningGameInfo } from '../shared/types'
import { getDatabase } from '../database'
import { getAppSettings } from '../integrations/settingsHelper'
import { clearGamePresence } from '../integrations/discord'
import { findEpicGameExecutable } from './epicLaunch'
import { findGameExecutable } from './gameExe'
import {
  findPidsByExecutable,
  findPidsUnderPath,
  focusProcess,
  killProcessTree
} from './processUtils'

interface RunningGameState extends RunningGameInfo {
  installPath?: string
  appId?: string
  sessionId: string
  exePath?: string
  emptyPolls: number
  hadPids: boolean
}

let current: RunningGameState | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

function resolveExecutable(
  platform: GamePlatform,
  appId: string | undefined,
  installPath: string | undefined
): string | undefined {
  if (!installPath) return undefined
  if (platform === 'epic' && appId) {
    return findEpicGameExecutable(appId, installPath) ?? findGameExecutable(installPath) ?? undefined
  }
  return findGameExecutable(installPath) ?? undefined
}

function toPublicInfo(state: RunningGameState): RunningGameInfo {
  return {
    gameId: state.gameId,
    name: state.name,
    platform: state.platform,
    startedAt: state.startedAt,
    pids: state.pids
  }
}

async function resolvePids(state: RunningGameState): Promise<number[]> {
  const fromExe = state.exePath ? await findPidsByExecutable(state.exePath) : []
  if (fromExe.length > 0) return fromExe

  if (state.installPath) {
    const fromPath = await findPidsUnderPath(state.installPath)
    if (fromPath.length > 0) return fromPath
  }

  return state.pids.filter((pid) => pid > 0)
}

async function pollRunningGame(): Promise<void> {
  if (!current) return

  const pids = await resolvePids(current)
  if (pids.length > 0) {
    current.pids = pids
    current.emptyPolls = 0
    current.hadPids = true
    return
  }

  current.emptyPolls += 1
  const grace = current.hadPids ? 3 : 20
  if (current.emptyPolls >= grace) {
    await finalizeRunningGame(false)
  }
}

function startPolling(): void {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    void pollRunningGame()
  }, 2000)
}

function stopPolling(): void {
  if (!pollTimer) return
  clearInterval(pollTimer)
  pollTimer = null
}

async function finalizeRunningGame(stoppedByUser: boolean): Promise<void> {
  if (!current) return

  const { sessionId } = current
  stopPolling()
  current = null

  const database = getDatabase()
  const now = new Date().toISOString()
  database.prepare('UPDATE play_sessions SET ended_at = ? WHERE id = ? AND ended_at IS NULL').run(now, sessionId)

  const settings = getAppSettings()
  if (settings.discordEnabled && settings.discordRichPresence) {
    void clearGamePresence()
  }

  if (stoppedByUser) {
    // no-op for now — hook for future telemetry
  }
}

export function getRunningGame(): RunningGameInfo | null {
  return current ? toPublicInfo(current) : null
}

export function registerRunningGame(params: {
  gameId: string
  name: string
  platform: GamePlatform
  installPath?: string
  appId?: string
  sessionId: string
  initialPid?: number
  exePath?: string
}): void {
  const exePath =
    params.exePath ?? resolveExecutable(params.platform, params.appId, params.installPath)

  current = {
    gameId: params.gameId,
    name: params.name,
    platform: params.platform,
    startedAt: new Date().toISOString(),
    pids: params.initialPid ? [params.initialPid] : [],
    installPath: params.installPath,
    appId: params.appId,
    sessionId: params.sessionId,
    exePath,
    emptyPolls: 0,
    hadPids: Boolean(params.initialPid)
  }

  startPolling()

  setTimeout(() => {
    void pollRunningGame()
  }, 2500)
  setTimeout(() => {
    void pollRunningGame()
  }, 6000)
}

export async function stopRunningGame(gameId?: string): Promise<boolean> {
  if (!current) return false
  if (gameId && current.gameId !== gameId) return false

  const pids = await resolvePids(current)
  const targets = pids.length > 0 ? pids : current.pids

  for (const pid of targets) {
    await killProcessTree(pid)
  }

  await finalizeRunningGame(true)
  return true
}

export async function focusRunningGame(): Promise<boolean> {
  if (!current) return false

  const pids = await resolvePids(current)
  for (const pid of pids) {
    if (await focusProcess(pid)) return true
  }
  return false
}
