import { fixtureBridge } from "../../frontend/src/bridge/fixture.ts";
import type { Bridge } from "../../frontend/src/bridge/index.ts";
import { versionNewer } from "../../frontend/src/engine/index.ts";
import type { Channel, FontFamilyEntry, InstalledFont, InstallRecord, MediaItem, SavedMedia, FolderView } from "../../frontend/src/engine/types.ts";
import storeFonts from "../../core/data/store-fonts.json";
import storeMedia from "../../core/data/store-media.json";
import { packageBytes, pickArtifact, trustedCatalogue } from "./catalogue.ts";
import { bundledFamilies, fontBytes, fontsReady, hasMedia, mediaBytes } from "./store.ts";
import { inspectBytes, inspectPath } from "./inspect.ts";
import * as lib from "./library.ts";
import { loadSamples } from "./samples.ts";
import { readFont } from "./sfnt.ts";
import { download, encoder, pause, sha256 } from "./util.ts";
import { readZip, writeZip } from "./zip.ts";

export const state = { corrupt: false, tamper: false };

const KEEP = "formportal.demo.installs";
const key = (product: string, channel: Channel) => `${product}:${channel}`;

interface Held extends InstallRecord {
  sha256: string;
  file: string;
  bytes: number;
  at: number;
}

const installed = new Map<string, Held>();
try {
  for (const held of JSON.parse(localStorage.getItem(KEEP) ?? "[]") as Held[]) installed.set(key(held.product, held.channel), held);
} catch {
  installed.clear();
}

function remember(): void {
  try {
    localStorage.setItem(KEEP, JSON.stringify(Array.from(installed.values())));
  } catch {
    return;
  }
}

export function forget(): void {
  try {
    localStorage.removeItem(KEEP);
  } catch {
    return;
  }
}

let ready: Promise<void> | null = null;
function samples(): Promise<void> {
  ready ??= loadSamples();
  return ready;
}

let rescan: (paths: string[]) => void = () => undefined;
const later = new Set<string>();

export function isInstalled(product: string): boolean {
  return Array.from(installed.values()).some((h) => h.product === product);
}

export function notifyKept(): void {
  rescan([]);
}

async function downloadAndVerify(product: string, channel: Channel, version: string | undefined, progress: (fraction: number) => void) {
  const catalog = await trustedCatalogue(state.tamper);
  const latest = catalog.products.find((p) => p.id === product)?.channels[channel];
  const release = version ? [latest, ...(latest?.history ?? [])].find((r) => r?.version === version) : latest;
  if (!release) throw new Error(`the catalogue offers this computer nothing for ${product}${version ? ` ${version}` : ""}`);
  const platform = await fixtureBridge.platform();
  const artifact = pickArtifact(release.artifacts, platform.os, platform.arch);
  if (!artifact) throw new Error(`${product} ${release.version} has no download for this computer`);
  let data = packageBytes(product, release.version, artifact.file);
  progress(0.05);
  for (let step = 1; step <= 6; step += 1) {
    await pause(70);
    progress(0.05 + step * 0.1);
  }
  if (state.corrupt) {
    state.corrupt = false;
    const box = document.querySelector<HTMLInputElement>("[data-demo-corrupt]");
    if (box) box.checked = false;
    data = data.slice();
    data[data.length >> 1] ^= 1;
  }
  const got = await sha256(data);
  progress(0.75);
  if (got !== artifact.sha256) {
    throw new Error(`the download of ${artifact.file} did not match the catalogue (expected sha256 ${artifact.sha256.slice(0, 12)}, got ${got.slice(0, 12)}); nothing was unpacked and nothing was installed`);
  }
  const entries = await readZip(data);
  const bad = entries.find((e) => !e.crcOk);
  if (bad) throw new Error(`${bad.name} in ${artifact.file} fails its CRC-32; nothing was installed`);
  progress(0.95);
  return { release, artifact, got, bytes: data.length };
}

async function install(product: string, channel: Channel, progress: (fraction: number) => void, version?: string): Promise<InstallRecord> {
  const { release, artifact, got, bytes } = await downloadAndVerify(product, channel, version, progress);
  const prefs = await fixtureBridge.preferences();
  const latest = (await trustedCatalogue(false)).products.find((p) => p.id === product)?.channels[channel];
  if (version && latest && versionNewer(latest.version, release.version) && prefs.per_app[product] !== false && (prefs.per_app[product] || prefs.auto_update)) {
    await fixtureBridge.setPreferences({ ...prefs, per_app: { ...prefs.per_app, [product]: false } });
  }
  const before = installed.get(key(product, channel));
  const kept = before && before.version !== release.version ? before.version : (before?.previous ?? null);
  const held: Held = { product, channel, version: release.version, previous: prefs.keep_previous ? kept : null, sha256: got, file: artifact.file, bytes, at: Math.floor(Date.now() / 1000) };
  installed.set(key(product, channel), held);
  remember();
  progress(1);
  return { product, channel, version: held.version, previous: held.previous };
}

const plain = (h: Held): InstallRecord => ({ product: h.product, channel: h.channel, version: h.version, previous: h.previous });

const fontIndex: FontFamilyEntry[] = (storeFonts as unknown as { families: FontFamilyEntry[] }).families.filter((f) => bundledFamilies.has(f.id));
const fontsIn: InstalledFont[] = [];
const faces = new Map<string, FontFace>();
const picked = new Map<string, File>();

function register(id: string, family: string, weight: number, italic: boolean, data: Uint8Array): void {
  const old = faces.get(id);
  if (old) document.fonts.delete(old);
  const face = new FontFace(family, data.slice().buffer as ArrayBuffer, { weight: String(weight), style: italic ? "italic" : "normal" });
  void face.load().then((done) => {
    document.fonts.add(done);
    faces.set(id, done);
  });
}

const mediaIndex: MediaItem[] = (storeMedia as unknown as { items: MediaItem[] }).items
  .filter((m) => hasMedia(m.file))
  .map((m) => ({ ...m, product: m.product ?? null, thumbnail: m.thumbnail ? m.thumbnail.replace(/^\//, "") : null }));
const savedMedia: SavedMedia[] = [];
const credit = (m: MediaItem) => (m.licence === "CC0-1.0" ? `${m.title} by ${m.creator}, public domain (CC0 1.0), ${m.source_url}` : `${m.title} by ${m.creator}, licensed ${m.licence}, ${m.source_url}`);

export async function addFiles(files: File[]): Promise<string[]> {
  await samples();
  const paths: string[] = [];
  for (const file of files.slice(0, 60)) {
    if (file.size > 40_000_000) continue;
    paths.push(await lib.put(lib.YOURS, file.name, new Uint8Array(await file.arrayBuffer()), file.type, "first seen"));
  }
  if (paths.length) rescan(paths);
  return paths;
}

function chooseFiles(options: { directory?: boolean; accept?: string }): Promise<File[]> {
  return new Promise((done) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    if (options.directory) input.setAttribute("webkitdirectory", "");
    if (options.accept) input.accept = options.accept;
    input.addEventListener("change", () => done(Array.from(input.files ?? [])));
    input.addEventListener("cancel", () => done([]));
    input.click();
  });
}

export const demoBridge: Bridge = {
  ...fixtureBridge,
  catalog: async () => trustedCatalogue(state.tamper),
  catalogKept: async () => trustedCatalogue(false),
  installs: async () => Array.from(installed.values()).map(plain),
  install,
  open: async (product, channel) => {
    const held = installed.get(key(product, channel));
    if (!held) throw new Error(`${product} is not installed`);
    const catalog = await trustedCatalogue(false);
    const release = [catalog.products.find((p) => p.id === product)?.channels[channel]].flatMap((r) => (r ? [r, ...(r.history ?? [])] : [])).find((r) => r.version === held.version);
    const expected = release?.artifacts.find((a) => a.file === held.file)?.sha256;
    const data = packageBytes(product, held.version, held.file);
    const now = await sha256(data);
    await inspectBytes(held.file, now === expected ? `${product} ${held.version}, re-checked against the catalogue just now: it matches` : `${product} ${held.version}: it no longer matches the catalogue`, data);
  },
  rollback: async (product, channel) => {
    const held = installed.get(key(product, channel));
    if (!held || !held.previous) throw new Error(`there is no earlier version of ${product} to go back to`);
    const catalog = await trustedCatalogue(false);
    const latest = catalog.products.find((p) => p.id === product)?.channels[channel];
    const release = [latest, ...(latest?.history ?? [])].find((r) => r?.version === held.previous);
    const platform = await fixtureBridge.platform();
    const artifact = release ? pickArtifact(release.artifacts, platform.os, platform.arch) : undefined;
    if (!release || !artifact) throw new Error(`the kept copy of ${product} ${held.previous} is gone`);
    const data = packageBytes(product, release.version, artifact.file);
    if ((await sha256(data)) !== artifact.sha256) throw new Error(`the kept copy of ${product} ${held.previous} fails its SHA-256; it was not restored`);
    const next: Held = { ...held, version: release.version, previous: held.version, sha256: artifact.sha256, file: artifact.file, bytes: data.length, at: Math.floor(Date.now() / 1000) };
    installed.set(key(product, channel), next);
    remember();
    return plain(next);
  },
  remove: async (product, channel) => {
    if (!installed.delete(key(product, channel))) throw new Error(`${product} is not installed`);
    remember();
  },
  stillOpen: async () => [],
  laterList: async () => Array.from(later),
  updateLater: async (product, channel, on) => {
    if (on && !installed.has(key(product, channel))) throw new Error(`${product} is not installed`);
    if (on) later.add(key(product, channel));
    else later.delete(key(product, channel));
    return Array.from(later);
  },
  autoUpdate: async (progress) => {
    const catalog = await trustedCatalogue(false);
    const prefs = await fixtureBridge.preferences();
    const done = [];
    for (const record of Array.from(installed.values())) {
      const release = catalog.products.find((p) => p.id === record.product)?.channels[record.channel];
      if (!release || !versionNewer(release.version, record.version)) continue;
      const own = prefs.per_app[record.product];
      const automatic = own !== undefined ? own && (record.channel === "stable" || prefs.auto_update_beta) : record.channel === "stable" ? prefs.auto_update : prefs.auto_update && prefs.auto_update_beta;
      const k = key(record.product, record.channel);
      if (!(automatic || later.has(k))) continue;
      try {
        await install(record.product, record.channel, (f) => progress(record.product, record.channel, f));
        later.delete(k);
        done.push({ product: record.product, channel: record.channel, from: record.version, to: release.version, error: null });
      } catch (e) {
        done.push({ product: record.product, channel: record.channel, from: record.version, to: release.version, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return done;
  },
  repair: async () => {
    const catalog = await trustedCatalogue(false);
    const findings = [];
    for (const held of installed.values()) {
      const release = catalog.products.find((p) => p.id === held.product)?.channels[held.channel];
      const artifact = [release, ...(release?.history ?? [])].find((r) => r?.version === held.version)?.artifacts.find((a) => a.file === held.file);
      if (!artifact || (await sha256(packageBytes(held.product, held.version, held.file))) !== artifact.sha256) {
        findings.push({ kind: "broken" as const, product: held.product, channel: held.channel, path: held.file, bytes: held.bytes, problem: `${held.product} ${held.version} no longer matches the catalogue`, fix: "install the same version again", fixed: false, error: null });
      }
    }
    return { checked: installed.size, findings, fixed: 0, freed: 0 };
  },
  storage: async () => {
    const apps = Array.from(installed.values()).reduce((n, h) => n + h.bytes, 0);
    const folders: FolderView[] = lib.folderViews();
    return {
      formportal: [
        { what: "Installed apps", path: "~/.local/share/formportal/apps", bytes: apps },
        { what: "File versions", path: "~/.local/share/formportal/history", bytes: lib.totalBytes() },
      ],
      formportal_bytes: apps + lib.totalBytes(),
      folders,
    };
  },
  onFileDrop: (handler) => {
    document.addEventListener("dragover", (event) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.preventDefault();
      handler([], "over");
    });
    document.addEventListener("dragleave", (event) => {
      if (!event.relatedTarget) handler([], "leave");
    });
    document.addEventListener("drop", (event) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.preventDefault();
      const dropped = Array.from(event.dataTransfer.files);
      void addFiles(dropped).then((paths) => {
        handler(paths, "drop");
        if (paths[0]) void inspectPath(paths[0]);
      });
    });
  },
  onVersionsKept: (handler) => {
    rescan = handler;
  },
  filesScan: async (query) => {
    await samples();
    return { scan: { folders: lib.folderViews(), files: lib.scan(query), truncated: false, new_versions: 0 }, suggested: lib.YOURS };
  },
  folderPick: async () => {
    const files = await chooseFiles({ directory: true });
    if (!files.length) return null;
    await samples();
    const root = (files[0].webkitRelativePath || files[0].name).split("/")[0];
    const folder = `/Picked/${root}`;
    lib.addFolder(folder);
    for (const file of files.slice(0, 200)) {
      if (file.size > 40_000_000) continue;
      const rel = (file.webkitRelativePath || file.name).split("/").slice(1).join(" - ") || file.name;
      await lib.put(folder, rel, new Uint8Array(await file.arrayBuffer()), file.type, "first seen");
    }
    return folder;
  },
  folderAdd: async (path) => {
    if (!path.startsWith("/")) throw new Error(`${path} is not a full path; give the whole path to the folder`);
    lib.addFolder(path);
  },
  folderRemove: async (path) => {
    if (!lib.removeFolder(path)) throw new Error(`${path} is not one of FormPortal's folders`);
  },
  fileOpen: async (path) => {
    if (!(await inspectPath(path))) throw new Error(`${path} does not exist`);
    return lib.current(path)?.product ?? "formai";
  },
  fileVersions: async (path, action, version) => {
    if (!lib.has(path)) throw new Error(`${path} does not exist`);
    if (action === "save") return lib.keep(path, "kept by hand");
    if (action === "revert") return lib.revert(path, version);
    return lib.versions(path);
  },
  filePreview: async (path) => {
    const url = lib.previewUrl(path.replace(/\.preview\.webp$/, ""));
    if (!url) throw new Error("only a project's preview is shown");
    return url;
  },
  media: async () => ({ index: { items: mediaIndex }, credits: mediaIndex.map(credit), index_error: null, saved: savedMedia.map((s) => ({ ...s })), library: "Library" }),
  mediaThumb: async (url) => `./${url.replace(/^\.?\//, "")}`,
  mediaSave: async (id, useTemplate) => {
    const item = mediaIndex.find((m) => m.id === id);
    if (!item) throw new Error(`${id} is not in the media index`);
    const wanted = (storeMedia as unknown as { items: { id: string; sha256: string }[] }).items.find((m) => m.id === id)?.sha256;
    const data = mediaBytes(item.file);
    if (!data) throw new Error(`${item.file} is not bundled in the demo`);
    if ((await sha256(data)) !== wanted) throw new Error(`${item.file} does not match its SHA-256 in the media index; it was not saved`);
    const line = credit(item);
    download(`${item.id}.zip`, writeZip([{ name: item.file, data }, { name: "CREDIT.txt", data: encoder.encode(`${line}\n`) }]), "application/zip");
    if (!savedMedia.some((s) => s.id === id)) savedMedia.push({ id, title: item.title, kind: item.kind, creator: item.creator, licence: item.licence, source_url: item.source_url, file: `Library/${item.kind}/${item.file}`, credit: line });
    return useTemplate ? { copied_to: `Downloads/${item.id}.zip`, opened_with: null } : {};
  },
  mediaRemove: async (id) => {
    const at = savedMedia.findIndex((s) => s.id === id);
    if (at >= 0) savedMedia.splice(at, 1);
  },
  fonts: async () => {
    await fontsReady;
    return { index: { families: fontIndex }, index_error: null, installed: fontsIn.map((f) => ({ ...f })), updates: [], folder: "~/.local/share/fonts/FormPortal" };
  },
  fontInstall: async (id, style) => {
    const family = fontIndex.find((f) => f.id === id);
    if (!family) throw new Error(`${id} is not in the font index`);
    for (const s of family.styles.filter((x) => !style || x.style === style)) {
      const data = fontBytes(s.url.replace(/^bundled:/, ""));
      if (!data) throw new Error(`${s.file} is not bundled in the demo`);
      if ((await sha256(data)) !== s.sha256) throw new Error(`${s.file} does not match its SHA-256 in the font index; it was not installed`);
      register(`${id}:${s.style}`, family.family, s.weight, s.italic, data);
      if (!fontsIn.some((f) => f.family_id === id && f.style === s.style)) {
        fontsIn.push({ family: family.family, style: s.style, family_id: id, file: `~/.local/share/fonts/FormPortal/FormPortal-${id}-${s.style}.ttf`, sha256: s.sha256, source: "index", licence: family.licence });
      }
    }
  },
  fontPick: async () => {
    const [file] = await chooseFiles({ accept: ".ttf,.otf" });
    if (!file) return null;
    picked.set(`/Picked/${file.name}`, file);
    return `/Picked/${file.name}`;
  },
  fontAdd: async (path, rights) => {
    if (!rights) throw new Error("adding your own font needs your confirmation that you have the right to use it on this computer");
    const file = picked.get(path);
    if (!file) throw new Error(`${path} was not picked in this session`);
    const data = new Uint8Array(await file.arrayBuffer());
    const facts = readFont(data);
    register(`own:${facts.style}`, facts.family, 400, false, data);
    fontsIn.push({ family: facts.family, style: facts.style, family_id: null, file: `~/.local/share/fonts/FormPortal/FormPortal-own-${file.name}`, sha256: await sha256(data), source: "own", licence: null });
  },
  fontRemove: async (family, style) => {
    for (let i = fontsIn.length - 1; i >= 0; i -= 1) {
      const f = fontsIn[i];
      if ((f.family === family || f.family_id === family) && (!style || f.style === style)) {
        const face = faces.get(`${f.family_id ?? "own"}:${f.style}`);
        if (face) document.fonts.delete(face);
        fontsIn.splice(i, 1);
      }
    }
  },
};
