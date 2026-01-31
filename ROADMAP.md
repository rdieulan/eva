# EVA - Roadmap

## 📋 En cours

### Feature : Salles (Venues) et Gérants (Managers)

**Objectif** : Introduire la notion de salle de jeu EVA et de comptes gérants pour administrer ces salles.

**Décisions d'architecture :**
- Tables séparées : User (auth) + Player + Manager + Admin
- User peut avoir plusieurs rôles via playerId, managerId, adminId
- Les comptes peuvent être liés pour switch rapide (style Google)
- Super Admin = Admin avec toutes les permissions à true

---

#### Phase 1 - Schéma DB (backbone)

| Tâche | Statut | Notes |
|-------|--------|-------|
| 1.1 Créer la table `Venue` | ✅ | `id`, `name`, `city`, `address`, `phone`, `createdAt`, `updatedAt` |
| 1.2 Modifier la table `Team` | ✅ | Supprimer `location`, ajouter `venueId`, leader pointe vers Player |
| 1.3 Créer la table `VenueManager` | ✅ | Table de liaison `managerId` + `venueId` |
| 1.4 Créer la table `Player` | ✅ | `id`, `permissions`, `teamId`, relations joueur |
| 1.5 Créer la table `Manager` | ✅ | `id`, `permissions`, relation managedVenues |
| 1.6 Créer la table `Admin` | ✅ | `id`, `permissions` (superAdmin = toutes à true) |
| 1.7 Refactoriser `User` | ✅ | Auth uniquement + `playerId`, `managerId`, `adminId` |
| 1.8 Ajouter champs d'activation | ✅ | `activationToken` + `activationTokenExpiresAt` sur `User` |
| 1.9 Créer la table `LinkedAccountGroup` | ✅ | Pour lier plusieurs comptes |
| 1.10 Créer la migration Prisma | ✅ | Migration `0007_add_venues_and_roles` |
| 1.11 Adapter le backend | ✅ | Services, routes, middleware adaptés à la nouvelle architecture |

#### Phase 2 - API Backend

| Tâche | Statut | Notes |
|-------|--------|-------|
| 2.1 Route publique `GET /api/venues` | ✅ | Liste des salles (visible par tous les users authentifiés) |
| 2.2 Route équipe `PUT /api/teams/:id/venue` | ✅ | Changer l'affiliation d'une équipe à une salle |
| 2.3 Route activation `POST /api/auth/activate` | ✅ | Permettre au manager de définir son password via le lien |
| 2.4 Route liaison `POST /api/auth/link-account` | ✅ | Lier deux comptes (nécessite auth sur les deux) |
| 2.5 Route switch `POST /api/auth/switch-account` | ✅ | Changer de compte actif dans un groupe lié |
| 2.6 Routes admin (futures) | ⬜ | `POST /api/admin/venues`, `POST /api/admin/managers` |

#### Phase 3 - Frontend

| Tâche | Statut | Notes |
|-------|--------|-------|
| 3.1 Remplacer le sélecteur de localisation | ✅ | Sélecteur de salle dans la page Team et CreateTeam |
| 3.2 Afficher la salle affiliée | ✅ | Dans les infos de l'équipe |
| 3.3 Page d'activation manager | ⬜ | `/activate/:token` - Définir le mot de passe |
| 3.4 Switch de compte dans le profil | ⬜ | Dropdown avec comptes liés |
| 3.5 Bouton "Lier un compte" | ⬜ | Dans le profil |

#### Phase 4 - Tests

| Tâche | Statut | Notes |
|-------|--------|-------|
| 4.1 Tests d'intégration Venues | ⬜ | `GET /api/venues`, `PUT /api/teams/:id/venue` |
| 4.2 Tests d'intégration activation | ⬜ | `POST /api/auth/activate` |
| 4.3 Tests d'intégration comptes liés | ⬜ | `POST /api/auth/link-account`, `POST /api/auth/switch-account` |

---

## ✅ Terminé

### Tests d'intégration - Setup & Tests critiques

> **59 tests d'intégration** couvrant : Auth (login, register), Teams (création, join, invites), Maps (isolation équipe), Calendar (availability, events, CRUD complet)
>
> Helpers : `createAuthenticatedUser`, `createUserWithTeam`, `expectNoRecordCreated`
>
> Backend corrigé : 403 pour users sans équipe sur calendar

---

## 📅 À faire plus tard

### Tests d'intégration - Phase 3 : Tests complémentaires ⬜

> Ces tests seront ajoutés progressivement lors du développement de nouvelles features.

| Domaine | Routes | Statut |
|---------|--------|--------|
| Plans de jeu | `POST/PUT/DELETE /api/maps/:id/plans` | ⬜ |
| Permissions | Toutes les routes protégées | ⬜ |
| Balance Rules | `GET/PUT /api/balance-rules` | ⬜ |
| Users | `GET /api/users`, `PUT /api/users/:id/password` | ⬜ |

### Tests d'intégration - Phase 4 : CI/CD ⬜

| Tâche | Statut | Notes |
|-------|--------|-------|
| Ajouter les tests d'intégration au pipeline CI | ⬜ | GitHub Actions / Railway |
| DB de test automatique | ⬜ | Container PostgreSQL pour CI |

---

## 📝 Notes techniques

### Structure des tests

```
tests/
├── unit/
│   ├── client/       # Tests unitaires frontend
│   ├── server/       # Tests unitaires backend
│   └── shared/       # Tests unitaires shared
├── integration/      # Tests d'intégration API (59 tests)
│   ├── setup.ts
│   ├── helpers/
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
