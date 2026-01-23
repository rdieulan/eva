# EVA - Roadmap

## 📋 Prochaines étapes

### ⚖️ Règles de Validation d'Équilibre Personnalisables

Permettre à chaque équipe de configurer ses propres règles de validation d'équilibre des maps, avec la possibilité de définir si chaque règle génère une erreur (bloquante) ou un avertissement.

**Phase 1 : Modèle de données**
- [ ] Migration Prisma : table `BalanceRule` avec `teamId` (FK → Team)
  - `id`, `teamId`, `ruleKey`, `name`, `description`, `severity` (ERROR/WARNING), `enabled`, `params` (JSON)
- [ ] Types partagés : `BalanceRule`, `BalanceSeverity`, `RuleKey`
- [ ] Améliorer `BalanceCheckResult` : `{ isBalanced, errors: [], warnings: [] }`

**Phase 2 : Permissions**
- [ ] Ajouter `canManageBalanceRules` dans `PlannerPermissions`
- [ ] Mettre à jour `DEFAULT_PLAYER_PERMISSIONS` et `LEADER_PERMISSIONS`
- [ ] Middleware serveur pour protéger les routes

**Phase 3 : Seed et création d'équipe**
- [ ] Définir les règles par défaut dans une constante
- [ ] Créer les règles par défaut lors de la création d'une équipe
- [ ] Script de migration pour ajouter les règles aux équipes existantes

**Phase 4 : API Server**
- [ ] `GET /api/balance-rules` : Récupérer les règles de l'équipe
- [ ] `PUT /api/balance-rules/:ruleId` : Modifier une règle
- [ ] `POST /api/balance-rules/reset` : Réinitialiser aux valeurs par défaut

**Phase 5 : Client - Composable et API**
- [ ] API client `balance-rules.api.ts`
- [ ] Composable `useBalanceRules.ts`

**Phase 6 : Client - Interface de configuration**
- [ ] Composant `BalanceRulesModal.vue`
  - Liste des règles avec toggle enabled/disabled
  - Sélecteur severity (ERROR/WARNING)
  - Paramètres éditables selon la règle
  - Bouton reset aux valeurs par défaut
- [ ] Bouton d'accès dans `PlannerLeftBar` (si permission)

**Phase 7 : Client - Vérificateur d'équilibre**
- [ ] Modifier `checkMapBalance` pour utiliser les règles dynamiques de l'équipe
- [ ] Retourner `errors` et `warnings` séparément
- [ ] Mettre à jour `PlannerLeftBar` pour afficher 3 états :
  - ✓ Vert : aucune erreur ni warning
  - ⚠ Jaune : warnings mais pas d'erreurs
  - ✗ Rouge : au moins une erreur

**Phase 8 : Tests**
- [ ] Tests unitaires pour le vérificateur d'équilibre
- [ ] Tests API pour les routes balance-rules
- [ ] Tests composant pour BalanceRulesModal

---

## 📦 Documentation

- `docs/CODE_RULES.md` - Règles et conventions de code
- `docs/CODING_AGENT.md` - Scripts d'automatisation pour l'agent

---

## 🔄 Dernière mise à jour

**Date** : 2026-01-23
