import type { VideoItem } from "./types.ts";

/** Public-domain / CC films hosted with CORS, H.264 MP4 (codec sûr sur Quest 2). */
export const catalog: VideoItem[] = [
  {
    id: "bunny",
    title: "Big Buck Bunny",
    director: "Blender Foundation",
    duration: "10 min",
    year: "2008",
    synopsis:
      "Un lapin géant trop gentil décide de se venger des rongeurs qui lui pourrissent la vie. Idéal pour tester le grand écran.",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    kind: "flat",
    posterHue: 32,
  },
  {
    id: "elephants",
    title: "Elephants Dream",
    director: "Blender Foundation",
    duration: "11 min",
    year: "2006",
    synopsis:
      "Deux personnages errent dans une machine impossible. Court métrage surréaliste, parfait en salle virtuelle.",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    kind: "flat",
    posterHue: 265,
  },
  {
    id: "sintel",
    title: "Sintel",
    director: "Blender Foundation",
    duration: "15 min",
    year: "2010",
    synopsis:
      "Une jeune femme poursuit un dragon à travers des terres hostiles. Image cinémascope, très lisible en VR.",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    kind: "flat",
    posterHue: 200,
  },
  {
    id: "tears",
    title: "Tears of Steel",
    director: "Blender Foundation",
    duration: "12 min",
    year: "2012",
    synopsis:
      "Amsterdam, robots et voyage temporel. Un bon test pour le mode 3D côte-à-côte si vous avez une copie SBS.",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    kind: "flat",
    posterHue: 8,
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
