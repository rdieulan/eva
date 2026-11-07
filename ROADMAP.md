# EVA - Roadmap

## 📋 En cours

### Ligne directrice (décidée le 2026-11-01)

**« Faire jouer l'équipe. »** Quand, où, contre qui, et que les huit soient dans l'arène. Deux métiers pour l'instant : **organiser** (calendrier, disponibilités, créneaux de salle, réservations vérifiées) et **trouver un adversaire** (scrim ancré sur un créneau réel). Une fonctionnalité n'entre que si elle retire une étape entre « on veut jouer » et « on est huit dans l'arène ». Hors ligne : vidéo, statistiques détaillées, suivi de ligue, bot Discord comme produit.

Une salle se nomme partout par son nom seul (`formatVenueLabel`), celui qu'eva.gg lui donne d'après sa ville : Nîmes, Toulouse Blagnac, Lyon Nord. La ville de son adresse, souvent une commune voisine (Avignon est au Pontet), ne paraît que dans le détail des salles et des équipes côté admin.

Le planificateur de postes est **parqué** (`PLANNER_ENABLED`, `shared/constants/feature.constants.ts`) : complet et testé, pas assez abouti pour être montré. Retiré de la navigation, de l'accueil et des fiches de match ; API et données conservées.

### À cadrer avant construction

| Sujet | État | Notes |
|-------|------|-------|
| Matchmaking de scrims | 🟢 cadré le 2026-11-01, découpe ci-dessous | Construction en cours, ticket par ticket. |
| Rappel mensuel au capitaine d'une équipe de ligue locale | ⬜ à préciser | Validation d'inscription à faire chaque mois sur competitive.eva.gg. À établir : quoi valider exactement, quand (date butoir), où sur le site, et si c'est lisible publiquement pour savoir si c'est déjà fait. Affiché sur le tableau de bord d'accueil. |
| Nom de domaine | ⬜ | Sans « eva » dans le nom (demande OAuth à venir, deux concurrents l'ont déjà pris). `.fr` ou `.gg` ouverts là où les `.com` sont pris. Conditionne la demande de client OAuth2. |

### Cadrage : matchmaking de scrims

**Vision (capitaine, 2026-11-01).** Le calendrier a deux modes, « Équipe » et « Matchmaking ». En mode Matchmaking :

- Chaque jour est coloré d'après les disponibilités cumulées de l'équipe (et non celle du joueur connecté) : la question posée par la couleur est « peut-on aligner quatre joueurs ce jour-là ? ».
- Un menu des salles en haut du calendrier : la salle d'affiliation en tête, puis les favorites de l'équipe, puis le reste du réseau ; on en coche plusieurs à la fois. Les jours montrent les recherches des autres équipes dans ces salles : heure, nom et logo de l'équipe. Un clic ouvre la proposition de match, qui prévient l'autre équipe.
- Pour se déclarer : le capitaine sélectionne autant de jours qu'il veut (un jour rouge s'accepte avec un avertissement), puis une fenêtre liste pour chaque jour les créneaux de chaque salle cochée, et il coche ceux qu'il met en recherche, dans une salle ou dans plusieurs.

**Décisions prises (révisables).**

- *Créneau proposable* : le jeu compétitif (`game.id` = `COMPETITIVE_GAME_ID`), mode compétitif ouvert (`competitiveMode.isAvailable`) **et personne d'inscrit**. Un créneau où un inconnu est déjà réservé n'accueille pas un match : la règle des 8 le marquerait aussitôt « de trop ». Les créneaux restent tous affichés pour lire la soirée d'un bloc : ceux qu'un match peut prendre se lisent comme les jours jouables du calendrier, en relief selon le thème ; les autres sont à plat, leur raison écrite en gris (autre jeu, mode compétitif fermé, occupé dès qu'un joueur y est inscrit, plage trop courte pour un match) : on veut savoir si un créneau est libre, pas combien d'inconnus y sont. Un créneau choisi est cerclé de blanc.
- *Direction visuelle du calendrier* (décidée le 2026-11-02) : **la case est l'équipe, le coin est le joueur, dans les deux lectures**. Fond et contour portent le verdict de l'équipe : vert quatre dispos, jaune quatre en comptant les possibles, violet quand la salle n'est pas acquise mais que quatre joueurs au moins peuvent déjà se retrouver en vocal, rouge quand même les joueurs qui n'ont pas répondu ne changeraient rien, neutre quand rien n'est acquis et qu'ils peuvent encore y changer quelque chose. La couleur est le plancher garanti par les réponses données : quatre réponses disent déjà quelque chose, les silencieux ne peuvent que relever le verdict. Un triangle dans l'angle inférieur droit porte la couleur de la dispo du lecteur, avec son symbole (coche, tilde, micro, croix, point d'interrogation). Le numéro du jour s'écrit en grand et en transparence au fond de la case, en accent pour aujourd'hui. En lecture normale, en mode Équipe, le contenu est ce qui est posé (match, événement), une ligne texte par item avec l'icône de son type dans sa couleur ; en matchmaking, les lignes sont les autres équipes qui cherchent (voir *Lire un jour en matchmaking*). Toutes les cases ont la même hauteur, la place de cinq lignes, en mois comme en semaine, en Équipe, en matchmaking et en édition : rien ne bouge d'une semaine à l'autre ni quand on change de vue. Un jour qui porte plus finit sur « +N autres » (le nombre seul quand la ligne est trop étroite pour le mot), qui ouvre la liste complète du jour ; chaque ligne y ouvre ce qu'elle montre, comme dans la case. Le bas à gauche est à nous, dans les deux modes : la coche blanche d'un jour sélectionné, ou la marque de notre recherche ; un jour qui peut être sélectionné, ou qui porte notre recherche, garde sa dernière ligne pour elle. En mode édition (bouton « Dispos »), la case liste les coéquipiers en colonne, un par ligne, du plus au moins dispo, un point par statut (cercle vide pour un non renseigné), sans le lecteur lui-même ; c'est là qu'on distingue un indispo d'un oubli. Le triangle du lecteur, que chaque clic change, y double de côté avec un léger rebond, plafonné à 60 % de la largeur du jour pour qu'un jour étroit (téléphone) garde la place des noms ; il reprend sa taille sans rebond en sortant. À chaque clic, sa couleur glisse vers la nouvelle et le nouveau symbole jaillit par-dessus l'ancien. La liste des coéquipiers et les lignes du jour se croisent en fondu ; les lignes prennent tout de suite leur place finale à côté du triangle, sans se re-tronquer pendant qu'il change de taille. Plus de pastilles, plus de grand symbole de fond. La légende du haut porte les deux lectures. Le matchmaking n'apporte aucune couleur : jour sélectionné cerclé de blanc, boutons dans l'accent commun. En tête, une seule ligne : mode à gauche, mois au centre, affichage à droite ; le menu des salles en dessous, seulement en matchmaking ; pas d'emoji sur les commandes.
- *Unité de recherche* : **une offre par équipe et par jour**. L'équipe **offre** des créneaux dans une salle ou dans plusieurs, sur n'importe quelle arène, pas forcément à la suite (« on peut jouer sur tout ça »), dit **la durée d'un match** en créneaux (deux par défaut, de un à quatre) et **le nombre de matchs** qu'elle veut jouer ce jour-là, toutes salles confondues (un par défaut, jusqu'à quatre), un réglage de chaque pour tous les jours ouverts ensemble. Une équipe ne joue qu'un match à la fois : deux matchs d'une offre ne se chevauchent jamais, qu'ils soient sur deux arènes ou dans deux salles ; l'un peut commencer quand l'autre finit. Elle coche son offre match par match : un clic prend d'un bloc les créneaux d'un match, un clic sur un créneau coché le retire avec ce qui ne fait plus un match entier, un créneau qu'aucun match ne peut tenir ne se coche pas. L'équipe qui répond clique sur le créneau de départ, dans la salle de son choix : la suite de la bonne longueur se sélectionne d'elle-même, et c'est elle qui devient un match. Une offre qui ne tient pas tous les matchs demandés, l'un après l'autre, est refusée. Chaque proposition est un match, et la même équipe peut proposer le suivant. Un jour où l'équipe cherche déjà ne reçoit pas d'autre offre : on modifie la sienne, depuis sa fiche, jusqu'à son jour (créneaux, salles, durée d'un match, nombre de matchs ; le jour reste). Les matchs déjà calés restent et comptent dans le nombre de matchs, qui en vise un de plus au moins ; leurs heures sortent de l'offre. Une proposition en attente dont l'offre ne tient plus toute la suite, à la durée demandée, est refusée ; les autres restent.
- *Menu des salles* : la salle d'affiliation toujours en tête, marquée « Affiliée », puis les favorites de l'équipe dans son ordre, puis le reste du réseau par ordre alphabétique, avec un champ de recherche (nom ou ville). Quatre salles au plus cochées à la fois (`SCRIM_SEARCH_VENUES_MAX`) : chacune est une soirée à lire chez eva.gg. Entrer en matchmaking coche la salle d'affiliation. Une étoile à côté d'une salle l'ajoute aux favorites de l'équipe ou l'en retire, et la liste se réordonne aussitôt : ce sont les favorites de la page Équipe, six au plus, que seuls ceux qui gèrent l'équipe changent (les autres voient les étoiles).
- *Couleur d'un jour* : on compte les joueurs disponibles (vert) et sous condition (jaune) ; non renseigné, vocal seul et rouge ne comptent pas. Quatre verts ou plus : vert. Quatre comptés ou plus dont au moins un jaune : jaune. Moins de quatre : rouge. Personne n'a rien renseigné : neutre, le silence n'est pas un non.
- *Cycle de vie* : recherche → proposition d'une autre équipe → acceptation ou refus par l'équipe qui cherche, sans fil de discussion (la salle a un Discord pour ça). L'acceptation crée le match (salle, arène, créneaux) dans les deux calendriers et refuse les propositions qui tombent à la même heure, où qu'elles soient ; la recherche se ferme, en refusant le reste, dès qu'elle a tous ses matchs ou que ses créneaux restants n'en tiennent plus un à une autre heure. N'importe qui peut réserver à la salle un créneau offert : proposer et accepter relisent la suite du match chez eva.gg et refusent un créneau qui n'est plus libre, et un passage serveur chaque heure retire de l'offre les créneaux pris depuis. Une recherche qui ne tient plus de match, ou dont le jour est passé, se ferme : comme appariée si elle a fait des matchs, comme expirée sinon. Un créneau accepté sur eva.gg se réserve ensuite comme aujourd'hui, et la vérification des 8 s'applique. Les créneaux d'un match calé sont tenus par ses joueurs : avec les seules données publiques on ne sait pas qui s'y inscrit, donc qu'ils se remplissent chez eva.gg ne déclenche rien, ni retrait, ni alerte. Un match calé s'annule depuis sa fiche, par l'une ou l'autre équipe, jusqu'à son jour : il quitte les deux calendriers, sa proposition est marquée annulée, une recherche encore ouverte retrouve son heure pour un autre match et une recherche close le reste. Autrement, son heure et son lieu ne changent pas : le calendrier refuse de le supprimer d'un seul côté ou de le déplacer ; son titre et sa description restent libres. Les réservations faites sur eva.gg s'annulent là-bas, l'application ne les voit pas.
- *Qui agit* (décidé le 2026-11-07) : trois permissions du matchmaking, que le chef d'équipe donne à chaque membre comme les autres. Chercher : ouvrir, modifier et retirer les recherches de l'équipe. Proposer : répondre à la recherche d'une autre équipe, et retirer sa proposition. Répondre : accepter ou refuser les propositions reçues, et annuler un match calé ; accepter met le match dans le calendrier sans demander la permission d'y créer des événements. Lire les recherches reste ouvert à tous les membres ; les salles favorites restent à ceux qui gèrent l'équipe. Le chef d'équipe a tout.
- *Portée* : toutes les équipes de l'application, filtrées par les salles cochées ; une offre dans plusieurs salles apparaît sous chacune. La recherche d'une équipe apparaît aussi dans son propre calendrier en mode Équipe, avec la même marque qu'en matchmaking, et reste visible en matchmaking quelles que soient les salles cochées.
- *Lire un jour en matchmaking* (décidé le 2026-11-05) : une place par information. Le fond dit si l'équipe peut jouer, le coin la dispo du lecteur, les lignes les autres équipes qui cherchent : l'heure et le nom, sans icône puisqu'elles sont toutes de la même sorte ; au-delà de la place, « +N équipes » ouvre la liste du jour. Le bas à gauche est à nous : la coche d'un jour sélectionné, ou notre recherche : la loupe 🔎 du bouton « Chercher un adversaire », dessinée exactement dans le carré de la coche, suivie sur la même ligne des heures que la recherche offre (« 16:40 – 22:00 », l'heure de début seule quand le jour est étroit, la loupe seule sur téléphone). Le nombre de propositions qui attendent notre réponse s'inscrit au centre de son verre. Un seul objet, le détail au survol. Pas de pastille de texte ni de bulles accolées dans la case. Un jour où l'on cherche déjà ne se sélectionne plus, un clic ouvre notre recherche. Nos événements et les renouvellements restent en mode Équipe : là où on choisit des heures, la fenêtre « Chercher un adversaire » et la fiche d'une recherche à laquelle on répond rappellent ce que l'équipe a déjà prévu ce jour-là (« Déjà prévu »).
- *Avant d'ouvrir une recherche* : un jour où d'autres équipes cherchent déjà aux heures cochées, dans la même salle, le dit dans la fenêtre (« Déjà en recherche aux mêmes heures ») : leur nom, leur salle et leurs plages, ce qu'elles veulent encore jouer, et un bouton « Leur proposer un match » (« Voir notre proposition » quand elle est partie) qui ouvre leur recherche par-dessus la fenêtre. Ce n'est pas bloquant : le jour part quand même. Ce qu'un match déjà calé a pris, ou qui est trop court pour un de leurs matchs, ne compte pas.
- *Prévenir* : notification dans l'application d'abord ; le courriel quand un fournisseur d'envoi existe (aucun aujourd'hui, le nom de domaine le conditionne) ; Discord et WhatsApp après, quand l'intégration existe. Rien ne part quand quelqu'un s'inscrit sur un créneau d'un match calé : ce sont ses joueurs (voir *Cycle de vie*).

- *Page publique par salle* : le tableau des recherches d'une salle se lit sans compte (nom et logo de l'équipe, jour, créneaux), pour être partagé sur le Discord de la salle et amorcer le marché. Proposer demande un compte et une équipe.

**Découpe (ordre de construction, ce qui reste).**

1. Prévenir : notification dans l'application (cloche dans la barre du haut) quand une proposition arrive, est acceptée ou refusée, quand une recherche reçoit un match, et quand l'autre équipe annule un match calé. Le courriel attend un fournisseur d'envoi, lui-même suspendu au nom de domaine : l'application n'envoie aucun mail aujourd'hui, même pas d'activation.
2. Page publique du tableau d'une salle.

---

## ✅ Terminé

### Feature : Annuler un match calé

**Périmètre livré** :
- Fiche d'un match du matchmaking : bouton « Annuler le match », pour qui a la permission Répondre, jusqu'au jour du match ; la confirmation rappelle que les réservations eva.gg s'annulent là-bas. `DELETE /api/scrims/matches/:eventId`, depuis la copie de l'une ou l'autre équipe ; un match dont le jour est passé reste dans les deux calendriers.
- Les deux copies quittent les calendriers et la proposition passe en `CANCELLED` (migration 0030). Une recherche encore ouverte retrouve l'heure du match pour un autre : l'équipe qui avait proposé y lit « Match annulé » et peut en refaire une. Une recherche close le reste.
- Le calendrier laisse un match du matchmaking à son annulation : le supprimer, ou changer son jour, ses heures, son type, sa salle, son arène ou ses créneaux, est refusé ; son titre et sa description restent libres. Le formulaire d'édition montre son lieu et son heure sans champ pour les changer, et sans bouton Supprimer.

### Feature : Les créneaux d'une recherche suivis dans le temps

**Périmètre livré** :
- Proposer un match vérifie que la suite est encore libre chez eva.gg, et accepter la relit avant de faire le match : une suite réservée depuis par quelqu'un d'autre est refusée (« Un des créneaux de ce match n'est plus libre »), la proposition refusée d'office à l'acceptation.
- Passage serveur toutes les heures (`scrim-upkeep.service.ts`, la première fois une heure après le démarrage du serveur) : une lecture eva.gg par salle et par jour portant des recherches ouvertes, une seconde entre deux lectures. Il retire de l'offre les créneaux qui ne peuvent plus accueillir un match (`refreshSearchOffer`) et refuse les propositions en attente sur eux ; ceux d'un match déjà calé restent, ses joueurs les réservent. Une recherche qui ne tient plus de match se ferme, et celles dont le jour est passé aussi, leurs propositions en attente refusées. Une salle qu'eva.gg ne donne pas laisse ses recherches comme elles sont jusqu'au passage suivant.
- Statut `EXPIRED` (migration 0029) : une recherche close sans match. Une close avec des matchs reste `MATCHED`.

### Feature : Permissions du matchmaking

**Périmètre livré** :
- Une catégorie `matchmaking` dans les permissions d'un membre : `canSearch`, `canPropose`, `canRespond` (voir *Qui agit*), à la place de la permission de créer des événements qui couvrait tout. Chaque route du matchmaking demande la sienne ; l'écran suit : sélection des jours et fenêtre de recherche, fiche d'une autre équipe (proposer, retirer sa proposition), fiche de la nôtre (modifier, retirer ; accepter, refuser), et l'encart des équipes déjà en recherche, qui dit « Voir leur recherche » à qui ne propose pas.
- Fenêtre des permissions d'un membre : une section « Matchmaking » entre « Calendrier » et « Équipe ».
- Les permissions gardées se lisent contre l'ensemble connu (`normalizeAccountPermissions`, `shared/utils`), à la lecture comme à l'enregistrement : une permission ajoutée depuis reste refusée jusqu'à ce que le chef d'équipe la donne, et rien d'inconnu n'est gardé. La fenêtre des permissions édite sa propre copie.

### Correctif : un créneau est une arène à une heure

**Périmètre livré** :
- L'identifiant de créneau d'eva.gg nomme une heure de la salle, le même sur chacune de ses arènes. Notre créneau (`VenueSlot.slotId`) est désormais cet identifiant suivi de l'arène (`arenaSlotId`, `eva-sessions.ts`) : dans une salle à plusieurs arènes, cocher une arène ne coche plus l'autre, le serveur vérifie la dispo de l'arène choisie et la garde, une recherche peut offrir les deux arènes d'une même heure, et une proposition se joue sur l'arène de sa suite.
- Migration 0028 : les identifiants déjà gardés (créneaux des recherches, suites des propositions, créneaux des matchs) prennent leur arène ; un match gardé sans arène est dans une salle d'une seule arène, le formulaire ne la notant que quand la salle en a plusieurs.

### Feature : Modifier une recherche ouverte

**Périmètre livré** :
- `PUT /api/scrims/searches/:id` (permission `canCreateEvents`, équipe de la recherche, recherche ouverte, jour à venir) : nouvelle offre relue chez eva.gg comme à l'ouverture, durée et nombre de matchs. Les matchs déjà calés restent : le nombre de matchs en vise un de plus au moins, et l'offre tient les suivants hors de leurs heures. Les propositions en attente que l'offre ne tient plus, à la durée demandée, sont refusées ; les autres restent. Les changements et les réponses sur une recherche passent un à un (verrou de ligne).
- Fiche d'une recherche : son jour dans l'en-tête, après ce qu'elle est (« Notre recherche · mercredi 25 novembre 2026 »), et ses matchs en une ligne, combien et de quelle durée (« 2 matchs de 1h20, 1 déjà calé »). Pour la nôtre, pas de nom d'équipe : l'offre se lit salle par salle comme dans la fenêtre de recherche, arène par arène, ses créneaux cerclés de blanc parmi ceux du jour, ceux des matchs calés notés « Match calé », sans rien à cliquer (`VenueSlotPicker` en lecture seule).
- Fiche de notre recherche : bouton « Modifier la recherche », jusqu'à son jour. Il ouvre la fenêtre de recherche sur ce seul jour, avec ses créneaux, sa durée et son nombre de matchs ; les salles de la recherche d'abord, puis celles cochées. Les matchs calés y sont rappelés et leurs heures ne comptent plus ; « Enregistrer ».
- Sélecteur de créneaux : un créneau coché se décoche toujours, même s'il ne peut plus accueillir un match (quelqu'un s'y est inscrit depuis).

### Feature : Lire un jour en matchmaking

**Périmètre livré** :
- Lignes d'un jour (`DayItems`) : en matchmaking, les autres équipes seules, heure et nom, par heure de début, le reste compté « +N équipes » ; nos événements et les renouvellements restent en mode Équipe, dans la case comme dans la liste du jour.
- Notre recherche est, dans les deux modes, la loupe 🔎 dans le carré de la coche de sélection (`OwnSearchMark`), le nombre de propositions en attente au centre de son verre, les heures de la recherche à sa suite sur la ligne que le jour lui garde ; dans la liste du jour, sa première ligne : la même loupe, l'heure, « Notre recherche », le nombre dans son rond vert (`PendingCount`). La loupe est le dessin Fluent Emoji de Microsoft (licence MIT, `THIRD_PARTY_NOTICES.md`), gardé en image pour être le même sur tous les systèmes. Un jour où l'on cherche ne se sélectionne plus : un clic ouvre notre recherche, dont la fiche s'intitule « Notre recherche ».
- « Déjà prévu » (`PlannedEventsNote`) : les événements de l'équipe ce jour-là, dans la fenêtre « Chercher un adversaire » et sur la fiche d'une recherche à laquelle on répond.
- `GET /api/scrims/searches?venueIds=` renvoie aussi les recherches de l'équipe dans les autres salles : un jour où elle cherche déjà se voit en matchmaking, et la fenêtre « Chercher un adversaire » le sait avant l'envoi.
- Fenêtre « Chercher un adversaire » : l'encart « Déjà en recherche aux mêmes heures » (`searchOverlap`, `client/src/utils/scrims.ts`), avec le bouton qui ouvre la recherche de l'autre équipe par-dessus la fenêtre, les créneaux cochés gardés au retour.
- Fenêtres empilées (`Modal`) : chacune s'ouvre au-dessus de celles déjà ouvertes, Échap ferme seulement celle du dessus, la page ne défile de nouveau qu'une fois la dernière fermée. Une confirmation ouverte depuis une fiche en profite aussi : Échap ne ferme plus la fiche avec elle.

### Feature : Jetons HP / HC et quota EVA Pass sur les créneaux

**Périmètre livré** :
- Chaque créneau dit le jeton qu'un abonné EVA Pass y dépense, HP (heures pleines) ou HC (heures creuses, bons plans compris), lu avec les créneaux dans le même appel à eva.gg (`VenueSlot.tokenType`). Les prix ne sont pas affichés : nos joueurs paient en jetons.
- Le quota du jour de la salle pour les abonnés (`VenueSlot.passQuotaLeft`, lisible sans compte) : une fois atteint, les créneaux en heures pleines restants disent « Quota HP atteint ». Ils ne se cochent plus pour un match ni pour une recherche (le serveur refuse aussi de les offrir) ; le formulaire de match les laisse choisir en le signalant.

### Feature : Chercher dans plusieurs salles à la fois, favorites en étoile

**Périmètre livré** :
- Menu des salles du matchmaking (`MatchmakingVenuePicker`, sur la liste partagée `VenueChecklist`) : salle d'affiliation en tête, favorites, puis le reste ; recherche par nom ou ville ; quatre salles cochées au plus ; une étoile par salle change les favorites de l'équipe (`PUT /api/teams/current`), la liste glisse vers son nouvel ordre. Le calendrier montre les recherches de toutes les salles cochées (`GET /api/scrims/searches?venueIds=`).
- Une recherche est l'offre d'une équipe pour un jour, dans une ou plusieurs salles : ses créneaux sont des lignes `ScrimSearchSlot` (migration 0027) avec leur salle, leur arène et leurs heures, et une proposition dit dans quelle salle elle se joue. Une seule recherche ouverte par équipe et par jour, prise sous un verrou sur l'équipe. Les recherches ouvertes avant la migration sont supprimées, leurs matchs restent dans les calendriers.
- Une équipe ne joue qu'un match à la fois : une offre compte ses matchs sans chevauchement, toutes arènes et salles confondues (`countMatches`, `shared/utils/scrim.utils.ts`) ; une proposition à l'heure d'un match déjà calé est refusée ; accepter refuse les propositions à la même heure. Ce qui comptait avant deux arènes à la même heure pour deux matchs.
- Fenêtre « Chercher un adversaire » : pour chaque jour, les créneaux de chaque salle cochée sous son nom ; le manque de matchs le dit (« deux matchs ne tombent jamais en même temps ») ; un jour où l'équipe cherche déjà le dit et ne part pas. Fiche d'une recherche : ses salles, les créneaux de chacune, une seule suite choisie à la fois ; une proposition dit sa salle quand l'offre en a plusieurs.

### Feature : Plusieurs matchs par recherche, offre cochée match par match

**Périmètre livré** :
- Fenêtre « Chercher un adversaire » : la durée d'un match (lue en temps, puis en créneaux) et le nombre de matchs se choisissent d'un clic, avec le sélecteur segmenté partagé par la barre du calendrier (`SegmentedControl`). Un clic coche les créneaux d'un match entier, décalés vers l'arrière quand la soirée s'arrête ; un clic sur un créneau coché le retire avec ce qui ne fait plus un match. Changer la durée garde ce qui fait encore des matchs entiers. Un jour dont l'offre ne tient pas tous les matchs dit ce qui manque et ne part pas.
- Sélecteur de créneaux partagé (`VenueSlotPicker`) : relief des jours du calendrier pour les créneaux qu'un match peut prendre, à plat pour les autres avec leur raison, « Plage trop courte » quand la suite ne tient pas un match, choix cerclé de blanc. Autant de créneaux par ligne que la place le permet, sur ordinateur comme sur téléphone : chaque colonne a la largeur du créneau le plus large que la liste peut afficher, mesurée dans la page, si bien que ni l'heure ni la raison ne sont jamais coupées. Un créneau montre son heure de début, comme une ligne du calendrier, la plage entière au survol. Dans le matchmaking, un créneau dit seulement s'il est libre : « Occupé » en gris dès qu'un joueur y est inscrit, sans compte ni couleur, et rien sur un créneau libre. Le compte des joueurs sur 8 (jaune, vert, rouge) reste au formulaire de match, pour vérifier sa propre réservation, et seulement sur les créneaux de notre jeu.
- Table `ScrimSearch` (migration 0026) : `matchCount` (bornes `SCRIM_MATCH_COUNT_MIN` / `MAX`). Les matchs que les créneaux restants tiennent encore se comptent sans relire eva.gg, depuis les créneaux offerts gardés avec leurs heures.
- Accepter une proposition crée un match ; la recherche se ferme quand elle a tous ses matchs ou plus la place d'en tenir un. Les réponses sur une même recherche passent une à une (verrou de ligne) : deux matchs ne se chevauchent jamais et ne dépassent pas le nombre demandé.
- Une recherche porte `matchCount`, `matchedCount` et `takenSlotIds` ; sa fiche dit combien de matchs elle cherche et combien sont calés, et grise « Heure déjà prise » les créneaux à l'heure de ses matchs.

### Feature : Proposer un match sur la recherche d'une autre équipe

**Périmètre livré** :
- Table `ScrimProposal` (migrations 0023, 0024 et 0027) : équipe qui propose, la salle et la suite de créneaux du match qu'elle veut jouer parmi ceux offerts (consécutifs, une arène, horaires relus chez eva.gg), mot facultatif (300 caractères au plus), statut en attente, acceptée, refusée ou retirée. Une équipe ne propose pas sur sa propre recherche et n'a qu'une proposition en attente par recherche.
- Accepter (équipe qui cherche, permission `canCreateEvents`) fait tout en une transaction : la recherche passe « appariée », les autres propositions en attente sont refusées, et un match « Scrim vs <équipe> » est créé dans les deux calendriers sur la suite de créneaux de la proposition. Les deux événements pointent la recherche d'origine (`CalendarEvent.scrimSearchId`). Refuser laisse la recherche ouverte ; retirer sa proposition la marque retirée.
- Visibilité : l'équipe qui cherche voit les propositions en attente sur sa recherche, chacune avec sa suite de créneaux ; une autre équipe ne voit que la sienne, avec ce qu'elle est devenue. Le badge d'une recherche de l'équipe compte les propositions en attente.
- Fiche d'une recherche : la durée du match affichée, sélecteur des créneaux limité à ceux offerts où un clic sur le créneau de départ prend la suite entière, bouton « Proposer un match » avec le mot facultatif, état de sa proposition et retrait ; côté chercheur, liste des propositions avec Accepter / Refuser. Routes `POST /api/scrims/searches/:id/proposals`, `PUT /api/scrims/proposals/:id/accept|decline`, `DELETE /api/scrims/proposals/:id`.
- Les créneaux d'une salle sont lus pour tous les jeux (`game.id` exposé dans `VenueSlot.gameId`) : un créneau pris par un autre jeu apparaît à sa place, grisé, au lieu de laisser un trou dans la soirée. Le sélecteur de créneaux partagé affiche tout et dit pourquoi un créneau ne se coche pas ; en mode offre, un bouton par arène coche ou décoche tout.

### Feature : Déclarer et voir les recherches de scrim dans le calendrier

**Périmètre livré** :
- En mode Matchmaking, qui peut créer des événements clique sur autant de jours qu'il veut (un jour rouge ou neutre s'accepte) ; une barre flottante compte la sélection et ouvre la fenêtre « Chercher un adversaire ». La sélection se vide quand le mois ou le mode change, ou qu'aucune salle ne reste cochée.
- La fenêtre liste, jour par jour, tous les créneaux de chaque salle cochée, seuls ceux qu'un match peut prendre se cochent (notre jeu, mode compétitif ouvert, personne d'inscrit), avec le rappel de l'état de l'équipe ce jour-là et un bouton « Tout sélectionner » par arène. Une recherche par jour coché ; un jour refusé par le serveur reste affiché avec la raison, les autres partent.
- Les recherches apparaissent dans les jours : celles de toutes les équipes dans les salles cochées en Matchmaking, avec les nôtres où qu'elles soient, celles de l'équipe seule en mode Équipe. Un clic ouvre le détail (équipe, jour, horaire, convocation, salles) ; une recherche de sa propre équipe s'y retire après confirmation.
- `VenueSlotPicker` partagé avec le formulaire de match : filtre « jouable seulement » et créneaux exclus en options.

### Feature : Recherches de scrim (données et API)

**Périmètre livré** :
- Table `ScrimSearch` (migrations 0022, 0025 et 0027) : équipe, jour, la durée du match en créneaux (`slotCount`, 2 par défaut, bornes `SCRIM_MATCH_SLOTS_MIN` / `MAX`), heures du premier créneau et du dernier, convocation du premier, statut `OPEN` ou `MATCHED` ; les créneaux offerts (toute salle, toute arène, pas forcément à la suite) dans `ScrimSearchSlot`. Une recherche retirée est supprimée. Supprimée avec l'équipe ; un créneau part avec sa salle.
- `POST /api/scrims/searches` (permission `canCreateEvents`) ne reçoit que le jour et, salle par salle, les identifiants de créneaux : le serveur relit les créneaux du jour chez eva.gg (cache partagé avec le formulaire d'événement) et en tire heures et arène. Refus : jour passé, créneau inconnu ce jour-là dans sa salle, créneau d'un autre jeu, créneau fermé au mode compétitif, créneau où quelqu'un est déjà inscrit, recherche déjà ouverte par l'équipe ce jour-là, salle non reliée à eva.gg.
- `GET /api/scrims/searches?month=` liste les recherches ouvertes de l'équipe ; avec `&venueIds=` (quatre salles au plus) s'y ajoutent celles des autres équipes qui offrent des créneaux dans une de ces salles, avec nom et logo d'équipe et le drapeau `isMine`. Les recherches de l'équipe restent listées où qu'elles soient : un jour où elle cherche déjà se voit dans toutes les vues. `PUT /api/scrims/searches/:id` modifie une recherche ouverte de sa propre équipe (voir *Modifier une recherche ouverte*). `DELETE /api/scrims/searches/:id` retire une recherche ouverte de sa propre équipe ; une recherche qui a trouvé un adversaire reste.
- `VenueSlot.isCompetitiveAvailable` exposé par la route des créneaux : la fenêtre de déclaration s'en servira pour ne proposer que les créneaux jouables.

### Feature : Mode Matchmaking du calendrier

**Périmètre livré** :
- Bascule « Équipe / Matchmaking » à côté de « Mois / Semaine ». En matchmaking, chaque jour est coloré par la capacité de l'équipe à aligner quatre joueurs (`assessTeamAvailability`, partagé : prêt, sous condition, vocal seulement, incomplet quand même les silencieux ne changeraient rien, ou neutre quand rien n'est acquis et que des joueurs n'ont pas répondu), la légende de la barre du haut suit, et l'édition des dispos personnelles est coupée. Clic sur un jour vide : rien pour l'instant, la sélection de jours vient avec les recherches.
- Menu des salles sous les bascules : la salle affiliée, puis les favorites, puis le reste du réseau, les salles non reliées à eva.gg écartées (`groupMatchmakingVenues`). À l'entrée en matchmaking, la salle affiliée est cochée.
- `TEAM_PLAYER_COUNT = 4` partagé ; `MATCH_PLAYER_COUNT` en découle.

### Feature : Salles favorites de l'équipe

**Périmètre livré** :
- L'équipe liste jusqu'à 6 salles favorites (`TEAM_FAVORITE_VENUES_MAX`), distinctes de la salle affiliée, dans l'ordre qu'elle choisit (table `TeamFavoriteVenue`, migration 0021, supprimée avec l'équipe ou la salle). Elles alimenteront l'accès rapide du sélecteur de salle du matchmaking.
- Réglées dans le formulaire d'édition de la page équipe (permission `canManageTeam`), par le même `PUT /api/teams/current` que le nom et la salle affiliée ; la liste envoyée remplace la précédente, une requête qui ne la mentionne pas la laisse intacte. Refus : liste mal formée, plus de 6, salle inconnue.
- Case à cocher de salles extraite en composant partagé `VenueChecklist` (liste défilante, plafond optionnel), branché sur la page équipe et sur l'écran d'administration des managers qui avait la sienne.

### Feature : Logo d'équipe

**Périmètre livré** :
- Image envoyée depuis la page équipe par qui gère l'équipe, gardée en base (migration 0020, colonne binaire + type + date), donc insensible aux redéploiements. PNG, JPEG ou WebP, 256 Ko au plus ; le serveur lit la signature du fichier, jamais l'extension ni le type annoncé. Pas d'URL distante : une image hébergée ailleurs peut disparaître, changer, ou pister qui consulte la page.
- Routes `PUT` / `DELETE /api/teams/current/logo` (permission `canManageTeam`) et `GET /api/teams/:id/logo` (publique, chargée par `<img>`, cache long : l'URL change à chaque envoi).
- Les octets ne sont jamais chargés par les autres requêtes sur les équipes (omission globale Prisma). L'ancienne colonne texte `logo`, qu'aucun écran n'alimentait, est supprimée.
- Affiché sur la page équipe (avec initiales en attendant) et dans la barre du haut.

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
| Découper `EventFormModal.vue` | ⬜ | Plus de 950 lignes : extraire la vue lecture seule et les champs de lieu (salle, arène, créneau) en sous-composants. |
| `POST /api/teams` ignore `venueId` | ⬜ | La salle passée à la création n'est pas enregistrée ; elle ne se pose qu'ensuite depuis la page équipe. Soit l'accepter, soit la retirer du contrat. |
| Barre du haut du calendrier trop large entre 769 et ~1000 px | ⬜ | Les deux légendes et les boutons ne tiennent pas : à 900 px de large, la légende d'équipe passe sur deux lignes et le bouton du compte sort de l'écran. Relevé en vérifiant le calendrier à toutes les largeurs. |
| Symboles du coin d'un jour trop bas sur petit écran | ⬜ | La coche et la croix sont des caractères de police dont le dessin est décalé vers le bas : à 768 px et moins, ils tombent environ 2 px sous le centre du triangle (mesuré), le micro, une icône dessinée, tombe juste. Les remplacer, avec le tilde et le point d'interrogation, par des icônes dessinées changerait un peu leur dessin. |
| Les tests ne passent pas la vérification de types | ⬜ | `vue-tsc -p tests/tsconfig.json` relève une quarantaine d'erreurs, toutes dans des tests anciens : jours sans `renewals`, créneaux sans `isCompetitiveAvailable`, salles incomplètes, `userId` dans `PlayerAssignment`, `UserPermissions` disparu, alias `@routes` et `@utils` inconnus de ce tsconfig. Vitest ne vérifie pas les types, donc rien ne casse, mais les fixtures dérivent des types sans que personne le voie. Les corriger, puis brancher cette vérification avec les autres. |

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
