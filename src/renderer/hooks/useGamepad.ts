import { useEffect, useRef, useState } from 'react'
import { subscribeGamepad, type GamepadCallbacks } from '../services/gamepadManager'

export function useGamepad(callbacks: GamepadCallbacks, enabled = true, priority = 0): void {
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
        onSearch: () => callbacksRef.current.onSearch?.(),
        onBumperLeft: () => callbacksRef.current.onBumperLeft?.(),
        onBumperRight: () => callbacksRef.current.onBumperRight?.()
      },
      () => enabledRef.current,
      priority
    )
  }, [priority])
}

export function useGamepadConnected(): boolean {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const check = () => {
      const pads = navigator.getGamepads()
      setConnected([...pads].some((p) => p != null))
    }
    check()
    window.addEventListener('gamepadconnected', check)
    window.addEventListener('gamepaddisconnected', check)
    const interval = setInterval(check, 1000)
    return () => {
      window.removeEventListener('gamepadconnected', check)
      window.removeEventListener('gamepaddisconnected', check)
      clearInterval(interval)
    }
  }, [])

  return connected
}
