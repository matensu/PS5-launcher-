import { spawn } from 'child_process'

export function openUri(uri: string): void {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', uri], { detached: true, stdio: 'ignore' }).unref()
  } else {
    spawn('xdg-open', [uri], { detached: true, stdio: 'ignore' }).unref()
  }
}

export function openSteamStoreApp(appId: string): void {
  openUri(`steam://openurl/https://store.steampowered.com/app/${appId}`)
}

export function openSteamStoreSearch(query: string): void {
  const encoded = encodeURIComponent(query)
  openUri(`steam://openurl/https://store.steampowered.com/search/?term=${encoded}`)
}

export function openEpicStoreProduct(slug: string): void {
  openUri(`com.epicgames.launcher://store/product/${slug}`)
}

export function openEpicStoreHome(): void {
  openUri('com.epicgames.launcher://store/')
}

export function launchEpicGame(appName: string): void {
  openUri(`com.epicgames.launcher://apps/${encodeURIComponent(appName)}?action=launch&silent=true`)
}

export function installEpicGame(appName: string): void {
  openUri(`com.epicgames.launcher://apps/${encodeURIComponent(appName)}?action=install&silent=true`)
}
