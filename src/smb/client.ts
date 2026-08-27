export type SmbEntry = {
  name: string;
  path: string;
  kind: "dir" | "video";
  size: number | null;
};

export type SmbList = {
  path: string;
  parent: string | null;
  entries: SmbEntry[];
};

export type SmbConnectResult = {
  ok: true;
  sid: string;
  path: string;
  label: string;
};

export type SmbForm = {
  host: string;
  share: string;
  username: string;
  password: string;
  domain: string;
  port: string;
  folder: string;
  remember: boolean;
};

const STORAGE_KEY = "cinevr.smb";

export async function smbAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/smb/status");
    if (!res.ok) return false;
    const data = (await res.json()) as { available?: boolean };
    return data.available === true;
  } catch {
    return false;
  }
}

export async function smbConnect(form: SmbForm): Promise<SmbConnectResult> {
  const res = await fetch("/api/smb/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      host: form.host,
      share: form.share,
      username: form.username,
      password: form.password,
      domain: form.domain,
      port: form.port ? Number(form.port) : 445,
      folder: form.folder,
    }),
  });
  const data = (await res.json()) as SmbConnectResult & { error?: string };
  if (!res.ok || !data.ok) throw new Error(data.error || "Connexion SMB refusée.");
  saveForm(form);
  sessionStorage.setItem("cinevr.smb.sid", data.sid);
  return data;
}

export async function smbDisconnect(): Promise<void> {
  const sid = sessionStorage.getItem("cinevr.smb.sid") ?? "";
  try {
    await fetch("/api/smb/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sid }),
    });
  } catch {
    /* ignore */
  }
  sessionStorage.removeItem("cinevr.smb.sid");
}

export async function smbList(dir: string): Promise<SmbList> {
  const sid = sessionStorage.getItem("cinevr.smb.sid") ?? "";
  const res = await fetch(
    `/api/smb/list?sid=${encodeURIComponent(sid)}&path=${encodeURIComponent(dir)}`,
  );
  const data = (await res.json()) as SmbList & { error?: string };
  if (!res.ok) throw new Error(data.error || "Lecture du dossier impossible.");
  return data;
}

export function smbFileUrl(filePath: string): string {
  const sid = sessionStorage.getItem("cinevr.smb.sid") ?? "";
  return `/api/smb/file?sid=${encodeURIComponent(sid)}&path=${encodeURIComponent(filePath)}`;
}

export function loadForm(): SmbForm {
  const empty: SmbForm = {
    host: "",
    share: "",
    username: "",
    password: "",
    domain: "WORKGROUP",
    port: "445",
    folder: "",
    remember: true,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<SmbForm>;
    return { ...empty, ...parsed };
  } catch {
    return empty;
  }
}

export function saveForm(form: SmbForm): void {
  const stored: SmbForm = {
    ...form,
    password: form.remember ? form.password : "",
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function formatSize(bytes: number | null): string {
  if (bytes == null || bytes < 0) return "";
  if (bytes < 1000) return `${bytes} o`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} ko`;
  if (bytes < 1_000_000_000) {
    const mo = bytes / 1_000_000;
    return `${mo >= 10 ? mo.toFixed(0) : mo.toFixed(1).replace(".", ",")} Mo`;
  }
  return `${(bytes / 1_000_000_000).toFixed(1).replace(".", ",")} Go`;
}
