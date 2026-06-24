import type { Settings } from '@shared/types'

export interface Theme {
  id: Settings['theme']
  name: string
  colors: {
    bg: string
    surface: string
    accent: string
    accentGlow: string
    text: string
    muted: string
    card: string
    border: string
  }
  gradient: string
}

export const themes: Theme[] = [
  {
    id: 'ps5',
    name: 'Aurora',
    colors: {
      bg: '#0a0a12',
      surface: 'rgba(20, 20, 35, 0.85)',
      accent: '#0070d1',
      accentGlow: 'rgba(0, 112, 209, 0.5)',
      text: '#f0f0f5',
      muted: '#8a8a9a',
      card: 'rgba(30, 30, 50, 0.6)',
      border: 'rgba(255, 255, 255, 0.08)'
    },
    gradient: 'radial-gradient(ellipse at 20% 50%, rgba(0, 112, 209, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(100, 50, 200, 0.1) 0%, transparent 40%)'
  },
  {
    id: 'xbox',
    name: 'Velocity',
    colors: {
      bg: '#0d1117',
      surface: 'rgba(16, 24, 16, 0.9)',
      accent: '#107c10',
      accentGlow: 'rgba(16, 124, 16, 0.5)',
      text: '#e8e8e8',
      muted: '#7a8a7a',
      card: 'rgba(20, 30, 20, 0.7)',
      border: 'rgba(16, 124, 16, 0.2)'
    },
    gradient: 'radial-gradient(ellipse at 50% 0%, rgba(16, 124, 16, 0.2) 0%, transparent 60%)'
  },
  {
    id: 'nintendo',
    name: 'Pulse',
    colors: {
      bg: '#1a0a0a',
      surface: 'rgba(30, 15, 15, 0.9)',
      accent: '#e60012',
      accentGlow: 'rgba(230, 0, 18, 0.4)',
      text: '#f5f0f0',
      muted: '#9a8080',
      card: 'rgba(40, 20, 20, 0.7)',
      border: 'rgba(230, 0, 18, 0.15)'
    },
    gradient: 'radial-gradient(ellipse at 30% 70%, rgba(230, 0, 18, 0.12) 0%, transparent 50%)'
  },
  {
    id: 'cyberpunk',
    name: 'Neon',
    colors: {
      bg: '#0a0510',
      surface: 'rgba(15, 5, 25, 0.9)',
      accent: '#ff00ff',
      accentGlow: 'rgba(255, 0, 255, 0.4)',
      text: '#f0e0ff',
      muted: '#8a70a0',
      card: 'rgba(25, 10, 40, 0.7)',
      border: 'rgba(255, 0, 255, 0.2)'
    },
    gradient: 'radial-gradient(ellipse at 70% 30%, rgba(255, 0, 255, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(0, 255, 255, 0.1) 0%, transparent 40%)'
  },
  {
    id: 'minimal',
    name: 'Pure',
    colors: {
      bg: '#111111',
      surface: 'rgba(24, 24, 24, 0.95)',
      accent: '#ffffff',
      accentGlow: 'rgba(255, 255, 255, 0.2)',
      text: '#ffffff',
      muted: '#888888',
      card: 'rgba(32, 32, 32, 0.8)',
      border: 'rgba(255, 255, 255, 0.1)'
    },
    gradient: 'none'
  }
]

export function applyTheme(themeId: Settings['theme']): void {
  const theme = themes.find((t) => t.id === themeId) ?? themes[0]
  const root = document.documentElement
  root.style.setProperty('--color-bg', theme.colors.bg)
  root.style.setProperty('--color-surface', theme.colors.surface)
  root.style.setProperty('--color-accent', theme.colors.accent)
  root.style.setProperty('--color-accent-glow', theme.colors.accentGlow)
  root.style.setProperty('--color-text', theme.colors.text)
  root.style.setProperty('--color-muted', theme.colors.muted)
  root.style.setProperty('--color-card', theme.colors.card)
  root.style.setProperty('--color-border', theme.colors.border)
  root.style.setProperty('--theme-gradient', theme.gradient)
}
