# EVA

Outil web de gestion d'équipe FPS 4v4 : planification de postes par map, calendrier de disponibilités, organisation d'équipe, et administration des salles affiliées.

## Fonctionnalités

- **Planificateur** : assignation des joueurs aux 4 postes de chaque map, avec règles d'équilibrage configurables et export PNG.
- **Calendrier** : disponibilités joueurs, événements (match / entraînement), rattachement d'un plan de jeu à un match.
- **Équipes** : création d'équipe, invitations par lien, permissions granulaires par membre (leader, gestion calendrier, planificateur, etc.).
- **Comptes multi-rôles** : Player, Manager (gérant de salle), Admin. Liaison de comptes + switch sans re-login.
- **Administration** (`/admin`) : CRUD des salles et des managers, génération de liens d'activation.

## Stack

| Couche | Techno |
|---|---|
| Frontend | Vue 3 (script setup) + TypeScript + Vite + SCSS |
| Backend | Node.js + Express + TypeScript |
| ORM / DB | Prisma 7 + PostgreSQL 16 |
| Auth | JWT (Bearer) + bcrypt |
| Tests | Vitest (unit + intégration via Supertest) |
| Conteneurs | Docker / Docker Compose |
| Déploiement | Railway (Dockerfile) |

## Prérequis

- **Node.js 20+** (`node -v`)
- **Docker Desktop** (pour PostgreSQL en local)
- **npm** (livré avec Node)

## Démarrage rapide (local)

```bash
# 1. Cloner et installer
git clone https://github.com/rdieulan/eva.git
cd eva
npm install

# 2. Copier la config d'environnement
cp .env.example .env
# Ajuster DATABASE_URL et JWT_SECRET si besoin (les défauts marchent avec docker-compose)

# 3. Démarrer PostgreSQL (crée aussi eva_db et eva_db_test)
npm run docker:up

# 4. Appliquer les migrations Prisma
npx prisma migrate deploy

# 5. Seeder les maps (référence indispensable)
npm run db:seed

# 6. (Optionnel) créer un super admin pour accéder à /admin
npm run create-admin

# 7. Lancer le backend (port 3001) — laisser tourner
npm run server

# 8. Dans un autre terminal, lancer le frontend (port 5173 par défaut)
npm run dev
```

L'app est disponible sur **http://localhost:5173**. Le backend tourne sur **http://localhost:3001** (le dev server Vite proxifie `/api/*` vers lui).

## Variables d'environnement

| Variable | Description | Défaut local |
|---|---|---|
| `DATABASE_URL` | URL Postgres (format `postgresql://user:pass@host:port/db`) | `postgresql://eva_user:eva_secret_password@localhost:5432/eva_db` |
| `JWT_SECRET` | Secret de signature des JWT — **à changer en prod** | `votre_secret_jwt_a_changer_en_production` |
| `JWT_EXPIRES_IN` | Durée de vie des tokens | `7d` |
| `NODE_ENV` | `development` / `production` / `test` | — |
| `PORT` | Port du backend | `3001` |

## Scripts npm

### Développement
| Script | Effet |
|---|---|
| `npm run dev` | Lance Vite (frontend) en mode dev, port 5173 |
| `npm run server` | Lance le backend avec `tsx --watch` |
| `npm run docker:up` / `docker:down` | Démarre / arrête le container Postgres |

### Build & prod
| Script | Effet |
|---|---|
| `npm run build` | Type-check + build frontend (`dist/`) + compile backend (`dist-server/`) |
| `npm start` | Démarre le serveur compilé (utilisé par Docker en prod) |

### Base de données
| Script | Effet |
|---|---|
| `npm run db:seed` | Seed des maps (référence) |
| `npm run db:studio` | Ouvre Prisma Studio (UI d'inspection) |
| `npm run db:generate` | Régénère le client Prisma après modif du schéma |
| `npm run db:push` | Sync rapide schéma → DB sans créer de migration (dev only) |
| `npm run create-admin` | Crée un super admin interactivement |

### Tests
| Script | Effet |
|---|---|
| `npm run test:run` | Tests unitaires (~212 tests) |
| `npm run test:integration` | Tests d'intégration (~109 tests, nécessite Docker) |
| `npm test` | Vitest en mode watch |

## Structure du projet

```
eva/
├── client/              # Frontend Vue 3
│   ├── src/
│   │   ├── api/         # Clients HTTP (auth, teams, calendar, admin, ...)
│   │   ├── components/  # Composants réutilisables
│   │   ├── composables/ # useAuth, useErrors, useBalanceRules, ...
│   │   ├── pages/       # Pages routées (HomePage, PlannerPage, AdminLayout, ...)
│   │   ├── router/      # vue-router + guards
│   │   └── styles/      # SCSS partagé (variables, mixins, buttons)
│   └── vite.config.ts
├── server/              # Backend Express
│   └── src/
│       ├── routes/      # Routes HTTP (auth, teams, admin, calendar, ...)
│       ├── services/    # Logique métier (auth.service, venues.service, ...)
│       ├── middleware/  # authMiddleware, requirePermission, requireAdmin
│       ├── db/          # Singleton Prisma + pool pg
│       └── utils/       # Logger, helpers
├── shared/              # Types et utils partagés client/serveur
│   ├── types/           # AccountPermissions, AdminPermissions, Venue, ...
│   ├── constants/       # ERROR, validation regex/seuils
│   └── utils/           # validateEmail, validatePassword, ...
├── prisma/
│   ├── schema.prisma    # Source de vérité du modèle de données
│   ├── migrations/      # Historique des migrations
│   └── seed.ts          # Seed des maps
├── tests/
│   ├── unit/            # Vitest unit (client + server + shared)
│   └── integration/     # Supertest contre une vraie DB
├── scripts/             # Outils CLI (create-admin, rename-file, refactor)
├── docs/                # CODE_RULES, CODE_AGENT, REVIEW_CRITERIA
└── ROADMAP.md           # État des features en cours / terminées
```

## Modèle d'auth

Un `User` porte les credentials (email + password) et peut être lié à exactement **l'un** parmi :

- `Player` — joueur d'équipe (a un `teamId`, des permissions granulaires, des disponibilités).
- `Manager` — gérant de salle (rattaché à une ou plusieurs `Venue` via `VenueManager`).
- `Admin` — administrateur (permissions système : gérer venues / managers / autres admins).

Un même utilisateur humain peut avoir plusieurs comptes (par exemple un compte player et un compte manager) reliés via `LinkedAccountGroup` et basculer entre eux sans se reconnecter (`POST /api/auth/switch-account`).

Le JWT embarque `userId`, `email`, `accountType` (`player` / `manager` / `admin`) et l'id spécifique au rôle (`playerId` / `managerId` / `adminId`).

## Tests d'intégration

Les tests d'intégration tapent sur une vraie DB PostgreSQL.

```bash
# Avant la première run : créer la DB de test et appliquer les migrations
npm run docker:up
DATABASE_URL='postgresql://eva_user:eva_secret_password@localhost:5432/eva_db_test' npx prisma migrate deploy

# Run
npm run test:integration
```

Le `setup.ts` nettoie automatiquement les tables entre chaque test (`cleanDatabase` dans `tests/integration/helpers/db.ts`), donc l'ordre des fichiers n'a pas d'importance.

## Déploiement

Railway construit l'image via le `Dockerfile`. La config est dans `railway.json` (builder = DOCKERFILE, restart policy = ON_FAILURE, max retries = 10). En prod, au démarrage, le container exécute `npx prisma migrate deploy` puis lance le serveur Node compilé.

Pour bootstrapper la prod :

```bash
# Après le déploiement, sur Railway shell (ou local en pointant DATABASE_URL prod)
npm run db:seed         # seed des maps
npm run create-admin    # créer le premier super admin
```

## Roadmap

Voir `ROADMAP.md` pour l'état des features (en cours / terminées / à faire).
