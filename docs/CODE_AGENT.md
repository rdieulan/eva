# Code Agent - Guide de fonctionnement

Ce document définit les règles de fonctionnement de l'agent de code pour le projet EVA.

---

## 📚 Documents de référence

| Document | Description |
|----------|-------------|
| [CODE_RULES.md](CODE_RULES.md) | Conventions de code, nommage, structure des fichiers |
| [REVIEW_CRITERIA.md](REVIEW_CRITERIA.md) | Critères de review pour l'analyse des fichiers |
| [SCRIPTS.md](SCRIPTS.md) | Scripts d'automatisation disponibles |
| [ROADMAP.md](../ROADMAP.md) | État d'avancement et tâches en cours |

---

## 🤖 Règles de fonctionnement

### Workflow obligatoire

1. **Analyser avant d'agir**
   - Toujours faire une analyse du fichier/problème AVANT de modifier
   - Soumettre l'analyse pour validation
   - Attendre la validation explicite avant de procéder

2. **Validation systématique**
   - Ne JAMAIS valider/cocher la roadmap sans accord explicite de l'utilisateur
   - Ne JAMAIS commit/push sans demander
   - Ne JAMAIS passer à l'étape suivante sans validation

3. **Pauses régulières**
   - Marquer des pauses entre les étapes pour permettre l'intervention
   - Ne pas enchaîner plusieurs phases sans interruption
   - Laisser le temps de valider ou contredire

### Communication

- **Proposer, ne pas imposer** : Soumettre les solutions avant de les implémenter
- **Être concis** : Aller à l'essentiel, pas de blabla inutile
- **Être précis** : Détailler ce qui va être modifié avant de le faire

### Qualité du code

- **Toujours suivre** les règles définies dans [CODE_RULES.md](CODE_RULES.md)
- **Vérifier les imports** : Utiliser les alias `@/` et `@shared/`
- **Pas de redondance** : Factoriser, réutiliser, centraliser
- **Tester ses modifications** : Build + tests avant de valider

### Git

- Ne JAMAIS commit/push automatiquement
- Attendre l'instruction explicite de l'utilisateur
- Décrire les changements avant de proposer un commit

---

## ⚠️ Erreurs à éviter

| Erreur | Conséquence |
|--------|-------------|
| Valider la roadmap sans accord | Perte de traçabilité |
| Push sans validation | Code potentiellement cassé en remote |
| Enchaîner les étapes sans pause | Impossible d'intervenir/corriger |
| Modifier le style validé sans demander | Régression visuelle |
| Créer des variables/couleurs inutiles | Complexification de la charte |
| Ignorer les warnings de build | Dette technique |
| Écrire des tests qui ne testent rien | Fausse sécurité |

---

## 🛠️ Scripts disponibles

Voir [SCRIPTS.md](SCRIPTS.md) pour la liste complète.

### Utilisation obligatoire pour le refactoring

> ⚠️ **Important**: Lors de tout renommage de symbole (variable, fonction, constante, etc.), l'agent DOIT utiliser le script `refactor symbol` au lieu de modifier les fichiers manuellement. Cela garantit qu'aucun fichier ou occurrence n'est oublié.

**Workflow de refactoring:**

1. **Dry-run d'abord** : Toujours exécuter en mode dry-run pour prévisualiser les changements
   ```bash
   npm run script:dry -- refactor symbol <file> <oldName> <newName>
   ```

2. **Vérifier le diff** : Examiner le diff des fichiers `.vue` pour détecter les faux positifs (ex: même nom mais contexte différent)

3. **Exécuter** : Lancer le script en mode interactif
   ```bash
   npm run script -- refactor symbol <file> <oldName> <newName>
   ```

4. **Valider manuellement** : Pour chaque fichier `.vue`, répondre `y/n/a/q` selon le contexte

### Commandes principales

```bash
# Renommer un symbole (variable, fonction, constante)
npm run script -- refactor symbol <file> <oldName> <newName>

# Renommer/déplacer un fichier avec mise à jour des imports
npm run script -- rename-file <source> <target>

# Mode dry-run (prévisualisation sans modification)
npm run script:dry -- <script-name> [args]
```

---

## 📋 Processus d'implémentation de features

### Phase 1 - Analyse (AVANT toute modification)

| Étape | Description | Validation requise |
|-------|-------------|-------------------|
| 1.1 | **Comprendre le besoin** : Reformuler la demande pour s'assurer de la compréhension | ✅ |
| 1.2 | **Identifier les composants impactés** : Lister les fichiers/modules concernés | ✅ |
| 1.3 | **Analyser le code existant** : Lire et comprendre le code actuel | ❌ |
| 1.4 | **Identifier les dépendances** : Autres features, données, permissions | ❌ |
| 1.5 | **Réfléchir aux implications** : Effets de bord, cas limites, sécurité | ✅ |

### Phase 2 - Planification

| Étape | Description | Validation requise |
|-------|-------------|-------------------|
| 2.1 | **Rédiger le plan d'action** : Étapes ordonnées et détaillées | ✅ |
| 2.2 | **Mettre à jour la ROADMAP** : Ajouter les tâches (non cochées) | ✅ |
| 2.3 | **Identifier les tests nécessaires** : Unitaires et/ou intégration | ✅ |
| 2.4 | **Identifier les migrations DB** : Si changement de schéma | ✅ |

### Phase 3 - Implémentation

| Étape | Description | Validation requise |
|-------|-------------|-------------------|
| 3.1 | **Implémenter étape par étape** : Une étape à la fois, pas d'enchaînement | ✅ par étape |
| 3.2 | **Respecter CODE_RULES.md** : Nommage, structure, imports | ❌ |
| 3.3 | **Vérifier les erreurs IDE** : Pas de warning/erreur ignoré | ❌ |
| 3.4 | **Pause après chaque étape** : Permettre la review | ✅ |

### Phase 4 - Validation technique

| Étape | Description | Validation requise |
|-------|-------------|-------------------|
| 4.1 | **Build** : `npm run build` doit passer | ❌ |
| 4.2 | **Tests unitaires** : `npm run test:unit` | ❌ |
| 4.3 | **Tests d'intégration** : `npm run test:integration` | ❌ |
| 4.4 | **Test manuel** : Si applicable, décrire ce qui a été testé | ✅ |

### Phase 5 - Finalisation

| Étape | Description | Validation requise |
|-------|-------------|-------------------|
| 5.1 | **Mettre à jour la ROADMAP** : Cocher les tâches terminées | ✅ |
| 5.2 | **Mettre à jour la documentation** : Si nouveau pattern/règle | ✅ |
| 5.3 | **Commit/Push** : Attendre l'instruction explicite | ✅ |

---

## 🧪 Décision : Tests nécessaires ?

### Tests unitaires

| Situation | Test unitaire ? |
|-----------|----------------|
| Nouvelle fonction utilitaire (`@/utils`, `@shared/utils`) | ✅ Oui |
| Nouveau composable avec logique métier | ✅ Oui |
| Nouvelle constante de validation | ✅ Oui |
| Modification de logique existante testée | ✅ Oui (adapter) |
| Nouveau composant Vue (UI pure) | ❌ Non |
| Modification CSS/style | ❌ Non |

### Tests d'intégration

| Situation | Test intégration ? |
|-----------|-------------------|
| Nouvelle route API | ✅ Oui |
| Modification de route existante (comportement) | ✅ Oui (adapter) |
| Nouveau middleware/permission | ✅ Oui |
| Modification de service avec effet DB | ✅ Oui |
| Modification frontend uniquement | ❌ Non |

---

## ⚡ Checklist rapide (avant chaque action)

```
[ ] Ai-je compris la demande ?
[ ] Ai-je fait l'analyse préalable ?
[ ] Ai-je soumis mon plan pour validation ?
[ ] Ai-je reçu la validation explicite ?
[ ] Mon code respecte-t-il CODE_RULES.md ?
[ ] Ai-je vérifié build + tests ?
[ ] Ai-je marqué une pause avant de continuer ?
[ ] Ai-je attendu l'accord avant commit/push ?
```

---

## 🚨 Points de vigilance par domaine

### Backend (routes, services)

- [ ] Vérifier l'isolation par équipe (`teamId`)
- [ ] Vérifier les permissions requises
- [ ] Utiliser les constantes `ERROR` pour les messages
- [ ] Retourner `{ errors: [...] }` en cas d'erreur
- [ ] Logger les erreurs serveur

### Frontend (composants, pages)

- [ ] Utiliser les alias d'import (`@/`, `@shared/`)
- [ ] Utiliser les variables SCSS (pas de couleurs en dur)
- [ ] Gérer les erreurs avec `useErrors` / `ErrorModal`
- [ ] Vérifier le rendu mobile

### Base de données

- [ ] Migration nécessaire ?
- [ ] Données existantes à migrer ?
- [ ] Index nécessaires ?
- [ ] Cascade delete configuré ?

### Sécurité

- [ ] Route protégée par `authMiddleware` ?
- [ ] Permission vérifiée si nécessaire ?
- [ ] Données d'une équipe non accessibles par une autre ?
- [ ] Pas d'information sensible dans les messages d'erreur ?
