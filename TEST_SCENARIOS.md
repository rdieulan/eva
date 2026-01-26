# Scénarios de Test Manuel - EVA

Ce fichier liste uniquement les tests qui nécessitent une validation manuelle.
Les logiques métier (permissions, isolation équipe, validation codes, etc.) sont couvertes par les tests unitaires.

---

## 🔐 Authentification (UX / Navigation)

- [ ] **Multi-onglets** : Se déconnecter sur onglet 2 → onglet 1 redirigé vers login
- [ ] **Multi-onglets** : Se connecter avec autre compte sur onglet 2 → onglet 1 se synchronise

---

## 👥 Gestion d'équipe (Flux complet)

### Parcours création d'équipe
- [ ] Homepage sans équipe → clic "Créer une équipe" → `/team/create` → formulaire → redirection `/team`

### Parcours quitter l'équipe
- [ ] `/team` → clic "Quitter l'équipe" → confirmation → redirection homepage

### Parcours suppression d'équipe (Leader)
- [ ] `/team` → clic "Supprimer l'équipe" → saisir "supprimer" → redirection homepage

---

## 📨 Système d'invitation (Flux complet)

### Générer et utiliser une invitation
- [ ] Générer lien → copier → ouvrir en navigation privée → se connecter/créer compte → rejoindre → message succès → `/team`

### Rejoindre via code collé
- [ ] Homepage → coller code ou URL → redirection `/join/:code` → message succès → `/team`

---

## 📱 Responsive / Mobile

- [ ] Homepage : navigation lisible sur mobile
- [ ] TeamPage : liste des membres scrollable
- [ ] Calendrier vue mois : pastilles de dispo visibles et cliquables
- [ ] Calendrier vue semaine : jours scrollables, actions accessibles
- [ ] Planificateur : map zoomable, drawer fonctionnel sur tablette
- [ ] Modales : scrollables et fermables sur petit écran

---

## 🔄 Cas limites (Edge cases)

- [ ] Session expirée : action déclenche redirection login
- [ ] Invitation expirée/épuisée : message d'erreur clair
- [ ] Utilisateur retiré de l'équipe pendant navigation : comportement cohérent
