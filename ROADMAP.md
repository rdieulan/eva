# EVA - Roadmap

## 📋 Prochaines étapes

### 🎯 Système de Phases & Multi-Plans (Planificateur)

#### Étape 1 : Extension des types partagés ✅
- [x] Ajouter `GamePhase` enum (START, ATTACK, DEFENSE) dans `shared/types/map.types.ts`
- [x] Créer `PhaseZones` interface (zones par rôle pour une phase)
- [x] Enrichir `Assignment` avec `zonesByPhase: Record<GamePhase, Zone>`
- [x] Ajouter `PhaseNotes` interface (notes par phase)
- [x] Ajouter `generalNotes` et `phaseNotes` au niveau GamePlan
- [x] Adapter `MatchGamePlan` pour supporter les phases
- [x] Ajouter fonctions helper (getZoneForPhase, migrateAssignmentToPhases, etc.)
- [x] Modifier getZonePolygons pour accepter Zone | undefined

#### Étape 2 : Modification du schéma Prisma ✅
- [x] Mettre à jour le champ `assignments` de `GamePlan` pour stocker les zones par phase
- [x] Ajouter champ `generalNotes: String?` dans `GamePlan`
- [x] Ajouter champ `phaseNotes: Json?` dans `GamePlan` (Record<GamePhase, string>)
- [x] Exécuter migration Prisma (db push)

#### Étape 3 : Adaptation du MapViewer ✅
- [x] Ajouter prop `currentPhase: GamePhase` pour afficher les zones de la phase
- [x] Modifier le rendu des zones pour lire `zonesByPhase[currentPhase]`
- [x] Adapter le mode edit pour éditer les zones de la phase en cours
- [x] Gérer la migration automatique au save (zones legacy → zones par phase)

#### Étape 4 : Composant PhaseSelector ✅
- [x] Créer `client/src/components/planner/PhaseSelector.vue`
- [x] 3 boutons visuels (Start/Attaque/Défense) avec icônes
- [x] Créer icônes SVG (play.svg, sword.svg, shield.svg)
- [x] Intégrer dans `PlannerPage.vue`
- [x] Intégrer dans `RotationCalculator.vue`

#### Étape 5 : Panneau d'explications (Drawer) ✅
- [x] Créer `client/src/components/planner/PlanNotesDrawer.vue`
- [x] Section éditable "Notes générales du plan"
- [x] Section éditable "Notes de la phase en cours"
- [x] Animation slide-in depuis la droite
- [x] Bouton toggle dans la toolbar du planificateur (icône notes.svg)
- [x] Intégrer dans `PlannerPage.vue`
- [x] Mode readonly quand pas en édition

#### Étape 6 : Système Multi-Plans ✅
- [x] Ajouter sélecteur de plan dans `PlannerPage.vue` (dropdown)
- [x] Bouton "Nouveau plan" pour créer un plan vierge
- [x] Bouton "Dupliquer le plan" pour copier le plan actuel
- [x] Bouton "Supprimer le plan" avec confirmation
- [x] Adapter les routes API pour CRUD complet des plans (notes incluses)
- [x] Renommer un plan (inline edit)
- [x] Créer composant `PlanSelector.vue`

#### Étape 7 : Adaptation des routes API ✅
- [x] `GET /api/maps/:id/plans` - Liste des plans d'une map (avec notes)
- [x] `POST /api/maps/:id/plans` - Créer un nouveau plan
- [x] `PUT /api/plans/:id` - Sauvegarder un plan (avec migration auto)
- [x] `DELETE /api/plans/:id` - Supprimer un plan
- [x] Logique de migration automatique (zones legacy → zonesByPhase)

#### Étape 8 : Visualisation des phases dans le calendrier ✅
- [x] Adapter `EventFormModal` pour afficher le sélecteur de phase
- [x] Adapter la visualisation du plan de jeu dans les events
- [x] Permettre de naviguer entre les phases en mode lecture
- [x] Ajouter prop `currentPhase` à `GamePlanTable` pour compatibilité future

#### Étape 9 : Tests & Validation
- [ ] Tests unitaires pour les nouveaux types
- [ ] Tests des routes API multi-plans
- [ ] Tests des composants PhaseSelector et PlanNotesDrawer
- [ ] Tests d'intégration calendrier avec phases
- [ ] Vérification build et déploiement

---

### 🌐 Autres

- [ ] Multi-language support (i18n)

---

## 📦 Documentation

- `docs/STRUCTURE.md` - Structure du projet
- `docs/NOMENCLATURE.md` - Conventions de nommage
- `docs/TESTS.md` - Documentation des tests

---

## 🔄 Dernière mise à jour

**Date** : 2026-01-14
