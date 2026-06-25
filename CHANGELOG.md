# Changelog

## [Unreleased] - 2026-06-25

- Correction : démarrage automatique sous Windows attend désormais la connexion Internet avant d’afficher l’interface principale.
- Correction : détection réseau renforcée au démarrage avec vérification DNS, connexion TCP et plusieurs requêtes HTTP vers des serveurs fiables.
- Correction : ajout de la prise en charge IPC `check-online` et `network-status` dans `preload.js` pour éviter le blocage des vérifications réseau côté renderer.
- Correction : comportement de secours dans le renderer utilisant `navigator.onLine` afin de ne pas afficher un faux message hors ligne lorsque le PC est connecté.
- Amélioration : lancement Minecraft forcé avec `javaw` après le téléchargement pour éviter l’ouverture de la console Java.
- Amélioration : prévention du double démarrage de Minecraft après fermeture de l’instance lancée depuis le launcher.
