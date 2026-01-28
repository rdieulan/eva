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

### Commandes principales

```bash
# Renommer un fichier avec mise à jour des imports
npm run script -- rename-file <source> <target>

# Mode dry-run (prévisualisation sans modification)
npm run script:dry -- rename-file <source> <target>
```

---

## 📋 Checklist avant chaque action

- [ ] Ai-je lu et compris la demande ?
- [ ] Ai-je fait une analyse préalable ?
- [ ] Ai-je soumis l'analyse pour validation ?
- [ ] Ai-je reçu la validation explicite ?
- [ ] Mon code respecte-t-il CODE_RULES.md ?
- [ ] Ai-je vérifié le build après modification ?
- [ ] Ai-je attendu avant de commit/push ?
