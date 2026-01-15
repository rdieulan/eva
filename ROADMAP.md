# EVA - Roadmap

## 📋 Prochaines étapes

### 🔧 Découpage des gros composants

**Contexte** : Selon CODE_RULES.md, les composants > 500 lignes doivent être refactorisés.

#### État actuel
| Fichier | Avant | Après | Statut |
|---------|-------|-------|--------|
| MapViewer.vue | 1405 | 962 | ✅ -31% |
| RotationCalculator.vue | 989 | - | En attente |
| CalendarPage.vue | 826 | - | En attente |
| PlannerPage.vue | 684 | - | En attente |

---

### Phase 2 : MapViewer.vue ✅

**Fichiers réorganisés dans `client/src/components/planner/` :**
- `MapViewer.vue` - composant principal de la carte
- `MapList.vue` - liste des cartes
- `MarkerEditPanel.vue` - panel d'édition de marqueur
- `PlayerEditPanel.vue` - panel d'édition joueur/poste
- `Toolbar.vue` - barre d'outils (ex PlannerToolbar)
- `Sidebar.vue` - panneau latéral (ex PlannerSidebar)
- `PhaseSelector.vue` - sélecteur de phase
- `PlanSelector.vue` - sélecteur de plan
- `markerIcons.ts` - constantes SVG paths

**Résultat : 1405 → 962 lignes (-443 lignes, -31%)**

---

### Phase 3 : RotationCalculator.vue (à faire)
- [ ] Créer `client/src/composables/useRotationCalculator.ts` - algorithme de calcul
- [ ] Refactoriser RotationCalculator.vue
- [ ] Tests et validation

**Résultat attendu : 989 → X lignes**

---

### Phase 4 : CalendarPage.vue (à faire)
- [ ] Créer `client/src/composables/useCalendarData.ts`
- [ ] Créer `client/src/composables/useCalendarEvents.ts`
- [ ] Refactoriser CalendarPage.vue
- [ ] Tests et validation

**Résultat attendu : 826 → X lignes**

---

### Phase 5 : PlannerPage.vue (à faire)
- [ ] Créer `client/src/composables/usePlannerState.ts`
- [ ] Refactoriser PlannerPage.vue
- [ ] Tests et validation

**Résultat attendu : 684 → X lignes**

---

### Phase 6 : Validation finale
- [ ] Tous les tests passent
- [ ] Build OK
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
