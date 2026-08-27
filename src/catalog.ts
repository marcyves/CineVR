import { assetUrl } from "./assetUrl.ts";
import type { VideoItem } from "./types.ts";

/** Copies locales H.264 — lisibles hors-ligne et sans CORS sur Quest 2. */
export const catalog: VideoItem[] = [
  {
    id: "trailer",
    title: "Bande-annonce",
    director: "Ciné VR",
    duration: "10 s",
    year: "2026",
    synopsis:
      "Générique de la salle. Un bon premier test d’écran, de velours et de cadrage 16:9.",
    src: assetUrl("videos/trailer.mp4"),
    kind: "flat",
    posterHue: 38,
  },
  {
    id: "bunny",
    title: "Big Buck Bunny",
    director: "Blender Foundation",
    duration: "10 s",
    year: "2008",
    synopsis:
      "Extrait du court métrage : un lapin trop gentil et des rongeurs insupportables. Boucle H.264 720p.",
    src: assetUrl("videos/big-buck-bunny.mp4"),
    kind: "flat",
    posterHue: 32,
  },
  {
    id: "sintel",
    title: "Sintel",
    director: "Blender Foundation",
    duration: "52 s",
    year: "2010",
    synopsis:
      "Bande-annonce officielle. Une jeune femme poursuit un dragon — très lisible en grand écran VR.",
    src: assetUrl("videos/sintel.mp4"),
    kind: "flat",
    posterHue: 200,
  },
  {
    id: "sphere",
    title: "Ciel 360°",
    director: "Ciné VR",
    duration: "12 s",
    year: "2026",
    synopsis:
      "Ciel equirectangulaire avec horizon. En mode Sphère, tournez la tête : le bleu est au zénith, l’or à l’horizon.",
    src: assetUrl("videos/sphere-360.mp4"),
    kind: "360",
    posterHue: 265,
  },
];

export const viewModeHelp: Record<string, string> = {
  cinema:
    "Film plat projeté sur l’écran 16:9 de la salle. Mode confort, assis, comme au cinéma.",
  sbs: "Vidéo stéréoscopique côte-à-côte (SBS). L’œil gauche voit la moitié gauche, l’œil droit la moitié droite.",
  "180":
    "Vidéo 180° equirectangulaire. L’image entoure le champ avant ; l’arrière reste dans le noir.",
  "360":
    "Vidéo 360° equirectangulaire. Tournez la tête dans toutes les directions pour explorer la scène.",
};
