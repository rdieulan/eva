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
| Salle : vue publique du calendrier | ⬜ à cadrer | Le calendrier de la salle, que son gérant lit dans son espace, en lecture publique : les événements, ouverts à tous, s'y lisent sans compte ni équipe, et une équipe d'une autre salle, favorite comprise, les ajoute de là à son calendrier ; aujourd'hui, seules les équipes affiliées à la salle voient ses événements. Reste à décider ce que cette vue montre des matchs entre équipes, que le gérant y voit avec leurs noms. |
| Agenda personnel | ⬜ à réfléchir | Ajouter un événement de la salle à son propre agenda (téléphone, Google), pour un joueur seul comme pour un joueur d'équipe. Une réflexion à mener, rien n'est décidé : pour l'instant, un événement se copie dans le calendrier de l'équipe. |
| Salle : publier sur WhatsApp et Instagram | ⬜ à cadrer | Ce que le gérant publie part sur le Discord de la salle, par le salon relié dans Ma salle ; WhatsApp et Instagram viendraient ensuite, pour qu'il n'ait à le publier nulle part une seconde fois. |
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
| Symboles du coin d'un jour trop bas sur petit écran | ⬜ | La coche et la croix sont des caractères de police dont le dessin est décalé vers le bas : à 768 px et moins, ils tombent environ 2 px sous le centre du triangle (mesuré), le micro, une icône dessinée, tombe juste. Les remplacer, avec le tilde et le point d'interrogation, par des icônes dessinées changerait un peu leur dessin. |
| Le gérant s'appelle « manager » dans l'administration | ⬜ | L'onglet « Managers » et le bouton « Inviter un manager » de l'administration, quand le reste de l'application dit « Gérant » (la bascule de rôle, « Ma salle ») : un seul mot partout, à choisir. |
| Supprimer un joueur qui a ouvert une recherche ou proposé un match | ⬜ | L'administration échoue sur ce joueur : ses recherches et ses propositions le désignent comme auteur, un lien que la base refuse de casser, et `deletePlayer` ne traite que ses événements et ses invitations. Décider ce que deviennent une recherche et une proposition dont l'auteur part : elles appartiennent à l'équipe. |
| Emojis sur les boutons | ⬜ | La règle du calendrier exclut les emojis des commandes de son en-tête ; ailleurs, des boutons en portent encore (« ➕ Inviter », « ➕ Ajouter », « 💾 Sauvegarder », « 📋 Définir le plan de jeu »), d'autres une icône dessinée (« Modifier »). Trancher pour toute l'app. |
