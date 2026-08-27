import * as THREE from "three";
import { APP_VERSION } from "../version.ts";
import { formatTimecode, type MediaPlayer } from "../media.ts";
import { ViewMode } from "../types.ts";

type HitAction =
  | { kind: "play" }
  | { kind: "seek"; ratio: number }
  | { kind: "volume"; ratio: number }
  | { kind: "mode"; mode: ViewMode }
  | { kind: "mute" }
  | { kind: "lobby" };

type Region = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

const W = 1024;
const H = 384;

export class SpatialPanel {
  readonly mesh: THREE.Mesh;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  visible = true;
  hoverId: string | null = null;

  private texture: THREE.CanvasTexture;
  private regions: Region[] = [];

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponible");
    this.ctx = ctx;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.345), material);
    this.mesh.position.set(0, 1.08, -1.35);
    this.mesh.name = "spatial-panel";
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.mesh.visible = visible;
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  draw(player: MediaPlayer, mode: ViewMode, hoverId: string | null): void {
    this.hoverId = hoverId;
    const { ctx } = this;
    ctx.clearRect(0, 0, W, H);

    roundRect(ctx, 0, 0, W, H, 28, "rgba(10, 8, 16, 0.88)");
    ctx.strokeStyle = "rgba(232, 192, 122, 0.45)";
    ctx.lineWidth = 3;
    roundRectStroke(ctx, 4, 4, W - 8, H - 8, 24);

    ctx.fillStyle = "#e8c07a";
    ctx.font = "600 22px 'DM Sans', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`CINÉ VR  ·  ${APP_VERSION}`, 36, 46);
    ctx.fillStyle = "rgba(246, 241, 230, 0.7)";
    ctx.font = "500 20px 'DM Sans', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(player.sourceLabel, W - 36, 46);

    const progressY = 92;
    const progressX = 36;
    const progressW = W - 72;
    roundRect(ctx, progressX, progressY, progressW, 28, 14, "rgba(255,255,255,0.08)");
    const ratio = player.duration ? player.currentTime / player.duration : 0;
    roundRect(ctx, progressX, progressY, Math.max(18, progressW * ratio), 28, 14, "#e8c07a");
    ctx.fillStyle = "rgba(246, 241, 230, 0.8)";
    ctx.font = "500 18px 'DM Sans', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      `${formatTimecode(player.currentTime)}  /  ${formatTimecode(player.duration)}`,
      36,
      150,
    );

    const buttons: { id: string; label: string; x: number; w: number }[] = [
      { id: "play", label: player.paused ? "Lecture" : "Pause", x: 36, w: 150 },
      { id: "cinema", label: "Cinéma", x: 202, w: 130 },
      { id: "sbs", label: "3D SBS", x: 348, w: 120 },
      { id: "180", label: "180°", x: 484, w: 100 },
      { id: "360", label: "360°", x: 600, w: 100 },
      { id: "mute", label: player.muted ? "Son" : "Muet", x: 716, w: 110 },
      { id: "lobby", label: "Lobby", x: 842, w: 146 },
    ];

    this.regions = [
      { id: "seek", x: progressX, y: progressY, w: progressW, h: 28 },
    ];

    for (const b of buttons) {
      const active =
        (b.id === "cinema" && mode === ViewMode.Cinema) ||
        (b.id === "sbs" && mode === ViewMode.Sbs) ||
        (b.id === "180" && mode === ViewMode.Half) ||
        (b.id === "360" && mode === ViewMode.Sphere);
      const hover = hoverId === b.id;
      const fill = active
        ? "#e8c07a"
        : hover
          ? "rgba(196, 181, 253, 0.35)"
          : "rgba(255,255,255,0.08)";
      roundRect(ctx, b.x, 188, b.w, 64, 16, fill);
      ctx.fillStyle = active ? "#1a1208" : "#f6f1e6";
      ctx.font = "600 22px 'DM Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(b.label, b.x + b.w / 2, 228);
      this.regions.push({ id: b.id, x: b.x, y: 188, w: b.w, h: 64 });
    }

    const volY = 286;
    ctx.fillStyle = "rgba(246, 241, 230, 0.6)";
    ctx.font = "500 16px 'DM Sans', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Volume", 36, volY);
    roundRect(ctx, 130, volY - 16, 420, 18, 9, "rgba(255,255,255,0.08)");
    roundRect(ctx, 130, volY - 16, 420 * player.video.volume, 18, 9, "#c4b5fd");
    this.regions.push({ id: "volume", x: 130, y: volY - 16, w: 420, h: 18 });

    ctx.fillStyle = "rgba(246, 241, 230, 0.45)";
    ctx.font = "400 15px 'DM Sans', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("Gâchette · viser  ·  A lecture  ·  B panneau  ·  Stick avance / volume", W - 36, 348);

    this.texture.needsUpdate = true;
  }

  hit(uv: THREE.Vector2): HitAction | null {
    const x = uv.x * W;
    const y = (1 - uv.y) * H;
    const region = this.regions.find(
      (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h,
    );
    if (!region) return null;
    if (region.id === "seek") {
      return { kind: "seek", ratio: (x - region.x) / region.w };
    }
    if (region.id === "volume") {
      return { kind: "volume", ratio: (x - region.x) / region.w };
    }
    if (region.id === "play") return { kind: "play" };
    if (region.id === "mute") return { kind: "mute" };
    if (region.id === "lobby") return { kind: "lobby" };
    if (region.id === "cinema") return { kind: "mode", mode: ViewMode.Cinema };
    if (region.id === "sbs") return { kind: "mode", mode: ViewMode.Sbs };
    if (region.id === "180") return { kind: "mode", mode: ViewMode.Half };
    if (region.id === "360") return { kind: "mode", mode: ViewMode.Sphere };
    return null;
  }

  hoverAt(uv: THREE.Vector2 | undefined): string | null {
    if (!uv) return null;
    const x = uv.x * W;
    const y = (1 - uv.y) * H;
    return (
      this.regions.find(
        (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h,
      )?.id ?? null
    );
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function roundRectStroke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.stroke();
}
