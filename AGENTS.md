# AGENTS.md — Velkora AI Agent Instructions

Purpose: concise, link-first guidance for AI coding agents working on this repository.

## Quick Start

- Install dependencies and start in dev mode:

```bash
npm install
npm run copy-assets
npm run dev
```

- Build (production):

```bash
npm run build          # build all platforms (where supported)
npm run build:win      # Windows NSIS installer
```

See [package.json](package.json) for full scripts.

## Architecture (high level)

- **Main process**: [src/main/index.js](src/main/index.js) — app startup, window creation, IPC handlers, game-launch orchestration.
- **Renderer**: [src/renderer/app.js](src/renderer/app.js) — UI initialization, view lifecycle, renderer-side IPC.

Core managers and files:

- [src/main/microsoft-auth.js](src/main/microsoft-auth.js) — Microsoft OAuth2 flow
- [src/main/minecraft-launcher.js](src/main/minecraft-launcher.js) — game launch + loader detection
- [src/main/discord-rpc.js](src/main/discord-rpc.js) — Discord Rich Presence
- [src/renderer/ModsManager.js](src/renderer/ModsManager.js) — mods/resource pack UI
- [scripts/copy-assets.js](scripts/copy-assets.js) — prebuild asset copy

## Key Files

- [package.json](package.json)
- [README.md](README.md)
- [forge.config.js](forge.config.js)
- [build/installer.nsh](build/installer.nsh)
- [src/main/index.js](src/main/index.js)
- [src/renderer/app.js](src/renderer/app.js)

## Security Checklist (Actionable)

1. Review `contextIsolation` (current repo uses `contextIsolation: false`). Remediation steps:
   - Set `contextIsolation: true` and expose a minimal, well-scoped `preload` API for renderer needs.
   - Move privileged logic into the main process and avoid exposing `require`/Node globals in renderer.
   - Validate all external URLs in [src/main/electron-security.js](src/main/electron-security.js).
2. Keep CSP strict in renderer pages (`index.html`) and avoid loading remote scripts unless whitelisted.
3. Native modules (e.g., `sharp`) require `electron-rebuild` on platform-specific CI/builds. If a native build fails:

```bash
npm rebuild --build-from-source
npx electron-rebuild -f -w sharp
```

4. Tokens and secrets: tokens are persisted in `electron-store`; avoid logging secrets and rotate tokens if possible.

## Conventions

- Logging: emoji-prefixed console messages are used across the codebase. Example:

```js
console.log('✅ Mods loaded:', count);
```

- IPC pattern (main):

```js
ipcMain.handle('get-profiles', async (event) => {
  try {
    const profiles = await getProfiles();
    return { success: true, data: profiles };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
```

- Naming: Classes in `PascalCase`, methods `camelCase`, IPC channels `kebab-case`.

## Build notes & pitfalls

- Windows packaging uses NSIS: see [build/installer.nsh](build/installer.nsh) and `npm run build:win`.
- If `sharp` or other native deps fail on Windows, ensure Visual Studio Build Tools and Python are installed.

## Where to look first for common tasks

- Start: [src/main/index.js](src/main/index.js)
- UI/flow: [src/renderer/app.js](src/renderer/app.js)
- Build config: [forge.config.js](forge.config.js)

---

Keep this file minimal and link-first. Link to richer docs (e.g., `README.md`) instead of copying them here.
