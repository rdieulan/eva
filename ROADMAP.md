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

#### Phase 2 - Routes serveur à adapter

**Routes maps/plans (`maps.routes.ts`, `plans.routes.ts`) :**
- [ ] `GET /api/maps` - Filtrer les gamePlans par teamId
- [ ] `GET /api/maps/:mapId` - Filtrer les gamePlans par teamId
- [ ] `GET /api/maps/:mapId/plans` - Filtrer par teamId
- [ ] `POST /api/maps/:mapId/plans` - Ajouter teamId à la création
- [ ] `PUT /api/plans/:planId` - Vérifier que le plan appartient à l'équipe
- [ ] `DELETE /api/plans/:planId` - Vérifier que le plan appartient à l'équipe

**Routes calendrier (`calendar.routes.ts`) :**
- [ ] `GET /api/calendar/availability` - Filtrer les users et availabilities par teamId
- [ ] `PUT /api/calendar/availability` - Vérifier appartenance équipe
- [ ] `GET /api/calendar/events` - Filtrer par teamId
- [ ] `POST /api/calendar/events` - Ajouter teamId à la création
- [ ] `PUT /api/calendar/events/:eventId` - Vérifier appartenance équipe
- [ ] `DELETE /api/calendar/events/:eventId` - Vérifier appartenance équipe

**Routes utilisateurs (`users.routes.ts`) :**
- [ ] `GET /api/users` - Filtrer par teamId (membres de l'équipe uniquement)
- [ ] `GET /api/users/players` - Filtrer par teamId

**Routes balance-rules (`balance-rules.routes.ts`) :**
- [x] ✅ Déjà filtré par teamId

---

#### Phase 3 - Migrations Prisma ✅

- [x] Migration pour ajouter `teamId` à `GamePlan`
- [x] Migration pour ajouter `teamId` à `CalendarEvent`
- [x] Script de migration des données existantes (inclus dans 0005_add_team_isolation)

---

#### Phase 4 - Logique côté client

**Composants à vérifier :**
- [ ] `PlannerPage.vue` - S'assurer que seuls les joueurs de l'équipe sont proposés
- [ ] `RotationCalculator` - Charger uniquement les joueurs de l'équipe
- [ ] `CalendarPage.vue` - Afficher uniquement les disponibilités de l'équipe
- [ ] `EventFormModal.vue` - Créer les events avec teamId
- [ ] `TeamPage.vue` - Déjà isolé par équipe ✅

---

#### Phase 5 - Cas edge à gérer

- [ ] Utilisateur sans équipe : afficher message "Rejoignez une équipe"
- [ ] Création d'équipe : Le créateur devient leader avec toutes les permissions
- [ ] Changement d'équipe : Que faire des données (plans, events) créées ?
- [ ] Suppression d'équipe : Cascade delete sur toutes les données liées

---

#### Phase 6 - Tests

- [ ] Tests unitaires : filtrage par équipe
- [ ] Tests d'intégration : isolation des données entre équipes
- [ ] Tests de sécurité : impossible d'accéder aux données d'une autre équipe

---

## 📦 Documentation

- `docs/CODE_RULES.md` - Règles et conventions de code
- `docs/CODING_AGENT.md` - Scripts d'automatisation pour l'agent

