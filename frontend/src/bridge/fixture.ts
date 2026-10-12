import apps from "../../../catalog/fixtures/apps.json";
import extensions from "../../../catalog/fixtures/extensions.json";
import { DEFAULT_PREFS, versionNewer } from "../engine/index.ts";
import type { AgentClient, FileVersion, FolderView, ProjectFile, Catalog, Channel, ExtensionIndex, InstalledExtension, InstallRecord, Os, Platform, Preferences, UpdateOutcome } from "../engine/types.ts";
import type { Bridge } from "./index.ts";

function browserPlatform(): Platform {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const name = nav.userAgentData?.platform || nav.platform || "";
  let os: Os = "other";
  if (/Mac/i.test(name)) os = "macos";
  else if (/Win/i.test(name)) os = "windows";
  else if (/Linux|X11/i.test(name)) os = "linux";
  return { os, arch: os === "macos" ? "arm64" : "x86_64" };
}

const catalog = apps as unknown as Catalog;
const installed = new Map<string, InstallRecord>();
const pause = (ms: number) => new Promise<void>((done) => window.setTimeout(done, ms));
const key = (product: string, channel: Channel) => `${product}:${channel}`;
const SAMPLE = "/home/you/Documents/Form";
const folders: FolderView[] = new URLSearchParams(window.location.search).has("files") ? [{ path: SAMPLE, keep_versions: true, exists: true, files: 0, bytes: 0 }] : [];
const day = 86400;
const stamp = Math.floor(Date.parse("2026-10-12T09:00:00Z") / 1000);
const sampleFiles = (folder: string): ProjectFile[] => [
  { path: `${folder}/Trailer.fc`, name: "Trailer.fc", folder, product: "formcut", bytes: 18_400_000, modified: stamp, versions: 4 },
  { path: `${folder}/Posters/Launch poster.fmv`, name: "Launch poster.fmv", folder, product: "formvis", bytes: 52_300_000, modified: stamp - day, versions: 2 },
  { path: `${folder}/Audio/Interview mix.fmw`, name: "Interview mix.fmw", folder, product: "formwav", bytes: 9_100_000, modified: stamp - 3 * day, versions: 1 },
  { path: `${folder}/Cutdowns/Teaser 15s.fc`, name: "Teaser 15s.fc", folder, product: "formcut", bytes: 4_200_000, modified: stamp - 9 * day, versions: 1 },
];
const kept = new Map<string, FileVersion[]>();
const versionsOf = (path: string, count: number): FileVersion[] => {
  if (!kept.has(path)) kept.set(path, Array.from({ length: count }, (_, i) => ({ id: `${stamp - i * day}-${(i + 1).toString(16).padStart(12, "0")}`, at: stamp - i * day, size: 1000 * (count - i), sha256: "0".repeat(64), reason: i === count - 1 ? "first seen" : "changed since the last version" })));
  return kept.get(path) ?? [];
};
const LABELS: Record<AgentClient["client"], string> = { claude: "Claude Code", codex: "Codex", cursor: "Cursor" };
const linked = new Set<string>();
const agentsFor = (product: string, channel: Channel): AgentClient[] =>
  (["claude", "codex", "cursor"] as const).map((client) => ({ client, label: LABELS[client], state: linked.has(`${key(product, channel)}:${client}`) ? "connected" : "not-connected", note: null }));

for (const seed of (new URLSearchParams(window.location.search).get("installed") ?? "").split(",")) {
  const [product, version] = seed.split(":");
  if (product && version) installed.set(key(product, "stable"), { product, channel: "stable", version, previous: null });
}

const extInstalled = new Map<string, InstalledExtension>();

let prefs: Preferences ={ ...DEFAULT_PREFS, auto_update: new URLSearchParams(window.location.search).get("auto") !== "off", per_app: {} };

function missing(product: string): Error {
  return new Error(`${product} is not installed`);
}

export const fixtureBridge: Bridge = {
  source: "fixture",
  platform: async () => browserPlatform(),
  catalog: async () => {
    if (new URLSearchParams(window.location.search).has("offline")) throw new Error("the download did not complete: no network (browser mode, ?offline)");
    return catalog;
  },
  extensions: async () => ({ index: extensions as unknown as ExtensionIndex, index_error: null, installed: Array.from(extInstalled.values()) }),
  installExtension: async ({ id, path }) => {
    const index = extensions as unknown as ExtensionIndex;
    const entry = id ? index.packages.find((p) => p.id === id) : undefined;
    if (id && !entry) throw new Error(`${id} is not in the extension index`);
    const name = path ? path.split(/[\\/]/).pop()?.replace(/\.formpkg$/i, "") ?? "package" : "";
    const record: InstalledExtension = entry
      ? { id: entry.id, name: entry.name, product: entry.product, kind: entry.kind, version: entry.version, sha256: entry.sha256, source: "catalogue", signed_by: entry.signature?.publisher ?? null, native: entry.native, permissions: entry.permissions, enabled: true }
      : { id: name, name, product: "formcut", kind: "preset", version: "0.1.0", sha256: "", source: "sideload", signed_by: null, native: false, permissions: [], enabled: true };
    await pause(300);
    extInstalled.set(`${record.product}:${record.id}`, record);
    return record;
  },
  removeExtension: async (product, id) => {
    if (!extInstalled.delete(`${product}:${id}`)) throw new Error(`the extension ${id} for ${product} is not installed`);
  },
  enableExtension: async (product, id, enabled) => {
    const record = extInstalled.get(`${product}:${id}`);
    if (!record) throw new Error(`the extension ${id} for ${product} is not installed`);
    extInstalled.set(`${product}:${id}`, { ...record, enabled });
  },
  selfUpdateCheck: async () => {
    await pause(200);
    const offered = new URLSearchParams(window.location.search).get("self");
    return { configured: offered !== null, current: "0.0.0", available: offered || null, notes: null };
  },
  selfUpdateInstall: async () => {
    await pause(300);
    throw new Error("the browser mode cannot restart FormPortal");
  },
  onPackage: (handler) => {
    const path = new URLSearchParams(window.location.search).get("package");
    if (path) handler(path);
  },
  installs: async () => Array.from(installed.values()),
  install: async (product, channel, progress, version) => {
    const latest = catalog.products.find((p) => p.id === product)?.channels[channel];
    const release = version ? [latest, ...(latest?.history ?? [])].find((r) => r?.version === version) : latest;
    if (!release) throw new Error(`the catalogue offers this computer nothing for ${product}${version ? ` ${version}` : ""}`);
    for (let step = 1; step <= 10; step += 1) {
      await pause(90);
      progress(step / 10);
    }
    const before = installed.get(key(product, channel));
    if (version && latest && versionNewer(latest.version, release.version) && prefs.per_app[product] !== false && (prefs.per_app[product] || prefs.auto_update)) {
      prefs = { ...prefs, per_app: { ...prefs.per_app, [product]: false } };
    }
    const kept = before && before.version !== release.version ? before.version : (before?.previous ?? null);
    const record: InstallRecord = { product, channel, version: release.version, previous: prefs.keep_previous ? kept : null };
    installed.set(key(product, channel), record);
    return record;
  },
  open: async (product, channel) => {
    if (!installed.has(key(product, channel))) throw missing(product);
  },
  rollback: async (product, channel) => {
    const record = installed.get(key(product, channel));
    if (!record || !record.previous) throw missing(`an earlier version of ${product}`);
    const swapped: InstallRecord = { product, channel, version: record.previous, previous: record.version };
    installed.set(key(product, channel), swapped);
    return swapped;
  },
  remove: async (product, channel) => {
    if (!installed.delete(key(product, channel))) throw missing(product);
  },
  onLink: (handler) => {
    const link = new URLSearchParams(window.location.search).get("link");
    if (link) handler(link);
  },
  stillOpen: async (product) => ((new URLSearchParams(window.location.search).get("open") ?? "").split(",").includes(product) ? [4242] : []),
  openWeb: async (url) => {
    window.open(url, "_blank", "noopener");
  },
  filesScan: async (query) => {
    await pause(150);
    const words = (query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const files = folders.flatMap((f) => sampleFiles(f.path)).filter((f) => words.every((w) => `${f.name} ${f.product}`.toLowerCase().includes(w)));
    const views = folders.map((f) => ({ ...f, files: sampleFiles(f.path).length, bytes: sampleFiles(f.path).reduce((n, x) => n + x.bytes, 0) }));
    return { scan: { folders: views, files: files.map((f) => ({ ...f, versions: versionsOf(f.path, f.versions).length })), truncated: false, new_versions: 0 }, suggested: SAMPLE };
  },
  folderPick: async () => SAMPLE,
  folderAdd: async (path, keepVersions) => {
    if (!path.startsWith("/")) throw new Error(`${path} is not a full path; give the whole path to the folder`);
    if (!folders.some((f) => f.path === path)) folders.push({ path, keep_versions: keepVersions, exists: true, files: 0, bytes: 0 });
  },
  folderRemove: async (path) => {
    const at = folders.findIndex((f) => f.path === path);
    if (at < 0) throw new Error(`${path} is not one of FormPortal's folders`);
    folders.splice(at, 1);
  },
  fileOpen: async (path) => {
    const file = folders.flatMap((f) => sampleFiles(f.path)).find((f) => f.path === path);
    if (!file) throw new Error(`${path} does not exist`);
    if (!installed.has(key(file.product, "stable"))) throw new Error(`${file.product}, which opens ${path.slice(path.lastIndexOf("."))} files, is not installed`);
    return file.product;
  },
  fileVersions: async (path, action, version) => {
    const list = kept.get(path) ?? versionsOf(path, 1);
    if (action === "save") list.unshift({ id: `${stamp + 60}-${"a".repeat(12)}`, at: stamp + 60, size: list[0]?.size ?? 0, sha256: "a".repeat(64), reason: "saved by hand" });
    if (action === "revert") {
      const target = list.find((v) => v.id === version);
      if (!target) throw new Error(`${version} is not a version of ${path}`);
      list.unshift({ ...target, id: `${stamp + 120}-${"b".repeat(12)}`, at: stamp + 120, reason: "went back to an earlier version" });
    }
    kept.set(path, list);
    return [...list];
  },
  storage: async () => ({
    formportal: [
      { what: "Installed apps", path: "~/.local/share/formportal/apps", bytes: 231_000_000 * installed.size },
      { what: "Downloads in progress", path: "~/.local/share/formportal/downloads", bytes: 0 },
      { what: "Extensions", path: "~/.local/share/formportal/extensions", bytes: 120_000 },
      { what: "File versions", path: "~/.local/share/formportal/history", bytes: 41_000_000 },
      { what: "Catalogue copy", path: "~/.local/share/formportal/catalog", bytes: 9_000 },
    ],
    formportal_bytes: 231_000_000 * installed.size + 41_129_000,
    folders: folders.map((f) => ({ ...f, bytes: sampleFiles(f.path).reduce((n, x) => n + x.bytes, 0) })),
  }),
  appAgents: async (product, channel) => {
    const surface = installed.has(key(product, channel)) && (new URLSearchParams(window.location.search).get("agents") ?? "").split(",").includes(product);
    return { surface, server_name: channel === "stable" ? product : `${product}-${channel}`, clients: surface ? agentsFor(product, channel) : [] };
  },
  connectAgents: async (product, channel, disconnect) => {
    await pause(300);
    for (const client of ["claude", "codex", "cursor"]) {
      const id = `${key(product, channel)}:${client}`;
      if (disconnect) linked.delete(id);
      else linked.add(id);
    }
    return agentsFor(product, channel);
  },
  policy: async () =>
    new URLSearchParams(window.location.search).get("policy") === "locked"
      ? {
          managed_by: "Example IT",
          system: true,
          path: "/etc/formportal/policy.json",
          locked: ["catalog", "allow_unsigned", "auto_update", "per_app"],
          catalog: "https://apps.example.internal/formportal/apps.json",
          apps: ["formcut", "formvis"],
          channels: ["stable"],
          extensions: true,
          sideload: false,
        }
      : null,
  preferences: async () => ({ ...prefs, per_app: { ...prefs.per_app } }),
  setPreferences: async (next) => {
    prefs = { ...next, per_app: { ...next.per_app } };
  },
  autoUpdate: async (progress) => {
    const done: UpdateOutcome[] = [];
    for (const record of Array.from(installed.values())) {
      const release = catalog.products.find((p) => p.id === record.product)?.channels[record.channel];
      if (!release || !versionNewer(release.version, record.version)) continue;
      const own = prefs.per_app[record.product];
      const automatic = own !== undefined ? own && (record.channel === "stable" || prefs.auto_update_beta) : record.channel === "stable" ? prefs.auto_update : prefs.auto_update && prefs.auto_update_beta;
      if (!automatic) continue;
      await fixtureBridge.install(record.product, record.channel, (f) => progress(record.product, record.channel, f));
      done.push({ product: record.product, channel: record.channel, from: record.version, to: release.version, error: null });
    }
    return done;
  },
};
