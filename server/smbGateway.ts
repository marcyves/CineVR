import { createReadStream, promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { Readable } from "node:stream";
import type { Connect, Plugin } from "vite";

const require = createRequire(import.meta.url);
const SMB2 = require("@marsaud/smb2") as {
  new (opt: {
    share: string;
    domain: string;
    username: string;
    password: string;
    port?: number;
    packetConcurrency?: number;
    autoCloseTimeout?: number;
  }): SmbClient;
};

type SmbClient = {
  readdir(
    dir: string,
    options: { stats: true },
  ): Promise<Array<{ name: string; size?: number; isDirectory(): boolean }>>;
  getSize(file: string): Promise<number>;
  createReadStream(
    file: string,
    options: { start?: number; end?: number },
  ): Promise<Readable & { fileSize: number }>;
  disconnect(): void;
};

type EntryKind = "dir" | "video";

export type SmbEntry = {
  name: string;
  path: string;
  kind: EntryKind;
  size: number | null;
};

type Backend = {
  label: string;
  list(rel: string): Promise<SmbEntry[]>;
  fileSize(rel: string): Promise<number>;
  openStream(
    rel: string,
    start: number,
    end: number,
  ): Promise<{ stream: Readable; fileSize: number }>;
  close(): void;
};

type Session = {
  id: string;
  backend: Backend;
  createdAt: number;
};

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const VIDEO_EXT = new Set([".mp4", ".m4v", ".webm", ".mov", ".mkv"]);
const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
};

const sessions = new Map<string, Session>();

export function smbGateway(): Plugin {
  const handler = createHandler();
  return {
    name: "cinevr-smb",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

function createHandler(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.url ?? "";
    if (!url.startsWith("/api/smb")) {
      next();
      return;
    }
    void route(req, res).catch((error) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      json(res, 500, { error: explainError(error) });
    });
  };
}

async function route(
  req: Connect.IncomingMessage,
  res: Connect.ServerResponse,
): Promise<void> {
  pruneSessions();
  const url = new URL(req.url ?? "/", "http://cinevr.local");
  const pathname = url.pathname.replace(/\/$/, "") || "/";

  if (req.method === "GET" && pathname === "/api/smb/status") {
    json(res, 200, { available: true });
    return;
  }

  if (req.method === "POST" && pathname === "/api/smb/connect") {
    const body = await readJson(req);
    const host = String(body.host ?? "").trim();
    const share = String(body.share ?? "").trim();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const domain = String(body.domain ?? "").trim() || "WORKGROUP";
    const folder = String(body.folder ?? "").trim();
    const port = Number(body.port) || 445;
    if (!host) {
      json(res, 400, { error: "Indiquez l’adresse du serveur (IP ou nom)." });
      return;
    }

    const parsed = parseSmbTarget(host, share, folder);
    const backend =
      parsed.host.toLowerCase() === "demo"
        ? createDemoBackend()
        : await createSmbBackend({
            host: parsed.host,
            share: parsed.share,
            username: username || "Guest",
            password,
            domain,
            port: parsed.port ?? port,
          });

    try {
      await withTimeout(backend.list(parsed.folder), 12_000);
    } catch (error) {
      backend.close();
      json(res, 400, { error: explainError(error) });
      return;
    }

    const session = createSession(backend);
    res.setHeader(
      "Set-Cookie",
      `cinevr_smb=${session.id}; Path=/; SameSite=Lax; Max-Age=43200`,
    );
    json(res, 200, {
      ok: true,
      sid: session.id,
      path: parsed.folder,
      label: backend.label,
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/smb/disconnect") {
    const sid = sidFrom(req, url);
    const session = sid ? sessions.get(sid) : undefined;
    if (session) {
      session.backend.close();
      sessions.delete(session.id);
    }
    res.setHeader("Set-Cookie", "cinevr_smb=; Path=/; SameSite=Lax; Max-Age=0");
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && pathname === "/api/smb/list") {
    const session = requireSession(req, url, res);
    if (!session) return;
    const rel = sanitizeRelPath(url.searchParams.get("path") ?? "");
    const entries = await session.backend.list(rel);
    json(res, 200, {
      path: rel,
      parent: parentPath(rel),
      entries,
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/smb/file") {
    const session = requireSession(req, url, res);
    if (!session) return;
    const rel = sanitizeRelPath(url.searchParams.get("path") ?? "");
    if (!rel || !isVideoName(rel)) {
      json(res, 400, { error: "Ce fichier n’est pas une vidéo lisible." });
      return;
    }
    await streamFile(session.backend, rel, req, res);
    return;
  }

  json(res, 404, { error: "Route SMB inconnue." });
}

function requireSession(
  req: Connect.IncomingMessage,
  url: URL,
  res: Connect.ServerResponse,
): Session | null {
  const sid = sidFrom(req, url);
  const session = sid ? sessions.get(sid) : undefined;
  if (!session) {
    json(res, 401, {
      error: "Session SMB expirée. Reconnectez le disque réseau.",
    });
    return null;
  }
  return session;
}

function sidFrom(req: Connect.IncomingMessage, url: URL): string {
  const q = url.searchParams.get("sid") ?? "";
  if (q) return q;
  const cookie = req.headers.cookie ?? "";
  const m = /(?:^|;\s*)cinevr_smb=([0-9a-f]+)/i.exec(cookie);
  return m?.[1] ?? "";
}

function createSession(backend: Backend): Session {
  const id = randomBytes(16).toString("hex");
  const session: Session = { id, backend, createdAt: Date.now() };
  sessions.set(id, session);
  return session;
}

function pruneSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      session.backend.close();
      sessions.delete(id);
    }
  }
}

function createDemoBackend(): Backend {
  const root = path.resolve(process.cwd(), "public", "videos");
  return {
    label: "Démo locale (public/videos)",
    async list(rel) {
      const dir = resolveLocal(root, rel);
      const names = await fs.readdir(dir, { withFileTypes: true });
      const entries: SmbEntry[] = [];
      for (const item of names) {
        if (item.name.startsWith(".")) continue;
        const child = joinRel(rel, item.name);
        if (item.isDirectory()) {
          entries.push({ name: item.name, path: child, kind: "dir", size: null });
        } else if (isVideoName(item.name)) {
          const st = await fs.stat(path.join(dir, item.name));
          entries.push({
            name: item.name,
            path: child,
            kind: "video",
            size: st.size,
          });
        }
      }
      return sortEntries(entries);
    },
    async fileSize(rel) {
      const st = await fs.stat(resolveLocal(root, rel));
      if (st.isDirectory()) throw new Error("Ceci est un dossier.");
      return st.size;
    },
    async openStream(rel, start, end) {
      const file = resolveLocal(root, rel);
      const st = await fs.stat(file);
      const stream = createReadStream(file, { start, end });
      return { stream, fileSize: st.size };
    },
    close() {
      /* local folder */
    },
  };
}

async function createSmbBackend(opt: {
  host: string;
  share: string;
  username: string;
  password: string;
  domain: string;
  port: number;
}): Promise<Backend> {
  if (!opt.share) {
    throw new Error("Indiquez le nom du partage (ex. films, media, videos).");
  }
  const share = `\\\\${opt.host}\\${opt.share}`;
  const client = new SMB2({
    share,
    domain: opt.domain,
    username: opt.username,
    password: opt.password,
    port: opt.port,
    packetConcurrency: 20,
    autoCloseTimeout: 0,
  });
  return {
    label: `${opt.host}/${opt.share}`,
    async list(rel) {
      const dir = toSmbPath(rel);
      let rows: Array<{ name: string; size?: number; isDirectory(): boolean }>;
      try {
        rows = await client.readdir(dir, { stats: true });
      } catch (error) {
        if (dir) throw error;
        rows = await client.readdir(".", { stats: true });
      }
      const entries: SmbEntry[] = [];
      for (const row of rows) {
        const name = row.name;
        if (!name || name === "." || name === ".." || name.startsWith(".")) continue;
        const child = joinRel(rel, name);
        if (row.isDirectory()) {
          entries.push({ name, path: child, kind: "dir", size: null });
        } else if (isVideoName(name)) {
          entries.push({
            name,
            path: child,
            kind: "video",
            size: typeof row.size === "number" ? row.size : null,
          });
        }
      }
      return sortEntries(entries);
    },
    async fileSize(rel) {
      return client.getSize(toSmbPath(rel));
    },
    async openStream(rel, start, end) {
      const stream = await client.createReadStream(toSmbPath(rel), { start, end });
      return { stream, fileSize: stream.fileSize };
    },
    close() {
      try {
        client.disconnect();
      } catch {
        /* ignore */
      }
    },
  };
}

async function streamFile(
  backend: Backend,
  rel: string,
  req: Connect.IncomingMessage,
  res: Connect.ServerResponse,
): Promise<void> {
  const fileSize = await backend.fileSize(rel);
  const range = parseRange(req.headers.range, fileSize);
  if (req.headers.range && !range) {
    res.statusCode = 416;
    res.setHeader("Content-Range", `bytes */${fileSize}`);
    res.end();
    return;
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? fileSize - 1;
  const { stream } = await backend.openStream(rel, start, end);
  const ext = path.posix.extname(rel.replace(/\\/g, "/")).toLowerCase();
  res.statusCode = range ? 206 : 200;
  res.setHeader("Content-Type", MIME[ext] ?? "video/mp4");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Length", String(end - start + 1));
  if (range) res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
  res.setHeader("Cache-Control", "private, no-store");
  req.on("close", () => stream.destroy());
  stream.on("error", () => {
    if (!res.headersSent) json(res, 500, { error: "Lecture SMB interrompue." });
    else res.end();
  });
  stream.pipe(res);
}

function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | null {
  if (!header || size <= 0) return null;
  const m = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!m) return null;
  const hasStart = m[1] !== "";
  const hasEnd = m[2] !== "";
  if (!hasStart && hasEnd) {
    const suffix = Number(m[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    return { start: Math.max(size - suffix, 0), end: size - 1 };
  }
  const start = hasStart ? Number(m[1]) : 0;
  const end = hasEnd ? Number(m[2]) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

function parseSmbTarget(
  hostField: string,
  shareField: string,
  folderField: string,
): { host: string; share: string; folder: string; port?: number } {
  const raw = hostField.trim();
  const smbUrl = raw.match(/^smb:\/\/([^/]+)\/([^/]+)(?:\/(.*))?$/i);
  if (smbUrl) {
    const [host, port] = splitHostPort(smbUrl[1]);
    return {
      host,
      share: decodeURIComponent(smbUrl[2]),
      folder: folderField || (smbUrl[3] ? decodeURIComponent(smbUrl[3]) : ""),
      port,
    };
  }
  const unc = raw.match(/^\\\\([^\\]+)\\([^\\]+)(?:\\(.*))?$/);
  if (unc) {
    const [host, port] = splitHostPort(unc[1]);
    return {
      host,
      share: unc[2],
      folder: folderField || unc[3] || "",
      port,
    };
  }
  const [host, port] = splitHostPort(raw);
  return {
    host,
    share: shareField.replace(/^[/\\]+/, "").split(/[/\\]/)[0] ?? shareField,
    folder: folderField,
    port,
  };
}

function splitHostPort(raw: string): [string, number | undefined] {
  const cleaned = raw.replace(/^[/\\]+/, "");
  if (cleaned.includes("]") && cleaned.startsWith("[")) {
    return [cleaned, undefined];
  }
  const parts = cleaned.split(":");
  if (parts.length === 2 && /^\d+$/.test(parts[1])) {
    return [parts[0], Number(parts[1])];
  }
  return [cleaned.split(/[/\\]/)[0] ?? cleaned, undefined];
}

export function sanitizeRelPath(raw: string): string {
  const unified = decodeURIComponent(raw).replace(/\\/g, "/").trim();
  const parts = unified.split("/").filter((part) => part && part !== ".");
  if (parts.some((part) => part === "..")) {
    throw new Error("Chemin invalide.");
  }
  return parts.join("/");
}

function toSmbPath(rel: string): string {
  return rel.replace(/\//g, "\\");
}

function joinRel(dir: string, name: string): string {
  return dir ? `${dir.replace(/\\/g, "/")}/${name}` : name;
}

function parentPath(rel: string): string | null {
  if (!rel) return null;
  const parts = rel.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function isVideoName(name: string): boolean {
  const ext = path.posix.extname(name.replace(/\\/g, "/")).toLowerCase();
  return VIDEO_EXT.has(ext);
}

function sortEntries(entries: SmbEntry[]): SmbEntry[] {
  return entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
  });
}

function resolveLocal(root: string, rel: string): string {
  const target = path.resolve(root, ...sanitizeRelPath(rel).split("/").filter(Boolean));
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error("Chemin invalide.");
  }
  return target;
}

function json(
  res: Connect.ServerResponse,
  status: number,
  payload: Record<string, unknown>,
): void {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

function readJson(
  req: Connect.IncomingMessage,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > 32_768) {
        reject(new Error("Requête trop volumineuse."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
        resolve(parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {});
      } catch {
        reject(new Error("JSON invalide."));
      }
    });
    req.on("error", reject);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Délai dépassé. PC, casque et NAS doivent être sur le même réseau."));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function explainError(error: unknown): string {
  const err = error as { message?: string; code?: string };
  const blob = `${err.code ?? ""} ${err.message ?? error}`.toLowerCase();
  if (blob.includes("share is not valid")) {
    return "Nom de partage invalide. Exemple : films, media, videos.";
  }
  if (blob.includes("econnrefused") || blob.includes("econnreset")) {
    return "Le NAS ne répond pas. Vérifiez l’IP et que SMB (port 445) est ouvert.";
  }
  if (blob.includes("etimedout") || blob.includes("timeout") || blob.includes("timed out")) {
    return "Délai dépassé. PC, casque et NAS doivent être sur le même réseau.";
  }
  if (blob.includes("enotfound") || blob.includes("eai_again")) {
    return "Serveur introuvable. Utilisez l’adresse IP du NAS plutôt que le nom.";
  }
  if (blob.includes("logon_failure") || blob.includes("logon failure") || blob.includes("wrong_password")) {
    return "Identifiant ou mot de passe refusé par le NAS.";
  }
  if (blob.includes("bad_network_name") || blob.includes("bad network")) {
    return "Partage introuvable. Le nom doit être celui du dossier partagé, pas le chemin Windows.";
  }
  if (blob.includes("access_denied") || blob.includes("access denied")) {
    return "Accès refusé. Vérifiez le compte, et que le dossier est bien partagé.";
  }
  if (blob.includes("enoent") || blob.includes("no such file") || blob.includes("object_name_not_found")) {
    return "Dossier introuvable sur le partage.";
  }
  if (typeof err.message === "string" && err.message.trim()) return err.message;
  return "Connexion SMB impossible.";
}
