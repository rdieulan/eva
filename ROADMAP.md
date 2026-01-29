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

**Critères de review** : voir [docs/REVIEW_CRITERIA.md](docs/REVIEW_CRITERIA.md)

---

### Phase 3.1 - Server : Routes API

| Fichier | Statut | Notes |
|---------|--------|-------|
| `server/src/routes/auth.routes.ts` | ✅ | Validation centralisée dans shared, format errors[], tests dynamiques |
| `server/src/routes/teams.routes.ts` | ✅ | Refactorisé avec services, format errors[], validateTeamName centralisé |
| `server/src/routes/invites.routes.ts` | ✅ | Refactorisé avec services, format errors[], getInviteError() centralisé |
| `server/src/routes/maps.routes.ts` | ✅ | Refactorisé avec services, isolation par teamId |
| `server/src/routes/plans.routes.ts` | ✅ | Refactorisé avec services, isolation par teamId, permissions |
| `server/src/routes/calendar.routes.ts` | ✅ | Refactorisé avec calendarService, helpers extraits, format errors[], isolation teamId |
| `server/src/routes/users.routes.ts` | ✅ | Nettoyé (suppression route dupliquée, import inutilisé), format errors[], filtrage par teamId |
| `server/src/routes/players.routes.ts` | ✅ | Nouveau fichier extrait de index.ts, format errors[], filtrage par teamId |
| `server/src/routes/balance-rules.routes.ts` | ✅ | Refactorisé avec service, format errors[], utilise req.user.teamId |

---

### Phase 3.2 - Server : Middleware & Services

| Fichier | Statut | Notes |
|---------|--------|-------|
| `server/src/middleware/auth.middleware.ts` | ✅ | Format errors[], warning JWT_SECRET en prod |
| `server/src/db/prisma.ts` | ✅ | Check DATABASE_URL, logs réduits en prod |

---

### Phase 3.3 - Client : Pages

| Fichier | Statut | Notes |
|---------|--------|-------|
| `client/src/pages/HomePage.vue` | ✅ | Nettoyé CSS inutilisé (.badge) |
| `client/src/pages/LoginPage.vue` | ✅ | Simplifié fallback errors, commentaires anglais, utilise ERROR_MESSAGES + ErrorDisplay |
| `client/src/pages/RegisterPage.vue` | ✅ | Simplifié fallback errors, utilise ERROR_MESSAGES + ErrorDisplay |
| `client/src/pages/TeamPage.vue` | ✅ | Refactorisé en sous-composants (TeamInfo, TeamMembers, TeamInvites, TeamPermissionsModal, TeamInviteModal), converti error→errors[], utilise ErrorDisplay |
| `client/src/pages/CreateTeamPage.vue` | ✅ | Utilise validateTeamName depuis @shared/utils, ERROR_MESSAGES + ErrorDisplay |
| `client/src/pages/JoinTeamPage.vue` | ✅ | Utilise ERROR_MESSAGES (inviteCodeMissing, inviteValidationFailed, joinTeamFailed, inviteInvalid) + ErrorDisplay |
| `client/src/pages/ProfilePage.vue` | ✅ | Utilise validatePassword/validatePasswordsMatch depuis @shared/utils, ERROR_MESSAGES + ErrorDisplay, corrigé classe CSS .admin→.leader |
| `client/src/pages/PlannerPage.vue` | ✅ | Factorisé performSave(), ajouté ErrorModal pour affichage erreurs, utilise ERROR_MESSAGES |
| `client/src/pages/CalendarPage.vue` | ✅ | Utilise composables useCalendar/useCalendarEvents, ErrorModal, isolation équipe via API |

---

### Phase 3.4 - Client : Composants communs

| Fichier | Statut | Notes |
|---------|--------|-------|
| `client/src/components/common/error/ErrorDisplay.vue` | ✅ | Affichage liste d'erreurs (props: errors[], fallback?) |
| `client/src/components/common/error/ErrorModal.vue` | ✅ | **NOUVEAU** - Modal réutilisable pour affichage erreurs |
| `client/src/components/common/NoTeamMessage.vue` | ✅ | Utilise ERROR_MESSAGES.inviteCodeInvalid, redirection vers /join |
| `client/src/components/common/Modal.vue` | ✅ | Composant générique, gestion scroll/keyboard, aucune modif requise |
| `client/src/components/common/ConfirmModal.vue` | ✅ | Confirmation avec input, utilise color.adjust(), aucune modif requise |
| `client/src/components/common/Drawer.vue` | ✅ | Panel latéral, transitions responsive, aucune modif requise |
| `client/src/components/common/layout/DynamicTopBar.vue` | ✅ | Supprimé .btn-profile (code mort CSS) |

---

### Phase 3.5 - Client : API

| Fichier | Statut | Notes |
|---------|--------|-------|
| `client/src/api/auth.api.ts` | ✅ | Utilise authFetch, ERROR_MESSAGES, format errors[] |
| `client/src/api/teams.api.ts` | ✅ | Uniformisé ApiError.fromResponse, shadowing corrigé (errorData), format errors[] |
| `client/src/api/maps.api.ts` | ✅ | ApiError.fromResponse, ERROR_MESSAGES centralisés, pas de tests nécessaires (plomberie API) |
| `client/src/api/calendar.api.ts` | ✅ | authFetch amélioré, ERROR_MESSAGES centralisés |
| `client/src/api/players.api.ts` | ✅ | authFetch amélioré, cache géré, ERROR_MESSAGES centralisés |
| `client/src/api/balance-rules.api.ts` | ✅ | authFetch amélioré, ERROR_MESSAGES centralisés |
| `client/src/api/utils.ts` | ✅ | authFetch amélioré avec surcharge (errorMessage), gestion 401, ERROR_MESSAGES.sessionExpired |

---

### Phase 3.6 - Client : Composables

| Fichier | Statut | Notes |
|---------|--------|-------|
| `client/src/composables/useAuth.ts` | ✅ | Type User centralisé dans @shared/types/user.types.ts, imports nettoyés |
| `client/src/composables/useBalanceRules.ts` | ✅ | Plomberie API, tests de logique métier dans balance-rules.test.ts |
| `client/src/composables/useCalendar.ts` | ✅ | MONTH_NAMES centralisé, tests week navigation + setAvailability ajoutés |
| `client/src/composables/useCalendarEvents.ts` | ✅ | Paramètre days inutile supprimé, 15 tests créés |

---

### Phase 3.7 - Client : Router & Guards

| Fichier | Statut | Notes |
|---------|--------|-------|
| `client/src/router/index.ts` | ✅ | Constante ALLOWED_WITHOUT_TEAM extraite, /join/:code en requiresAuth: true |

---

### Phase 3.8 - Shared : Types & Constants

| Fichier | Statut | Notes |
|---------|--------|-------|
| `shared/types/permissions.types.ts` | ✅ | Bien structuré, interfaces par domaine, constantes DEFAULT_PLAYER/LEADER |
| `shared/types/team.types.ts` | ✅ | Types équipe, TEAM_LOCATIONS as const, TeamLocation dérivé |
| `shared/types/calendar.types.ts` | ✅ | Types complets, bien documentés |
| `shared/constants/error.constants.ts` | ✅ | Messages centralisés, as const, ErrorMessageKey type |
| `shared/constants/index.ts` | ✅ | Barrel export |

---

### Phase 3.9 - Tests existants ✅

**212 tests passent sur 17 fichiers.**

**Tests client :**
| Fichier | Statut | Tests |
|---------|--------|-------|
| `tests/client/balance-rules.test.ts` | ✅ | 17 tests |
| `tests/client/balance.test.ts` | ✅ | 9 tests |
| `tests/client/calendar-grid.test.ts` | ✅ | 8 tests |
| `tests/client/calendar-integration.test.ts` | ✅ | 10 tests |
| `tests/client/day-cell.test.ts` | ✅ | 8 tests |
| `tests/client/event-form-modal.test.ts` | ✅ | 8 tests |
| `tests/client/game-plan-viewer.test.ts` | ✅ | 7 tests |
| `tests/client/map-viewer.test.ts` | ✅ | 33 tests |
| `tests/client/permissions.test.ts` | ✅ | 16 tests |
| `tests/client/use-calendar-events.test.ts` | ✅ | 15 tests |
| `tests/client/use-calendar.test.ts` | ✅ | 21 tests |
| `tests/client/use-rotation-calculator.test.ts` | ✅ | 15 tests |

**Tests server :**
| Fichier | Statut | Tests |
|---------|--------|-------|
| `tests/server/calendar-helper.test.ts` | ✅ | 2 tests |
| `tests/server/date-helper.test.ts` | ✅ | 9 tests |
| `tests/server/validation-helper.test.ts` | ✅ | 13 tests |

**Tests shared :**
| Fichier | Statut | Tests |
|---------|--------|-------|
| `tests/shared/validation.test.ts` | ✅ | 17 tests |

**Tests quality :**
| Fichier | Statut | Tests |
|---------|--------|-------|
| `tests/quality/encoding.test.ts` | ✅ | 4 tests |

---

### Phase 3.10 - Base de données ✅

| Élément | Statut | Notes |
|---------|--------|-------|
| `prisma/schema.prisma` | ✅ | Modèles bien structurés, relations correctes, index optimisés |
| Migrations | ✅ | 0001_init à 0007_notes_refactor cohérentes |

---

## 📦 Documentation

- `docs/CODE_AGENT.md` - Guide de fonctionnement de l'agent de code
- `docs/CODE_RULES.md` - Règles et conventions de code
- `docs/REVIEW_CRITERIA.md` - Critères de review des fichiers
- `docs/SCRIPTS.md` - Scripts d'automatisation

