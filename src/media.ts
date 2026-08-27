export type MediaStatus = "idle" | "loading" | "ready" | "error";

type MediaListener = () => void;

const MEDIA_ERR_ABORTED = 1;
const MEDIA_ERR_NETWORK = 2;
const MEDIA_ERR_DECODE = 3;
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

export class MediaPlayer {
  readonly video: HTMLVideoElement;
  status: MediaStatus = "idle";
  errorMessage = "";
  sourceLabel = "Bande-annonce";

  private listeners = new Set<MediaListener>();
  private objectUrl: string | null = null;
  private loadId = 0;

  constructor() {
    const video = document.createElement("video");
    video.playsInline = true;
    video.preload = "auto";
    video.loop = true;
    video.controls = false;
    video.muted = true;
    video.setAttribute("webkit-playsinline", "true");
    video.setAttribute("playsinline", "true");
    video.style.position = "fixed";
    video.style.width = "1px";
    video.style.height = "1px";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    video.setAttribute("aria-hidden", "true");
    document.body.append(video);

    video.addEventListener("loadstart", () => {
      if (this.status !== "error") this.setStatus("loading");
    });
    video.addEventListener("loadeddata", () => this.setStatus("ready"));
    video.addEventListener("canplay", () => this.setStatus("ready"));
    video.addEventListener("playing", () => this.setStatus("ready"));
    video.addEventListener("error", () => {
      if (!video.src) return;
      const code = video.error?.code ?? 0;
      if (code === MEDIA_ERR_ABORTED) return;
      this.errorMessage = messageForError(code);
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
    const id = ++this.loadId;
    this.revokeObjectUrl();
    this.sourceLabel = label;
    this.errorMessage = "";
    if (remote) this.video.crossOrigin = "anonymous";
    else this.video.removeAttribute("crossorigin");
    this.setStatus("loading");
    this.video.pause();
    this.video.src = src;
    this.video.load();
    await this.waitUntilSettled(id);
  }

  async loadFile(file: File): Promise<void> {
    const id = ++this.loadId;
    this.revokeObjectUrl();
    this.objectUrl = URL.createObjectURL(file);
    this.sourceLabel = file.name;
    this.errorMessage = "";
    this.video.removeAttribute("crossorigin");
    this.setStatus("loading");
    this.video.src = this.objectUrl;
    this.video.load();
    await this.waitUntilSettled(id);
  }

  async play(): Promise<void> {
    try {
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
    if (this.video.volume > 0) this.video.muted = false;
    this.emit();
  }

  nudgeVolume(delta: number): void {
    this.setVolume(this.video.volume + delta);
  }

  toggleMute(): void {
    this.video.muted = !this.video.muted;
    this.emit();
  }

  unmute(): void {
    this.video.muted = false;
    this.emit();
  }

  private waitUntilSettled(id: number): Promise<void> {
    return new Promise((resolve) => {
      const video = this.video;
      const finish = () => {
        video.removeEventListener("canplay", onOk);
        video.removeEventListener("loadeddata", onOk);
        video.removeEventListener("error", onErr);
        resolve();
      };
      const onOk = () => {
        if (id !== this.loadId) return;
        this.setStatus("ready");
        finish();
      };
      const onErr = () => {
        if (id !== this.loadId) return;
        const code = video.error?.code ?? 0;
        if (code === MEDIA_ERR_ABORTED) return;
        this.errorMessage = messageForError(code);
        this.setStatus("error");
        finish();
      };
      video.addEventListener("canplay", onOk, { once: true });
      video.addEventListener("loadeddata", onOk, { once: true });
      video.addEventListener("error", onErr, { once: true });
      window.setTimeout(() => {
        if (id !== this.loadId) return;
        if (this.status === "loading") finish();
      }, 8000);
    });
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

function messageForError(code: number): string {
  if (code === MEDIA_ERR_NETWORK) {
    return "Réseau coupé pendant le chargement. Réessayez ou importez un fichier.";
  }
  if (code === MEDIA_ERR_DECODE) {
    return "Le fichier est endommagé ou trop lourd pour le décodeur du casque.";
  }
  if (code === MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return "Fichier illisible. Sur Quest 2, utilisez un MP4 H.264 (ou un WebM).";
  }
  return "Impossible de charger la vidéo. Vérifiez l’URL, le réseau ou le fichier.";
}

export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds % 60);
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
