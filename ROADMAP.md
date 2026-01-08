# EVA - Roadmap

## ✅ Fonctionnalités terminées

- **Page Calendrier** : Calendrier partagé avec disponibilités joueurs, événements admin, plan de jeu pour les MATCH
- **Vue Mois/Semaine** : Switch entre vue mensuelle et hebdomadaire
- **Responsivité Mobile/Tablette** : Application adaptée pour tous les écrans
- **Migration SCSS** : Tous les styles convertis en SCSS avec variables et mixins

---

## 🎯 Objectif actuel : Prochaines fonctionnalités

### Architecture SCSS

- **Variables** : `client/src/styles/_variables.scss`
  - Breakpoints : `$breakpoint-mobile`, `$breakpoint-mobile-lg`, `$breakpoint-tablet`
  - Couleurs : `$color-bg-*`, `$color-text-*`, `$color-accent`, etc.
  - Espacements : `$spacing-xs` à `$spacing-2xl`
  - Rayons de bordure : `$radius-sm` à `$radius-xl`

- **Mixins responsive** :
  - `@include mobile { }` - max-width: 480px
  - `@include mobile-lg { }` - max-width: 768px
  - `@include tablet { }` - max-width: 1024px
  - `@include desktop { }` - min-width: 1025px

### ✅ Responsive - Toutes les étapes terminées

- [x] **Étape 1** : Base CSS & Variables globales ✅
- [x] **Étape 2** : Layout principal (TopBar) ✅
- [x] **Étape 3** : Page d'accueil (HomePage) ✅
- [x] **Étape 4** : Page de connexion (LoginPage) ✅
- [x] **Étape 5** : Page Profil (ProfilePage) ✅
- [x] **Étape 6** : Page Calendrier (CalendarPage) ✅
- [x] **Étape 7** : Page Planner (PlannerPage) ✅
- [x] **Étape 8** : Composants modaux ✅
- [x] **Étape 9** : Composants partagés ✅

---

## 📋 Prochaines étapes (après Responsive)

- [ ] Multi-language support (i18n)
- [ ] UI Multi-plans (plusieurs plans de jeu par map)

---

## 📦 Documentation

- `docs/STRUCTURE.md` - Structure du projet
- `docs/NOMENCLATURE.md` - Conventions de nommage
- `docs/TESTS.md` - Documentation des tests

---

## 🔄 Dernière mise à jour

**Date** : 2026-01-08
**Status** : Calendrier terminé ✅ | Responsive terminé ✅
