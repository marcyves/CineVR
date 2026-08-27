import { catalog, viewModeHelp } from "../catalog.ts";
import type { MediaPlayer } from "../media.ts";
import { formatTimecode } from "../media.ts";
import { ViewMode, type VideoItem } from "../types.ts";

export type OverlayHandlers = {
  onSelectVideo: (item: VideoItem) => void;
  onCustomUrl: (url: string) => void;
  onCustomFile: (file: File) => void;
  onMode: (mode: ViewMode) => void;
  onEnterVr: () => void;
  onPreview: () => void;
  onLobby: () => void;
  onPlayToggle: () => void;
  onSeek: (ratio: number) => void;
  onVolume: (ratio: number) => void;
  onMute: () => void;
};

export class Overlay {
  readonly lobby = el<HTMLElement>("#lobby");
  readonly hud = el<HTMLElement>("#hud");
  readonly toast = el<HTMLElement>("#toast");
  readonly vrButton = el<HTMLButtonElement>("#enter-vr");
  readonly previewButton = el<HTMLButtonElement>("#preview");
  readonly badge = el<HTMLElement>("#headset-badge");
  readonly help = el<HTMLElement>("#mode-help");
  readonly urlInput = el<HTMLInputElement>("#video-url");
  readonly fileInput = el<HTMLInputElement>("#video-file");
  readonly hudTitle = el<HTMLElement>("#hud-title");
  readonly hudTime = el<HTMLElement>("#hud-time");
  readonly hudPlay = el<HTMLButtonElement>("#hud-play");
  readonly seek = el<HTMLInputElement>("#hud-seek");
  readonly volume = el<HTMLInputElement>("#hud-volume");

  selectedId: string | null = catalog[0]?.id ?? null;
  mode: ViewMode = ViewMode.Cinema;
  private toastTimer = 0;
  private handlers: OverlayHandlers;

  constructor(handlers: OverlayHandlers) {
    this.handlers = handlers;
    this.renderCatalog();
    this.bind();
    this.setMode(ViewMode.Cinema);
    this.fillQuestAddress();
  }

  showLobby(): void {
    this.lobby.hidden = false;
    this.hud.hidden = true;
    document.body.dataset.stage = "lobby";
  }

  showHud(): void {
    this.lobby.hidden = true;
    this.hud.hidden = false;
    document.body.dataset.stage = "play";
  }

  hideChrome(): void {
    this.lobby.hidden = true;
    this.hud.hidden = true;
    document.body.dataset.stage = "xr";
  }

  setVrAvailability(supported: boolean, quest: boolean): void {
    this.vrButton.disabled = !supported;
    this.vrButton.textContent = supported
      ? "Entrer en VR"
      : "WebXR indisponible";
    this.badge.textContent = quest
      ? "Quest détecté"
      : supported
        ? "Casque VR prêt"
        : "Aperçu bureau — ouvrez cette page dans le navigateur du Quest 2";
    this.badge.dataset.state = quest ? "quest" : supported ? "xr" : "desktop";
  }

  setMode(mode: ViewMode): void {
    this.mode = mode;
    for (const btn of this.lobby.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
      btn.setAttribute("aria-pressed", String(btn.dataset.mode === mode));
    }
    for (const btn of this.hud.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
      btn.setAttribute("aria-pressed", String(btn.dataset.mode === mode));
    }
    this.help.textContent = viewModeHelp[mode] ?? "";
  }

  setSelected(id: string | null): void {
    this.selectedId = id;
    for (const card of this.lobby.querySelectorAll<HTMLButtonElement>(".film-card")) {
      card.setAttribute("aria-pressed", String(card.dataset.id === id));
    }
  }

  syncPlayer(player: MediaPlayer): void {
    this.hudTitle.textContent = player.sourceLabel;
    this.hudTime.textContent = `${formatTimecode(player.currentTime)} / ${formatTimecode(player.duration)}`;
    this.hudPlay.textContent = player.paused ? "Lecture" : "Pause";
    this.hudPlay.setAttribute("aria-pressed", String(!player.paused));
    if (player.duration && document.activeElement !== this.seek) {
      this.seek.value = String((player.currentTime / player.duration) * 1000);
    }
    if (document.activeElement !== this.volume) {
      this.volume.value = String(player.video.volume * 100);
    }
    const err = el<HTMLElement>("#load-error");
    if (player.status === "error") {
      err.hidden = false;
      err.textContent = player.errorMessage;
    } else {
      err.hidden = true;
    }
    const loading = el<HTMLElement>("#load-status");
    loading.hidden = player.status !== "loading";
  }

  notify(message: string): void {
    this.toast.textContent = message;
    this.toast.dataset.show = "true";
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast.dataset.show = "false";
    }, 3200);
  }

  private fillQuestAddress(): void {
    const node = document.querySelector<HTMLElement>("#quest-address");
    if (!node) return;
    const href = window.location.href;
    const secure = window.isSecureContext;
    node.textContent = secure
      ? `Adresse actuelle : ${href} — ouvrez-la dans le navigateur du Quest.`
      : `Cette page est en HTTP. WebXR sur Quest exige HTTPS : lancez npm run dev:https sur votre PC, ou déployez le site.`;
  }

  private renderCatalog(): void {
    const grid = el<HTMLElement>("#film-grid");
    grid.replaceChildren();
    for (const item of catalog) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "film-card";
      card.dataset.id = item.id;
      card.setAttribute("aria-pressed", String(item.id === this.selectedId));
      card.innerHTML = `
        <span class="poster" style="--hue:${item.posterHue}"></span>
        <span class="film-meta">
          <span class="film-title">${item.title}</span>
          <span class="film-sub">${item.year} · ${item.duration}</span>
          <span class="film-syn">${item.synopsis}</span>
        </span>
      `;
      card.addEventListener("click", () => {
        this.setSelected(item.id);
        this.handlers.onSelectVideo(item);
      });
      grid.append(card);
    }
  }

  private bind(): void {
    for (const btn of this.lobby.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode as ViewMode;
        this.setMode(mode);
        this.handlers.onMode(mode);
      });
    }
    for (const btn of this.hud.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode as ViewMode;
        this.setMode(mode);
        this.handlers.onMode(mode);
      });
    }
    this.vrButton.addEventListener("click", () => this.handlers.onEnterVr());
    this.previewButton.addEventListener("click", () => this.handlers.onPreview());
    el<HTMLButtonElement>("#hud-lobby").addEventListener("click", () =>
      this.handlers.onLobby(),
    );
    this.hudPlay.addEventListener("click", () => this.handlers.onPlayToggle());
    this.seek.addEventListener("input", () => {
      this.handlers.onSeek(Number(this.seek.value) / 1000);
    });
    this.volume.addEventListener("input", () => {
      this.handlers.onVolume(Number(this.volume.value) / 100);
    });
    el<HTMLButtonElement>("#hud-mute").addEventListener("click", () =>
      this.handlers.onMute(),
    );
    el<HTMLButtonElement>("#load-url").addEventListener("click", () => {
      const url = this.urlInput.value.trim();
      if (!url) {
        this.notify("Collez d’abord l’adresse d’un fichier MP4.");
        return;
      }
      this.setSelected(null);
      this.handlers.onCustomUrl(url);
    });
    this.urlInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") el<HTMLButtonElement>("#load-url").click();
    });
    this.fileInput.addEventListener("change", () => {
      const file = this.fileInput.files?.[0];
      if (!file) return;
      this.setSelected(null);
      this.handlers.onCustomFile(file);
    });
    el<HTMLButtonElement>("#pick-file").addEventListener("click", () =>
      this.fileInput.click(),
    );
  }
}

function el<T extends HTMLElement>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Élément manquant: ${selector}`);
  return node;
}
