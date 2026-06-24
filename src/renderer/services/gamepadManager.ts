import { useAppStore } from '../stores/appStore'

export type GamepadDirection = 'up' | 'down' | 'left' | 'right'

export interface GamepadCallbacks {
  onNavigate?: (direction: GamepadDirection) => void
  onConfirm?: () => void
  onBack?: () => void
  onMenu?: () => void
  onSearch?: () => void
  onBumperLeft?: () => void
  onBumperRight?: () => void
}

/** Options / Start — overlay */
const OVERLAY_BUTTONS = [8, 9] as const
/** Guide / Home — bascule jeu ↔ launcher si un jeu tourne */
const GUIDE_BUTTONS = [16, 17] as const

const BUTTON_MAP: Record<number, keyof GamepadCallbacks | 'dir'> = {
  12: 'dir',
  13: 'dir',
  14: 'dir',
  15: 'dir',
  0: 'onConfirm',
  1: 'onBack',
  3: 'onSearch',
  4: 'onBumperLeft',
  5: 'onBumperRight'
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
  priority: number
}

let initialized = false
let rafId = 0
const pressed = new Set<number>()
const overlayPressed = new Set<number>()
let lastOverlayToggle = 0
let lastFocusToggle = 0
const subscriptions: Subscription[] = []

function isButtonPressed(gp: Gamepad, index: number): boolean {
  const btn = gp.buttons[index]
  if (!btn) return false
  return btn.pressed || (btn.value ?? 0) > 0.45
}

function getGamepad(): Gamepad | null {
  const pads = navigator.getGamepads()
  for (const pad of pads) {
    if (pad) return pad
  }
  return null
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
  if (now - lastOverlayToggle < 500) return
  lastOverlayToggle = now
  void window.electronAPI?.overlay.toggle()
}

function toggleLauncherGameFocus(): void {
  const now = Date.now()
  if (now - lastFocusToggle < 500) return
  lastFocusToggle = now

  const { runningGame, launcherHasFocus, setLauncherHasFocus } = useAppStore.getState()
  if (!runningGame) {
    toggleOverlay()
    return
  }

  if (launcherHasFocus) {
    void window.electronAPI?.window.focusGame()
    setLauncherHasFocus(false)
  } else {
    void window.electronAPI?.window.focus()
    setLauncherHasFocus(true)
  }
}

function handleOverlayButtons(gp: Gamepad): void {
  for (const idx of OVERLAY_BUTTONS) {
    if (edgePress(idx, overlayPressed, isButtonPressed(gp, idx))) {
      toggleOverlay()
      return
    }
  }

  for (const idx of GUIDE_BUTTONS) {
    if (edgePress(idx + 100, overlayPressed, isButtonPressed(gp, idx))) {
      toggleLauncherGameFocus()
      return
    }
  }

  for (let i = 0; i < gp.buttons.length; i++) {
    const label = gp.buttons[i]?.label?.toLowerCase() ?? ''
    if (label.includes('start') || label.includes('options') || label.includes('menu')) {
      if (edgePress(1000 + i, overlayPressed, isButtonPressed(gp, i))) {
        toggleOverlay()
        return
      }
    }
    if (label.includes('guide') || label.includes('home') || label.includes('ps')) {
      if (edgePress(2000 + i, overlayPressed, isButtonPressed(gp, i))) {
        toggleLauncherGameFocus()
        return
      }
    }
  }
}

function handleNavigation(gp: Gamepad, callbacks: GamepadCallbacks): void {
  for (const [indexStr, action] of Object.entries(BUTTON_MAP)) {
    const index = Number(indexStr)
    if (edgePress(index, pressed, isButtonPressed(gp, index))) {
      if (action === 'dir') {
        callbacks.onNavigate?.(DIR_MAP[index]!)
      } else {
        const fn = callbacks[action as keyof GamepadCallbacks]
        if (typeof fn === 'function') fn()
      }
    }
  }

  const threshold = 0.5
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

  if (!gp) {
    rafId = requestAnimationFrame(poll)
    return
  }

  useAppStore.getState().setNavigationMode('gamepad')
  handleOverlayButtons(gp)

  const active = [...subscriptions]
    .filter((s) => s.enabled())
    .sort((a, b) => b.priority - a.priority)[0]

  if (active) {
    handleNavigation(gp, active.callbacks)
  }

  rafId = requestAnimationFrame(poll)
}

export function initGamepadManager(): void {
  if (initialized) return
  initialized = true

  const wake = (): void => {
    for (const pad of navigator.getGamepads()) {
      if (pad) poll()
    }
  }

  window.addEventListener('gamepadconnected', wake)
  window.addEventListener('gamepaddisconnected', wake)
  rafId = requestAnimationFrame(poll)
}

export function subscribeGamepad(
  callbacks: GamepadCallbacks,
  enabled: () => boolean,
  priority = 0
): () => void {
  initGamepadManager()
  const id = Symbol('gamepad-sub')
  const sub: Subscription = { id, callbacks, enabled, priority }
  subscriptions.push(sub)

  return () => {
    const idx = subscriptions.findIndex((s) => s.id === id)
    if (idx >= 0) subscriptions.splice(idx, 1)
  }
}
