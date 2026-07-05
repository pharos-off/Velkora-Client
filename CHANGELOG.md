# Changelog

## [Unreleased] - 2026-07-05

- Correction : fix du crash de démarrage `Store is not a constructor` en important `electron-store` via son export par défaut dans `src/main/security-manager.js`, `src/main/microsoft-auth.js` et `src/main/index.js`.
- Correction : fix de l'erreur `fetch is not a function` dans le contrôle des mises à jour en important `node-fetch` via son export par défaut.
- Mise à jour : versions des dépendances principales (`electron`, `systeminformation`, `node-fetch`, `minecraft-launcher-core`, `minecraft-protocol`, `sharp`, etc.) et correction des incompatibilités liées au chargement des modules.
- Ajout : option de paramètres pour afficher Mission Control en plein écran.
- Ajout : `missionControlFullscreen` désormais stocké dans les paramètres et pris en compte lors de la création de la fenêtre Mission Control.
- Correction : le mode Mission Control plein écran utilise maintenant une maximisation fenêtrée plutôt qu’une vraie mise en plein écran natif.
- Amélioration : alignement visuel de Mission Control avec le thème principal du launcher, y compris le fond, les panneaux et la barre de titre.
- Ajout : remplacement du son de notification synthétique par le fichier WAV `assets/sound-notification.wav` pour toutes les notifications.
- Correction : suppression du son système par défaut de Windows sur les notifications Electron en les rendant silencieuses et en gardant uniquement le son local personnalisé.
- Amélioration : ajout d’un message d’attente dans la fenêtre de connexion Microsoft indiquant de patienter pendant le chargement et de contacter le support si l’ouverture dépasse une minute.
- Ajout : sauvegarde persistante des favoris radio dans le player radio.