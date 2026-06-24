export {}

declare global {
  interface Window {
    electronAPI: {
      window: {
        minimize: () => Promise<void>
        maximize: () => Promise<void>
        close: () => Promise<void>
        toggleFullscreen: () => Promise<void>
        focus: () => Promise<boolean>
        focusGame: () => Promise<boolean>
      }
      app: {
        getVersion: () => Promise<string>
        getPlatform: () => Promise<string>
        openExternal: (url: string) => Promise<boolean>
      }
      overlay: {
        toggle: () => Promise<void>
        close: () => Promise<void>
      }
      console: {
        setMode: (enabled: boolean) => Promise<boolean>
      }
      steamTools: {
        importPlugins: () => Promise<{
          imported: Array<{ type: 'lua' | 'manifest'; fileName: string; appId?: string }>
          errors: string[]
        }>
      }
    }
  }
}
