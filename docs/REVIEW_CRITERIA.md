# Review Criteria

Critères de review à appliquer lors de l'analyse de chaque fichier du projet.

## Critères principaux

| Icône | Critère | Description |
|-------|---------|-------------|
| 🔁 | **Code redondant / duplication** | Identifier et factoriser le code dupliqué |
| 🗑️ | **Reliquats / code mort** | Supprimer le code inutilisé ou obsolète |
| ⚡ | **Optimisation données / exécution** | Améliorer les performances (requêtes, rendu, mémoire) |
| 🔒 | **Sécurité** | Vérifier validation, permissions, protection contre injections |
| 🧪 | **Tests unitaires** | Vérifier existence et pertinence des tests |

## Checklist détaillée

### 🔁 Code redondant / duplication
- [ ] Logique métier dupliquée → extraire dans utils/helpers/services
- [ ] Messages d'erreur dupliqués → centraliser dans `@shared/constants`
- [ ] Validation dupliquée → utiliser `@shared/utils/validation.utils.ts`
- [ ] Styles CSS répétés → extraire dans variables/mixins SCSS

### 🗑️ Reliquats / code mort
- [ ] Imports inutilisés
- [ ] Variables/fonctions non utilisées
- [ ] Commentaires obsolètes
- [ ] Code commenté (à supprimer)
- [ ] Fichiers orphelins

### ⚡ Optimisation
- [ ] Requêtes N+1 (utiliser `include` Prisma)
- [ ] Données chargées mais non utilisées
- [ ] Re-renders inutiles (computed vs methods)
- [ ] Appels API parallélisables (`Promise.all`)

### 🔒 Sécurité
- [ ] Validation des entrées utilisateur (côté client ET serveur)
- [ ] Vérification des permissions avant actions sensibles
- [ ] Isolation des données par équipe (`teamId`)
- [ ] Protection contre injection SQL (Prisma paramétré)
- [ ] Pas de secrets exposés côté client
- [ ] Format d'erreur `errors[]` (pas de détails techniques sensibles)

### 🧪 Tests unitaires
- [ ] Tests existants pour la logique métier critique
- [ ] Tests de validation (entrées valides/invalides)
- [ ] Tests de permissions
- [ ] Pas de tests "vides" ou qui ne testent rien de réel
