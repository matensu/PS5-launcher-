import initSqlJs, { type Database as SqlDatabase, type Statement as SqlStatement } from 'sql.js'
import { join, dirname } from 'path'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { createRequire } from 'module'
import { app } from 'electron'
import { v4 as uuid } from 'uuid'
import type { Game, Profile, Settings, Trophy, DailyChallenge } from '../shared/types'
import { calculateLevel } from '../shared/types'

let db: SqlDatabase | null = null
let savePath = ''

class StatementWrapper {
  constructor(
    private stmt: SqlStatement,
    private onMutate: () => void
  ) {}

  run(...params: unknown[]): void {
    if (params.length > 0) this.stmt.bind(params)
    this.stmt.step()
    this.stmt.reset()
    this.onMutate()
  }

  get(...params: unknown[]): Record<string, unknown> | undefined {
    if (params.length > 0) this.stmt.bind(params)
    const hasRow = this.stmt.step()
    const result = hasRow ? (this.stmt.getAsObject() as Record<string, unknown>) : undefined
    this.stmt.reset()
    return result
  }

  all(...params: unknown[]): Record<string, unknown>[] {
    if (params.length > 0) this.stmt.bind(params)
    const results: Record<string, unknown>[] = []
    while (this.stmt.step()) {
      results.push(this.stmt.getAsObject() as Record<string, unknown>)
    }
    this.stmt.reset()
    return results
  }
}

class DatabaseWrapper {
  constructor(
    private database: SqlDatabase,
    private persist: () => void
  ) {}

  exec(sql: string): void {
    this.database.run(sql)
    this.persist()
  }

  prepare(sql: string): StatementWrapper {
    return new StatementWrapper(this.database.prepare(sql), this.persist)
  }
}

let wrapper: DatabaseWrapper | null = null

function persistDatabase(): void {
  if (!db || !savePath) return
  const data = db.export()
  writeFileSync(savePath, Buffer.from(data))
}

export function getDbPath(): string {
  const userData = app?.getPath?.('userData') ?? join(process.cwd(), 'data')
  mkdirSync(userData, { recursive: true })
  return join(userData, 'pc-console-os.db')
}

export async function initDatabase(dbPath?: string): Promise<DatabaseWrapper> {
  if (wrapper) return wrapper

  const require = createRequire(import.meta.url)
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')
  const wasmDir = dirname(wasmPath)

  const SQL = await initSqlJs({
    locateFile: (file) => join(wasmDir, file)
  })

  savePath = dbPath ?? getDbPath()
  mkdirSync(dirname(savePath), { recursive: true })

  if (existsSync(savePath)) {
    const buffer = readFileSync(savePath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  wrapper = new DatabaseWrapper(db, persistDatabase)

  wrapper.exec('PRAGMA foreign_keys = ON')

  wrapper.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      avatar_url TEXT,
      level INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      total_play_time_minutes INTEGER DEFAULT 0,
      games_owned INTEGER DEFAULT 0,
      trophies_unlocked INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      app_id TEXT,
      install_path TEXT,
      cover_url TEXT,
      banner_url TEXT,
      description TEXT,
      play_time_minutes INTEGER DEFAULT 0,
      last_played TEXT,
      added_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trophies (
      id TEXT PRIMARY KEY,
      game_id TEXT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      tier TEXT NOT NULL,
      icon TEXT,
      unlocked INTEGER DEFAULT 0,
      unlocked_at TEXT,
      is_custom INTEGER DEFAULT 0,
      steam_achievement_id TEXT,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_challenges (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      target INTEGER NOT NULL,
      progress INTEGER DEFAULT 0,
      xp_reward INTEGER NOT NULL,
      completed INTEGER DEFAULT 0,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trophy_history (
      id TEXT PRIMARY KEY,
      trophy_id TEXT NOT NULL,
      unlocked_at TEXT NOT NULL,
      FOREIGN KEY (trophy_id) REFERENCES trophies(id)
    );

    CREATE TABLE IF NOT EXISTS play_sessions (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_minutes INTEGER DEFAULT 0,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS integration_tokens (
      provider TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
  `)

  seedDefaultData(wrapper)
  return wrapper
}

function seedDefaultData(database: DatabaseWrapper): void {
  const profileCount = database.prepare('SELECT COUNT(*) as c FROM profile').get() as { c: number }
  if (profileCount.c === 0) {
    database.prepare(`
      INSERT INTO profile (id, username, level, xp, created_at)
      VALUES (?, ?, 1, 0, ?)
    `).run(uuid(), 'Joueur', new Date().toISOString())
  }

  const settingsCount = database.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number }
  if (settingsCount.c === 0) {
    const defaults: Settings = {
      theme: 'ps5',
      soundEnabled: true,
      consoleMode: false,
      autoLaunch: false,
      fullscreen: true,
      overlayShortcut: 'CommandOrControl+Shift+G',
      steamToolsEnabled: true,
      discordEnabled: true,
      discordRichPresence: true,
      discordAppId: '',
      spotifyEnabled: true,
      spotifyClientId: '',
      showMediaInOverlay: true
    }
    for (const [key, value] of Object.entries(defaults)) {
      database.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value))
    }
  }

  seedCustomTrophies(database)
  ensureDailyChallenges(database)
}

function seedCustomTrophies(database: DatabaseWrapper): void {
  const customTrophies = [
    { name: 'Marathonien', description: 'Jouer 100 heures au total', tier: 'gold' },
    { name: 'Explorateur', description: 'Lancer 50 jeux différents', tier: 'silver' },
    { name: 'Collectionneur', description: 'Obtenir 1000 succès Steam', tier: 'platinum' },
    { name: 'Premier pas', description: 'Lancer votre premier jeu', tier: 'bronze' },
    { name: 'Régulier', description: 'Jouer 7 jours consécutifs', tier: 'silver' }
  ]

  for (const t of customTrophies) {
    const existing = database.prepare('SELECT id FROM trophies WHERE name = ? AND is_custom = 1').get(t.name)
    if (!existing) {
      database.prepare(`
        INSERT INTO trophies (id, name, description, tier, is_custom, unlocked)
        VALUES (?, ?, ?, ?, 1, 0)
      `).run(uuid(), t.name, t.description, t.tier)
    }
  }
}

function ensureDailyChallenges(database: DatabaseWrapper): void {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const expiresAt = today.toISOString()

  const active = database.prepare(`
    SELECT COUNT(*) as c FROM daily_challenges WHERE expires_at > datetime('now')
  `).get() as { c: number }

  if (active.c > 0) return

  const challenges = [
    { title: 'Session rapide', description: 'Jouer 30 minutes', target: 30, xpReward: 100 },
    { title: 'Nouveauté', description: 'Lancer un nouveau jeu', target: 1, xpReward: 150 },
    { title: 'Chasseur de succès', description: 'Obtenir 5 succès', target: 5, xpReward: 200 }
  ]

  for (const c of challenges) {
    database.prepare(`
      INSERT INTO daily_challenges (id, title, description, target, xp_reward, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuid(), c.title, c.description, c.target, c.xpReward, expiresAt)
  }
}

export type DatabaseSync = DatabaseWrapper

export function getDatabase(): DatabaseWrapper {
  if (!wrapper) throw new Error('Database not initialized')
  return wrapper
}

export function rowToGame(row: Record<string, unknown>): Game {
  return {
    id: row.id as string,
    name: row.name as string,
    platform: row.platform as Game['platform'],
    appId: row.app_id as string | undefined,
    installPath: row.install_path as string | undefined,
    coverUrl: row.cover_url as string | undefined,
    bannerUrl: row.banner_url as string | undefined,
    description: row.description as string | undefined,
    playTimeMinutes: Number(row.play_time_minutes ?? 0),
    lastPlayed: row.last_played as string | undefined,
    addedAt: row.added_at as string
  }
}

export function rowToProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    username: row.username as string,
    avatarUrl: row.avatar_url as string | undefined,
    level: Number(row.level),
    xp: Number(row.xp),
    totalPlayTimeMinutes: Number(row.total_play_time_minutes ?? 0),
    gamesOwned: Number(row.games_owned ?? 0),
    trophiesUnlocked: Number(row.trophies_unlocked ?? 0),
    createdAt: row.created_at as string
  }
}

export function rowToTrophy(row: Record<string, unknown>): Trophy {
  return {
    id: row.id as string,
    gameId: row.game_id as string | undefined,
    name: row.name as string,
    description: row.description as string,
    tier: row.tier as Trophy['tier'],
    icon: row.icon as string | undefined,
    unlocked: Boolean(row.unlocked),
    unlockedAt: row.unlocked_at as string | undefined,
    isCustom: Boolean(row.is_custom),
    steamAchievementId: row.steam_achievement_id as string | undefined
  }
}

export function rowToChallenge(row: Record<string, unknown>): DailyChallenge {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    target: Number(row.target),
    progress: Number(row.progress ?? 0),
    xpReward: Number(row.xp_reward),
    completed: Boolean(row.completed),
    expiresAt: row.expires_at as string
  }
}

export function addXp(amount: number): Profile {
  const database = getDatabase()
  const profile = database.prepare('SELECT * FROM profile LIMIT 1').get() as Record<string, unknown>
  const newXp = Number(profile.xp) + amount
  const newLevel = calculateLevel(newXp)

  database.prepare('UPDATE profile SET xp = ?, level = ? WHERE id = ?').run(newXp, newLevel, profile.id)
  return rowToProfile(database.prepare('SELECT * FROM profile WHERE id = ?').get(profile.id) as Record<string, unknown>)
}

export function unlockTrophy(trophyId: string): Trophy | null {
  const database = getDatabase()
  const trophy = database.prepare('SELECT * FROM trophies WHERE id = ?').get(trophyId) as Record<string, unknown> | undefined
  if (!trophy || trophy.unlocked) return null

  const now = new Date().toISOString()
  database.prepare('UPDATE trophies SET unlocked = 1, unlocked_at = ? WHERE id = ?').run(now, trophyId)
  database.prepare('INSERT INTO trophy_history (id, trophy_id, unlocked_at) VALUES (?, ?, ?)').run(uuid(), trophyId, now)

  const profile = database.prepare('SELECT * FROM profile LIMIT 1').get() as Record<string, unknown>
  database.prepare('UPDATE profile SET trophies_unlocked = trophies_unlocked + 1 WHERE id = ?').run(profile.id)

  return rowToTrophy(database.prepare('SELECT * FROM trophies WHERE id = ?').get(trophyId) as Record<string, unknown>)
}
