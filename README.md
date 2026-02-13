# La Volière du Trésor 🐦

Un mini-jeu de type Flappy Bird créé pour une chasse au trésor.  
**Maître du jeu : Antoine**

## Comment lancer le jeu

### Option 1 — Ouvrir directement
Ouvre le fichier `index.html` dans ton navigateur (Chrome ou Safari recommandé).

### Option 2 — Serveur local
```bash
npx serve .
```
Puis ouvre l'adresse affichée dans le terminal (par défaut `http://localhost:3000`).

## Contrôles

| Action | Desktop | Mobile |
|--------|---------|--------|
| Voler | `Espace` ou clic | Tap n'importe où |
| Pause | `P` | Bouton ⏸ |
| Recommencer | `R` | — |
| Son on/off | `M` | Bouton 🔊 |

## Objectif

Atteins **100 points** pour débloquer l'indice final de la chasse au trésor !

## Technique

- HTML + CSS + JavaScript (ES modules)
- Canvas 2D pour le gameplay
- Audio procédural (Web Audio API, pas de fichiers audio externes)
- Aucune dépendance, aucun build nécessaire
- Responsive mobile-first
