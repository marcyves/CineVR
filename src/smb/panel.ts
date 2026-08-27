import {
  formatSize,
  loadForm,
  smbAvailable,
  smbConnect,
  smbDisconnect,
  smbFileUrl,
  smbList,
  type SmbEntry,
  type SmbForm,
} from "./client.ts";

type SmbPanelHandlers = {
  onPlay: (url: string, title: string) => void;
  notify: (message: string) => void;
  setSelected: (id: string | null) => void;
};

export class SmbPanel {
  private handlers: SmbPanelHandlers;
  private available = false;
  private connected = false;
  private currentPath = "";
  private label = "";

  constructor(handlers: SmbPanelHandlers) {
    this.handlers = handlers;
  }

  async init(): Promise<void> {
    this.fillForm(loadForm());
    this.bind();
    this.available = await smbAvailable();
    this.renderAvailability();
    if (!this.available) return;
    const form = this.readForm();
    if (form.host && form.share && form.remember && form.password) {
      /* Stay disconnected until the user clicks — auto-connect on Quest can hang the lobby. */
    }
  }

  markSelected(id: string | null): void {
    for (const row of document.querySelectorAll<HTMLButtonElement>(".smb-row")) {
      row.setAttribute("aria-pressed", String(row.dataset.id === id));
    }
  }

  private bind(): void {
    el<HTMLButtonElement>("#smb-disconnect").addEventListener("click", () => {
      void this.disconnect();
    });
    el<HTMLFormElement>("#smb-form").addEventListener("submit", (event) => {
      event.preventDefault();
      void this.connect();
    });
  }

  private async connect(): Promise<void> {
    if (!this.available) {
      this.handlers.notify("Le disque SMB n’est disponible que depuis l’app lancée sur le PC.");
      return;
    }
    const form = this.readForm();
    const status = el<HTMLElement>("#smb-status");
    status.hidden = false;
    status.classList.remove("error");
    status.textContent = "Connexion au NAS…";
    el<HTMLButtonElement>("#smb-connect").disabled = true;
    try {
      const result = await smbConnect(form);
      this.connected = true;
      this.label = result.label;
      this.currentPath = result.path;
      this.renderAvailability();
      await this.browse(result.path);
      this.handlers.notify(`Connecté à ${result.label}`);
    } catch (error) {
      status.classList.add("error");
      status.hidden = false;
      status.textContent = error instanceof Error ? error.message : "Connexion impossible.";
    } finally {
      el<HTMLButtonElement>("#smb-connect").disabled = false;
    }
  }

  private async disconnect(): Promise<void> {
    await smbDisconnect();
    this.connected = false;
    this.currentPath = "";
    this.label = "";
    el<HTMLElement>("#smb-browser").hidden = true;
    el<HTMLElement>("#smb-list").replaceChildren();
    this.renderAvailability();
    const status = el<HTMLElement>("#smb-status");
    status.hidden = false;
    status.classList.remove("error");
    status.textContent = "Déconnecté.";
    this.handlers.notify("Disque réseau déconnecté.");
  }

  private async browse(dir: string): Promise<void> {
    const status = el<HTMLElement>("#smb-status");
    status.hidden = false;
    status.classList.remove("error");
    status.textContent = "Lecture du dossier…";
    try {
      const listing = await smbList(dir);
      this.currentPath = listing.path;
      this.renderList(listing.parent, listing.entries);
      status.hidden = true;
    } catch (error) {
      status.classList.add("error");
      status.textContent = error instanceof Error ? error.message : "Dossier illisible.";
    }
  }

  private renderAvailability(): void {
    const note = el<HTMLElement>("#smb-note");
    const form = el<HTMLElement>("#smb-form");
    const browser = el<HTMLElement>("#smb-browser");
    const connect = el<HTMLButtonElement>("#smb-connect");
    const disconnect = el<HTMLButtonElement>("#smb-disconnect");
    if (!this.available) {
      note.textContent =
        "Le navigateur du Quest ne parle pas SMB. Ouvrez Ciné VR depuis un PC du même Wi‑Fi (`npm run dev:https`), pas depuis GitHub Pages, puis reconnectez le NAS ici.";
      form.setAttribute("inert", "");
      connect.disabled = true;
      disconnect.hidden = true;
      browser.hidden = true;
      return;
    }
    form.removeAttribute("inert");
    connect.disabled = this.connected;
    disconnect.hidden = !this.connected;
    note.textContent = this.connected
      ? `Connecté à ${this.label}. Cliquez un film pour le projeter. Mode 360° : choisissez Sphère avant d’ouvrir le fichier.`
      : "Serveur = IP du NAS, partage = nom du dossier partagé. Pour tester sans NAS : serveur demo, partage videos.";
  }

  private renderList(parent: string | null, entries: SmbEntry[]): void {
    const browser = el<HTMLElement>("#smb-browser");
    const list = el<HTMLElement>("#smb-list");
    const crumb = el<HTMLElement>("#smb-path");
    browser.hidden = false;
    crumb.textContent = this.currentPath ? `${this.label} / ${this.currentPath}` : this.label;
    list.replaceChildren();

    if (parent !== null) {
      list.append(this.rowButton("dir", "smb:up", "Dossier parent", "Remonter", null, () => {
        void this.browse(parent);
      }));
    }

    if (entries.length === 0 && parent === null) {
      const empty = document.createElement("p");
      empty.className = "smb-empty";
      empty.textContent = "Aucun fichier vidéo dans ce dossier (MP4, WebM, MKV, MOV).";
      list.append(empty);
      return;
    }

    for (const entry of entries) {
      if (entry.kind === "dir") {
        list.append(
          this.rowButton("dir", `smb:dir:${entry.path}`, entry.name, "Dossier", null, () => {
            void this.browse(entry.path);
          }),
        );
      } else {
        const sub = formatSize(entry.size);
        list.append(
          this.rowButton("video", `smb:${entry.path}`, entry.name, "Film", sub, () => {
            this.handlers.setSelected(`smb:${entry.path}`);
            this.handlers.onPlay(smbFileUrl(entry.path), entry.name);
          }),
        );
      }
    }
  }

  private rowButton(
    kind: "dir" | "video",
    id: string,
    title: string,
    tag: string,
    extra: string | null,
    onClick: () => void,
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "smb-row";
    btn.dataset.id = id;
    btn.dataset.kind = kind;
    btn.setAttribute("aria-pressed", "false");
    btn.innerHTML = `
      <span class="smb-kind">${escapeHtml(tag)}</span>
      <span class="smb-name">${escapeHtml(title)}</span>
      <span class="smb-extra">${escapeHtml(extra ?? "")}</span>
    `;
    btn.addEventListener("click", onClick);
    return btn;
  }

  private fillForm(form: SmbForm): void {
    el<HTMLInputElement>("#smb-host").value = form.host;
    el<HTMLInputElement>("#smb-share").value = form.share;
    el<HTMLInputElement>("#smb-username").value = form.username;
    el<HTMLInputElement>("#smb-password").value = form.password;
    el<HTMLInputElement>("#smb-domain").value = form.domain;
    el<HTMLInputElement>("#smb-port").value = form.port;
    el<HTMLInputElement>("#smb-folder").value = form.folder;
    el<HTMLInputElement>("#smb-remember").checked = form.remember;
  }

  private readForm(): SmbForm {
    return {
      host: el<HTMLInputElement>("#smb-host").value.trim(),
      share: el<HTMLInputElement>("#smb-share").value.trim(),
      username: el<HTMLInputElement>("#smb-username").value.trim(),
      password: el<HTMLInputElement>("#smb-password").value,
      domain: el<HTMLInputElement>("#smb-domain").value.trim() || "WORKGROUP",
      port: el<HTMLInputElement>("#smb-port").value.trim() || "445",
      folder: el<HTMLInputElement>("#smb-folder").value.trim(),
      remember: el<HTMLInputElement>("#smb-remember").checked,
    };
  }
}

function el<T extends HTMLElement>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Élément manquant: ${selector}`);
  return node;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
