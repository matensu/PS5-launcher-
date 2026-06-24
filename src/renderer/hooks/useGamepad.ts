import { useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../stores/appStore'

type GamepadButton = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start' | 'back'

interface GamepadCallbacks {
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void
  onConfirm?: () => void
  onBack?: () => void
  onMenu?: () => void
}

const BUTTON_MAP: Record<number, GamepadButton> = {
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right',
  0: 'a',
  1: 'b',
  9: 'start',
  8: 'back'
}

export function useGamepad(callbacks: GamepadCallbacks): void {
  const pressedRef = useRef<Set<number>>(new Set())
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks
  const setNavigationMode = useAppStore((s) => s.setNavigationMode)

  const pollGamepad = useCallback(() => {
    const gamepads = navigator.getGamepads()
    const gp = gamepads[0] ?? gamepads[1] ?? gamepads[2] ?? gamepads[3]

    if (!gp) return

    setNavigationMode('gamepad')

    for (const [indexStr, button] of Object.entries(BUTTON_MAP)) {
      const index = Number(indexStr)
      const isPressed = gp.buttons[index]?.pressed ?? false
      const wasPressed = pressedRef.current.has(index)

      if (isPressed && !wasPressed) {
        pressedRef.current.add(index)

        switch (button) {
          case 'up':
          case 'down':
          case 'left':
          case 'right':
            callbacksRef.current.onNavigate?.(button)
            break
          case 'a':
            callbacksRef.current.onConfirm?.()
            break
          case 'b':
            callbacksRef.current.onBack?.()
            break
          case 'start':
            callbacksRef.current.onMenu?.()
            break
        }
      } else if (!isPressed && wasPressed) {
        pressedRef.current.delete(index)
      }
    }

    const threshold = 0.5
    if (gp.axes[0] < -threshold) {
      if (!pressedRef.current.has(-1)) {
        pressedRef.current.add(-1)
        callbacksRef.current.onNavigate?.('left')
      }
    } else if (gp.axes[0] > threshold) {
      if (!pressedRef.current.has(-2)) {
        pressedRef.current.add(-2)
        callbacksRef.current.onNavigate?.('right')
      }
    } else {
      pressedRef.current.delete(-1)
      pressedRef.current.delete(-2)
    }
  }, [setNavigationMode])

  useEffect(() => {
    const interval = setInterval(pollGamepad, 16)
    return () => clearInterval(interval)
  }, [pollGamepad])
}

export function useGamepadConnected(): boolean {
  const connectedRef = useRef(false)

  useEffect(() => {
    const onConnect = () => { connectedRef.current = true }
    const onDisconnect = () => { connectedRef.current = false }

    window.addEventListener('gamepadconnected', onConnect)
    window.addEventListener('gamepaddisconnected', onDisconnect)

    return () => {
      window.removeEventListener('gamepadconnected', onConnect)
      window.removeEventListener('gamepaddisconnected', onDisconnect)
    }
  }, [])

  return connectedRef.current
}
