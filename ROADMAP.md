# EVA - Roadmap

## 🎯 Objectif actuel : Page Calendrier

Mise en place d'un calendrier partagé permettant aux joueurs de renseigner leurs disponibilités et aux admins de créer des événements.

---

## 📅 Calendrier de disponibilités - Plan d'implémentation

### Fonctionnalités cibles

1. **Disponibilités joueurs** : Chaque utilisateur peut renseigner sa disponibilité par jour
   - Code couleur : Gris (non-renseigné) / Vert (disponible) / Rouge (indisponible)
   
2. **Aperçu équipe** : Vue rapide des disponibilités de tous les joueurs
   - Mini-avatars/initiales colorées par joueur dans chaque cellule
   
3. **Événements** (Admin) : Création d'événements sur le calendrier
   - Types : MATCH (orange) / EVENT (bleu)
   - Avec heure de début et fin

### Étapes d'implémentation

- [x] **Étape 1** : Schéma de données (Prisma) ✅
  - Modèle `Availability` (userId, date, status)
  - Modèle `CalendarEvent` (date, startTime, endTime, type, title, description, createdBy)

- [x] **Étape 2** : Routes API backend ✅
  - `GET /api/calendar/availability?month=YYYY-MM` - Récupérer les disponibilités du mois
  - `POST /api/calendar/availability` - Définir sa disponibilité
  - `GET /api/calendar/events?month=YYYY-MM` - Récupérer les événements du mois
  - `POST /api/calendar/events` - Créer un événement (Admin)
  - `DELETE /api/calendar/events/:id` - Supprimer un événement (Admin)

- [x] **Étape 3** : Types partagés ✅
  - `shared/types/calendar.types.ts` : AvailabilityStatus, Availability, CalendarEvent, DayData

- [x] **Étape 4** : API client ✅
  - `client/src/api/calendar.api.ts` : fetchMonthData(), setAvailability(), createEvent(), deleteEvent()

- [x] **Étape 5** : Composant CalendarGrid ✅
  - Grille mensuelle avec navigation (mois précédent/suivant)
  - Affichage des semaines et jours

- [x] **Étape 6** : Composant DayCell ✅
  - Pastille cliquable pour la dispo de l'utilisateur courant
  - Mini-avatars colorés pour l'aperçu équipe
  - Badges d'événements (MATCH=orange, EVENT=bleu)

- [x] **Étape 7** : Composant Modal réutilisable ✅
  - Composant générique pour les modales de l'application
  - Utilisé pour la création d'événements

- [x] **Étape 8** : Page CalendarPage ✅
  - Intégration de CalendarGrid
  - Gestion du state (mois courant, données)
  - Modale de création d'événement pour les admins

- [x] **Étape 9** : Plan de jeu pour les MATCH ✅
  - Bouton "Définir plan de jeu" dans le formulaire de MATCH (admin)
  - Intégration du RotationCalculator en mode "associate"
  - Stockage du plan de jeu en JSON dans la base de données
  - Affichage du plan de jeu dans la vue utilisateur (readonly)
  - Route API `PUT /api/calendar/events/:id/gameplan`

---

## 📋 Prochaines étapes (après Calendrier)

- [ ] Multi-language support (i18n)
- [ ] UI Multi-plans (plusieurs plans de jeu par map)

---

## 📦 Structure du projet

Voir `docs/STRUCTURE.md` pour la documentation complète.

---

## 📊 Structure de la base de données

```prisma
model Map {
  id        String     @id           // ex: "artefact"
  name      String                   // ex: "Artefact"
  images    Json       @default("[]")
  template  Json                     // { assignments: [...] }
  gamePlans GamePlan[]
}

model GamePlan {
  id          String   @id @default(cuid())
  name        String                   // ex: "Défense standard"
  mapId       String
  assignments Json                     // Array of Assignment objects
  players     GamePlanPlayer[]
}

model GamePlanPlayer {
  id            String   @id @default(cuid())
  gamePlanId    String
  userId        String
  assignmentIds Int[]    // ex: [1, 3]
}

// === Calendrier (à implémenter) ===

model Availability {
  id        String   @id @default(cuid())
  userId    String
  date      DateTime @db.Date          // Date sans heure
  status    AvailabilityStatus

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([date])
}

enum AvailabilityStatus {
  AVAILABLE
  UNAVAILABLE
}

model CalendarEvent {
  id          String        @id @default(cuid())
  date        DateTime      @db.Date
  startTime   String                    // Format "HH:mm"
  endTime     String                    // Format "HH:mm"
  type        EventType
  title       String
  description String?
  createdById String
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  createdBy User @relation(fields: [createdById], references: [id])

  @@index([date])
}

enum EventType {
  MATCH
  EVENT
}
```

---

## 🔄 Dernière mise à jour

**Date** : 2026-01-07
**Status** : Déploiement Railway réussi ✅

