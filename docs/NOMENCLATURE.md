# Nomenclature Français → Anglais

## 📋 Types et Interfaces

| Français | Anglais | Fichier(s) |
|----------|---------|------------|
| `Joueur` | `Player` | `src/types/index.ts` |
| `Poste` | `Assignment` | `src/types/index.ts` |
| `MapConfig.nom` | `MapConfig.name` | `src/types/index.ts` |
| `MapConfig.postes` | `MapConfig.assignments` | `src/types/index.ts` |
| `MapConfig.joueurs` | `MapConfig.players` | `src/types/index.ts` |
| `Poste.nom` | `Assignment.name` | `src/types/index.ts` |
| `Poste.etage` | `Assignment.floor` | `src/types/index.ts` |
| `selectedJoueur` | `selectedPlayer` | Plusieurs fichiers |
| `selectedEtage` | `selectedFloor` | Plusieurs fichiers |

## 📋 Variables et Fonctions

| Français | Anglais | Fichier(s) |
|----------|---------|------------|
| `joueurs` | `players` | `src/data/config.ts` |
| `posteColors` | `assignmentColors` | `src/data/config.ts` |
| `posteToPlayers` | `assignmentToPlayers` | `src/data/config.ts` |
| `checkMapBalance` | `checkMapBalance` | ✅ Déjà anglais |
| `loadMap` | `loadMap` | ✅ Déjà anglais |
| `loadAllMaps` | `loadAllMaps` | ✅ Déjà anglais |
| `activePostes` | `activeAssignments` | Plusieurs fichiers |
| `selectedJoueurId` | `selectedPlayerId` | Plusieurs fichiers |

## 📋 Base de données (Prisma)

| Français | Anglais | Fichier(s) |
|----------|---------|------------|
| `MapData.nom` | `MapData.name` | `prisma/schema.prisma` ✅ |
| `MapData.configurations` | `MapData.assignments` | `prisma/schema.prisma` ✅ |
| `MapData.joueurs` | `MapData.players` | `prisma/schema.prisma` ✅ |
| `User.nom` | `User.name` | `prisma/schema.prisma` ✅ |

## 📋 Classes CSS

| Français | Anglais | Fichier(s) |
|----------|---------|------------|
| `.poste` | `.marker` | `MapViewer.vue` ✅ |
| `.poste-bar` | `.assignment-bar` | `PlannerToolbar.vue` ✅ |
| `.poste-tag` | `.assignment-tag` | `RotationCalculator.vue` ✅ |
| `.poste-label` | `.marker-label` | `MapViewer.vue` ✅ |
| `--poste-color` | `--assignment-color` | Plusieurs fichiers ✅ |

## 📋 Logs Console (serveur)

| Français | Anglais |
|----------|---------|
| `Map sauvegardée par` | `Map saved by` |
| `Serveur démarré sur` | `Server started on` |
| `Erreur lors de la récupération` | `Error fetching` |
| `Erreur lors de la sauvegarde` | `Error saving` |
| `Erreur serveur` | `Server error` |
| `Début de la migration` | `Starting migration` |
| `Migration terminée` | `Migration completed` |
| `migrée avec succès` | `migrated successfully` |
| `Erreur pour la map` | `Error for map` |
| `Maps en base de données` | `Maps in database` |
| `Erreur fatale` | `Fatal error` |

## 📋 UI Labels (Vue templates)

| Français | Anglais | Fichier(s) |
|----------|---------|------------|
| `Effectif équilibré` | `Balanced roster` | `PlannerToolbar.vue` |
| `Mode Édition` | `Edit Mode` | `PlannerToolbar.vue` |
| `Éditer` | `Edit` | `PlannerToolbar.vue` |
| `Sauvegarder` | `Save` | `PlannerToolbar.vue` |
| `Annuler` | `Cancel` | `PlannerToolbar.vue` |
| `Calculer` | `Calculate` | `RotationCalculator.vue` |
| `Générer le plan de jeu` | `Generate game plan` | `RotationCalculator.vue` |
| `Copier (texte)` | `Copy (text)` | `RotationCalculator.vue` |
| `Télécharger (PNG)` | `Download (PNG)` | `RotationCalculator.vue` |
| `Joueur(se) absent(e)` | `Absent player` | `RotationCalculator.vue` |
| `absent(e)` | `absent` | `RotationCalculator.vue` |
| `Connexion` | `Login` | `LoginPage.vue` |
| `Se connecter` | `Sign in` | `LoginPage.vue` |
| `Connexion...` | `Signing in...` | `LoginPage.vue` |
| `Mot de passe` | `Password` | `LoginPage.vue`, `ProfilePage.vue` |
| `Se déconnecter` | `Sign out` | `ProfilePage.vue` |
| `Mon Profil` | `My Profile` | `ProfilePage.vue` |
| `Changer le mot de passe` | `Change password` | `ProfilePage.vue` |
| `Mot de passe actuel` | `Current password` | `ProfilePage.vue` |
| `Nouveau mot de passe` | `New password` | `ProfilePage.vue` |
| `Confirmer le nouveau mot de passe` | `Confirm new password` | `ProfilePage.vue` |
| `Mot de passe modifié avec succès` | `Password changed successfully` | `ProfilePage.vue` |
| `Planificateur` | `Planner` | `HomePage.vue` |
| `Calendrier` | `Calendar` | `HomePage.vue`, `CalendarPage.vue` |
| `Organisez les postes de votre équipe par map` | `Organize your team roles by map` | `HomePage.vue` |
| `Planifiez vos sessions d'entraînement` | `Plan your training sessions` | `HomePage.vue` |
| `À venir` | `Coming soon` | `HomePage.vue` |
| `Outil de gestion d'équipe FPS 4v4` | `FPS 4v4 Team Management Tool` | `HomePage.vue` |
| `Profil` | `Profile` | `TopBar.vue` |

## 📋 Messages d'erreur (validation)

| Français | Anglais |
|----------|---------|
| `n'a aucun joueur` | `has no player` |
| `n'a que` | `only has` |
| `n'a aucun poste` | `has no role` |
| `a X postes (max 2)` | `has X roles (max 2)` |

## 📋 Commentaires de code

Les commentaires en français seront également traduits en anglais.

---

## 🎯 Priorité de refactoring

1. **Types** (impact sur tout le projet)
2. **Variables/Fonctions** (impact modéré)
3. **UI Labels** (impact visuel seulement)
4. **Logs/Commentaires** (impact développeur seulement)

