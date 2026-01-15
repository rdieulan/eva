# EVA - Roadmap

## 📋 Prochaines étapes

### 🔧 Refactorisation & Nettoyage ✅

#### Étape 1 : Correction des incohérences de nommage camelCase ✅
- [x] `visibleplayerId` → `visiblePlayerId` dans calendar.types.ts
- [x] Mise à jour dans RotationCalculator.vue
- [x] Mise à jour dans EventFormModal.vue
- [x] Mise à jour dans EventViewerModal.vue
- [x] Mise à jour dans GamePlanTable.vue
- [x] Mise à jour dans les fichiers de tests

#### Étape 2 : Séparation types/fonctions dans shared/ ✅
- [x] Créer `shared/utils/map.utils.ts` pour les fonctions helper
- [x] Déplacer `getZoneForPhase`, `isLegacyAssignment`, `migrateAssignmentToPhases`, `migrateMapConfigToPhases` depuis map.types.ts
- [x] Mettre à jour les imports dans tout le projet (réexport depuis shared/types/index.ts)
- [x] map.types.ts ne contient QUE des types/interfaces/constantes

#### Étape 3 : Vérification des conventions de langue ✅
- [x] Messages utilisateur final → restent en français (balance.service.ts OK)
- [x] Code, commentaires, variables, fonctions, logs de debug → anglais

#### Étape 4 : Nettoyage du dossier client/src/types ✅
- [x] client/src/types/index.ts ne fait que réexporter depuis @shared/types
- [x] Aucun type dupliqué

#### Étape 5 : Vérification et tests ✅
- [x] Lancer tous les tests (137 tests passent)
- [x] Vérifier le build (OK)
- [x] Aucune erreur

#### (Optionnel - Plus tard) Découpage des gros composants
- [ ] MapViewer.vue (1405 lignes)
- [ ] RotationCalculator.vue (989 lignes)
- [ ] CalendarPage.vue (826 lignes)
- [ ] PlannerPage.vue (684 lignes)
- Note: Découpage complexe et risqué, à faire dans une itération dédiée

---

### 🌐 Autres

- [ ] Multi-language support (i18n)

---

## 📦 Documentation

- `docs/STRUCTURE.md` - Structure du projet
- `docs/CODE_RULES.md` - Règles et conventions de code
- `docs/TESTS.md` - Documentation des tests

---

## 🔄 Dernière mise à jour

**Date** : 2026-01-15
