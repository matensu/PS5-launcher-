# PC Console OS

Application desktop multiplateforme qui transforme votre PC gaming en une expérience console moderne, inspirée des interfaces PlayStation et Xbox tout en conservant une identité visuelle originale.

## Prérequis

### Windows 11
- [Node.js](https://nodejs.org/) 20 LTS ou supérieur
- npm 10+
- Visual Studio Build Tools **non requis** (SQLite via module natif Node.js 24+)

### Arch Linux
```bash
sudo pacman -S nodejs npm base-devel python
```

Environnements de bureau supportés : **Hyprland**, **KDE Plasma**, **GNOME**.

## Installation

```bash
# Cloner ou accéder au projet
cd "PS5 OS"

# Installer les dépendances
npm install

# Lancer en mode développement
npm run dev
```

## Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance l'app Electron en mode développement |
| `npm run build` | Compile l'application |
| `npm run pack:win` | Génère l'installateur NSIS Windows |
| `npm run pack:linux` | Génère l'AppImage Linux |
| `npm run pack:arch` | Génère le paquet Pacman (.pkg.tar.zst) |
| `npm run typecheck` | Vérification TypeScript |

## Fonctionnalités

- **Bibliothèque de jeux** — Détection automatique Steam, Epic, GOG, Ubisoft Connect, Battle.net
- **Trophées** — Système Bronze/Argent/Or/Platine avec sync Steam
- **Profil joueur** — Niveau, XP, statistiques
- **Défis quotidiens** — Missions avec récompenses XP
- **Navigation manette** — Xbox, DualSense, DualShock 4, Nintendo Pro
- **Hub de jeu** — Page dédiée par jeu avec lancement
- **Overlay** — `Ctrl + Shift + G` en jeu
- **Mode Console** — Plein écran immersif au démarrage
- **5 thèmes** — Aurora, Velocity, Pulse, Neon, Pure

## Raccourcis

| Raccourci | Action |
|-----------|--------|
| `Ctrl + Shift + G` | Ouvrir/fermer l'overlay |
| Manette `A` | Confirmer / Ouvrir le hub |
| Manette `B` | Retour |
| Manette `D-Pad` | Navigation horizontale |

## Mode Console (Arch Linux)

Pour un démarrage automatique sous Hyprland, ajoutez à `~/.config/hypr/hyprland.conf` :

```conf
exec-once = pc-console-os
```

Pour KDE Plasma :
```bash
cp pc-console-os.desktop ~/.config/autostart/
```

Pour GNOME :
```bash
cp pc-console-os.desktop ~/.config/autostart/
```

## Packaging

### Windows (NSIS)
```bash
npm run pack:win
```
L'installateur sera dans `dist/`.

### Arch Linux (AppImage + Pacman)
```bash
npm run pack:arch
```

## Structure du projet

```
src/
├── main/           # Process Electron principal
├── preload/        # IPC sécurisé
├── renderer/       # Interface React
├── api/            # Serveur Express local
├── database/       # SQLite
├── launcher/       # Détection et lancement de jeux
├── achievements/   # Système de trophées
└── shared/         # Types et validation
```

## Sécurité

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- CSP stricte
- Validation Zod sur toutes les entrées API

## Cloud Sync

La synchronisation cloud (PostgreSQL + JWT) nécessite un serveur externe. Configurez `CLOUD_API_URL` — voir `docs/DEVELOPER.md`.

## Licence

MIT
