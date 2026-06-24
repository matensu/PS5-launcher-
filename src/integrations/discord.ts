import { createConnection, type Socket } from 'net'
import { randomUUID } from 'crypto'
import { openUri } from '../launcher/launcherUrls'
import { getDiscordExe, isProcessRunning } from './processUtils'
import { getEffectiveDiscordAppId } from './discordDefaults'

const OPCODE_HANDSHAKE = 0
const OPCODE_FRAME = 1

interface DiscordActivity {
  details?: string
  state?: string
  timestamps?: { start?: number }
  assets?: { large_image?: string; large_text?: string; small_image?: string; small_text?: string }
}

let rpcSocket: Socket | null = null
let connectedClientId: string | null = null
let pendingActivity: DiscordActivity | null = null
let discordUsername: string | undefined

function getDiscordPipeCandidates(): string[] {
  if (process.platform === 'win32') {
    return Array.from({ length: 10 }, (_, i) => `\\\\?\\pipe\\discord-ipc-${i}`)
  }
  const runtime = process.env.XDG_RUNTIME_DIR ?? '/tmp'
  return Array.from({ length: 10 }, (_, i) => joinPipe(runtime, `discord-ipc-${i}`))
}

function joinPipe(dir: string, name: string): string {
  return `${dir}/${name}`
}

function encodePacket(op: number, data: object): Buffer {
  const json = JSON.stringify(data)
  const packet = Buffer.alloc(8 + json.length)
  packet.writeInt32LE(op, 0)
  packet.writeInt32LE(json.length, 4)
  packet.write(json, 8)
  return packet
}

function readPacket(socket: Socket): Promise<{ op: number; data: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      if (chunk.length < 8) return
      const op = chunk.readInt32LE(0)
      const length = chunk.readInt32LE(4)
      const json = chunk.subarray(8, 8 + length).toString('utf-8')
      socket.off('data', onData)
      socket.off('error', onError)
      try {
        resolve({ op, data: JSON.parse(json) as Record<string, unknown> })
      } catch (err) {
        reject(err)
      }
    }
    const onError = (err: Error) => {
      socket.off('data', onData)
      reject(err)
    }
    socket.on('data', onData)
    socket.on('error', onError)
  })
}

async function tryConnectPipe(pipe: string, clientId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection(pipe)
    const timeout = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, 1500)

    socket.on('connect', async () => {
      try {
        socket.write(
          encodePacket(OPCODE_HANDSHAKE, {
            v: 1,
            client_id: clientId
          })
        )
        const response = await readPacket(socket)
        clearTimeout(timeout)
        const isReady =
          response.op === OPCODE_FRAME &&
          (response.data.evt === 'READY' || response.data.cmd === 'DISPATCH')
        if (isReady) {
          const user = response.data.user as { username?: string } | undefined
          if (user?.username) discordUsername = user.username
          rpcSocket = socket
          connectedClientId = clientId
          if (pendingActivity) {
            await sendActivity(pendingActivity)
          }
          resolve(true)
          return
        }
        socket.destroy()
        resolve(false)
      } catch {
        clearTimeout(timeout)
        socket.destroy()
        resolve(false)
      }
    })

    socket.on('error', () => {
      clearTimeout(timeout)
      resolve(false)
    })
  })
}

async function ensureDiscordRpc(clientId: string): Promise<boolean> {
  if (rpcSocket && connectedClientId === clientId) return true
  disconnectDiscordRpc()

  for (const pipe of getDiscordPipeCandidates()) {
    const ok = await tryConnectPipe(pipe, clientId)
    if (ok) return true
  }
  return false
}

async function sendActivity(activity: DiscordActivity): Promise<boolean> {
  if (!rpcSocket) return false
  return new Promise((resolve) => {
    try {
      rpcSocket!.write(
        encodePacket(OPCODE_FRAME, {
          cmd: 'SET_ACTIVITY',
          args: { pid: process.pid, activity },
          nonce: randomUUID()
        })
      )
      resolve(true)
    } catch {
      resolve(false)
    }
  })
}

export function disconnectDiscordRpc(): void {
  rpcSocket?.destroy()
  rpcSocket = null
  connectedClientId = null
}

export function isDiscordRunning(): boolean {
  return isProcessRunning('Discord.exe')
}

export function openDiscord(): void {
  if (isDiscordRunning()) {
    openUri('discord://')
    return
  }
  const exe = getDiscordExe()
  if (exe) {
    import('child_process').then(({ spawn }) => {
      spawn(exe, [], { detached: true, stdio: 'ignore' }).unref()
    })
    return
  }
  openUri('discord://')
}

export interface DiscordStatus {
  running: boolean
  richPresenceConnected: boolean
  desktopConnected: boolean
  username?: string
  currentGame?: string
}

export function getDiscordStatus(): DiscordStatus {
  return {
    running: isDiscordRunning(),
    richPresenceConnected: rpcSocket !== null,
    desktopConnected: rpcSocket !== null || isDiscordRunning(),
    username: discordUsername,
    currentGame: pendingActivity?.details
  }
}

export async function ensureDiscordDesktopConnection(userAppId?: string): Promise<boolean> {
  if (!isDiscordRunning()) return false
  const appId = getEffectiveDiscordAppId(userAppId)
  if (!appId) return false
  return ensureDiscordRpc(appId)
}

export async function setGamePresence(userAppId: string | undefined, gameName: string): Promise<boolean> {
  const activity: DiscordActivity = {
    details: `Joue à ${gameName}`,
    state: 'via PC Console OS',
    timestamps: { start: Date.now() },
    assets: {
      large_text: gameName,
      small_text: 'PC Console OS'
    }
  }
  pendingActivity = activity

  const appId = getEffectiveDiscordAppId(userAppId)
  if (!appId) return false
  const connected = await ensureDiscordRpc(appId)
  if (!connected) return false
  return sendActivity(activity)
}

export async function clearGamePresence(): Promise<void> {
  pendingActivity = null
  if (!rpcSocket) return
  try {
    rpcSocket.write(
      encodePacket(OPCODE_FRAME, {
        cmd: 'SET_ACTIVITY',
        args: { pid: process.pid, activity: null },
        nonce: randomUUID()
      })
    )
  } catch {
    // ignore
  }
}
