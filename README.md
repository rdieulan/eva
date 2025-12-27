# EVA - Équipe Visualisation & Assignation

Outil de visualisation de l'organisation d'une équipe FPS en 4v4.

## 🎯 Objectif

Nous sommes **5 joueurs** dans notre équipe, et chaque joueur doit savoir occuper **2 postes**. Cet outil permet de visualiser les postes de chacun en fonction des maps.

## 🖥️ Interface

La page principale contient :

- **Colonne gauche** : Liste des maps (cliquables)
- **Bandeau supérieur** : 5 cartouches joueurs (cliquables)
- **Zone centrale** : Image de la map en fullsize
- **Système de layers** : Superposition dynamique selon le joueur sélectionné

## 🎮 Concepts clés

### Postes

Chaque map contient **4 postes** :
- Chaque poste est représenté par une **pastille** (position sur la map)
- Chaque poste est associé à une **zone de contrôle** (rectangle)

### Joueurs

L'équipe comporte **5 joueurs** :
- Chaque joueur est associé à **2+ postes** qu'il peut occuper
- Un joueur est représenté par un ou plusieurs **traits** qui relient entre elles les pastilles des postes qu'il peut jouer

### Interaction

Quand on clique sur un **cartouche joueur** :
1. Ses **traits** sont mis en surbrillance
2. Les **pastilles** des postes qu'il peut jouer sont activées
3. Les **zones de contrôle** correspondantes sont affichées

## 🗺️ Système de Layers

Les layers permettent d'afficher des informations contextuelles sur la map :

### Fichiers JSON de configuration

Chaque map dispose d'un fichier `.json` qui décrit :

#### Postes (pastilles + zones associées)
```json
{
  "postes": [
    {
      "id": "poste1",
      "nom": "Entrée A",
      "x": 150,
      "y": 200,
      "zone": {
        "x1": 100,
        "y1": 150,
        "x2": 250,
        "y2": 300
      }
    }
  ]
}
```

#### Assignations joueurs
```json
{
  "joueurs": {
    "Player1": ["poste1", "poste3"],
    "Player2": ["poste2", "poste4"],
    "Player3": ["poste1", "poste2"],
    "Player4": ["poste3", "poste4"],
    "Player5": ["poste2", "poste3"]
  }
}
```

### Fonctionnement

- Les **postes** affichent des pastilles sur la map avec leur zone de contrôle associée
- Les **traits** relient les pastilles des postes qu'un joueur peut occuper
- Au clic sur un joueur :
  - Ses traits sont mis en **surbrillance**
  - Les pastilles de ses postes sont **activées**
  - Les zones de contrôle correspondantes sont **affichées**

## 🛠️ Stack Technique

- **Vue 3** - Framework frontend
- **TypeScript** - Typage statique
- **Vite** - Build tool

## 📦 Installation

```bash
npm install
```

## 🚀 Développement

```bash
npm run dev
```

## 📦 Build Production

```bash
npm run build
```

## 📁 Structure des assets

```
public/
├── maps/
│   ├── map1.png
│   ├── map1.json
│   ├── map2.png
│   └── map2.json
```
