# Changelog

## 2026-07-08 — Correctif Discord RPC et notifications de paramètres

- Correction: Résolution de l'erreur Discord RPC liée à la dépendance manquante `ps-list`.
  - Suppression de l'appel inutile à cette dépendance dans le module de présence Discord.
  - Le launcher charge désormais correctement le module RPC sans bloquer l'exécution.

- Amélioration: Vérification du chargement du module Discord RPC après correction.
  - Le démarrage du client ne produit plus l'erreur `Cannot find module 'ps-list'` dans la console.

- Correctif: Résolution des notifications liées aux paramètres du launcher.
  - Les messages d'alerte et de confirmation associés aux réglages s'affichent désormais correctement.
  - Amélioration de la cohérence du feedback utilisateur dans l'interface.

- Amélioration: Ajout d’un bouton de test des notifications dans l’onglet paramètres.
  - Permet de vérifier rapidement l’affichage et le son d’une notification depuis l’interface.