# EVA - Roadmap

## 📋 Prochaines étapes

### 🔐 Gestion d'équipe et permissions (en cours)

**Phase 1 : Schema et types** ✅
- [x] Table `Team` dans Prisma (name, logo, location, leaderId)
- [x] Champ `permissions` JSON sur `User`
- [x] Champ `teamId` sur `User`
- [x] Supprimer le champ `role` et l'enum `Role`
- [x] Types TypeScript (`UserPermissions`, `Team`, etc.)

**Phase 2 : Migration et API** ✅
- [x] Régénérer le client Prisma
- [x] Middleware `requirePermission` pour permissions granulaires
- [x] Mise à jour routes calendar (canCreateEvents, canEditEvents, etc.)
- [x] Mise à jour routes maps (canEdit, canCreate)
- [x] Mise à jour routes plans (canEdit, canDelete)
- [x] Mise à jour routes users (canManagePermissions)
- [x] Migration Prisma 0003_add_teams_and_permissions
- [x] Route API : CRUD Team (`/api/teams`)
- [x] Route API : Gestion permissions (`/api/teams/:id/permissions`)

**Phase 3 : Refactoring permissions côté client** ✅
- [x] Refactor `useAuth.ts` pour utiliser les nouvelles permissions
- [x] Remplacer les checks `isAdmin` par des checks granulaires
- [x] Adapter CalendarPage et PlannerPage
- [x] Adapter ProfilePage

**Phase 4 : Interface de gestion d'équipe** ✅
- [x] Page `TeamPage.vue` pour gérer l'équipe
- [x] API client teams (`teams.api.ts`)
- [x] Composant d'édition des infos équipe (nom, localisation)
- [x] Composant de gestion des membres
- [x] Composant d'édition des permissions par membre
- [x] Bouton équipe dans DynamicTopBar
- [x] Route `/team` dans le router

**Phase 5 : Tests et finalisation**
- [ ] Tests unitaires permissions
- [ ] Tests API équipe
- [ ] Documentation

---

## 📦 Documentation

- `docs/CODE_RULES.md` - Règles et conventions de code

---

## 🔄 Dernière mise à jour

**Date** : 2026-01-22
