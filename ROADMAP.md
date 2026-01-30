# EVA - Roadmap

## 📋 En cours

---

## Feature : Tests d'intégration (Supertest)

**Objectif**: Mettre en place des tests d'intégration pour tester les endpoints API de bout en bout, afin de détecter les régressions rapidement.

---

### Phase 1 - Setup ✅

| Tâche | Statut | Notes |
|-------|--------|-------|
| 1.1 Restructurer le serveur (app.ts séparé) | ✅ | `server/src/app.ts` créé, `server/index.ts` simplifié |
| 1.2 Créer `tests/integration/setup.ts` | ✅ | Configuration DB test, cleanup |
| 1.3 Créer helpers d'authentification | ✅ | `createTestUser`, `createTestToken`, `createAuthenticatedUser`, `isValidJwtFormat` |
| 1.4 Créer helpers de données | ✅ | `createTestTeam`, `createUserWithTeam`, `cleanDatabase` |
| 1.5 Configurer Vitest pour les tests d'intégration | ✅ | `vitest.integration.config.mts` + script `npm run test:integration` |
| 1.6 Installer Supertest | ✅ | `supertest` + `@types/supertest` |

---

### Phase 2 - Tests critiques ✅

| Route | Priorité | Statut | Cas testés |
|-------|----------|--------|------------|
| `POST /api/auth/login` | Haute | ✅ | Succès + format JWT, case-insensitive email, mauvais password, user inexistant, sécurité (même erreur) |
| `POST /api/auth/register` | Haute | ✅ | Succès + userId valide, email existant (409), validation password/email/username |
| `POST /api/teams` | Haute | ✅ | Création équipe + game plans par défaut, 401 sans auth, rejet si déjà dans une équipe |
| `GET /api/teams/current` | Haute | ✅ | Retour info équipe, 404 si pas d'équipe |
| `POST /api/invites/:code/join` | Haute | ✅ | Join valide + DB (user.teamId, invite.uses), code expiré (400), code invalide (404) |
| `POST /api/teams/invites` | Haute | ✅ | Création succès + DB, 401 sans auth, 403 sans permission, 403 autre équipe, 400 params invalides |
| `GET /api/maps` | Moyenne | ✅ | Succès + structure + DB, 401 sans auth, 403 sans équipe, isolation par équipe |
| `GET /api/calendar/availability` | Moyenne | ✅ | Succès + structure, 401, 400 month invalide, 403 sans équipe |
| `GET /api/calendar/events` | Moyenne | ✅ | Succès + contenu vérifié, 401, 400, 403 sans équipe, isolation par équipe |
| `POST /api/calendar/availability` | Moyenne | ✅ | Succès + DB, 401, 400 date/status invalide |
| `POST /api/calendar/events` | Moyenne | ✅ | Succès + DB, 401, 403 sans équipe, 400 validations (date, type, titre) |
| `PUT /api/calendar/events/:id` | Moyenne | ✅ | Succès + DB, 401, 404, 403 autre équipe |
| `DELETE /api/calendar/events/:id` | Moyenne | ✅ | Succès + DB suppression vérifiée, 401, 404, 403 autre équipe |
| `PUT /api/calendar/events/:id/gameplan` | Moyenne | ✅ | Succès MATCH + DB, 400 si EVENT, 401, 404 |

---

### Phase 3 - Tests complémentaires (À faire au fil de l'eau) ⬜

> Ces tests seront ajoutés progressivement lors du développement de nouvelles features.

| Domaine | Routes | Statut |
|---------|--------|--------|
| Plans de jeu | `POST/PUT/DELETE /api/maps/:id/plans` | ⬜ |
| Permissions | Toutes les routes protégées | ⬜ |
| Balance Rules | `GET/PUT /api/balance-rules` | ⬜ |
| Users | `GET /api/users`, `PUT /api/users/:id/password` | ⬜ |

---

### Phase 4 - CI/CD (Optionnel, plus tard) ⬜

| Tâche | Statut | Notes |
|-------|--------|-------|
| Ajouter les tests d'intégration au pipeline CI | ⬜ | GitHub Actions / Railway |
| DB de test automatique | ⬜ | Container PostgreSQL pour CI |

---

## 📝 Notes techniques

### Structure cible

```
tests/
├── unit/
│   ├── client/       # Tests unitaires frontend
│   ├── server/       # Tests unitaires backend
│   └── shared/       # Tests unitaires shared
├── integration/      # Tests d'intégration API (serveur)
│   ├── setup.ts
│   ├── helpers/
│   │   ├── auth.ts
│   │   └── db.ts
│   ├── auth.test.ts
│   ├── teams.test.ts
│   ├── calendar.test.ts
│   └── maps.test.ts
└── e2e/              # Tests end-to-end (futur)
```

### Variables d'environnement requises

```env
TEST_DATABASE_URL=postgresql://...  # DB de test séparée
JWT_SECRET=test-secret              # Secret pour les tokens de test
```

---

## ✅ Terminé

*(Historique des features complétées)*

- Feature 1 : Intégration de la notion d'équipe (Team Isolation)
- Feature 2 : Système d'invitations
- Feature 3 : Review de code complète (Phase 3.1 à 3.10)
- Refactorisation des boutons (mixins SCSS)
