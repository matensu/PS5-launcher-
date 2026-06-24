import { createServer, type Server } from 'http'
import { exchangeSpotifyCode, validateSpotifyCallback } from './spotify'

let oauthServer: Server | null = null

const SUCCESS_HTML = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>PC Console OS</title>
<style>body{font-family:system-ui;background:#0a0a0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{text-align:center;padding:2rem;border-radius:1rem;background:#ffffff10;border:1px solid #ffffff20}</style>
</head>
<body><div class="card"><h1>Connexion réussie</h1><p>Vous pouvez fermer cette fenêtre et retourner à PC Console OS.</p></div></body>
</html>`

const ERROR_HTML = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Erreur</title></head>
<body style="font-family:system-ui;background:#0a0a0f;color:#fff;text-align:center;padding:4rem">
<h1>Échec de la connexion</h1><p>Retournez à PC Console OS et réessayez.</p></body></html>`

export function startOAuthServer(port = 3848): void {
  if (oauthServer) return

  oauthServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)

    if (url.pathname === '/callback/spotify') {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const error = url.searchParams.get('error')

      if (error || !code || !state) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(ERROR_HTML)
        return
      }

      const auth = validateSpotifyCallback(state)
      if (!auth) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(ERROR_HTML)
        return
      }

      const ok = await exchangeSpotifyCode(code, auth.verifier, auth.clientId)
      res.writeHead(ok ? 200 : 500, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(ok ? SUCCESS_HTML : ERROR_HTML)
      return
    }

    res.writeHead(404)
    res.end()
  })

  oauthServer.listen(port, '127.0.0.1', () => {
    console.log(`[PC Console OS] OAuth callback on http://127.0.0.1:${port}`)
  })
}

export function stopOAuthServer(): void {
  oauthServer?.close()
  oauthServer = null
}
