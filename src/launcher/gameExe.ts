import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const SKIP_EXE =
  /unreal|crash|launcher|steam|eos|setup|redist|easyanticheat|battleye|installer|vcredist|dxsetup|prereq|unitycrash/i

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

export function findGameExecutable(installPath: string): string | null {
  if (!installPath || !existsSync(installPath)) return null

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
