export const ViewMode = {
  Cinema: "cinema",
  Sbs: "sbs",
  Half: "180",
  Sphere: "360",
} as const;

export type ViewMode = (typeof ViewMode)[keyof typeof ViewMode];

export type VideoItem = {
  id: string;
  title: string;
  director: string;
  duration: string;
  year: string;
  synopsis: string;
  src: string;
  kind: "flat" | "360";
  posterHue: number;
};
