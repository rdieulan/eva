# EVA - Roadmap

## 🎯 Objectif actuel : Stabilisation et améliorations

---

## ✅ Chantiers terminés

### Réorganisation du projet ✅ (Janvier 2026)
- [x] Séparation frontend/backend claire
  - `client/src/` - Modules frontend (api, config, services, utils)
  - `server/src/` - Modules backend (routes, middleware, services, db)
  - `shared/types/` - Types partagés (purs, sans fonctions)
- [x] Découpage des routes Express par domaine
- [x] Re-export pour compatibilité ascendante
- [x] Documentation de la structure (`docs/STRUCTURE.md`)

### Tests automatisés ✅
- [x] Configuration Vitest
- [x] 115 tests passants
- [x] Tests unitaires des types, config, balance, auth, API, composants Vue

### Migration DB ✅
- [x] Schéma Prisma mis à jour (Map, GamePlan, GamePlanPlayer)
- [x] Script de migration JSON → DB
- [x] Déploiement Railway fonctionnel

### Authentification & Autorisation ✅
- [x] Login/Logout avec JWT
- [x] Rôles ADMIN/PLAYER
- [x] Mode édition réservé aux admins

### Planificateur de maps ✅
- [x] Visualisation des maps avec zones
- [x] Mode édition (déplacement zones/pastilles)
- [x] Calculateur de rotation
- [x] Export PNG/texte des plans de jeu

### Refactoring FR → EN ✅
- [x] Nomenclature anglaise (Assignment, Player, etc.)
- [x] Messages UI restent en français

---

## 📋 Prochaines étapes

### Améliorations à venir
- [ ] Finaliser la migration du serveur (`server.ts` → `server/index.ts`)
- [ ] Supprimer les fichiers legacy (`src/server/`)
- [ ] Page Calendrier
- [ ] Multi-language support

---

## 📦 Structure du projet

Voir `docs/STRUCTURE.md` pour la documentation complète.

| Dossier | Rôle |
|---------|------|
| `client/src/api/` | Appels API (auth, maps, players) |
| `client/src/services/` | Logique métier (balance) |
| `client/src/config/` | Configuration UI (couleurs) |
| `server/src/routes/` | Routes Express par domaine |
| `server/src/middleware/` | Middlewares (auth) |
| `shared/types/` | Types TypeScript partagés |
| `src/types/index.ts` | Types TypeScript |
| `server.ts` | API endpoints |

---

## 📊 Structure de la base de données

```prisma
model Map {
  id        String     @id           // ex: "artefact"
  name      String
  images    Json       @default("[]")
  template  Json                     // { assignments: [...] } - PAS de players
  gamePlans GamePlan[]
}

model GamePlan {
  id          String   @id @default(cuid())
  name        String
  mapId       String
  assignments Json                   // positions des zones/markers
  players     GamePlanPlayer[]       // liaison vers les joueurs
}

model GamePlanPlayer {
  id            String   @id @default(cuid())
  gamePlanId    String
  userId        String
  assignmentIds Int[]                // ex: [1, 3]
  
  @@unique([gamePlanId, userId])
}
```

---

## ✅ Chantiers terminés

### Tests automatisés ✅
- [x] Configuration Vitest
- [x] Tests unitaires des types (zones, polygones)
- [x] Tests de la logique de balance d'équipe
- [x] Tests du calculateur de rotation
- [x] Tests d'authentification
- [x] Tests des API (mocks)
- [x] Tests des composants Vue
- [x] Tests de la logique serveur
- **115 tests passants**

### Authentification & Autorisation
- [x] Login/Logout avec JWT
- [x] Rôles ADMIN/PLAYER
- [x] Mode édition réservé aux admins

### Planificateur de maps
- [x] Visualisation des maps avec zones
- [x] Mode édition (déplacement zones/pastilles)
- [x] Calculateur de rotation
- [x] Export PNG/texte des plans de jeu

### Refactoring FR → EN
- [x] Types et Interfaces traduits
- [x] Variables et Fonctions traduits
  id        String     @id           // ex: "artefact"
  name      String                   // ex: "Artefact"
  images    Json       @default("[]")
  template  Json                     // { assignments: [...] } - sans players
  gamePlans GamePlan[]
}

model GamePlan {
  id          String   @id @default(cuid())
  name        String                   // ex: "Défense standard"
  mapId       String
  assignments Json                     // Array of Assignment objects
  players     GamePlanPlayer[]
}

model GamePlanPlayer {
  id            String   @id @default(cuid())
  gamePlanId    String
  userId        String
  assignmentIds Int[]    // ex: [1, 3]
}
```

### Séparation des responsabilités

| Table | Contenu |
|-------|---------|
| `Map` | Template par défaut (id, nom, images, structure des zones) |
| `GamePlan` | Configuration spécifique (positions des zones modifiées) |
| `GamePlanPlayer` | Associations userId → assignmentIds |

---

## 📊 Progression globale

| Chantier | Status |
|----------|--------|
| Migration PostgreSQL | ✅ Complété |
| Authentification | ✅ Complété |
| GamePlanPlayer | 🚧 En cours |
| Planificateur | ✅ Complété |
| Refactoring FR→EN | ✅ Complété |
| Schéma DB renforcé | ✅ Complété |
| Déploiement Railway | 🔜 À venir |
| UI Multi-plans | 🔜 À venir |
| Calendrier | 🔜 À venir |

---

## 🔄 Dernière mise à jour

**Date** : 2026-01-05
**Status** : Schéma DB renforcé - Prêt pour déploiement
