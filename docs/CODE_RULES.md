# EVA - Règles de Code

Ce document définit les conventions et règles à respecter pour le développement du projet EVA.

---

## 📝 Langue

### Code (Anglais)
- **Variables** : anglais (`userName`, `isLoading`, `selectedPhase`)
- **Fonctions** : anglais (`getPlayerAssignments`, `fetchMonthData`)
- **Commentaires** : anglais (`// Get zone for current phase`)
- **Logs de debug** : anglais (`console.log('Loading map:', mapId)`)
- **Noms de fichiers** : anglais (`balance.service.ts`, `MapViewer.vue`)

### Interface utilisateur (Français)
- **Labels UI** : français (`'Start'`, `'Attaque'`, `'Défense'`)
- **Messages d'erreur utilisateur** : français (`"Ce poste n'a aucun joueur"`)
- **Textes affichés** : français (`'Disponible'`, `'Indisponible'`)
- **Tooltips et aides** : français

---

## 📁 Structure des fichiers

### Séparation des responsabilités
- **Types uniquement** : `shared/types/*.ts` - interfaces, types, constantes
- **Fonctions utilitaires** : `shared/utils/*.ts` ou `client/src/utils/*.ts`
- **Ne jamais mélanger** types et fonctions dans le même fichier

### Organisation client
```
client/src/
├── api/           # Appels API (fetch)
├── components/    # Composants Vue (.vue uniquement)
│   ├── calendar/  # Composants du calendrier
│   ├── common/    # Composants réutilisables (Modal, Drawer, etc.)
│   ├── layout/    # Composants de layout (TopBar, etc.)
│   └── planner/   # Composants du planificateur
├── composables/   # Logique réactive réutilisable (useAuth, etc.)
├── config/        # Re-exports pour rétrocompatibilité
├── constants/     # Données constantes (couleurs, paths SVG, etc.)
├── pages/         # Pages/vues principales
├── services/      # Logique métier pure (sans Vue)
├── styles/        # SCSS partagés
├── types/         # Réexports depuis @shared/types (pas de types locaux)
└── utils/         # Fonctions utilitaires pures
```

### Organisation shared
```
shared/
├── types/         # Types partagés client/serveur
└── utils/         # Fonctions utilitaires partagées
```

### Organisation server
```
server/src/
├── db/            # Prisma et accès base de données
├── middleware/    # Middlewares Express
├── routes/        # Routes API
└── services/      # Logique métier serveur
```

---

## 🏷️ Conventions de nommage

### Variables et fonctions
- **camelCase** : `userId`, `getPlayerName`, `isLoading`
- **Booléens** : préfixe `is`, `has`, `can` (`isVisible`, `hasError`, `canEdit`)
- **Handlers** : préfixe `handle` ou `on` (`handleClick`, `onSubmit`)

### Types et interfaces
- **PascalCase** : `MapConfig`, `PlayerAssignment`, `GamePhase`
- **Pas de préfixe I** : `Assignment` (pas `IAssignment`)

### Constantes
- **SCREAMING_SNAKE_CASE** pour les constantes globales : `GAME_PHASES`, `MARKER_ICONS`
- **camelCase** pour les constantes locales : `defaultValue`, `maxRetries`

### Fichiers
- **Composants Vue** : PascalCase (`MapViewer.vue`, `CalendarGrid.vue`)
- **Fichiers TS** : kebab-case ou camelCase (`balance.service.ts`, `zones.ts`)
- **Types** : suffixe `.types.ts` (`map.types.ts`, `calendar.types.ts`)
- **Tests** : suffixe `.test.ts` (`balance.test.ts`)

---

## 🧩 Composants Vue

### Structure d'un composant
```vue
<script setup lang="ts">
// 1. Imports
// 2. Props & Emits
// 3. Composables (useAuth, etc.)
// 4. Reactive state (ref, reactive)
// 5. Computed properties
// 6. Functions
// 7. Lifecycle hooks
</script>

<template>
  <!-- HTML -->
</template>

<style lang="scss" scoped>
/* Styles */
</style>
```

### Taille des composants
- **Idéal** : < 300 lignes
- **Acceptable** : 300-500 lignes
- **À refactoriser** : > 500 lignes (extraire sous-composants)

---

## 🎨 CSS/SCSS

### Variables
- Définir dans `client/src/styles/_variables.scss`
- Utiliser les variables pour : couleurs, breakpoints, espacements

### Breakpoints
```scss
$breakpoint-mobile: 480px;
$breakpoint-tablet: 768px;
$breakpoint-desktop: 1024px;
$breakpoint-large: 1440px;
```

### Organisation
- Styles globaux : `client/src/style.scss`
- Variables : `client/src/styles/_variables.scss`
- Styles composant : `<style scoped>` dans le `.vue`

---

## 🧪 Tests

### Ce qu'on teste
- ✅ Fonctions utilitaires exportées
- ✅ Logique métier (services)
- ✅ Composants Vue (comportement, pas implémentation)
- ✅ Contrats API (structure des requêtes/réponses)

### Ce qu'on ne teste PAS
- ❌ Fonctions définies localement dans le fichier de test
- ❌ Code de librairies tierces
- ❌ Détails d'implémentation CSS

### Structure d'un test
```typescript
describe('NomDeLaFonction', () => {
  it('should [comportement] when [condition]', () => {
    // Arrange
    const input = { ... };
    
    // Act
    const result = maVraieFonction(input);
    
    // Assert
    expect(result).toBe(expected);
  });
});
```

---

## 📦 Imports

### Alias
- `@/` → `client/src/`
- `@shared/` → `shared/`
- `@db/` → `server/src/db/`
- `@middleware/` → `server/src/middleware/`

### Ordre des imports
1. Librairies externes (`vue`, `vitest`)
2. Alias projet (`@/`, `@shared/`)
3. Imports relatifs (`./`, `../`)

### Exemple
```typescript
import { ref, computed } from 'vue';
import type { MapConfig, Assignment } from '@shared/types';
import { useAuth } from '@/composables/useAuth';
import { getZonePolygons } from '@/utils/zones';
```

---

## 🔄 Composables

### Définition
Les composables sont des fonctions réutilisables qui encapsulent de la logique réactive Vue.

### Nommage
- Préfixe `use` : `useAuth`, `useCalendarData`, `useMapZones`
- Fichier : `client/src/composables/useNomDuComposable.ts`

### Quand extraire un composable
- Logique réutilisable entre plusieurs composants
- Logique complexe (> 50 lignes) qui alourdit un composant
- État partagé entre composants

### Structure type
```typescript
// useExemple.ts
import { ref, computed } from 'vue';

export function useExemple(options?: ExempleOptions) {
  // State
  const data = ref<Data | null>(null);
  const isLoading = ref(false);
  
  // Computed
  const isEmpty = computed(() => !data.value);
  
  // Methods
  async function loadData() { ... }
  function resetData() { ... }
  
  // Return public API
  return {
    data,
    isLoading,
    isEmpty,
    loadData,
    resetData,
  };
}
```

---

## 🔄 Git

### Branches
- `main` : production
- `dev` : développement
- Feature branches si nécessaire

### Commits
- Messages clairs et concis
- En anglais ou français (cohérent)

---

## ⚠️ Règles strictes

1. **Jamais de `any`** sauf cas exceptionnels documentés
2. **Jamais de fonctions dans les fichiers de types**
3. **Toujours utiliser les alias d'import** (`@/`, `@shared/`)
4. **Pas de code dupliqué** - factoriser
5. **Pas de valeurs magiques** - utiliser des constantes nommées
6. **Composants > 500 lignes** = refactorisation nécessaire

---

## 🔄 Dernière mise à jour

**Date** : 2026-01-15

