# Ciné VR

Application vidéo pour **Meta Quest 2** : une salle de cinéma WebXR dans le navigateur du casque. Vous pouvez y projeter un film plat 16:9, une copie **3D SBS**, une vidéo **180°** ou une vidéo **360°**.

Ce n’est pas une APK Unity. C’est une app web immersive (WebXR) que le navigateur Meta Quest lance en plein casque, avec les manettes Touch.

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrez l’adresse indiquée (port **43221**).

Pour une preview de production :

```bash
npm run build
npm run preview
```

## Sur Quest 2

WebXR n’est autorisé que dans un **contexte sécurisé** (HTTPS, ou `localhost`).

1. Déployez le dossier `dist` sur n’importe quel hébergeur statique (Netlify, Vercel, GitHub Pages) **ou** servez votre PC en HTTPS sur le réseau local.
2. Dans le casque, ouvrez le **navigateur Meta Quest**.
3. Entrez l’URL, éventuellement via **Ajouter à vos applications** (manifeste PWA fourni).
4. Choisissez un film et un mode de projection.
5. Appuyez sur **Entrer en VR**. Restez assis, comme au cinéma.

Sur un ordinateur, **Prévisualiser la salle** ouvre la même pièce : glisser pour regarder, Espace pour lecture.

## Commandes casque

| Action | Contrôle |
| --- | --- |
| Viser / cliquer le panneau | Rayon + gâchette |
| Lecture / pause | Bouton A / X |
| Afficher / masquer le panneau | Bouton B / Y |
| Avancer / reculer | Stick horizontal |
| Volume | Stick vertical |

## Modes de projection

- **Cinéma** — écran 16:9 dans une salle velours, le plus confortable.
- **3D SBS** — vidéo stéréoscopique côte-à-côte (œil gauche / œil droit).
- **180°** — dôme avant, pour les captures VR 180.
- **360°** — sphère complète. Tournez la tête.

Les films du programme sont des courts métrages libres de droits en **MP4 H.264**, le codec le plus fiable sur Quest 2. Vous pouvez aussi charger un fichier depuis le casque ou une URL MP4.

## Pile technique

Vite, TypeScript, Three.js, WebXR `immersive-vr`.
