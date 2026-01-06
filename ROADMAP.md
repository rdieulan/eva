# EVA - Roadmap

## 🎯 Objectif actuel : Migration vers la nouvelle structure DB

---

## 📋 Plan de migration (étapes claires)

### Étape 1 : Structure DB ✅
- [x] Schéma Prisma mis à jour
  - `Map` : contient le template (assignments sans players)
  - `GamePlan` : contient les assignments modifiés
  - `GamePlanPlayer` : table de liaison userId ↔ assignmentIds
- [x] Prisma client régénéré

### Étape 2 : Logique adaptée au nouveau format ✅
- [x] Types TypeScript mis à jour (`PlayerAssignment { userId, assignmentIds[] }`)
- [x] `config.ts` nettoyé (plus de fallback avec données en dur)
- [x] Chargement des joueurs via API (`/api/players`)
- [x] Chargement des maps via API (`/api/maps`)
- [x] Helpers créés (`getPlayerAssignments`, `getAssignmentPlayers`)
- [x] Composants Vue adaptés
- [x] Server endpoints mis à jour

### Étape 3 : Script de migration des données 🚧
- [x] Script créé (`scripts/migrate-json-to-db.ts`)
- [ ] Définir le mapping `player1` → `userId` réel
- [ ] Tester le script en local
- [ ] Migrer les données JSON vers la DB

### Étape 4 : Exécution de la migration ⏳
- [ ] Appliquer le schéma sur la DB locale (`npx prisma db push`)
- [ ] Exécuter le seed (`npm run db:seed`)
- [ ] Exécuter le script de migration
- [ ] Tester l'application en local

### Étape 5 : Déploiement ⏳
- [ ] Appliquer le schéma sur Railway
- [ ] Migrer les données en prod
- [ ] Vérifier que tout fonctionne

---

## 📦 Fichiers clés

| Fichier | Rôle |
|---------|------|
| `prisma/schema.prisma` | Schéma de la DB |
| `prisma/seed.ts` | Initialisation des users et maps (templates) |
| `scripts/migrate-json-to-db.ts` | Migration des JSON vers GamePlan + GamePlanPlayer |
| `src/data/config.ts` | Chargement des données depuis l'API + helpers |
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
