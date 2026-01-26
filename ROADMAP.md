# EVA - Roadmap

## 📋 À faire

---

## Feature 1 : Intégration de la notion d'équipe (Team Isolation) ✅

**Objectif**: Chaque équipe doit avoir ses propres données isolées. Un utilisateur ne doit voir que les données de son équipe.

---

### Phase 1.1 - Schéma de base de données ✅

**Modèles à modifier :**

| Modèle | Changement requis | Statut |
|--------|-------------------|--------|
| `User` | ✅ A déjà `teamId` | ✅ OK |
| `Team` | ✅ Modèle complet | ✅ OK |
| `BalanceRule` | ✅ A déjà `teamId` | ✅ OK |
| `GamePlan` | ✅ Ajout de `teamId` | ✅ Fait |
| `CalendarEvent` | ✅ Ajout de `teamId` | ✅ Fait |
| `Availability` | Filtrer via `user.teamId` | 🔵 Via routes |
| `Map` | 🔵 Partagée (globale) | ✅ OK |

**Migration créée**: `0005_add_team_isolation`
- Ajoute `teamId` à `GamePlan` et `CalendarEvent`
- Crée les index et foreign keys
- Script de migration des données existantes inclus

---

#### Phase 1.2 - Routes serveur à adapter ✅

**Routes maps/plans (`maps.routes.ts`, `plans.routes.ts`) :**
- [x] `GET /api/maps` - Filtrer les gamePlans par teamId ✅
- [x] `GET /api/maps/:mapId` - Filtrer les gamePlans par teamId ✅
- [x] `GET /api/maps/:mapId/plans` - Filtrer par teamId ✅
- [x] `POST /api/maps/:mapId/plans` - Ajouter teamId à la création ✅
- [x] `PUT /api/plans/:planId` - Vérifier que le plan appartient à l'équipe ✅
- [x] `DELETE /api/plans/:planId` - Vérifier que le plan appartient à l'équipe ✅

**Routes calendrier (`calendar.routes.ts`) :**
- [x] `GET /api/calendar/availability` - Filtrer les users et availabilities par teamId ✅
- [x] `POST /api/calendar/availability` - Via userId de l'utilisateur connecté ✅
- [x] `GET /api/calendar/events` - Filtrer par teamId ✅
- [x] `POST /api/calendar/events` - Ajouter teamId à la création ✅
- [x] `PUT /api/calendar/events/:id` - Vérifier appartenance équipe ✅
- [x] `DELETE /api/calendar/events/:id` - Vérifier appartenance équipe ✅
- [x] `PUT /api/calendar/events/:id/gameplan` - Vérifier appartenance équipe ✅

**Routes utilisateurs (`users.routes.ts`) :**
- [x] `GET /api/users` - Filtrer par teamId (membres de l'équipe uniquement) ✅
- [x] `GET /api/users/players` - Filtrer par teamId ✅

**Routes balance-rules (`balance-rules.routes.ts`) :**
- [x] ✅ Déjà filtré par teamId

---

### Phase 1.3 - Migrations Prisma ✅

- [x] Migration pour ajouter `teamId` à `GamePlan`
- [x] Migration pour ajouter `teamId` à `CalendarEvent`
- [x] Script de migration des données existantes (inclus dans 0005_add_team_isolation)

---

### Phase 1.4 - Logique côté client ✅

**Composants vérifiés :**
- [x] `PlannerPage.vue` - Charge les joueurs via `fetchPlayers()` (filtré par teamId côté serveur) ✅
- [x] `RotationCalculatorModal` - Reçoit les joueurs en props depuis le parent ✅
- [x] `CalendarPage.vue` - Charge les joueurs via `fetchPlayers()` (filtré par teamId côté serveur) ✅
- [x] `EventFormModal.vue` - Reçoit les joueurs en props depuis CalendarPage ✅
- [x] `TeamPage.vue` - Déjà isolé par équipe ✅

**Note**: Toutes les données sont filtrées côté serveur via le `teamId` de l'utilisateur connecté. Les composants client n'ont pas besoin de modifications car ils reçoivent déjà les données filtrées.

---

### Phase 1.5 - Cas edge à gérer ✅

**Protection des utilisateurs sans équipe :**
- [x] Toutes les routes retournent des données vides (pas d'erreur) pour les utilisateurs sans équipe
- [x] GET /api/maps - retourne les maps sans gamePlans
- [x] GET /api/maps/:mapId/plans - retourne []
- [x] GET /api/users - retourne []
- [x] GET /api/users/players - retourne []
- [x] GET /api/calendar/availability - retourne calendrier vide avec flag `noTeam: true`
- [x] GET /api/calendar/events - retourne []

**Autres cas :**
- [x] Afficher message "Rejoignez une équipe" côté client (NoTeamMessage composant)
- [x] Création d'équipe : Le créateur devient leader avec toutes les permissions
- [ ] Changement d'équipe : Que faire des données (plans, events) créées ? (en attente de spécification)
- [x] Suppression d'équipe : Cascade delete sur toutes les données liées + UI pour leader

---

### Phase 1.6 - Tests ✅

- [x] Tests unitaires : filtrage par équipe
- [x] Tests d'intégration : isolation des données entre équipes
- [x] Tests de sécurité : impossible d'accéder aux données d'une autre équipe

**Fichier**: `tests/server/team-isolation.test.ts` (26 tests)

---


## Feature 2 : Système d'inscription et d'invitation

**Objectif**: Permettre aux utilisateurs de créer un compte, puis de rejoindre une équipe via un lien d'invitation généré par un membre autorisé.

---

### Phase 2.1 - Page d'inscription ✅

**Fonctionnalités :**
- [x] Créer `RegisterPage.vue` avec formulaire : email, mot de passe, confirmation mot de passe, pseudo
- [x] Validation côté client (email valide, mot de passe min 8 caractères, confirmation identique)
- [x] Route API `POST /api/auth/register` pour créer le compte
- [x] Validation côté serveur (email unique, règles mot de passe)
- [x] Redirection vers login après inscription réussie
- [x] Lien "Créer un compte" sur la page de login

---

### Phase 2.2 - Schéma base de données (TeamInvite) ✅

**Nouveau modèle Prisma :**
```prisma
model TeamInvite {
  id          String   @id @default(cuid())
  teamId      String
  team        Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  code        String   @unique
  createdById String
  createdBy   User     @relation(fields: [createdById], references: [id])
  expiresAt   DateTime
  maxUses     Int      @default(1)  // Nombre max d'utilisations (pas d'illimité)
  uses        Int      @default(0)  // Utilisations actuelles
  createdAt   DateTime @default(now())
}
```

**Configuration par défaut :**
- Expiration : 24h (configurable à la création)
- Utilisations max : 1 (configurable, mais obligatoire > 0)

**Migration créée**: `0006_add_team_invites` ✅

---

### Phase 2.3 - Routes API invitations ✅

**Nouvelles routes (`invites.routes.ts`) :**
- [x] `POST /api/teams/:teamId/invites` - Créer un lien d'invitation
  - Body: `{ expiresInHours?: number, maxUses?: number }`
  - Défaut: 24h, 1 usage
  - Permission requise: `canInviteMembers`
  - Retourne: `{ code, url, expiresAt, maxUses }`

- [x] `GET /api/teams/:teamId/invites` - Lister les invitations actives
  - Permission requise: `canInviteMembers`
  - Retourne les invitations non expirées et non épuisées

- [x] `DELETE /api/teams/:teamId/invites/:inviteId` - Révoquer une invitation
  - Permission requise: `canInviteMembers`

- [x] `GET /api/invites/:code` - Vérifier validité d'un code (public)
  - Retourne: `{ valid, teamName, expiresAt }` ou `{ valid: false, reason }`

- [x] `POST /api/invites/:code/join` - Rejoindre l'équipe via le code
  - Utilisateur doit être connecté et sans équipe
  - Incrémente `uses`, vérifie `maxUses` et `expiresAt`

**API client (`teams.api.ts`) :**
- [x] `createInvite(teamId, options)` - Créer invitation
- [x] `fetchInvites(teamId)` - Lister invitations
- [x] `revokeInvite(teamId, inviteId)` - Révoquer invitation
- [x] `verifyInviteCode(code)` - Vérifier validité
- [x] `joinTeamWithCode(code)` - Rejoindre équipe

---

### Phase 2.4 - UI Gestion des invitations (TeamPage) ✅

**Nouvelle section dans TeamPage.vue :**
- [x] Bouton "Générer un lien d'invitation" (si permission `canInviteMembers`)
- [x] Modal de configuration :
  - Durée d'expiration (select: 1h, 6h, 12h, 24h, 48h, 7j)
  - Nombre d'utilisations (input number, min 1, max 100)
- [x] Affichage du lien généré avec bouton copier
- [x] Liste des invitations actives avec :
  - Code
  - Date d'expiration
  - Utilisations (X/Y)
  - Bouton révoquer
  - Bouton copier URL

---

### Phase 2.5 - Page de jonction d'équipe ✅

**Nouveau composant/page :**
- [x] Route `/join/:code` accessible sans équipe
- [x] Affiche le nom de l'équipe à rejoindre
- [x] Bouton "Rejoindre l'équipe"
- [x] Gestion des erreurs : lien expiré, épuisé, invalide
- [x] Redirection vers page équipe après succès
- [x] Redirection vers login si non connecté (avec return URL)

---

### Phase 2.6 - Amélioration NoTeamMessage ✅

**Modifications :**
- [x] Ajouter section "Vous avez reçu un lien d'invitation ?"
- [x] Champ pour coller le code/lien (extraction automatique du code depuis URL)
- [x] Bouton vérifier et rejoindre
- [x] Gestion erreurs et redirection après succès

---

### Phase 2.7 - Tests ✅

- [x] Tests unitaires : génération code invitation (format, unicité)
- [x] Tests unitaires : expiration et limites d'usage
- [x] Tests unitaires : parsing URL/code
- [x] Tests unitaires : validation invitations (expirée, épuisée, valide)
- [x] Tests unitaires : permissions (canInviteMembers)
- [x] Tests unitaires : validation inscription (email, mdp, confirmation)

**Fichier**: `tests/client/team-invitations.test.ts` (24 tests)

---

## Feature 3 : Review de code post-features 1 & 2

**Objectif**: Passer en revue tous les composants touchés par les features précédentes pour optimiser, sécuriser et nettoyer le code.

**Critères de review pour chaque fichier :**
- 🔁 Code redondant / duplication
- 🗑️ Reliquats / code mort
- ⚡ Optimisation données / exécution
- 🔒 Sécurité (validation, permissions, injections)
- 🧪 Tests unitaires existants ? pertinents ?

---

### Phase 3.1 - Server : Routes API

| Fichier | Statut | Notes |
|---------|--------|-------|
| `server/src/routes/auth.routes.ts` | ✅ | Validation centralisée dans shared, format errors[], tests dynamiques |
| `server/src/routes/teams.routes.ts` | ✅ | Format errors[], validateTeamName centralisé, createMany optimisé |
| `server/src/routes/invites.routes.ts` | ✅ | Format errors[], getInviteError() centralisé |
| `server/src/routes/maps.routes.ts` | ✅ | Isolation par teamId |
| `server/src/routes/plans.routes.ts` | ⬜ | Isolation par teamId, permissions |
| `server/src/routes/calendar.routes.ts` | ⬜ | Isolation par teamId, permissions |
| `server/src/routes/users.routes.ts` | ⬜ | Filtrage par teamId |
| `server/src/routes/balance-rules.routes.ts` | ⬜ | Isolation par teamId |

---

### Phase 3.2 - Server : Middleware & Services

| Fichier | Statut | Notes |
|---------|--------|-------|
| `server/src/middleware/auth.middleware.ts` | ⬜ | Validation token, permissions |
| `server/src/db/prisma.ts` | ⬜ | Configuration Prisma |

---

### Phase 3.3 - Client : Pages

| Fichier | Statut | Notes |
|---------|--------|-------|
| `client/src/pages/HomePage.vue` | ⬜ | Affichage conditionnel hasTeam |
| `client/src/pages/LoginPage.vue` | ⬜ | Formulaire login |
| `client/src/pages/RegisterPage.vue` | ⬜ | Formulaire inscription |
| `client/src/pages/TeamPage.vue` | ⬜ | Gestion équipe, membres, invitations |
| `client/src/pages/CreateTeamPage.vue` | ⬜ | Création équipe |
| `client/src/pages/JoinTeamPage.vue` | ⬜ | Jonction via invitation |
| `client/src/pages/ProfilePage.vue` | ⬜ | Profil utilisateur |
| `client/src/pages/PlannerPage.vue` | ⬜ | Intégration données équipe |
| `client/src/pages/CalendarPage.vue` | ⬜ | Intégration données équipe |

---

### Phase 3.4 - Client : Composants communs

| Fichier | Statut | Notes |
|---------|--------|-------|
| `client/src/components/common/NoTeamMessage.vue` | ⬜ | Redirection jointure |
| `client/src/components/common/Modal.vue` | ⬜ | Composant générique |
| `client/src/components/common/ConfirmModal.vue` | ⬜ | Confirmation avec input |
| `client/src/components/common/Drawer.vue` | ⬜ | Panel latéral |
| `client/src/components/common/layout/TopBar.vue` | ⬜ | Navigation, menu utilisateur |

---

### Phase 3.5 - Client : API

| Fichier | Statut | Notes |
|---------|--------|-------|
| `client/src/api/auth.api.ts` | ⬜ | Login, register, logout |
| `client/src/api/teams.api.ts` | ⬜ | CRUD équipe, invitations |
| `client/src/api/maps.api.ts` | ⬜ | Utilisation authFetch |
| `client/src/api/calendar.api.ts` | ⬜ | Utilisation authFetch |
| `client/src/api/players.api.ts` | ⬜ | Cache, utilisation authFetch |
| `client/src/api/balance-rules.api.ts` | ⬜ | Utilisation authFetch |
| `client/src/api/utils.ts` | ⬜ | authFetch, gestion 401 |

---

### Phase 3.6 - Client : Composables

| Fichier | Statut | Notes |
|---------|--------|-------|
| `client/src/composables/useAuth.ts` | ⬜ | État auth, refreshUser, storage listener |
| `client/src/composables/useBalanceRules.ts` | ⬜ | Cache rules |
| `client/src/composables/useCalendar.ts` | ⬜ | État calendrier |
| `client/src/composables/useCalendarEvents.ts` | ⬜ | Gestion événements |

---

### Phase 3.7 - Client : Router & Guards

| Fichier | Statut | Notes |
|---------|--------|-------|
| `client/src/router/index.ts` | ⬜ | Guards auth, hasTeam, redirections |

---

### Phase 3.8 - Shared : Types & Constants

| Fichier | Statut | Notes |
|---------|--------|-------|
| `shared/types/permissions.types.ts` | ⬜ | Types permissions |
| `shared/types/team.types.ts` | ⬜ | Types équipe |
| `shared/types/calendar.types.ts` | ⬜ | Types calendrier |
| `shared/constants/index.ts` | ⬜ | Constantes partagées |

---

### Phase 3.9 - Tests existants

| Fichier | Statut | Notes |
|---------|--------|-------|
| `tests/server/team-isolation.test.ts` | ⬜ | 26 tests - pertinence ? |
| `tests/server/permissions.test.ts` | ⬜ | Tests permissions API |
| `tests/client/team-invitations.test.ts` | ⬜ | 24 tests - pertinence ? |
| `tests/client/permissions.test.ts` | ⬜ | Tests permissions client |
| `tests/client/calendar-*.test.ts` | ⬜ | Suite tests calendrier |

---

### Phase 3.10 - Base de données

| Élément | Statut | Notes |
|---------|--------|-------|
| `prisma/schema.prisma` | ⬜ | Modèles, relations, index |
| Migrations | ⬜ | Cohérence, nettoyage éventuel |

---

## 📦 Documentation

- `docs/CODE_RULES.md` - Règles et conventions de code
- `docs/CODING_AGENT.md` - Scripts d'automatisation pour l'agent

