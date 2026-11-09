# EVA - Roadmap

## 📋 En cours

### Ligne directrice (décidée le 2026-11-01)

**« Faire jouer l'équipe. »** Quand, où, contre qui, et que les huit soient dans l'arène. Deux métiers pour l'instant : **organiser** (calendrier, disponibilités, créneaux de salle, réservations vérifiées) et **trouver un adversaire** (scrim ancré sur un créneau réel). Une fonctionnalité n'entre que si elle retire une étape entre « on veut jouer » et « on est huit dans l'arène ». Hors ligne : vidéo, statistiques détaillées, suivi de ligue, bot Discord comme produit.

Le planificateur de postes est **parqué** (`PLANNER_ENABLED`, `shared/constants/feature.constants.ts`) : complet et testé, pas assez abouti pour être montré. Retiré de la navigation, de l'accueil et des fiches de match ; API et données conservées.

Ce que fait l'application et pourquoi (calendrier, dispos, matchmaking, notifications, tableau public des salles, adresse du site) : [docs/PRODUIT.md](docs/PRODUIT.md).

### À cadrer avant construction

| Sujet | État | Notes |
|-------|------|-------|
| Connexion par Discord | ⬜ à préciser | Se connecter avec son compte Discord, sans mot de passe à nous : plus de mail de réinitialisation, et une donnée personnelle de moins. À établir : ce qu'on garde du compte Discord (le moins possible), le passage des comptes existants, les administrateurs et les gérants de salle. |
| Mise en production | ⬜ à cadrer | De quelques joueurs à quelques centaines : Railway reste l'hébergeur, une seule instance (le passage horaire sur les recherches et les caches de créneaux vivent dans le serveur : deux copies doubleraient les lectures eva.gg). Avant d'ouvrir : une page de mentions légales et d'information sur les données personnelles (RGPD), sauvegarde quotidienne de la base, limite des tentatives de connexion, en-têtes de sécurité, les deux domaines déclarés sur Railway avec la redirection d'eva-calendar.com vers scrim-calendar.com faite par notre serveur (voir *L'adresse du site* dans [docs/PRODUIT.md](docs/PRODUIT.md)), `APP_URL` sur https://scrim-calendar.com, dev fusionné dans main (migrations 0016 à 0035 sur une base de prod remise à zéro), un compte d'administration. Ensuite, la base de prod ne se remet plus à zéro : les migrations gardent les données. À surveiller : le volume de lectures eva.gg, la vraie limite à cette échelle. |
| Nom affiché de l'application | ⬜ à décider | « EVA » dans les titres des pages et sur les cartes Discord peut passer pour un service officiel d'eva.gg, pour la même raison qu'un domaine en « eva » ; le site vit déjà sur scrim-calendar.com. |
| Prévenir sur WhatsApp | ⬜ à cadrer | Un compte Meta Business vérifié, un numéro dédié, des modèles de messages validés par Meta, un coût par message, et le numéro de chaque joueur avec son accord. Il se branche comme un canal de plus sur l'envoi des notifications, sans rien changer à ce qui les déclenche. |
| Rappel mensuel au capitaine d'une équipe de ligue locale | ⬜ à préciser | Validation d'inscription à faire chaque mois sur competitive.eva.gg. À établir : quoi valider exactement, quand (date butoir), où sur le site, et si c'est lisible publiquement pour savoir si c'est déjà fait. Affiché sur le tableau de bord d'accueil. |

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

### Dette et détails relevés en route ⬜

| Tâche | Statut | Notes |
|-------|--------|-------|
| Découper `EventFormModal.vue` | ⬜ | Plus de 900 lignes : extraire la vue lecture seule et les champs de lieu (salle, arène, créneau) en sous-composants. |
| `POST /api/teams` ignore `venueId` | ⬜ | La salle passée à la création n'est pas enregistrée ; elle ne se pose qu'ensuite depuis la page équipe. Soit l'accepter, soit la retirer du contrat. |
| Symboles du coin d'un jour trop bas sur petit écran | ⬜ | La coche et la croix sont des caractères de police dont le dessin est décalé vers le bas : à 768 px et moins, ils tombent environ 2 px sous le centre du triangle (mesuré), le micro, une icône dessinée, tombe juste. Les remplacer, avec le tilde et le point d'interrogation, par des icônes dessinées changerait un peu leur dessin. |
| Découper `DayCell.vue` | ⬜ | Près de 1000 lignes : extraire le coin du lecteur (triangle, symbole, horaires) en sous-composant, et l'appui qui ouvre la roue des réponses en composable. |
| Proposer un match hors des dispos de l'équipe | ⬜ | La fiche d'une autre recherche ne dit rien des dispos de sa propre équipe : une suite choisie là où l'équipe n'est pas au complet part sans avertissement. Reprendre les créneaux en jaune de « Chercher un adversaire » (`teamHours` de `VenueSlotPicker`). |
| Origine des icônes | ⬜ | Les icônes de `client/src/assets/icons/` reprennent des tracés Material Icons (Apache 2.0), dont seules la cloche et l'horloge sont déclarées dans `THIRD_PARTY_NOTICES.md`. Vérifier les autres une à une et les y déclarer. |
| Règles d'équilibrage demandées pour un compte sans équipe | ⬜ | L'application les demande pour tout compte connecté, alors que le serveur répond 404 à qui n'a pas d'équipe : un administrateur, un gérant ou un joueur sans équipe laisse une erreur dans la console du navigateur à chaque chargement. Ne les demander qu'à un joueur qui a une équipe. |
| Type `TeamWithMembers` en double | ⬜ | `shared/types/team.types.ts` en déclare un que plus rien n'utilise ; la page équipe lit celui de `client/src/api/teams.api.ts`, qui suit ce que le serveur renvoie. Supprimer le premier, ou faire du second le seul, partagé. |
| Les tests ne passent pas la vérification de types | ⬜ | `vue-tsc -p tests/tsconfig.json` relève une quarantaine d'erreurs, toutes dans des tests anciens : jours sans `renewals`, créneaux sans `isCompetitiveAvailable`, salles incomplètes, `userId` dans `PlayerAssignment`, `UserPermissions` disparu, alias `@routes` et `@utils` inconnus de ce tsconfig. Vitest ne vérifie pas les types, donc rien ne casse, mais les fixtures dérivent des types sans que personne le voie. Les corriger, puis brancher cette vérification avec les autres. |
| Prévenir d'une annulation qui n'a pas eu lieu | ⬜ | Accepter relit la suite chez eva.gg avant de prendre le verrou de la recherche (`checkRunStillFree`). Si pendant cette lecture la proposition est retirée, refusée ou acceptée par ailleurs, et que la suite n'est plus libre, rien ne change en base, mais l'équipe qui proposait reçoit quand même « Proposition annulée » et la réponse dit que le créneau est pris. Ne prévenir et ne répondre ainsi que si la proposition a bien été annulée. |
| Adresse publique lue dans les en-têtes | ⬜ | `app.set('trust proxy', true)` croit tous les relais, alors que son commentaire dit le premier : à régler sur un seul (le relais de Railway) avant toute limite par adresse IP, qu'un `X-Forwarded-For` inventé contournerait. Les liens d'invitation se construisent depuis ces en-têtes (`getOrigin`, `invites.routes.ts`) : les construire depuis `APP_URL`, comme les cartes Discord. Le service `app` de `docker-compose.yml` publie le port 3000 alors que le serveur écoute sur 3001. |
| Supprimer un joueur qui a ouvert une recherche ou proposé un match | ⬜ | L'administration échoue sur ce joueur : ses recherches et ses propositions le désignent comme auteur, un lien que la base refuse de casser, et `deletePlayer` ne traite que ses événements et ses invitations. Décider ce que deviennent une recherche et une proposition dont l'auteur part : elles appartiennent à l'équipe. |
