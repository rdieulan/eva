# API eva.gg — ce qu'on en sait

eva.gg est l'opérateur des salles où jouent nos équipes. Son API GraphQL sert notre
liste de salles et le lien entre un joueur et son compte eva.gg. Ce document consigne
ce que l'on a établi, pour ne pas avoir à le redécouvrir.

**Source de vérité : le bundle de leur application web** (`app.eva.gg`), copié en local
dans `tmp-eva-probe/` (ignoré par git). Toutes les formes de requêtes ci-dessous en
sont tirées. L'introspection du schéma est désactivée côté serveur.

**Règle : on ne sonde pas l'API en live.** Pas de balayage d'opérations, pas
d'identifiants devinés, pas de requêtes répétées pour tester l'authentification : leur
protection bloque l'appelant. On conçoit depuis le bundle, hors ligne. Au plus un appel
public ciblé sur nos propres données quand c'est indispensable.

Chaque point est marqué **[vérifié]** (observé en live ou en production chez nous) ou
**[lu dans le bundle]** (déduit de leur code, non confirmé par un appel).

---

## Accès

| Élément | Valeur |
|---|---|
| Endpoint | `POST https://api.eva.gg/graphql` |
| Header obligatoire | `origin: https://app.eva.gg` — sans lui, 403 **[vérifié]** |
| Authentification | `authorization: Bearer <jeton>` ; jetons émis par Keycloak (`https://auth.eva.gg/realms/eva`) |
| Sans jeton | les opérations publiques répondent ; les autres renvoient le code `UNAUTHENTICATED` **[vérifié]** |

Le client partagé est `server/src/integrations/eva/eva-graphql.ts`. Toute requête vers
eva.gg passe par lui. Les jetons de joueurs ne sont jamais demandés : les données
privées seront lues, plus tard, avec un compte dédié dont le jeton vivra en variable
d'environnement.

---

## Identité d'un joueur

Un compte eva.gg porte deux noms **[lu dans le bundle, recoupé avec l'interface]** :

| Champ | Exemple | Nature |
|---|---|---|
| `displayName` | `Sib` | Texte libre, non unique |
| `username` | `Sib#202617` | Tag complet avec suffixe, unique à un instant donné |
| `user.id` | entier | Identifiant stable, clé de toutes les données de réservation |

Quand le joueur renomme son `displayName`, eva.gg lui attribue un **nouveau tag** avec un
nouveau suffixe (`RONxSib` → `RONxSib#177352`). Le tag n'est donc pas une clé durable :
on stocke `user.id` (`Player.evaUserId`) et le tag au moment du lien (`Player.evaUsername`),
pour l'affichage.

Le joueur lit son tag sous son pseudo sur sa page « Mon compte » d'eva.gg. C'est ce tag
complet qu'il saisit dans son profil chez nous.

---

## Opérations publiques (sans jeton)

### `getPublicPlayerByUsername(username: String!)` — pseudo → identité **[vérifié]**

Prend le tag complet. Champs lus dans le bundle (fragments `PlayerFields`,
`PlayerUserFields`, `ProfileUser`) :

```graphql
getPublicPlayerByUsername(username: $username) {
  id                                   # id de l'entité Player (clé de stats, pas d'identité)
  user { id username displayName }     # user.id = identifiant stable
  seasonPass { active }                # season pass du jeu (cosmétique), oui/non
  experience(seasonId: $seasonId) {    # niveau de saison
    level experience experienceForCurrentLevel experienceForNextLevel
    levelProgressionPercentage seasonId
  }
  battleArenaStatistics(seasonId: $seasonId) { data {
    gameTime winRate killDeathRatio gameCount killsAverage kills deaths assists
    bestKillStreak mvpCount traveledDistance
  } }
  moonOfTheDeadStatistics(seasonId: $seasonId) { data { ... } }
  colorChaosStatistics { ... }
}
```

Le champ `SeasonPass.id` n'existe pas **[vérifié]**.

Refus possibles, portés par `errors[].extensions.code` **[lu dans le bundle]** :

| Code | Sens | Chez nous |
|---|---|---|
| `USER_NOT_FOUND` | aucun compte avec ce tag | 404, « Aucun joueur eva.gg avec ce tag » |
| `PRIVATE_USER_PROFILE` | le joueur a réglé son profil en privé (`setUserIsPublic`) | 422, « Ce profil eva.gg est privé » |

Un `data.getPublicPlayerByUsername` à `null` est traité comme « introuvable ».

### `listLocations(country: CountryEnum!)` — salles **[vérifié, en prod]**

Utilisé par `npm run db:sync-venues`. Voir `server/src/integrations/eva/eva-locations.ts`.

### `listSeasons` — saisons **[lu dans le bundle]**

```graphql
listSeasons { nodes { id from to seasonNumber active status name } itemCount }
```

Sert à connaître la saison courante pour interroger `experience` et les statistiques.

### `listLocationGameSessionsByDate(data: ListLocationSessionsByDateInput!)` — créneaux **[lu dans le bundle]**

Public d'après le bundle : le hook qui l'appelle ne se désactive que si la salle ou la date
manque, alors que les hooks de données personnelles se désactivent explicitement hors
connexion, et la page `/booking/calendar` qui l'utilise est ouverte aux visiteurs. Non
confirmé par un appel.

Entrée observée :

```graphql
data: {
  date: "YYYY-MM-DD",
  locationId: Int,
  seatCount: Int!,            # obligatoire [vérifié]
  seatTypes: ["Player"],
  isCompetitiveModeOnly: Boolean,
  gameIdList: [Int]           # omis quand vide
}
```

Sortie (extrait) : `takenSeatCount totalSeatCount availableSeatCount unitPrice currency
pricingType matchmakingLevel slot { id startTime convocationTime localDatetime duration }
terrain { id displayNumber } game { id identifier name minPlayer maxPlayer }`.

Piste pour les scrims : lire les créneaux libres d'une salle à une date.

### Probablement publics **[lu dans le bundle, non confirmé]**

Utilisés par les pages de profil public avec un `userId` :

- `listLastAfterhGameHistoriesByUserAndSeason(userId, seasonId, game)` : derniers matchs
  (date, mode, joueurs avec `userId`, issue, kills).
- `colorChaosGameHistoriesByUser(userId, limit)`.

---

## Opérations authentifiées (jeton requis) **[vérifié : `UNAUTHENTICATED` sans jeton]**

| Opération | Portée | Intérêt pour nous |
|---|---|---|
| `me` | le compte du jeton | identité du compte dédié |
| `getPlayerByUserId(userId: Int!)` | n'importe quel joueur | même champs que la version publique, profils privés compris |
| `bookings(userId: Int!, page: Int)` | réservations d'un joueur, paginées | **vérifier qu'un joueur est inscrit à un créneau** ; champs listés dans `scripts/eva-probe-me.ts` (`BOOKING_FIELDS`) |
| `myOrders(page: Int!)` | commandes du compte du jeton | — |
| `myBattlepass` | EVA Pass du compte du jeton | — |
| `user(username)`, `users(...)`, `searchUsers`, `battlepasses(username)` | écrans staff | hors de portée |

### Ce qui n'est pas public

L'**EVA Pass** (abonnement payant), que l'API appelle `Battlepass` : palier
(`subscriptionPlan.plan`), `active`, `expiredAt`, `renewalEnabled`, `memberFrom`,
`nextPaymentAttempt`. Lisible uniquement par le titulaire (`myBattlepass`) ou le staff.
Le palier et la date de renouvellement restent donc saisis à la main dans le profil.

Les réservations et sessions à venir d'un joueur ne sont pas publiques non plus.

---

## Codes d'erreur rencontrés dans le bundle

`UNAUTHENTICATED`, `FORBIDDEN`, `BAD_USER_INPUT`, `USER_NOT_FOUND`,
`PRIVATE_USER_PROFILE`, `USER_ACCOUNT_NOT_VALIDATED`, `USER_ACCOUNT_CLOSED`,
`LOCATION_NOT_FOUND`.

---

## Outillage

| Élément | Rôle |
|---|---|
| `server/src/integrations/eva/eva-graphql.ts` | client partagé, erreurs typées (`EvaApiError.hasCode`) |
| `server/src/integrations/eva/eva-players.ts` | résolution tag → identité |
| `server/src/integrations/eva/eva-locations.ts` | salles |
| `scripts/eva-probe-me.ts` (`npm run eva:probe-me`) | **en réserve** : lecture des données privées d'un compte dont on a le jeton (`EVA_TOKEN`). À réveiller avec le compte dédié. |
| `tmp-eva-probe/` | copie locale du bundle, référence hors ligne |
