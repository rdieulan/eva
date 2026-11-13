# EVA - Roadmap

## 📋 En cours

### Ligne directrice (décidée le 2026-11-01)

**« Faire jouer l'équipe. »** Quand, où, contre qui, et que les huit soient dans l'arène. Deux métiers pour l'instant : **organiser** (calendrier, disponibilités, créneaux de salle, réservations vérifiées) et **trouver un adversaire** (scrim ancré sur un créneau réel). Une fonctionnalité n'entre que si elle retire une étape entre « on veut jouer » et « on est huit dans l'arène ». Hors ligne : vidéo, statistiques détaillées, suivi de ligue, bot Discord comme produit.

Le planificateur de postes est **parqué** (`PLANNER_ENABLED`, `shared/constants/feature.constants.ts`) : complet et testé, pas assez abouti pour être montré. Retiré de la navigation, de l'accueil et des fiches de match ; API et données conservées.

Ce que fait l'application et pourquoi (calendrier, dispos, matchmaking, notifications, accueil, tableau public des salles, adresse du site) : [docs/PRODUIT.md](docs/PRODUIT.md).

### À cadrer avant construction

| Sujet | État | Notes |
|-------|------|-------|
| Mise en production | ⬜ à cadrer | De quelques joueurs à quelques centaines : Railway reste l'hébergeur, une seule instance (le passage horaire sur les recherches et les caches de créneaux vivent dans le serveur : deux copies doubleraient les lectures eva.gg). Avant d'ouvrir : une page de mentions légales et d'information sur les données personnelles (RGPD), sauvegarde quotidienne de la base, l'application Discord de la prod, nommée « Scrim Calendar » (adresse de retour https://scrim-calendar.com/api/auth/discord/callback, `DISCORD_CLIENT_ID` et `DISCORD_CLIENT_SECRET` sur Railway), les deux domaines déclarés sur Railway, puis `APP_URL` sur https://scrim-calendar.com une fois ce domaine en service : le serveur y renvoie toute autre adresse, l'adresse Railway comprise (voir *L'adresse du site* dans [docs/PRODUIT.md](docs/PRODUIT.md)), dev fusionné dans main (les migrations à partir de la 0016, sur une base de prod remise à zéro), le premier administrateur invité par `npm run create-admin`. Ensuite, la base de prod ne se remet plus à zéro : les migrations gardent les données. À surveiller : le volume de lectures eva.gg, la vraie limite à cette échelle. |
| Prévenir sur WhatsApp | ⬜ à cadrer | Un compte Meta Business vérifié, un numéro dédié, des modèles de messages validés par Meta, un coût par message, et le numéro de chaque joueur avec son accord. Il se branche comme un canal de plus sur l'envoi des notifications, sans rien changer à ce qui les déclenche. |
| Salle : vue publique du calendrier | ⬜ à cadrer | Le calendrier de la salle, que son gérant lit dans son espace, en lecture publique : les événements, ouverts à tous, s'y lisent sans compte ni équipe, et une équipe d'une autre salle, favorite comprise, les ajoute de là à son calendrier ; aujourd'hui, seules les équipes affiliées à la salle voient ses événements. Reste à décider ce que cette vue montre des matchs entre équipes, que le gérant y voit avec leurs noms. |
| Agenda personnel | ⬜ à réfléchir | Ajouter un événement de la salle à son propre agenda (téléphone, Google), pour un joueur seul comme pour un joueur d'équipe. Une réflexion à mener, rien n'est décidé : pour l'instant, un événement se copie dans le calendrier de l'équipe. |
| Salle : publier sur WhatsApp et Instagram | ⬜ à cadrer | Ce que le gérant publie part sur le Discord de la salle, par le salon relié dans Ma salle ; WhatsApp et Instagram viendraient ensuite, pour qu'il n'ait à le publier nulle part une seconde fois. |
| Matchs de ligue joués | ⬜ à cadrer | Les matchs joués d'une équipe de ligue se lisent sans compte, avec leur division, leurs adversaires et leurs résultats (score, victoire ou défaite, forfait) ; leur date n'est que celle où le résultat a été saisi. Une piste pour l'équipe reliée, à cadrer quand le besoin viendra. |
| Manager d'équipe | ⬜ à réfléchir | Un rôle d'encadrement d'une équipe, pour une version future : le mot « manager » lui est réservé, le responsable d'une salle s'appelle « gérant » dans tout ce que l'application affiche. Le code nomme encore `Manager` le gérant de salle (modèle, rôle, routes, pages) : à renommer avant d'introduire ce rôle, pour qu'un même mot ne désigne pas deux rôles. |

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
| Retour du planificateur | ⬜ | Le planificateur, en pause, garde des emojis et des signes de police sur ses boutons-icône : renommer, dupliquer et supprimer un plan, calculateur de rotation, équilibre, marqueur et zone (seuls sur téléphone, leur texte masqué), fermer un panneau, valider un nom. Leur donner des icônes dessinées à son retour, selon la règle des commandes de [docs/CODE_RULES.md](docs/CODE_RULES.md). Son export en image (html2canvas, plan de jeu d'un match) n'a pas tourné sous la politique de sécurité du contenu, qui refuse les styles insérés comme markup : à vérifier à son retour. |
| Alertes npm des outils de test | ⬜ | Après la mise à jour du 2026-11-13, `npm audit` ne relève plus rien dans les dépendances de production, mais encore 8 alertes (2 élevées, 6 modérées) dans les outils de test et de développement : happy-dom (correctif en version majeure, la 21), ts-morph et ce qu'il tire (minimatch, glob), js-beautify, brace-expansion. Aucune ne tourne dans le serveur, mais l'image Docker embarque toutes les dépendances (tsx sert aux scripts d'administration) : les monter de version, tests à l'appui. |
