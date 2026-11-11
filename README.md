# EVA

Outil web de gestion d'équipe FPS 4v4 : planification de postes par map, calendrier de disponibilités, organisation d'équipe, et administration des salles affiliées.

## Fonctionnalités

- **Accueil** : pour un joueur d'une équipe, ce qu'il a à faire bientôt, le plus urgent en tête. On y trouve ses matchs de la semaine, avec les inscrits lus sur eva.gg et le lien pour réserver sa place, et ses dispos à donner. Selon ses droits s'y ajoutent l'inscription de l'équipe à sa ligue, les compétitions que sa salle lui propose, les propositions de match et les demandes pour rejoindre. Des onglets Accueil, Calendrier et Équipe sont dans la barre du haut, et en bas de l'écran sur téléphone.
- **Planificateur** : assignation des joueurs aux 4 postes de chaque map, avec règles d'équilibrage configurables et export PNG.
- **Calendrier** : disponibilités joueurs (dispo, possible, vocal uniquement, indispo), événements (match, compétition, événement, réunion vocale avec sa plateforme : Discord, TeamSpeak, WhatsApp…), salle et arène où se joue un match (salle de l'équipe par défaut), créneau du match choisi parmi ceux que la salle propose ce jour-là (lus sur eva.gg, horaire et convocation compris), rattachement d'un plan de jeu à un match, jours de renouvellement d'abonnement des joueurs.
- **Profil** : niveau d'abonnement (bronze, argent, or) et date de renouvellement, l'abonnement se renouvelant tous les 30 jours à partir de cette date. Liaison du compte eva.gg par son tag (`Pseudo#123456`), résolu vers l'identifiant stable d'eva.gg pour suivre le joueur même s'il change de pseudo (voir [docs/EVA_API.md](docs/EVA_API.md)). Obligatoire : demandé dès la première connexion, il se change mais ne se retire pas.
- **Équipes** : création d'équipe, logo (PNG, JPEG ou WebP, 256 Ko max, stocké en base et affiché dans la barre du haut), invitations par lien, durée sur laquelle les joueurs donnent leurs dispos (15 jours par défaut, de 7 à 30), permissions granulaires par membre (leader, gestion calendrier, planificateur, etc.).
- **Comptes multi-rôles** : Player, Manager (gérant de salle), Admin, sur le même compte. On passe d'un rôle à l'autre sans se reconnecter, en un clic dans la barre du haut.
- **Espace gérant** : l'onglet « Compétition » porte les divisions de la ligue locale de la salle, rangées d'un glisser-déposer et reprises du dernier mois tiré sur competitive.eva.gg, et les compétitions de la salle (journées de division, tournois), proposées aux équipes concernées, qui les ajoutent à leur calendrier ou les refusent, et prévenues dans la cloche et sur Discord.
- **Salles** : nom, adresse, téléphone, nombre d'arènes et liens (Discord, réseaux sociaux, site), remplis automatiquement depuis eva.gg et modifiables dans l'administration. Le Discord de la salle s'affiche sur la page équipe et sur la fiche d'un match.
- **Administration** (`/admin`) : CRUD des salles et des managers, génération de liens d'activation, et le compte eva.gg de chaque joueur, à libérer quand un autre tient le sien.

## Stack

| Couche | Techno |
|---|---|
| Frontend | Vue 3 (script setup) + TypeScript + Vite + SCSS |
| Backend | Node.js + Express + TypeScript |
| ORM / DB | Prisma 7 + PostgreSQL 16 |
| Auth | Connexion par Discord (OAuth2, identité seule) + sessions vérifiées par le serveur (cookie HttpOnly) |
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
# Ajuster DATABASE_URL si besoin (les défauts marchent avec docker-compose)
# APP_URL vaut http://localhost:5173 en dev : sans elle, le site ne peut rien modifier
# DEV_LOGIN=true offre, en dev seulement, de se connecter à n'importe quel compte local sans Discord
# Les secrets de l'application Discord vont dans .env.local, jamais commité :
#   DISCORD_CLIENT_ID=...  DISCORD_CLIENT_SECRET=...

# 3. Démarrer PostgreSQL (crée aussi eva_db et eva_db_test)
npm run docker:up

# 4. Appliquer les migrations Prisma
npx prisma migrate deploy

# 5. Seeder les maps (référence indispensable)
npm run db:seed

# 6. Remplir la liste des salles (et leur nombre d'arènes) depuis l'API publique eva.gg
npm run db:sync-venues

# 7. Remplir l'annuaire des équipes de ligue depuis competitive.eva.gg (une page de 50 équipes
#    toutes les 3 secondes : le serveur de dev ne le fait jamais de lui-même)
npm run db:sync-league-teams

# 8. (Optionnel) inviter un super admin : le lien affiché s'ouvre et s'accepte avec Discord
npm run create-admin

# 9. Lancer le backend (port 3001) — laisser tourner
npm run server

# 10. Dans un autre terminal, lancer le frontend (port 5173 par défaut)
npm run dev
```

L'app est disponible sur **http://localhost:5173**. Le backend tourne sur **http://localhost:3001** (le dev server Vite proxifie `/api/*` vers lui).

## Variables d'environnement

| Variable | Description | Défaut local |
|---|---|---|
| `DATABASE_URL` | URL Postgres (format `postgresql://user:pass@host:port/db`) | `postgresql://eva_user:eva_secret_password@localhost:5432/eva_db` |
| `NODE_ENV` | `development` / `production` / `test` | — |
| `PORT` | Port du backend | `3001` |
| `APP_URL` | Adresse publique du site : liens des notifications Discord, retour de la connexion par Discord, et seule origine d'où le serveur accepte des modifications | `http://localhost:5173` |
| `DISCORD_CLIENT_ID` | Identifiant de l'application Discord de la connexion (dans `.env.local` en dev) | — |
| `DISCORD_CLIENT_SECRET` | Secret de cette application : **jamais commité**, dans `.env.local` en dev | — |
| `DEV_LOGIN` | `true` : se connecter à n'importe quel compte local sans Discord, pour les vérifications. Jamais actif en production, quoi qu'on règle | `true` |

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
| `npm run db:sync-venues [-- <pays>]` | Remplit / met à jour les salles et leur nombre d'arènes depuis l'API eva.gg (FR par défaut) |
| `npm run db:sync-league-teams` | Relit tout de suite la liste des équipes de ligue de competitive.eva.gg dans l'annuaire (le serveur de production la relit seul chaque nuit) |
| `npm run db:check-league-registrations` | Relit tout de suite les inscriptions des équipes reliées à leur ligue locale et envoie les rappels dus (le serveur de production le fait seul chaque nuit) |
| `npm run db:studio` | Ouvre Prisma Studio (UI d'inspection) |
| `npm run db:generate` | Régénère le client Prisma après modif du schéma |
| `npm run db:push` | Sync rapide schéma → DB sans créer de migration (dev only) |
| `npm run create-admin` | Invite un super admin : affiche le lien à ouvrir et accepter avec Discord |

### eva.gg
| Script | Effet |
|---|---|
| `npm run eva:probe-me` | En réserve : affiche les données privées du compte eva.gg dont on fournit le jeton (`EVA_TOKEN`), pour préparer la vérification des inscriptions aux créneaux avec le compte dédié. Voir [docs/EVA_API.md](docs/EVA_API.md). |

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
│       ├── integrations/ # Clients d'API tierces (eva.gg)
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
├── docs/                # PRODUIT, EVA_API, CODE_RULES, CODE_AGENT, REVIEW_CRITERIA, SCRIPTS
└── ROADMAP.md           # Ce qui reste à faire
```

## Modèle d'auth

Un `User` est une personne, connectée avec son compte Discord : on garde le numéro de ce compte (`discordId`) et le pseudo qu'elle affiche, rien d'autre (ni email, ni mot de passe, ni avatar). La connexion demande à Discord la seule portée `identify` ; le jeton d'accès sert à lire le compte, puis il est révoqué (`integrations/discord/discord-oauth.ts`). La première connexion crée le compte. Chaque personne a ses rôles :

- `Player` — toujours : joueur d'équipe (a un `teamId`, des permissions granulaires, des disponibilités).
- `Manager` — gérant de salle (rattaché à une ou plusieurs `Venue` via `VenueManager`), donné par invitation.
- `Admin` — administrateur (permissions système : gérer venues / managers / autres admins), donné par invitation.

Une invitation est un `Manager` ou un `Admin` sans compte : son lien (`/activate/:token`) s'ouvre, puis s'accepte en se connectant avec Discord, et le rôle rejoint le compte de la personne (`invitation.service.ts`). La session agit sous un rôle du compte (`Session.role`), un joueur au départ ; `PUT /api/auth/role` en change, pour cette session seulement. Seul l'identifiant du rôle joué est posé sur la requête : un admin qui agit en joueur n'a pas les droits d'admin, et l'inverse. Un rôle retiré fait agir la session en joueur.

La connexion par Discord part de `GET /api/auth/discord` (vers la page de Discord, avec un `state` gardé dans un cookie de dix minutes) et revient sur `GET /api/auth/discord/callback`, qui vérifie ce `state` avant tout : sans lui, n'importe qui pourrait connecter un visiteur à son propre compte. En dev, `DEV_LOGIN=true` ajoute `/api/auth/dev/*` et la liste « Se connecter en tant que… » de la page de connexion ; ni l'un ni l'autre n'existe en production.

La session est un jeton aléatoire dans un cookie `HttpOnly` (`SameSite=Lax`, `Secure` et préfixe `__Host-` en production) : le code de la page ne peut pas le lire. La base n'en garde que l'empreinte SHA-256 (`Session.tokenHash`) et le serveur la vérifie à chaque requête (`authMiddleware`) : la déconnexion la ferme pour de bon, la suppression d'un compte aussi. Elle dure 30 jours et se prolonge, au plus une fois par jour, tant qu'elle sert, sans dépasser 90 jours après son ouverture. Les requêtes qui modifient sont refusées quand le navigateur dit qu'elles viennent d'un autre site que `APP_URL` (en-tête `Origin`).

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
npm run db:sync-venues  # salles eva.gg
npm run db:sync-league-teams  # annuaire des équipes de ligue (sinon, le serveur le remplit dans l'heure)
npm run create-admin    # inviter le premier super admin (lien à accepter avec Discord)
```

## Roadmap

Ce qui reste à faire : `ROADMAP.md`. Ce que fait l'application et pourquoi : `docs/PRODUIT.md`.
