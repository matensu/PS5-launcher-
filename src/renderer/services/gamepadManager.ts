import { useAppStore } from '../stores/appStore'

export type GamepadDirection = 'up' | 'down' | 'left' | 'right'

export interface GamepadCallbacks {
  onNavigate?: (direction: GamepadDirection) => void
  onConfirm?: () => void
  onBack?: () => void
  onMenu?: () => void
  onSearch?: () => void
}

/** Start / Options (9), Guide Xbox (16), Home PS sur certains pilotes (17) */
const OVERLAY_BUTTONS = [9, 16, 17] as const

const BUTTON_MAP: Record<number, keyof GamepadCallbacks | 'dir'> = {
  12: 'dir',
  13: 'dir',
  14: 'dir',
  15: 'dir',
  0: 'onConfirm',
  1: 'onBack',
  3: 'onSearch'
}

const DIR_MAP: Record<number, GamepadDirection> = {
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right'
}

interface Subscription {
  id: symbol
  callbacks: GamepadCallbacks
  enabled: () => boolean
}

let initialized = false
let intervalId: ReturnType<typeof setInterval> | null = null
let pollMs = 250
const pressed = new Set<number>()
const overlayPressed = new Set<number>()
let lastOverlayToggle = 0
const subscriptions: Subscription[] = []

function getGamepad(): Gamepad | null {
  const pads = navigator.getGamepads()
  return pads[0] ?? pads[1] ?? pads[2] ?? pads[3] ?? null
}

function edgePress(buttonIndex: number, set: Set<number>, isPressed: boolean): boolean {
  if (isPressed && !set.has(buttonIndex)) {
    set.add(buttonIndex)
    return true
  }
  if (!isPressed && set.has(buttonIndex)) {
    set.delete(buttonIndex)
  }
  return false
}

function toggleOverlay(): void {
  const now = Date.now()
  if (now - lastOverlayToggle < 600) return
  lastOverlayToggle = now
  void window.electronAPI?.overlay.toggle()
}

function handleOverlayButtons(gp: Gamepad): void {
  for (const idx of OVERLAY_BUTTONS) {
    const isPressed = gp.buttons[idx]?.pressed ?? false
    if (edgePress(idx, overlayPressed, isPressed)) {
      toggleOverlay()
    }
  }
}

function handleNavigation(gp: Gamepad, callbacks: GamepadCallbacks): void {
  for (const [indexStr, action] of Object.entries(BUTTON_MAP)) {
    const index = Number(indexStr)
    const isPressed = gp.buttons[index]?.pressed ?? false

    if (edgePress(index, pressed, isPressed)) {
      if (action === 'dir') {
        callbacks.onNavigate?.(DIR_MAP[index]!)
      } else {
        const fn = callbacks[action as keyof GamepadCallbacks]
        if (typeof fn === 'function') fn()
      }
    }
  }

  const threshold = 0.55
  const stickX = gp.axes[0] ?? 0
  const stickY = gp.axes[1] ?? 0

  if (stickX < -threshold) {
    if (!pressed.has(-1)) {
      pressed.add(-1)
      callbacks.onNavigate?.('left')
    }
  } else if (stickX > threshold) {
    if (!pressed.has(-2)) {
      pressed.add(-2)
      callbacks.onNavigate?.('right')
    }
  } else {
    pressed.delete(-1)
    pressed.delete(-2)
  }

  if (stickY < -threshold) {
    if (!pressed.has(-3)) {
      pressed.add(-3)
      callbacks.onNavigate?.('up')
    }
  } else if (stickY > threshold) {
    if (!pressed.has(-4)) {
      pressed.add(-4)
      callbacks.onNavigate?.('down')
    }
  } else {
    pressed.delete(-3)
    pressed.delete(-4)
  }
}

function poll(): void {
  const gp = getGamepad()
  const setNavigationMode = useAppStore.getState().setNavigationMode

  if (!gp?.connected) {
    if (pollMs !== 250) {
      pollMs = 250
      restartInterval()
    }
    return
  }

  if (pollMs !== 20) {
    pollMs = 20
    restartInterval()
  }

  setNavigationMode('gamepad')
  handleOverlayButtons(gp)

  for (let i = subscriptions.length - 1; i >= 0; i--) {
    const sub = subscriptions[i]!
    if (sub.enabled()) {
      handleNavigation(gp, sub.callbacks)
      break
    }
  }
}

function restartInterval(): void {
  if (intervalId) clearInterval(intervalId)
  intervalId = setInterval(poll, pollMs)
}

export function initGamepadManager(): void {
  if (initialized) return
  initialized = true

  const onChange = (): void => {
    if (getGamepad()?.connected) poll()
  }

  window.addEventListener('gamepadconnected', onChange)
  window.addEventListener('gamepaddisconnected', onChange)
  restartInterval()
}

export function subscribeGamepad(
  callbacks: GamepadCallbacks,
  enabled: () => boolean
): () => void {
  initGamepadManager()
  const id = Symbol('gamepad-sub')
  const sub: Subscription = {
    id,
    callbacks,
    enabled
  }
  subscriptions.push(sub)

  return () => {
    const idx = subscriptions.findIndex((s) => s.id === id)
    if (idx >= 0) subscriptions.splice(idx, 1)
  }
}
