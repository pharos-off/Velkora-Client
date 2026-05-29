### Corrections appliquées

- Transitions de pages et Loading Screen
  - Désactivation du loading screen lors des changements de pages : le loading screen n'apparaît plus qu'au démarrage du launcher, pas lors des transitions entre pages.
  - Augmentation de la durée minimale d'affichage du loading screen : `minLoadingDuration` passé de 300ms à 800ms pour une meilleure visibilité.
  - Ajout d'un délai de transition entre les pages : `pageTransitionDelay` défini à 800ms pour améliorer l'UX des changements de page.
  - Implémentation du système de suivi `lastRenderedView` : ajout d'une propriété pour tracker la dernière vue rendue et éviter les rechargements inutiles.
  - Prévention du clic sur la page actuelle : les boutons du menu sont désormais automatiquement désactivés lorsque l'utilisateur est déjà sur cette page, avec un style visuel approprié (grisé, curseur not-allowed).
  - Ajout de vérifications robustes pour détecter les changements de vue (comparaisons case-insensitive et early return quand la vue n'a pas changé).
  - Suppression des doublons dans la whitelist IPC et ajout du canal `login-microsoft`.
  - **Système de forceRerender pour les sous-pages** : ajout d'un paramètre `forceRerender` dans `render()` et `renderContentAsync()` permettant de forcer le rechargement du contenu même si la vue reste la même. Ceci résout le problème des changements de tabs/sous-pages dans Mods (Mods → Shaders) et Aide & Support.
  - Modification de `ModsManager.rerenderModsView()` pour utiliser `forceRerender=true` lors des changements de catégorie.
  - Fichiers : src/renderer/PageLoader.js, src/renderer/app.js, src/renderer/ModsManager.js, src/main/preload.js

- Discord RPC
  - Synchronisation des clés et robustification : utilisation de `discord.rpcEnabled` (fallback vers `settings.discordRPC`), remplacement des vérifications `discordRPC.connected` par `discordRPC.isConnected`, et protection des appels asynchrones `connect()`, `disconnect()` et `clear()` pour éviter les erreurs si l'instance n'est pas initialisée.
  - Fichiers : src/main/index.js, src/main/discord-handler.js

- Newsletter
  - Correction du handler `subscribe-newsletter` : renvoie désormais `{ success: false, error: ... }` en cas d'erreur et enregistre proprement les adresses.
  - Fichier : src/main/index.js

- Mises à jour / User-Agent
  - Les appels vers l'API GitHub utilisent maintenant `LAUNCHER_NAME/LAUNCHER_VERSION` comme `User-Agent` au lieu d'une chaîne codée en dur (correction de typos et meilleure identification).
  - Fichiers : src/main/index.js, src/main/minecraft-launcher.js

- Minecraft Launcher
  - Suppression d'une affectation erronée (`lastError = error`) et stabilisation du fetch des versions.
  - Fichier : src/main/minecraft-launcher.js

- Microsoft Auth
  - Correction de l'attachement de session pour la fenêtre d'authentification : utilisation de `partition: 'persist:auth'` dans `BrowserWindow.webPreferences` (au lieu de tenter de passer un objet `session`).
  - Fichier : src/main/microsoft-auth.js

- Divers
  - Échappement/sanitation du chemin `gameDir` pour la commande PowerShell (doublement des apostrophes) afin d'éviter des erreurs de quoting et réduire le risque d'injection.
  - Suppression d'un double écouteur IPC `minimize-window` pour éviter les enregistrements redondants.