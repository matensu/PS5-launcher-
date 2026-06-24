import { app, BrowserWindow, ipcMain, globalShortcut, shell, screen, dialog } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { initDatabase, getDatabase } from '../database'
import { createApiServer } from '../api/server'
import { startOAuthServer } from '../integrations/oauthServer'
import { importSteamToolsFiles } from '../launcher/steamTools'
import { focusRunningGame } from '../launcher/runningGame'

const isDev = !app.isPackaged

function getPreloadPath(): string {
  const base = join(__dirname, '../preload/index')
  if (existsSync(`${base}.js`)) return `${base}.js`
  if (existsSync(`${base}.mjs`)) return `${base}.mjs`
  return `${base}.js`
}

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
const API_PORT = 3847

function createMainWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    frame: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    if (!isDev) {
      const settings = getSettingsFromDb()
      if (settings.fullscreen) {
        mainWindow?.setFullScreen(true)
      }
    }
  })

  if (!isDev) {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' http://127.0.0.1:3847; font-src 'self' data:"
          ]
        }
      })
    })
  }

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createOverlayWindow(): void {
  if (overlayWindow) {
    overlayWindow.focus()
    return
  }

  overlayWindow = new BrowserWindow({
    width: 392,
    height: 480,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    overlayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay.html`)
  } else {
    overlayWindow.loadFile(join(__dirname, '../renderer/overlay.html'))
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

function toggleOverlay(): void {
  if (overlayWindow?.isVisible()) {
    overlayWindow.hide()
    overlayWindow.close()
    overlayWindow = null
  } else {
    createOverlayWindow()
  }
}

function getSettingsFromDb(): { fullscreen: boolean; consoleMode: boolean; overlayShortcut: string } {
  try {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM settings').all() as { key: string; value: string }[]
    const settings: Record<string, unknown> = {}
    for (const row of rows) {
      settings[row.key] = JSON.parse(row.value)
    }
    return {
      fullscreen: Boolean(settings.fullscreen),
      consoleMode: Boolean(settings.consoleMode),
      overlayShortcut: (settings.overlayShortcut as string) ?? 'CommandOrControl+Shift+G'
    }
  } catch {
    return { fullscreen: true, consoleMode: false, overlayShortcut: 'CommandOrControl+Shift+G' }
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:toggleFullscreen', () => {
    mainWindow?.setFullScreen(!mainWindow.isFullScreen())
  })
  ipcMain.handle('window:focus', () => {
    if (!mainWindow) return false
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
    if (process.platform === 'win32') {
      mainWindow.moveTop()
    }
    return true
  })
  ipcMain.handle('window:focusGame', async () => focusRunningGame())

  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:getPlatform', () => process.platform)
  ipcMain.handle('app:openExternal', (_event, url: string) => {
    if (typeof url !== 'string' || !url) return false
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return shell.openExternal(url)
    }
    import('child_process').then(({ spawn }) => {
      if (process.platform === 'win32') {
        spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref()
      } else {
        spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref()
      }
    })
    return true
  })

  ipcMain.handle('overlay:toggle', () => toggleOverlay())
  ipcMain.handle('overlay:close', () => {
    overlayWindow?.close()
    overlayWindow = null
  })

  ipcMain.handle('console:setMode', (_event, enabled: boolean) => {
    if (typeof enabled !== 'boolean') return false
    if (enabled) {
      mainWindow?.setFullScreen(true)
      mainWindow?.setAlwaysOnTop(true, 'screen-saver')
    } else {
      mainWindow?.setAlwaysOnTop(false)
    }
    return true
  })

  ipcMain.handle('steamtools:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: 'Importer des plugins SteamTools',
      filters: [
        { name: 'SteamTools', extensions: ['lua', 'manifest'] },
        { name: 'Tous les fichiers', extensions: ['*'] }
      ],
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { imported: [], errors: [] }
    }
    return importSteamToolsFiles(result.filePaths)
  })
}

function registerShortcuts(): void {
  const settings = getSettingsFromDb()
  const shortcut = settings.overlayShortcut

  globalShortcut.unregisterAll()
  try {
    globalShortcut.register(shortcut, () => toggleOverlay())
  } catch (e) {
    console.warn('Failed to register overlay shortcut:', e)
  }
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.pcconsoleos.app')
  }
  await initDatabase()
  startOAuthServer(3848)
  createApiServer(API_PORT)
  registerIpcHandlers()
  createMainWindow()
  registerShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
