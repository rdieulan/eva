# EVA - Roadmap

## 📋 À faire

### 🔥 Intégration de la notion d'équipe (Team Isolation)

**Objectif**: Chaque équipe doit avoir ses propres données isolées. Un utilisateur ne doit voir que les données de son équipe.

---

#### Phase 1 - Schéma de base de données ✅

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

#### Phase 2 - Routes serveur à adapter ✅

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

#### Phase 3 - Migrations Prisma ✅

- [x] Migration pour ajouter `teamId` à `GamePlan`
- [x] Migration pour ajouter `teamId` à `CalendarEvent`
- [x] Script de migration des données existantes (inclus dans 0005_add_team_isolation)

---

#### Phase 4 - Logique côté client ✅

**Composants vérifiés :**
- [x] `PlannerPage.vue` - Charge les joueurs via `fetchPlayers()` (filtré par teamId côté serveur) ✅
- [x] `RotationCalculatorModal` - Reçoit les joueurs en props depuis le parent ✅
- [x] `CalendarPage.vue` - Charge les joueurs via `fetchPlayers()` (filtré par teamId côté serveur) ✅
- [x] `EventFormModal.vue` - Reçoit les joueurs en props depuis CalendarPage ✅
- [x] `TeamPage.vue` - Déjà isolé par équipe ✅

**Note**: Toutes les données sont filtrées côté serveur via le `teamId` de l'utilisateur connecté. Les composants client n'ont pas besoin de modifications car ils reçoivent déjà les données filtrées.

---

#### Phase 5 - Cas edge à gérer ✅

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

#### Phase 6 - Tests ✅

- [x] Tests unitaires : filtrage par équipe
- [x] Tests d'intégration : isolation des données entre équipes
- [x] Tests de sécurité : impossible d'accéder aux données d'une autre équipe

**Fichier**: `tests/server/team-isolation.test.ts` (26 tests)

---

## 📦 Documentation

- `docs/CODE_RULES.md` - Règles et conventions de code
- `docs/CODING_AGENT.md` - Scripts d'automatisation pour l'agent

