import { execFile } from 'child_process'
import { basename } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

function escapePsString(value: string): string {
  return value.replace(/'/g, "''")
}

export async function findPidsUnderPath(installPath: string): Promise<number[]> {
  if (process.platform !== 'win32' || !installPath) return []

  const pathArg = escapePsString(installPath)
  const script = `
$root = '${pathArg}'
Get-CimInstance Win32_Process |
  Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) } |
  Select-Object -ExpandProperty ProcessId
`.trim()

  try {
    const { stdout } = await execFileAsync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 10_000, windowsHide: true }
    )
    return stdout
      .split(/\r?\n/)
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0)
  } catch {
    return []
  }
}

export async function findPidsByExecutable(exePath: string): Promise<number[]> {
  if (process.platform !== 'win32' || !exePath) return []

  const exeArg = escapePsString(exePath)
  const nameArg = escapePsString(basename(exePath))
  const script = `
$exe = '${exeArg}'
$name = '${nameArg}'
Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -ieq $name -and $_.ExecutablePath -and $_.ExecutablePath -ieq $exe
  } |
  Select-Object -ExpandProperty ProcessId
`.trim()

  try {
    const { stdout } = await execFileAsync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 10_000, windowsHide: true }
    )
    return stdout
      .split(/\r?\n/)
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0)
  } catch {
    return []
  }
}

export async function killProcessTree(pid: number): Promise<boolean> {
  if (process.platform !== 'win32') return false
  try {
    await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      timeout: 10_000,
      windowsHide: true
    })
    return true
  } catch {
    return false
  }
}

export async function focusProcess(pid: number): Promise<boolean> {
  if (process.platform !== 'win32') return false

  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class PcConsoleFg {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue
if ($p -and $p.MainWindowHandle -ne [IntPtr]::Zero) {
  [void][PcConsoleFg]::ShowWindow($p.MainWindowHandle, 9)
  [PcConsoleFg]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
  exit 0
}
exit 1
`.trim()

  try {
    await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      timeout: 8_000,
      windowsHide: true
    })
    return true
  } catch {
    return false
  }
}
