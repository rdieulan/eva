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
128 × 128 px, de 14 à 31 Ko pour les trois équipes lues, en 0,3 s au plus.

On ne croit ni le type ni la taille annoncés : l'image est lue au plus 256 Ko, et gardée
seulement si ses premiers octets sont ceux d'un PNG, d'un JPEG ou d'un WebP.

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
| `server/src/integrations/competitive/competitive-teams.ts` | une page de la liste ; un logo, taille plafonnée et type vérifié sur l'image |
| `server/src/services/league-directory.service.ts` | l'annuaire : relecture de nuit, recherche, copie des logos |
| `npm run db:sync-league-teams` | relit la liste tout de suite (base neuve, développement) |
| `tmp-eva-probe/competitive/` | copie locale de leurs pages, référence hors ligne |
