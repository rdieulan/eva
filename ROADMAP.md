# EVA - Roadmap

## 📋 Prochaines étapes

### 🔧 Découpage des gros composants

**Contexte** : Selon CODE_RULES.md, les composants > 500 lignes doivent être refactorisés.

#### État actuel
| Fichier | Avant | Après | Statut |
|---------|-------|-------|--------|
| MapViewer.vue | 1405 | 962 | ✅ -31% |
| RotationCalculator.vue | 1154 | 288 | ✅ -75% |
| CalendarPage.vue | 952 | 236 | ✅ -75% |
| PlannerPage.vue | 772 | 318 | ✅ -59% |

---

### Phase 2 : MapViewer.vue ✅ TERMINÉE

**Fichiers réorganisés dans `client/src/components/planner/` :**
- `MapViewer.vue` - composant principal de la carte
- `MapList.vue` - liste des cartes
- `MarkerEditPanel.vue` - panel d'édition de marqueur
- `PlayerEditPanel.vue` - panel d'édition joueur/poste
- `Toolbar.vue` - barre d'outils (ex PlannerToolbar)
- `Sidebar.vue` - panneau latéral (ex PlannerSidebar)
- `PhaseSelector.vue` - sélecteur de phase
- `PlanSelector.vue` - sélecteur de plan

**Séparation des constantes/utilitaires :**
- `client/src/constants/markers.ts` - MARKER_ICON_PATHS, DEFAULT_MARKER_ICON
- `client/src/utils/markers.ts` - getMarkerIconPath(), getMarkerSize()
- `client/src/constants/colors.ts` - ASSIGNMENT_COLORS
- `client/src/utils/colors.ts` - getAssignmentColor()
- `client/src/constants/phases.ts` - PHASE_DISPLAY_DATA (nouveau)
- `client/src/utils/calendar.ts` - formatDateStr(), isPastDateStr() (centralisés)
- `client/src/utils/players.ts` - getPlayerStatusClass(), getNextAvailabilityStatus() (corrigés)

**Résultat : 1405 → 962 lignes (-443 lignes, -31%)**
**Tests : 137/137 ✅ | Build : OK ✅**

---

### Phase 3 : RotationCalculator.vue ✅ TERMINÉE

**Fichiers créés dans `client/src/components/common/rotation/` :**
- `RotationCalculator.vue` - composant principal allégé (288 lignes)
- `RotationResults.vue` - affichage des résultats (~190 lignes)
- `RotationExport.vue` - section export (~150 lignes)

**Composable créé :**
- `client/src/composables/useRotationCalculator.ts` - algorithme de calcul + logique métier (~380 lignes)

**Résultat : 1154 → 288 lignes (-866 lignes, -75%)**
**Tests : 137/137 ✅ | Build : OK ✅**

---

### Phase 4 : CalendarPage.vue ✅ TERMINÉE

**Composables créés dans `client/src/composables/` :**
- `useCalendar.ts` - navigation + données + disponibilités (~260 lignes)
- `useCalendarEvents.ts` - gestion des events/modales (~160 lignes)

**Sous-composants créés dans `client/src/components/calendar/` :**
- `CalendarToolbar.vue` - légende + bouton edit mode (~170 lignes)
- `CalendarControls.vue` - switch vue + navigation + weekdays (~235 lignes)

**Résultat : 952 → 236 lignes (-716 lignes, -75%)**
**Tests : 137/137 ✅ | Build : OK ✅**

---

### Phase 5 : PlannerPage.vue ✅ TERMINÉE

**Composables créés dans `client/src/composables/` :**
- `usePlannerPlans.ts` - CRUD plans (~175 lignes)
- `usePlannerNotes.ts` - gestion notes (~145 lignes)

**Sous-composant créé dans `client/src/components/planner/` :**
- `PlannerNotesPanel.vue` - contenu du Drawer (~230 lignes)

**Résultat : 772 → 318 lignes (-454 lignes, -59%)**
**Tests : 137/137 ✅ | Build : OK ✅**

---

### Phase 6 : Tests des composables ✅ TERMINÉE

**Tests créés dans `tests/client/` :**
- `use-calendar.test.ts` - tests de navigation, computed, edit mode (13 tests)
- `use-rotation-calculator.test.ts` - tests de calcul, sélection, export (15 tests)

**Nettoyage des tests inutiles :**
- Suppression des tests de "structure de type" (vérifiaient juste que TypeScript compile)
- Suppression des tests de constantes statiques (aucune valeur ajoutée)
- Suppression des imports inutilisés

**Mise à jour de CODE_RULES.md :**
- Ajout de la règle "Imports réels obligatoires"
- Ajout des instructions pour tester les composables

**Résultat : 165 → 157 tests pertinents (-8 tests inutiles) ✅ | Build : OK ✅**

---

### Phase 7 : Validation finale
- [x] Tous les tests passent (157/157)
- [x] Build OK
- [ ] Test manuel complet

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
