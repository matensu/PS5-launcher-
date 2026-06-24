# Documentation Développeur — PC Console OS

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main                         │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ BrowserWindow│  │ GlobalShortcut│  │ IPC Handlers  │  │
│  └──────┬──────┘  └──────────────┘  └────────────────┘  │
│         │                                                │
│  ┌──────▼──────┐  ┌──────────────┐  ┌────────────────┐  │
│  │   Preload   │  │  SQLite DB   │  │ Express API    │  │
│  │ contextBridge│  │ better-sqlite3│  │ :3847         │  │
│  └──────┬──────┘  └──────────────┘  └────────────────┘  │
└─────────┼───────────────────────────────────────────────┘
          │ IPC (invoke/handle)
┌─────────▼───────────────────────────────────────────────┐
│                 React Renderer (Vite)                    │
│  Zustand │ React Query │ Framer Motion │ Tailwind       │
└─────────────────────────────────────────────────────────┘
```

## Stack technique

| Couche | Technologie |
|--------|-------------|
| UI | React 19, TypeScript, Tailwind CSS, Framer Motion |
| State | Zustand (UI), React Query (server state) |
| Desktop | Electron 33 |
| API locale | Express 4 sur `127.0.0.1:3847` |
| BDD locale | SQLite via sql.js (WASM, sans compilation native) |
| Validation | Zod |
| Packaging | electron-builder (NSIS, AppImage, Pacman) |

## Démarrage en développement

```bash
npm install
npm run dev
```

electron-vite lance simultanément :
1. Le process main Electron
2. Le serveur Vite pour le renderer (HMR)
3. L'API Express (initialisée dans le main process)

## IPC Channels

| Channel | Direction | Description |
|---------|-----------|-------------|
| `window:minimize` | renderer → main | Minimiser la fenêtre |
| `window:maximize` | renderer → main | Maximiser/restaurer |
| `window:close` | renderer → main | Fermer |
| `window:toggleFullscreen` | renderer → main | Basculer plein écran |
| `overlay:toggle` | renderer → main | Ouvrir/fermer overlay |
| `console:setMode` | renderer → main | Mode console immersif |
| `app:openExternal` | renderer → main | Ouvrir URL externe (validée) |

## API REST locale

Base URL : `http://127.0.0.1:3847/api`

### Endpoints principaux

```
GET    /profile
PATCH  /profile
GET    /games
POST   /games/sync
POST   /games
GET    /games/:id
POST   /games/:id/launch
GET    /trophies
GET    /trophies/stats
GET    /games/:id/trophies
POST   /games/:id/trophies/sync
GET    /challenges
PATCH  /challenges/:id/progress
GET    /settings
PATCH  /settings
GET    /stats
```

## Ajouter un launcher

1. Créer une fonction de détection dans `src/launcher/gameDetector.ts`
2. L'ajouter à `detectAllGames()`
3. Ajouter la logique de lancement dans `launchGame()`

## Ajouter un thème

Dans `src/renderer/themes/index.ts`, ajouter un objet `Theme` et mettre à jour le type `Settings['theme']` dans `src/shared/types.ts`.

## Système XP

| Source | XP |
|--------|-----|
| 1 heure de jeu | 50 |
| Succès Steam | 25 |
| Trophée Bronze | 15 |
| Trophée Argent | 30 |
| Trophée Or | 60 |
| Trophée Platine | 150 |
| Défi quotidien | 100–200 |

Niveau = `floor(xp / 1000) + 1`

## Cloud Sync (production)

Le scaffold cloud est dans `src/api/cloud.ts`. Pour déployer :

1. Créer un serveur Express + PostgreSQL séparé
2. Implémenter auth JWT (`/auth/register`, `/auth/login`)
3. Endpoints sync : `POST /sync/push`, `GET /sync/pull`
4. Configurer `CLOUD_API_URL` dans l'environnement

## Tests manuels

1. **Scan jeux** : Bibliothèque → Scanner
2. **Lancement** : Double-clic sur une carte ou bouton Jouer
3. **Manette** : Brancher une manette, naviguer avec le D-Pad
4. **Overlay** : `Ctrl+Shift+G`
5. **Thèmes** : Paramètres → sélectionner un thème
6. **Trophées Steam** : Hub jeu Steam → Sync Steam

## Performance

Objectifs :
- RAM au repos < 300 Mo
- Démarrage < 3 secondes
- Animations GPU (`transform`, `opacity`, `will-change`)

Optimisations appliquées :
- `lazy` loading des images
- SQLite WAL mode
- Polling manette à 60 Hz (16ms)
- React Query cache (30s staleTime)

## Build production

```bash
npm run build
npm run pack:win    # Windows
npm run pack:arch   # Arch Linux
```

Les binaires sont générés dans `dist/`.

## Contribution

1. Respecter TypeScript strict
2. Valider les entrées avec Zod
3. Ne jamais activer `nodeIntegration` dans le renderer
4. Matcher le style existant (composants fonctionnels, hooks)
