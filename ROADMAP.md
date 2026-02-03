# EVA - Roadmap

## 📋 En cours

### Feature : Interface Admin

**Objectif** : Interface dédiée pour gérer les salles (venues) et les comptes gérants (managers).

**Décisions :**
- Route `/admin/*` accessible uniquement aux comptes avec `adminId`
- Layout séparé du reste de l'app
- Permissions admin granulaires (ajoutées au besoin)
- Suppression = suppression définitive (pas de soft delete)
- Suppression venue → équipes affiliées perdent leur affiliation (venueId = null)

---

#### Phase 0 - Script création super admin

| Tâche | Statut | Notes |
|-------|--------|-------|
| 0.1 Script `npm run create-admin` | ⬜ | Demande email + nom + password, crée Admin avec toutes permissions à true |

#### Phase 1 - Backend API Admin

| Tâche | Statut | Notes |
|-------|--------|-------|
| 1.1 Middleware `requireAdmin` | ⬜ | Vérifie que le compte a un `adminId` |
| 1.2 `GET /api/admin/venues` | ⬜ | Liste toutes les salles |
| 1.3 `POST /api/admin/venues` | ⬜ | Créer une salle |
| 1.4 `PUT /api/admin/venues/:id` | ⬜ | Modifier une salle |
| 1.5 `DELETE /api/admin/venues/:id` | ⬜ | Supprimer une salle (équipes → venueId = null) |
| 1.6 `GET /api/admin/managers` | ⬜ | Liste tous les managers avec leurs salles |
| 1.7 `POST /api/admin/managers` | ⬜ | Créer un manager (email, nom, salles) → génère lien d'activation |
| 1.8 `PUT /api/admin/managers/:id` | ⬜ | Modifier associations manager ↔ salles |
| 1.9 `DELETE /api/admin/managers/:id` | ⬜ | Supprimer un manager |

#### Phase 2 - Frontend Admin

| Tâche | Statut | Notes |
|-------|--------|-------|
| 2.1 Layout admin séparé | ⬜ | `/admin` avec navigation propre |
| 2.2 Page liste des salles | ⬜ | Tableau avec actions (modifier, supprimer) |
| 2.3 Formulaire création/édition salle | ⬜ | Modale ou page dédiée |
| 2.4 Page liste des managers | ⬜ | Tableau avec salles associées, actions |
| 2.5 Formulaire création manager | ⬜ | Email, nom, sélection salles → affiche lien d'activation à copier |
| 2.6 Formulaire édition manager | ⬜ | Modifier les salles associées |

#### Phase 3 - Tests

| Tâche | Statut | Notes |
|-------|--------|-------|
| 3.1 Tests d'intégration routes admin | ⬜ | CRUD venues, CRUD managers |
| 3.2 Tests permissions admin | ⬜ | Rejet si non-admin |

---

## ✅ Terminé

### Feature : Salles (Venues) et Gérants (Managers)

> Architecture multi-rôles : User (auth) + Player + Manager + Admin
> - Tables : Venue, VenueManager, Player, Manager, Admin, LinkedAccountGroup
> - API : Activation compte, liaison comptes, switch compte
> - Frontend : Sélecteur salle, page activation, switch compte dans profil
> - 82 tests d'intégration

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

---

## 📝 Notes techniques

### Structure des tests

```
tests/
├── unit/
│   ├── client/
│   ├── server/
│   └── shared/
├── integration/      # 82 tests
│   ├── auth.test.ts
│   ├── teams.test.ts
│   ├── calendar.test.ts
│   ├── maps.test.ts
│   ├── venues.test.ts
│   ├── activation.test.ts
│   └── linked-accounts.test.ts
└── e2e/              # futur
```

