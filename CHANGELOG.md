# Changelog

### 🐛 Fixes
- **Thème**: Corrigé le bug du chargement figé lors du changement de thème/accent
  - Suppression de l'appel inutile à `render()` pour les changements de thème
  - Mise à jour instantanée des styles CSS sans passer par PageLoader
  - Les boutons de thème se mettent à jour visuellement en temps réel
  - L'interface reste réactive et fluide pendant les changements
  
### ⚡ Performance
- **PageLoader**: Optimisé pour éviter de masquer inutilement le contenu
  - Les transitions sont maintenant lisses et prévisibles
  - L'opacité du contenu est garantie à 100% lors du rendu
  - Gestion améliorée des erreurs pour maintenir la visibilité

### 🔄 Changes
- **Thème Manager**: Les changements de thème et d'accent sont maintenant instantanés
  - Pas de délai d'attente pour voir les changements
  - L'affichage du "Thème actuel" se met à jour immédiatement
  - Les boutons de sélection reflètent l'état actuel instantanément