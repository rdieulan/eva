# EVA - Roadmap

## 📋 À faire

### ⚖️ Règles de Validation d'Équilibre - Tests

- [ ] Tests unitaires pour le vérificateur d'équilibre avec règles dynamiques
- [ ] Tests API pour les routes balance-rules
- [ ] Tests composant pour BalanceRulesModal

---

## ✅ Historique

### ⚖️ Règles de Validation d'Équilibre Personnalisables (2026-01-23)

Système permettant à chaque équipe de configurer ses propres règles de validation d'équilibre des maps.

**Règles disponibles :**
- `MIN_PLAYERS_PER_ROLE` : Joueurs minimum par rôle (param: minPlayers, défaut: 2)
- `MIN_ROLES_PER_PLAYER` : Rôles minimum par joueur (param: minRoles, défaut: 2)
- `MAX_ROLES_PER_PLAYER` : Rôles maximum par joueur (param: maxRoles, défaut: 2)
- `NO_DUPLICATE_PAIRS` : Pas de paires dupliquées entre rôles

**Fonctionnalités :**
- Toggle enabled/disabled par règle
- Sélection severity ERROR/WARNING
- Paramètres numériques éditables
- Reset aux valeurs par défaut
- Affichage 3 états (✓ vert, ⚠ jaune, ✗ rouge)
- Accès via page Équipe (permission `canManageBalanceRules`)

---

## 📦 Documentation

- `docs/CODE_RULES.md` - Règles et conventions de code
- `docs/CODING_AGENT.md` - Scripts d'automatisation pour l'agent

