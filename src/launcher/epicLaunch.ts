import { existsSync, readdirSync, statSync, readFileSync } from 'fs'
import { join, dirname, sep } from 'path'
import { spawn } from 'child_process'
import { getEpicManifestsPath } from './epicPath'
import { launchEpicGame } from './launcherUrls'
import type { EpicLibraryEntry } from './epicLibrary'

const SKIP_EXE = /unreal|crash|launcher|eos|setup|redist|easyanticheat|battleye|installer|vcredist|dxsetup|prereq/i

interface EpicManifestLaunch {
  AppName?: string
  LaunchExecutable?: string
  MainGameAppName?: string
}

function readManifestForApp(appName: string): EpicManifestLaunch | null {
  const manifestsPath = getEpicManifestsPath()
  if (!manifestsPath || !existsSync(manifestsPath)) return null

  for (const file of readdirSync(manifestsPath).filter((f) => f.endsWith('.item'))) {
    try {
      const manifest = JSON.parse(readFileSync(join(manifestsPath, file), 'utf-8')) as EpicManifestLaunch
      if (manifest.AppName === appName) return manifest
    } catch {
      // skip
    }
  }
  return null
}

function normalizeExePath(installPath: string, launchExecutable: string): string {
  return join(installPath, launchExecutable.replace(/\\/g, sep))
}

function pickBestExe(files: string[]): string | null {
  let best: { path: string; size: number } | null = null
  for (const file of files) {
    if (!file.toLowerCase().endsWith('.exe')) continue
    if (SKIP_EXE.test(file)) continue
    try {
      const size = statSync(file).size
      if (!best || size > best.size) best = { path: file, size }
    } catch {
      // skip
    }
  }
  return best?.path ?? null
}

function scanForExecutable(installPath: string): string | null {
  const candidates: string[] = []
  const subdirs = ['Binaries/Win64', 'Binaries/Win32', '']

  for (const sub of subdirs) {
    const dir = sub ? join(installPath, sub) : installPath
    if (!existsSync(dir)) continue
    try {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        try {
          if (statSync(full).isFile()) candidates.push(full)
        } catch {
          // skip
        }
      }
    } catch {
      // skip
    }
  }

  return pickBestExe(candidates)
}

export function findEpicGameExecutable(appName: string, installPath: string): string | null {
  const manifest = readManifestForApp(appName)

  if (manifest?.LaunchExecutable) {
    const fromManifest = normalizeExePath(installPath, manifest.LaunchExecutable)
    if (existsSync(fromManifest)) return fromManifest
  }

  return scanForExecutable(installPath)
}

export interface EpicLaunchResult {
  ok: boolean
  pid?: number
  exePath?: string
}

export async function launchEpicGameDirect(entry: EpicLibraryEntry): Promise<EpicLaunchResult> {
  if (!entry.installed || !entry.installPath || !existsSync(entry.installPath)) {
    try {
      launchEpicGame(entry.appName)
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }

  const exe = findEpicGameExecutable(entry.appName, entry.installPath)
  if (exe) {
    try {
      const child = spawn(exe, [], {
        cwd: dirname(exe),
        detached: true,
        stdio: 'ignore',
        shell: false
      })
      child.unref()
      return { ok: true, pid: child.pid, exePath: exe }
    } catch {
      // fallback to URI
    }
  }

  try {
    launchEpicGame(entry.appName)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
