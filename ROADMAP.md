# EVA - Roadmap

## 📋 En cours

_(rien — prêt pour un merge `dev` → `main`)_

---

## ✅ Terminé

### Feature : Liens d'une salle (Discord, réseaux)

**Périmètre livré** :
- La salle porte son site et ses réseaux (Discord, Facebook, Instagram, X, TikTok, YouTube, Twitch), remplis par `db:sync-venues` depuis eva.gg (`socialNetworks` + `externalUrl`) et modifiables dans l'écran d'administration des salles.
- Seule une URL http(s) absolue est stockée, côté sync comme côté saisie : écarte un pseudo, un champ vide, un `javascript:` de n'importe quelle source. Validation partagée `normalizeLinkUrl`.
- Le Discord de la salle s'affiche sur la page équipe (salle affiliée) et sur la fiche d'un match.

### Feature : Réservation d'un match sur eva.gg

**Périmètre livré** :
- Fiche d'un match à venir : joueurs inscrits sur ses créneaux, lus chez eva.gg et comparés à un match plein de 8 (la capacité affichée par eva.gg, souvent 10, est ignorée). Moins de 8 : « il en manque N » ; plus de 8 : « N de trop », à régulariser avec la salle. Détail par créneau quand ils diffèrent. Bouton « Réserver ma place sur eva.gg » qui ouvre le calendrier de la salle au bon jour.
- eva.gg donne le nombre d'inscrits, jamais les noms : l'affichage montre un écart éventuel, il ne prétend pas savoir qui manque. Pas de case « j'ai réservé » déclarative, qui créerait une fausse certitude pour le leader.
- `EventVenue.evaLocationId` pour construire le lien, `buildEvaBookingUrl` partagé.

### Feature : Créneau d'un match choisi dans la grille de la salle

**Périmètre livré** :
- eva.gg ne publie pas de grille hebdomadaire : les créneaux d'une salle se lisent par date (`listLocationGameSessionsByDate`, public, confirmé par un appel sur Nîmes). Route `GET /api/venues/:id/slots?date=…`, cache de 5 minutes par salle et jour, salles créées à la main exclues.
- Formulaire d'événement : Type, Titre, Salle, Date, puis pour un match sur une salle reliée la liste des créneaux du jour à la place de Début/Fin. Un match couvre une suite de créneaux consécutifs sur une arène (un scrim en prend deux) ; l'horaire et l'arène viennent des créneaux choisis, avec le rappel de l'heure de convocation et le nombre de joueurs déjà inscrits sur la capacité. Début/Fin ne reviennent que sans grille (pas de salle, salle non reliée, créneaux illisibles, autre type d'événement).
- `CalendarEvent.evaSlotIds` (migrations 0017 et 0018) : la liste des créneaux consécutifs du match, gardée tant que salle, jour et heure ne bougent pas. C'est la clé qui permettra de croiser avec les réservations des joueurs.
- Tests d'intégration avec eva.gg mocké sur la réponse réelle, unitaires sur la normalisation, le composable et le sélecteur.

### Feature : Compte eva.gg lié au profil

**Périmètre livré** :
- Le joueur saisit son tag eva.gg (`Pseudo#123456`) dans son profil ; le serveur le résout via l'opération publique `getPublicPlayerByUsername` et stocke l'identifiant stable d'eva.gg (`Player.evaUserId`, unique) avec le tag du moment.
- Routes `GET` / `PUT` / `DELETE /api/players/me/eva-account` ; refus distincts : tag inconnu (404), profil eva.gg privé (422), compte déjà lié à un autre joueur (409), eva.gg injoignable (502).
- Client eva.gg partagé déplacé dans `server/src/integrations/eva/` (salles + joueurs), erreurs typées avec les codes d'eva.gg.
- Tests d'intégration avec eva.gg mocké (aucun appel réseau), tests unitaires du client GraphQL et du composable.
- Connaissance de l'API consignée dans [docs/EVA_API.md](docs/EVA_API.md).

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

### Intégration eva.gg — suite ⬜

| Tâche | Statut | Notes |
|-------|--------|-------|
| Savoir **qui** est inscrit à un créneau | ⬜ **bloqué** | Aucune voie publique : la liste des participants est derrière un reCAPTCHA et ne renvoie aucun identifiant (voir [docs/EVA_API.md](docs/EVA_API.md)). Demande un accès accordé par eva.gg : droits d'un gérant de salle, ou accord partenaire. Démarche en cours côté gérant de Nîmes. |
| Dispos de créneaux pour organiser des scrims | ⬜ | Même lecture que le sélecteur de créneau (places restantes par créneau), à exposer côté équipe. |

### Dette et détails relevés en route ⬜

| Tâche | Statut | Notes |
|-------|--------|-------|
| Découper `EventFormModal.vue` | ⬜ | Plus de 850 lignes : extraire la vue lecture seule et les champs de lieu (salle, arène, créneau) en sous-composants. |
| `POST /api/teams` ignore `venueId` | ⬜ | La salle passée à la création n'est pas enregistrée ; elle ne se pose qu'ensuite depuis la page équipe. Soit l'accepter, soit la retirer du contrat. |

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
