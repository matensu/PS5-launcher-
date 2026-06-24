import { useEffect, useRef, useState } from 'react'
import { subscribeGamepad, type GamepadCallbacks } from '../services/gamepadManager'

export function useGamepad(callbacks: GamepadCallbacks, enabled = true): void {
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    return subscribeGamepad(
      {
        onNavigate: (dir) => callbacksRef.current.onNavigate?.(dir),
        onConfirm: () => callbacksRef.current.onConfirm?.(),
        onBack: () => callbacksRef.current.onBack?.(),
        onMenu: () => callbacksRef.current.onMenu?.(),
        onSearch: () => callbacksRef.current.onSearch?.()
      },
      () => enabledRef.current
    )
  }, [])
}

export function useGamepadConnected(): boolean {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const check = () => {
      const pads = navigator.getGamepads()
      setConnected([...pads].some((p) => p?.connected))
    }
    check()
    window.addEventListener('gamepadconnected', check)
    window.addEventListener('gamepaddisconnected', check)
    return () => {
      window.removeEventListener('gamepadconnected', check)
      window.removeEventListener('gamepaddisconnected', check)
    }
  }, [])

  return connected
}
