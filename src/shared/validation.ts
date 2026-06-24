import { z } from 'zod'

export const gamePlatformSchema = z.enum([
  'steam',
  'epic',
  'gog',
  'ubisoft',
  'battlenet',
  'manual'
])

export const trophyTierSchema = z.enum(['bronze', 'silver', 'gold', 'platinum'])

export const addGameSchema = z.object({
  name: z.string().min(1).max(200),
  platform: gamePlatformSchema,
  appId: z.string().optional(),
  installPath: z.string().optional(),
  coverUrl: z.string().url().optional().or(z.literal('')),
  bannerUrl: z.string().url().optional().or(z.literal('')),
  description: z.string().max(5000).optional()
})

export const updateProfileSchema = z.object({
  username: z.string().min(2).max(32).optional(),
  avatarUrl: z.string().url().optional().or(z.literal(''))
})

export const settingsSchema = z.object({
  theme: z.enum(['ps5', 'xbox', 'nintendo', 'cyberpunk', 'minimal']).optional(),
  soundEnabled: z.boolean().optional(),
  consoleMode: z.boolean().optional(),
  autoLaunch: z.boolean().optional(),
  fullscreen: z.boolean().optional(),
  overlayShortcut: z.string().max(50).optional(),
  steamToolsEnabled: z.boolean().optional(),
  discordEnabled: z.boolean().optional(),
  discordRichPresence: z.boolean().optional(),
  discordAppId: z.string().max(32).optional(),
  spotifyEnabled: z.boolean().optional(),
  spotifyClientId: z.string().max(64).optional(),
  showMediaInOverlay: z.boolean().optional()
})

export const launchGameSchema = z.object({
  gameId: z.string().uuid()
})

export const cloudLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
})

export const cloudRegisterSchema = cloudLoginSchema.extend({
  username: z.string().min(2).max(32)
})
