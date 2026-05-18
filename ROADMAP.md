# EVA - Roadmap

## 📋 En cours

_(rien — prêt pour un merge `dev` → `main`)_

---

## ✅ Terminé

### Feature : Interface Admin

**Périmètre livré** :
- Route `/admin/*` accessible uniquement aux comptes avec `adminId` (guard `requiresAdmin` côté router)
- Landing automatique : admin → `/admin/venues`, player → `/`, manager → `/profile` (placeholder)
- Layout admin séparé avec sous-nav Salles / Managers / Administrateurs* / Joueurs / Équipes (*si `canManageAdmins`)
- Permissions admin granulaires (`AdminPermissions`) appliquées sur le backend (`requireAdminPermission`)
- Suppression définitive (pas de soft delete)
- Suppression venue → équipes affiliées : `venueId = null` (en transaction Prisma)
- Garde-fous : un admin ne peut pas se supprimer lui-même, le dernier super admin ne peut être ni supprimé ni dégradé

#### Phase 0 - Script création super admin ✅

| Tâche | Statut | Notes |
|-------|--------|-------|
| 0.1 Script `npm run create-admin` | ✅ | `scripts/create-admin.ts` : prompts interactifs avec password masqué + validation email/pseudo/password |

#### Phase 1 - Backend API Admin ✅

| Tâche | Statut | Notes |
|-------|--------|-------|
| 1.1 Middleware `requireAdmin` | ✅ | `+ requireAdminPermission(perm)` factory dans `auth.middleware.ts` |
| 1.2 `GET /api/admin/venues` | ✅ | Lecture seule (admin) |
| 1.3 `POST /api/admin/venues` | ✅ | Permission `canManageVenues` |
| 1.4 `PUT /api/admin/venues/:id` | ✅ | Mise à jour partielle (champ par champ) |
| 1.5 `DELETE /api/admin/venues/:id` | ✅ | Cascade `Team.venueId = null` en transaction |
| 1.6 `GET /api/admin/managers` | ✅ | Avec activation status + venues |
| 1.7 `POST /api/admin/managers` | ✅ | Génère token d'activation UUID (TTL 7j), réponse inclut le token |
| 1.8 `PUT /api/admin/managers/:id` | ✅ | Replace la liste des venues affiliées |
| 1.9 `DELETE /api/admin/managers/:id` | ✅ | Supprime aussi le User lié en transaction |

#### Phase 2 - Frontend Admin ✅

| Tâche | Statut | Notes |
|-------|--------|-------|
| 2.1 Layout admin séparé | ✅ | `AdminLayout.vue` + route imbriquée `/admin` avec guard |
| 2.2 Page liste des salles | ✅ | `AdminVenuesPage.vue` (table + actions) |
| 2.3 Formulaire création/édition salle | ✅ | Modale unique, mode dépendant de `editingVenueId` |
| 2.4 Page liste des managers | ✅ | `AdminManagersPage.vue` (table + badge "En attente d'activation") |
| 2.5 Formulaire création manager | ✅ | Modale création + modale post-création affichant l'URL d'activation copiable |
| 2.6 Formulaire édition manager | ✅ | Modale dédiée pour éditer les salles associées |

#### Phase 3 - Tests ✅

| Tâche | Statut | Notes |
|-------|--------|-------|
| 3.1 Tests d'intégration routes admin | ✅ | 47 tests dans `tests/integration/admin.test.ts` (venues, managers, admins, players, teams, garde-fous) |
| 3.2 Tests permissions admin | ✅ | Couverts dans `admin.test.ts` (rejet anonyme / player / manager / admin sans permission granulaire) |

#### Phase 4 - Admins, Joueurs et Équipes ✅

| Tâche | Statut | Notes |
|-------|--------|-------|
| 4.1 CRUD administrateurs (`/api/admin/admins`) | ✅ | Avec activation par lien (réutilise `POST /api/auth/activate`) et garde-fous self / dernier super admin |
| 4.2 Lecture seule joueurs (`/api/admin/players`) | ✅ | Liste paginable côté UI (recherche) avec équipe, leader status, date de création |
| 4.3 Lecture seule équipes (`/api/admin/teams`, `/teams/:id`) | ✅ | Liste + détail modale avec membres |
| 4.4 UI Vue : `AdminAdminsPage`, `AdminPlayersPage`, `AdminTeamsPage` | ✅ | Avec recherche client sur joueurs et équipes |
| 4.5 Permissions admin exposées sur `Account.adminPermissions` | ✅ | Permet de masquer l'onglet "Administrateurs" pour les admins non-super |

**Total post-feature : 129/129 tests d'intégration verts + 212/212 tests unitaires verts.**

### Feature : Salles (Venues) et Gérants (Managers) — Backbone

> Architecture multi-rôles : User (auth) + Player + Manager + Admin
> - Tables : Venue, VenueManager, Player, Manager, Admin, LinkedAccountGroup (migration 0007)
> - JWT enrichi : `playerId` / `managerId` / `adminId`
> - Activation manager : `POST /api/auth/activate` + token + expiry
> - Liaison de comptes : `POST /api/auth/link-account`, `GET /api/auth/linked-accounts`, `POST /api/auth/switch-account`
> - Frontend : sélecteur de salle dans `TeamPage`, page `ActivatePage`, switch de compte dans `ProfilePage`

### Refactor nomenclature `user` → `account` / `player`

> `useAuth` (`refreshUser` → `refreshAccount`), `auth.api` (`getCurrentUser` → `getCurrentAccount`),
> `LoginResponse.user` → `account`, `DayData.currentUserStatus` → `currentPlayerStatus`,
> localStorage clé `user` → `account`, tests d'intégration alignés.

### Logger centralisé

> Logger personnalisé (`server/src/utils/logger.ts`) avec :
> - Mode `silent` automatique en environnement test
> - Loggers : `logger`, `dbLogger`, `authLogger`, `apiLogger`

---

## 📅 À faire plus tard

### Tests d'intégration - CI/CD ⬜

| Tâche | Statut | Notes |
|-------|--------|-------|
| Pipeline CI avec tests d'intégration | ⬜ | GitHub Actions / Railway |
| DB de test automatique | ⬜ | Container PostgreSQL pour CI |

### TopBar côté admin ⬜

| Tâche | Statut | Notes |
|-------|--------|-------|
| Hide / adapter TopBar dans `/admin/*` | ⬜ | Aujourd'hui la TopBar globale s'affiche aussi en zone admin avec les items "joueur" (Planificateur, Calendrier, Mon équipe). À masquer ou remplacer par une nav admin pure. Cosmétique, pas bloquant. |

---

## 📝 Notes techniques

### Structure des tests

```
tests/
├── unit/                  # 212 tests
│   ├── client/
│   ├── server/
│   └── shared/
├── integration/           # 109 tests
│   ├── auth.test.ts
│   ├── teams.test.ts
│   ├── calendar.test.ts
│   ├── maps.test.ts
│   ├── venues.test.ts
│   ├── activation.test.ts
│   ├── linked-accounts.test.ts
│   └── admin.test.ts      # nouveau
└── e2e/                   # futur
```
