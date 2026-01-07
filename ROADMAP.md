# EVA - Roadmap

## 🎯 Objectif actuel : Nouvelles fonctionnalités

---

## 📋 Prochaines étapes

### À venir
- [ ] Page Calendrier
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
```

---

## 🔄 Dernière mise à jour

**Date** : 2026-01-07
**Status** : Déploiement Railway réussi ✅

