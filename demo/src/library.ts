import type { FileVersion, FolderView, ProjectFile } from "../../frontend/src/engine/types.ts";
import { sha256 } from "./util.ts";

interface Kept extends FileVersion {
  data: Uint8Array;
}

interface Entry {
  path: string;
  name: string;
  folder: string;
  product: string | null;
  modified: number;
  kept: Kept[];
  type: string;
}

const entries = new Map<string, Entry>();
const folders = new Map<string, boolean>();
let serial = 0;

export const SAMPLES = "/Demo/Samples";
export const YOURS = "/Demo/Your files";

const extras: Record<string, string> = { json: "formai", zip: "formai", formpkg: "formai", ttf: "formai", otf: "formai", sig: "" };

export function fileApps(): Record<string, string> {
  const host = document.querySelector<HTMLElement>("[data-file-apps]");
  let base: Record<string, string> = {};
  try {
    base = JSON.parse(host?.dataset.fileApps ?? "{}") as Record<string, string>;
  } catch {
    base = {};
  }
  return { ...base, ...extras };
}

export function extOf(name: string): string {
  return name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase() : "";
}

export function productFor(name: string): string | null {
  return fileApps()[extOf(name)] || null;
}

export function addFolder(path: string): void {
  if (!folders.has(path)) folders.set(path, true);
}

export function removeFolder(path: string): boolean {
  if (!folders.delete(path)) return false;
  for (const [key, entry] of entries) if (entry.folder === path) entries.delete(key);
  return true;
}

export async function put(folder: string, name: string, data: Uint8Array, type: string, reason: string): Promise<string> {
  addFolder(folder);
  const path = `${folder}/${name}`;
  const at = Math.floor(Date.now() / 1000);
  const version: Kept = { id: `${at}-${(serial += 1).toString(16).padStart(12, "0")}`, at, size: data.length, sha256: await sha256(data), reason, data };
  const had = entries.get(path);
  if (had) {
    had.kept.unshift(version);
    had.modified = at;
    return path;
  }
  entries.set(path, { path, name, folder, product: productFor(name), modified: at, kept: [version], type });
  return path;
}

export function has(path: string): boolean {
  return entries.has(path);
}

export function current(path: string): { data: Uint8Array; name: string; type: string; sha256: string; product: string | null } | null {
  const entry = entries.get(path);
  if (!entry) return null;
  const top = entry.kept[0];
  return { data: top.data, name: entry.name, type: entry.type, sha256: top.sha256, product: entry.product };
}

export function sidecar(path: string, suffix: string): Uint8Array | null {
  return entries.get(`${path}${suffix}`)?.kept[0].data ?? null;
}

export function folderViews(): FolderView[] {
  return Array.from(folders.keys()).map((path) => {
    const list = listed().filter((f) => f.folder === path);
    return { path, keep_versions: true, exists: true, files: list.length, bytes: list.reduce((n, f) => n + f.bytes, 0) };
  });
}

function listed(): ProjectFile[] {
  return Array.from(entries.values())
    .filter((e) => e.product)
    .map((e) => ({
      path: e.path,
      name: e.name,
      folder: e.folder,
      product: e.product as string,
      bytes: e.kept[0].size,
      modified: e.modified,
      versions: e.kept.length,
      preview: e.type.startsWith("image/") && e.type !== "image/svg+xml" ? `${e.path}.preview.webp` : null,
    }));
}

export function scan(query?: string): ProjectFile[] {
  const words = (query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return listed().filter((f) => words.every((w) => `${f.name} ${f.product}`.toLowerCase().includes(w)));
}

export function versions(path: string): FileVersion[] {
  return (entries.get(path)?.kept ?? []).map(({ id, at, size, sha256: hash, reason }) => ({ id, at, size, sha256: hash, reason }));
}

export async function keep(path: string, reason: string): Promise<FileVersion[]> {
  const entry = entries.get(path);
  if (!entry) throw new Error(`${path} does not exist`);
  const top = entry.kept[0];
  await put(entry.folder, entry.name, top.data, entry.type, reason);
  return versions(path);
}

export async function revert(path: string, id: string | undefined): Promise<FileVersion[]> {
  const entry = entries.get(path);
  const target = entry?.kept.find((v) => v.id === id);
  if (!entry || !target) throw new Error(`${id ?? "that version"} is not a version of ${path}`);
  await put(entry.folder, entry.name, target.data, entry.type, "went back to an earlier version");
  return versions(path);
}

export function previewUrl(path: string): string | null {
  const entry = entries.get(path);
  if (!entry) return null;
  return URL.createObjectURL(new Blob([entry.kept[0].data as BlobPart], { type: entry.type }));
}

export function totalBytes(): number {
  return Array.from(entries.values()).reduce((n, e) => n + e.kept.reduce((m, v) => m + v.size, 0), 0);
}
