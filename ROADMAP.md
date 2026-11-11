# EVA - Roadmap

## 📋 En cours

### Ligne directrice (décidée le 2026-11-01)

**« Faire jouer l'équipe. »** Quand, où, contre qui, et que les huit soient dans l'arène. Deux métiers pour l'instant : **organiser** (calendrier, disponibilités, créneaux de salle, réservations vérifiées) et **trouver un adversaire** (scrim ancré sur un créneau réel). Une fonctionnalité n'entre que si elle retire une étape entre « on veut jouer » et « on est huit dans l'arène ». Hors ligne : vidéo, statistiques détaillées, suivi de ligue, bot Discord comme produit.

Le planificateur de postes est **parqué** (`PLANNER_ENABLED`, `shared/constants/feature.constants.ts`) : complet et testé, pas assez abouti pour être montré. Retiré de la navigation, de l'accueil et des fiches de match ; API et données conservées.

Ce que fait l'application et pourquoi (calendrier, dispos, matchmaking, notifications, accueil, tableau public des salles, adresse du site) : [docs/PRODUIT.md](docs/PRODUIT.md).

### À cadrer avant construction

| Sujet | État | Notes |
|-------|------|-------|
| Mise en production | ⬜ à cadrer | De quelques joueurs à quelques centaines : Railway reste l'hébergeur, une seule instance (le passage horaire sur les recherches et les caches de créneaux vivent dans le serveur : deux copies doubleraient les lectures eva.gg). Avant d'ouvrir : une page de mentions légales et d'information sur les données personnelles (RGPD), sauvegarde quotidienne de la base, en-têtes de sécurité, l'application Discord de la prod (adresse de retour https://scrim-calendar.com/api/auth/discord/callback, `DISCORD_CLIENT_ID` et `DISCORD_CLIENT_SECRET` sur Railway), les deux domaines déclarés sur Railway avec la redirection d'eva-calendar.com vers scrim-calendar.com faite par notre serveur (voir *L'adresse du site* dans [docs/PRODUIT.md](docs/PRODUIT.md)), `APP_URL` sur https://scrim-calendar.com, dev fusionné dans main (migrations 0016 à 0037 sur une base de prod remise à zéro), le premier administrateur invité par `npm run create-admin`. Ensuite, la base de prod ne se remet plus à zéro : les migrations gardent les données. À surveiller : le volume de lectures eva.gg, la vraie limite à cette échelle. |
| Nom affiché de l'application | ⬜ à décider | « EVA » dans les titres des pages, sur les cartes Discord et sur la page où Discord demande l'accord de connexion (le nom de l'application Discord) peut passer pour un service officiel d'eva.gg, pour la même raison qu'un domaine en « eva » ; le site vit déjà sur scrim-calendar.com. |
| Prévenir sur WhatsApp | ⬜ à cadrer | Un compte Meta Business vérifié, un numéro dédié, des modèles de messages validés par Meta, un coût par message, et le numéro de chaque joueur avec son accord. Il se branche comme un canal de plus sur l'envoi des notifications, sans rien changer à ce qui les déclenche. |
| Les compétitions sur l'accueil | ⬜ à cadrer | L'accueil liste les matchs de la semaine, pas les compétitions du calendrier. Une compétition des 7 prochains jours pourrait y figurer à son tour, avec sa coupe turquoise, et compter pour « le prochain match » quand il n'y a rien à faire. |
| Salle : modifier une publication | ⬜ à cadrer | Le gérant ne peut que retirer une compétition ou un événement publiés, puis les republier : les équipes sont prévenues deux fois, celles qui avaient accepté la compétition doivent l'accepter de nouveau, et celles qui avaient ajouté l'événement doivent l'ajouter de nouveau. Changer son jour, ses horaires, son titre ou sa description, la copie des équipes suivant, et ces équipes prévenues du changement. |
| Compétitions de salle : propositions à jour des divisions | ⬜ à cadrer | Une compétition va aux équipes placées au moment où elle est publiée. Une équipe placée ensuite dans la division, à l'arrivée d'un nouveau mois ou sur l'application, ne reçoit pas les journées déjà publiées, et une équipe changée de division garde celles de l'ancienne. |
| Salle : vue publique du calendrier | ⬜ à cadrer | Le calendrier de la salle, que son gérant lit dans son espace, en lecture publique : les événements, ouverts à tous, s'y lisent sans compte ni équipe, et une équipe d'une autre salle, favorite comprise, les ajoute de là à son calendrier ; aujourd'hui, seules les équipes affiliées à la salle voient ses événements. Reste à décider ce que cette vue montre des matchs entre équipes, que le gérant y voit avec leurs noms. |
| Agenda personnel | ⬜ à réfléchir | Ajouter un événement de la salle à son propre agenda (téléphone, Google), pour un joueur seul comme pour un joueur d'équipe. Une réflexion à mener, rien n'est décidé : pour l'instant, un événement se copie dans le calendrier de l'équipe. |
| Salle : publier sur son Discord | ⬜ à cadrer | Ce que le gérant publie, une nocturne par exemple, part aussi sur le Discord officiel de la salle, par le salon relié dans Ma salle : il n'a pas à le publier deux fois. WhatsApp et Instagram plus tard. |
| Matchs de ligue joués | ⬜ à cadrer | Les matchs joués d'une équipe de ligue se lisent sans compte, avec leur division, leurs adversaires et leurs résultats (score, victoire ou défaite, forfait) ; leur date n'est que celle où le résultat a été saisi. Une piste pour l'équipe reliée, à cadrer quand le besoin viendra. |

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
| Symboles du coin d'un jour trop bas sur petit écran | ⬜ | La coche et la croix sont des caractères de police dont le dessin est décalé vers le bas : à 768 px et moins, ils tombent environ 2 px sous le centre du triangle (mesuré), le micro, une icône dessinée, tombe juste. Les remplacer, avec le tilde et le point d'interrogation, par des icônes dessinées changerait un peu leur dessin. |
| Découper `DayCell.vue` | ⬜ | Près de 1000 lignes : extraire le coin du lecteur (triangle, symbole, horaires) en sous-composant, et l'appui qui ouvre la roue des réponses en composable. |
| Proposer un match hors des dispos de l'équipe | ⬜ | La fiche d'une autre recherche ne dit rien des dispos de sa propre équipe : une suite choisie là où l'équipe n'est pas au complet part sans avertissement. Reprendre les créneaux en jaune de « Chercher un adversaire » (`teamHours` de `VenueSlotPicker`). |
| Origine des icônes | ⬜ | Les icônes de `client/src/assets/icons/` reprennent des tracés Material Icons (Apache 2.0), dont seules la cloche, l'horloge, le calendrier, la coupe et la loupe sont déclarées dans `THIRD_PARTY_NOTICES.md`. Vérifier les autres une à une et les y déclarer. |
| Règles d'équilibrage demandées pour un compte sans équipe | ⬜ | L'application les demande pour tout compte connecté, alors que le serveur répond 404 à qui n'a pas d'équipe : un administrateur, un gérant ou un joueur sans équipe laisse une erreur dans la console du navigateur à chaque chargement. Ne les demander qu'à un joueur qui a une équipe. |
| Le gérant s'appelle « manager » dans l'administration | ⬜ | L'onglet « Managers » et le bouton « Inviter un manager » de l'administration, quand le reste de l'application dit « Gérant » (la bascule de rôle, « Ma salle ») : un seul mot partout, à choisir. |
| Type `TeamWithMembers` en double | ⬜ | `shared/types/team.types.ts` en déclare un que plus rien n'utilise ; la page équipe lit celui de `client/src/api/teams.api.ts`, qui suit ce que le serveur renvoie. Supprimer le premier, ou faire du second le seul, partagé. |
| Les tests ne passent pas la vérification de types | ⬜ | `vue-tsc -p tests/tsconfig.json` relève une quarantaine d'erreurs, toutes dans des tests anciens : jours sans `renewals`, créneaux sans `isCompetitiveAvailable`, salles incomplètes, `userId` dans `PlayerAssignment`, `UserPermissions` disparu, alias `@routes` et `@utils` inconnus de ce tsconfig. Vitest ne vérifie pas les types, donc rien ne casse, mais les fixtures dérivent des types sans que personne le voie. Les corriger, puis brancher cette vérification avec les autres. |
| Prévenir d'une annulation qui n'a pas eu lieu | ⬜ | Accepter relit la suite chez eva.gg avant de prendre le verrou de la recherche (`checkRunStillFree`). Si pendant cette lecture la proposition est retirée, refusée ou acceptée par ailleurs, et que la suite n'est plus libre, rien ne change en base, mais l'équipe qui proposait reçoit quand même « Proposition annulée » et la réponse dit que le créneau est pris. Ne prévenir et ne répondre ainsi que si la proposition a bien été annulée. |
| Adresse publique lue dans les en-têtes | ⬜ | `app.set('trust proxy', true)` croit tous les relais, alors que son commentaire dit le premier : à régler sur un seul (le relais de Railway) avant toute limite par adresse IP, qu'un `X-Forwarded-For` inventé contournerait. Les liens d'invitation se construisent depuis ces en-têtes (`getOrigin`, `invites.routes.ts`) : les construire depuis `APP_URL`, comme les cartes Discord. Le service `app` de `docker-compose.yml` publie le port 3000 alors que le serveur écoute sur 3001. |
| Supprimer un joueur qui a ouvert une recherche ou proposé un match | ⬜ | L'administration échoue sur ce joueur : ses recherches et ses propositions le désignent comme auteur, un lien que la base refuse de casser, et `deletePlayer` ne traite que ses événements et ses invitations. Décider ce que deviennent une recherche et une proposition dont l'auteur part : elles appartiennent à l'équipe. |
| Commentaire périmé de la route du logo d'équipe | ⬜ | `GET /api/teams/:id/logo` se dit publique parce qu'une image ne transporterait pas de jeton : depuis la session en cookie, elle la transporte. La route reste publique pour une autre raison, la page publique d'une salle montre les logos à qui n'est pas connecté : le commentaire doit dire celle-là. |
| Doc des tests d'intégration périmée | ⬜ | `docs/CODE_RULES.md` décrit encore `createTestUser` par `POST /api/auth/register` et un jeton dans l'en-tête `Authorization` : les aides créent un compte Discord et passent la session en cookie (`authHeader`). Mettre la table des aides et l'exemple à jour. |
| Lien d'invitation utilisé deux fois à la fois | ⬜ | `joinTeamWithCode` lit le nombre d'usages restants puis l'incrémente à part : deux joueurs qui ouvrent ensemble un lien à usage unique entrent tous les deux. Réserver l'usage en une écriture conditionnée (`uses < maxUses`). |
| Allers-retours de demandes pour rejoindre | ⬜ | Un joueur peut demander, annuler et redemander la même équipe sans fin, et chaque demande prévient l'équipe (cloche et Discord). Espacer les demandes d'un même joueur à une même équipe. |
| Fonctionnalités du README périmées | ⬜ | La liste nomme encore la dispo « possible », remplacée par la dispo sur une plage horaire, et le planificateur en tête alors qu'il est parqué ; elle ne dit rien du matchmaking, des notifications ni du tableau public des salles. La reprendre sur [docs/PRODUIT.md](docs/PRODUIT.md). |
| Barre de sélection du matchmaking trop large sur téléphone | ⬜ | À 390 px de large, « 1 jour sélectionné », « Annuler » et « Chercher un adversaire » demandent 441 px pour 372 disponibles : le bouton de recherche sort de l'écran (mesuré le 2026-11-10, `ScrimSelectionBar.vue`). Raccourcir le libellé ou passer les boutons sous le compte. |
| Emojis sur les boutons | ⬜ | La règle du calendrier exclut les emojis des commandes de son en-tête ; ailleurs, des boutons en portent encore (« ➕ Inviter », « ➕ Ajouter », « 💾 Sauvegarder », « 📋 Définir le plan de jeu »), d'autres une icône dessinée (« Modifier »). Trancher pour toute l'app. |
| Semaine à cheval sur deux mois | ⬜ | La vue semaine lit le mois de son mercredi : les jours de l'autre mois, en début ou en fin de semaine, restent vides et grisés même quand ils portent quelque chose, dans le calendrier de l'équipe comme dans celui de la salle. Lire les jours de la semaine affichée, quel que soit leur mois. |
