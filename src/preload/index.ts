import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen')
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion') as Promise<string>,
    getPlatform: () => ipcRenderer.invoke('app:getPlatform') as Promise<string>,
    openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url) as Promise<boolean>
  },
  overlay: {
    toggle: () => ipcRenderer.invoke('overlay:toggle'),
    close: () => ipcRenderer.invoke('overlay:close')
  },
  console: {
    setMode: (enabled: boolean) => ipcRenderer.invoke('console:setMode', enabled) as Promise<boolean>
  },
  steamTools: {
    importPlugins: () =>
      ipcRenderer.invoke('steamtools:import') as Promise<{
        imported: Array<{ type: 'lua' | 'manifest'; fileName: string; appId?: string }>
        errors: string[]
      }>
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
