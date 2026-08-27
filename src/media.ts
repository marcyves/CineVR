export type MediaStatus = "idle" | "loading" | "ready" | "error";

type MediaListener = () => void;

export class MediaPlayer {
  readonly video: HTMLVideoElement;
  status: MediaStatus = "idle";
  errorMessage = "";
  sourceLabel = "Bande-annonce";

  private listeners = new Set<MediaListener>();
  private objectUrl: string | null = null;

  constructor() {
    const video = document.createElement("video");
    video.playsInline = true;
    video.preload = "auto";
    video.loop = true;
    video.controls = false;
    video.setAttribute("webkit-playsinline", "true");
    video.addEventListener("loadstart", () => this.setStatus("loading"));
    video.addEventListener("canplay", () => this.setStatus("ready"));
    video.addEventListener("playing", () => this.setStatus("ready"));
    video.addEventListener("error", () => {
      const code = video.error?.code;
      this.errorMessage =
        code === 4
          ? "Ce format n’est pas lisible sur Quest 2. Préférez un MP4 H.264."
          : "Impossible de charger la vidéo. Vérifiez l’URL, le réseau ou le fichier.";
      this.setStatus("error");
    });
    this.video = video;
  }

  onChange(fn: MediaListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get currentTime(): number {
    return this.video.currentTime;
  }

  get duration(): number {
    const d = this.video.duration;
    return Number.isFinite(d) ? d : 0;
  }

  get paused(): boolean {
    return this.video.paused;
  }

  get muted(): boolean {
    return this.video.muted;
  }

  async loadUrl(src: string, label: string, remote: boolean): Promise<void> {
    this.revokeObjectUrl();
    this.sourceLabel = label;
    this.errorMessage = "";
    this.video.crossOrigin = remote ? "anonymous" : "";
    this.video.src = src;
    this.video.load();
    this.setStatus("loading");
    this.emit();
  }

  async loadFile(file: File): Promise<void> {
    this.revokeObjectUrl();
    this.objectUrl = URL.createObjectURL(file);
    this.sourceLabel = file.name;
    this.errorMessage = "";
    this.video.crossOrigin = "";
    this.video.src = this.objectUrl;
    this.video.load();
    this.setStatus("loading");
    this.emit();
  }

  async play(): Promise<void> {
    try {
      this.video.muted = false;
      await this.video.play();
    } catch {
      this.video.muted = true;
      await this.video.play();
    }
    this.emit();
  }

  pause(): void {
    this.video.pause();
    this.emit();
  }

  togglePlay(): void {
    if (this.video.paused) void this.play();
    else this.pause();
  }

  seekRatio(ratio: number): void {
    if (!this.duration) return;
    this.video.currentTime = Math.min(Math.max(ratio, 0), 1) * this.duration;
    this.emit();
  }

  seekBy(seconds: number): void {
    if (!this.duration) return;
    this.video.currentTime = Math.min(
      Math.max(this.video.currentTime + seconds, 0),
      this.duration,
    );
    this.emit();
  }

  setVolume(volume: number): void {
    this.video.volume = Math.min(Math.max(volume, 0), 1);
    this.video.muted = this.video.volume === 0;
    this.emit();
  }

  nudgeVolume(delta: number): void {
    this.setVolume(this.video.volume + delta);
  }

  toggleMute(): void {
    this.video.muted = !this.video.muted;
    this.emit();
  }

  private setStatus(status: MediaStatus): void {
    this.status = status;
    this.emit();
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}

export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds % 60);
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
