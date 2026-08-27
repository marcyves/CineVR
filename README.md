# Ciné VR

Application vidéo pour **Meta Quest 2** : une salle de cinéma WebXR dans le navigateur du casque. Vous pouvez y projeter un film plat 16:9, une copie **3D SBS**, une vidéo **180°** ou une vidéo **360°**.

Ce n’est pas une APK Unity. C’est une page web immersive. Le bouton Preview de Cursor s’ouvre sur l’ordinateur, pas dans le casque.

## Publier sur GitHub Pages

C’est le moyen le plus simple d’ouvrir Ciné VR dans le Quest 2 : GitHub Pages sert du **HTTPS**, obligatoire pour WebXR.

1. Poussez le projet sur GitHub (dépôt public ou privé avec Pages).
2. Dans le dépôt : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
3. Le workflow `.github/workflows/pages.yml` construit le site à chaque push sur `main`.
4. L’URL sera `https://<compte>.github.io/<repo>/` (ou `https://<compte>.github.io/` si le dépôt s’appelle `<compte>.github.io`).
5. Dans le navigateur du Quest, ouvrez cette URL, puis **Entrer en VR**.

Le `base` Vite est calculé automatiquement pour les sites en sous-chemin (`/nom-du-repo/`).

## Lancer en local (ordinateur)

```bash
npm install
npm run dev
```

Ouvrez le port **43221** dans un navigateur de bureau pour l’aperçu 2D.

## Visualiser dans le Quest 2

WebXR n’est autorisé que sur **HTTPS** (ou `localhost`, inutile dans le casque).

### Option A — même Wi‑Fi que votre PC

1. Casque et ordinateur sur le **même réseau Wi‑Fi**.
2. Dans le dossier du projet :

   ```bash
   npm run dev:https
   ```

3. Le terminal affiche une adresse réseau, par exemple `https://192.168.1.20:43221`.
4. Mettez le Quest. Ouvrez l’app **Navigateur** (icône globe dans la bibliothèque d’applications — pas TV, pas YouTube, pas l’app Vidéo).
5. Tapez cette adresse dans la barre d’URL. Si le navigateur signale un certificat non sûr, **continuez** : c’est le certificat local de Vite.
6. Le badge doit indiquer **Quest détecté**. Choisissez un film, puis **Entrer en VR**. Acceptez la session immersive.
7. Restez assis. Visez le panneau doré avec le rayon, validez avec la **gâchette**.

### Option B — GitHub Pages ou autre hébergeur HTTPS

GitHub Pages : voir plus haut. Autre hébergeur : `npm run build`, puis publiez le dossier `dist`.

## Dans le casque

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

Les films du programme sont embarqués en **MP4 H.264**. Vous pouvez aussi charger un fichier depuis le stockage du casque ou une URL MP4.

## Pile technique

Vite, TypeScript, Three.js, WebXR `immersive-vr`.
