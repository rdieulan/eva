# competitive.eva.gg — ce qu'on en sait

competitive.eva.gg est le site des ligues d'eva.gg : inscriptions, tournois, équipes. C'est
un site de la plateforme Toornament, où l'on se connecte avec son compte eva.gg. On s'en
sert pour l'annuaire des équipes de ligue, où un joueur retrouve son équipe par son nom
(la règle produit : *Annuaire des équipes de ligue* dans `docs/PRODUIT.md`).

**Source de vérité : le code de leurs pages**, copié en local dans `tmp-eva-probe/competitive/`
(ignoré par git) : la page d'une équipe et le script de leurs pages (`site-viewer.js`).

**Règle : on ne sonde pas le site en live**, comme pour eva.gg (`docs/EVA_API.md`). Pas de
balayage d'adresses, pas d'identifiants devinés, pas de requêtes répétées : un appel public
ciblé, quand il est indispensable. En production, le serveur relit la liste des équipes une
fois par nuit ; en développement, il ne l'appelle jamais de lui-même.

Chaque point est marqué **[vérifié]** (observé en live) ou **[lu dans leurs pages]** (déduit
de leur code, non confirmé par un appel).

---

## Liste des équipes — `GET /api/teams?discipline=after_humanity` **[vérifié le 2026-11-09]**

| Élément | Valeur |
|---|---|
| Adresse | `https://competitive.eva.gg/api/teams?discipline=after_humanity` |
| Pagination | `offset` (rang de la première équipe, à partir de 0) et `limit` (50) dans l'adresse, comme le font leurs pages ; sans eux, les 50 premières. La liste entière se lit en 24 pages |
| Jeton | aucun |
| Réponse | `200`, JSON `{ items, range: { offset, length, total } }` |

Une équipe : `{ id, name, discipline, playerOwner: { id }, logo: { id } | null, memberCount }`.

- `id` : un nombre de 19 chiffres, écrit en texte ; il dépasse ce qu'un nombre JavaScript
  tient exactement, on le garde en texte.
- `name` : texte libre, parfois avec des espaces aux bouts.
- `logo.id` : change avec chaque nouveau logo de l'équipe ; c'est lui qui périme notre copie.
- `playerOwner` : le compte qui a créé l'équipe. On ne le garde pas.
- Ordre : les plus anciennes d'abord (identifiants croissants sur la page lue).
- 1 163 équipes au 2026-11-09, dont 869 avec un logo. Des noms reviennent : deux équipes
  « RONIN » de 5 membres, chacune avec son logo.
- Pas de recherche par nom : le paramètre `search` n'existe que pour les circuits, les
  tournois et les disciplines **[lu dans leurs pages]**. D'où notre copie de la liste.
- L'en-tête `Range: teams=<début>-<fin>` est ignoré : chaque appel rend alors les 50
  premières équipes **[vérifié le 2026-11-09]**. Leur code sait écrire cet en-tête, mais
  ses listes passent par `offset` et `limit`.
- La réponse dit d'où elle part (`range.offset`) : une réponse qui ne part pas du rang
  demandé est refusée, pour qu'un changement de pagination chez eux ne passe jamais pour
  une liste réduite à ses premières équipes.

Les membres d'une équipe ont leur propre adresse, `/api/teams/{teamId}/members` **[lu dans
leurs pages]**. On ne l'appelle pas : l'annuaire ne garde pas qui joue dans une équipe.

---

## Logo d'une équipe — `GET /api/teams/{teamId}/logo/{format}` **[vérifié le 2026-11-09]**

Adresse déclarée par leurs pages (`toornament.repository.team_logo.show_format_url`), sans
jeton. Formats : `logo_small` (64 px), `logo_medium` (128 px), `logo_large` (256 px), et
`icon_small` (16 px), `icon_medium` (32 px). L'annuaire montre `logo_medium` : un PNG de
128 × 128 px, de 14 à 31 Ko pour les trois équipes lues, en 0,3 s au plus. Une de nos équipes créée
ou reliée depuis l'annuaire prend `logo_large`, lu une fois et gardé avec elle.

On ne croit ni le type ni la taille annoncés : l'image est lue au plus 256 Ko, et gardée
seulement si ses premiers octets sont ceux d'un PNG, d'un JPEG ou d'un WebP.

---

## Tournois d'une équipe — `GET /api/tournaments?team_id={teamId}` **[vérifié le 2026-11-10]**

| Élément | Valeur |
|---|---|
| Adresse | `https://competitive.eva.gg/api/tournaments?team_id={teamId}&sort=scheduled_desc&offset=0&limit=10` |
| Tri | `sort` : `scheduled_desc` (les plus récents d'abord), `scheduled_asc`, `created_desc`, `created_asc` **[lu dans leurs pages]** |
| Jeton | aucun |
| Réponse | `200`, JSON `{ items, range }` |

Un tournoi porte son nom, ses dates (`scheduledDateStart`, `AAAA-MM-JJ`), son circuit,
sa saison et sa région. Les ligues locales forment le circuit « LOCAL LEAGUES », une
région par salle : la région porte le nom de la salle (`NÎMES`) et un nom court
(`machineName` : `nimes`), qui est l'adresse de notre salle. Le lieu du tournoi
(`location`) est vide. Les 7 tournois de RONIN sont la ligue de Nîmes, un par mois
(« NEMAUSUS LEAGUE - NOVEMBRE »).

La salle d'une équipe de ligue se lit donc dans la région de son tournoi le plus
récent joué dans une de nos salles : rapprochée par le nom court, sinon par le nom.

Une équipe figure parmi les tournois auxquels elle est inscrite : RONIN figure dans
celui de novembre, ouvert aux inscriptions. Un tournoi absent de sa liste est un mois
où elle n'est pas inscrite. Une inscription en attente de validation par l'organisateur
(les inscriptions passent par `pending`, `accepted`, `refused`, `cancelled` **[lu dans
leurs pages]**) n'y figure sans doute qu'une fois acceptée **[jamais observé]**.

---

## Mois d'une ligue — `GET /api/tournaments?circuit_region_ids={regionId}` **[lu dans leurs pages]**

Le même appel, filtré sur une région au lieu d'une équipe :
`/api/tournaments?circuit_region_ids={regionId}&sort=scheduled_desc&offset=0&limit=3` donne
les derniers mois d'une ligue locale, dont le prochain dès qu'il est publié.

Chaque mois est un tournoi avec sa propre inscription **[vérifié le 2026-11-10]** :

| Champ | Valeur |
|---|---|
| `registrationStatus` | `pending` (pas encore ouverte), `open`, `finished` |
| `registrationOpeningDatetime` | environ une semaine avant le mois (le 24 octobre pour novembre) |
| `registrationClosingDatetime` | variable : le 13 pour avril, le 26 pour octobre, le 30 pour novembre ; souvent minuit, heure de Paris |
| `size` | 15 ou 16 équipes ; `teamMinSize` 4, `teamMaxSize` 7 |

L'inscription se fait sur la page du tournoi :
`https://competitive.eva.gg/fr/tournaments/{tournamentId}/registration` **[lu dans leurs pages]**.

---

## Matchs — `GET /api/matches` **[vérifié le 2026-11-10]**

| Élément | Valeur |
|---|---|
| Adresse | `https://competitive.eva.gg/api/matches?tournament_ids={tournamentId}&team_id={teamId}&sort=scheduled_asc&offset=0&limit=50` |
| Jeton | aucun |
| Réponse | `200`, JSON `{ items, range: { offset, length, total } }` |
| Filtres | `tournament_ids`, `team_id`, `participant_ids`, `stage_ids`, `group_ids`, `round_ids`, `circuit_region_ids`, `is_scheduled`, `statuses` **[lu dans leurs pages]** |
| Tri | `sort` : `structure`, `scheduled_asc`, `scheduled_desc`, `latest_results` **[lu dans leurs pages]** |

Le filtre `team_id` rend les matchs d'une équipe, alors que ses adversaires y sont nommés
par leur participation au tournoi, un autre identifiant que celui de l'équipe.

**Un mois de ligue** (RONIN en octobre, lu le 2026-11-10, gardé dans
`tmp-eva-probe/competitive/matches-ronin-2026-10/`) :

- une phase (`stage`) par mois, du nom du mois (« NEMAUSUS LEAGUE - OCTOBRE 26 ») :
  12 équipes, en 3 groupes de 4 ;
- chaque groupe est une division : « Division 2 » ; chacun y joue les trois autres, un
  tour (`round`) par adversaire, « Day 1 » à « Day 3 » ;
- un match se joue en 3 manches au plus ; il rapporte 3 points gagné, 1 nul, 0 perdu ;
- `scheduledDatetime` est vide : aucun match n'est programmé à une date ;
- `playedAt` semble être l'heure où le résultat a été saisi : deux matchs à une minute
  d'écart le 26/10 vers 17:53, le jour où l'inscription d'octobre fermait, et un forfait
  saisi le 15/10 ;
- chaque adversaire porte son `score`, son `result` (`win`, `loss`) et `forfeit` ; une
  équipe qui a déclaré forfait n'a plus d'équipe (`participant` vide).

La division d'une équipe se lit donc sur un mois déjà tiré. Le 10 novembre, RONIN n'a aucun
match dans le tournoi de novembre : le tournoi n'a pas commencé (`status` `pending`) et
son inscription reste ouverte jusqu'au 30. Les divisions d'un mois ne se lisent qu'une fois
ses matchs créés, sans doute à la clôture de son inscription.

La structure d'un tournoi a ses propres listes, filtrées par `tournament_ids` :
`/api/stages`, `/api/groups` (aussi par `stage_ids`) et `/api/rounds`.

Les dates d'un mois ne disent pas son jour de match **[vérifié le 2026-11-10]** : la fin du
tournoi tombe le jour où son inscription ferme en mai (25/05), juillet (27/07), septembre
(30/09) et novembre (30/11), mais pas en avril (fermeture le 14/04, fin le 30/04), juin
(03/06, 22/06) ni octobre (26/10, 31/10).

---

## Classements et participants **[lu dans leurs pages]**

Leurs pages déclarent aussi, hors de `/me/` : le classement de chaque phase ou groupe
(`/api/ranking-items`), le classement final d'un tournoi (`/api/standing-items`), le
classement d'une saison du circuit (`/api/circuit-rankings`, `/api/circuit-ranking-items`)
et les participants d'un tournoi (`/api/participants`). Jamais appelés. Le classement d'une
division dirait la place d'une équipe à la fin d'un mois ; la division où elle joue le mois
suivant reste la décision de l'organisateur, qui répartit les équipes en créant le mois.

---

## Fiche d'un tournoi — `GET /api/tournaments/{tournamentId}` **[lu dans leurs pages]**

En plus de ce que donne la liste : ses textes, par langue, écrits par l'organisateur, la
description, le programme (`schedule`), le règlement (`rules`) et les récompenses
(`prize`). Le programme peut dire les jours de chaque division : lisible par un joueur, pas
une donnée que l'app peut lire de façon sûre.

---

## Ce qui n'est pas public

- **Les équipes d'un joueur.** Rien de public ne relie un compte eva.gg à ses équipes : un
  joueur peut nommer n'importe quelle équipe de l'annuaire. Le prouver demanderait qu'il se
  connecte avec son compte eva.gg chez nous, un accès à obtenir d'eva.gg.
- **Une recherche par nom ailleurs.** L'API officielle de Toornament cherche les
  participants par nom, mais demande une clé, ne donne pas les logos, et sa version
  actuelle est annoncée en fin de vie.

---

## Outillage

| Élément | Rôle |
|---|---|
| `server/src/integrations/competitive/competitive-teams.ts` | une page de la liste ; un logo, taille plafonnée et type vérifié sur l'image ; les tournois d'une équipe, d'une ligue |
| `server/src/services/league-directory.service.ts` | l'annuaire : relecture de nuit, recherche, copie des logos, salle d'une équipe de ligue |
| `server/src/services/league-registrations.service.ts` | les inscriptions de nos équipes reliées à leur ligue locale, et leurs rappels |
| `npm run db:sync-league-teams` | relit la liste tout de suite (base neuve, développement) |
| `npm run db:check-league-registrations` | relit tout de suite les inscriptions (développement) |
| `tmp-eva-probe/competitive/` | copie locale de leurs pages, référence hors ligne |
