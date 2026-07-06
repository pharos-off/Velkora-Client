# Changelog

## 2026-07-06 — Patch de secours

- Correction: Résout l'erreur "Erreur: response.buffer is not a function" lors de l'installation des mises à jour et du téléchargement de mods/ressources.
	- Remplacement des appels non compatibles `response.buffer()` par une conversion robuste `Buffer.from(await response.arrayBuffer())`.
	- Permet de télécharger et lancer l'installateur sur les anciennes versions où l'API `fetch` n'expose pas `buffer()`.

- Amélioration: Lancement silencieux de l'installateur lors des mises à jour automatiques sur Windows (option NSIS `/S`) pour éviter la fenêtre d'installation interactive.

- Changement: Suppression des boutons et contrôles permettant le téléchargement/installation manuelle des mises à jour dans l'interface (le launcher gère désormais les mises à jour automatiquement et silencieusement au démarrage).

### Fichiers modifiés

- `src/main/index.js` : correction des téléchargements (remplacement de `response.buffer()`), logique de vérification/installation forcée et lancement silencieux de l'installateur sur Windows.
- `src/main/preload.js` : suppression de l'exposition des channels IPC `check-updates` et `install-update` au renderer.
- `src/main/screen-loading.js` : neutralisation des checks/notifications côté écran de chargement.
- `src/renderer/app.js` : suppression de la page "Versions" et des appels renderer liés aux mises à jour.
- `src/renderer/settings-app.js` : retrait de la section "Mises à jour" et masquage des boutons restants.

### Détails techniques

- Correction de compatibilité : `response.buffer()` remplacé par `Buffer.from(await response.arrayBuffer())` pour éviter l'erreur "response.buffer is not a function" avec certaines implémentations de `fetch`/`node-fetch`.
- Installateur Windows : lancement via `spawn(updatePath, ['/S'], { detached: true, stdio: 'ignore' }).unref()` avec un fallback vers `shell.openPath()` si nécessaire. Ce comportement suppose un installateur NSIS acceptant `/S` pour le mode silencieux.
- IPC : les handlers `ipcMain.handle('check-updates')` et `ipcMain.handle('install-update')` sont laissés dans le processus main pour la logique automatique au démarrage; le renderer ne peut plus les invoquer.