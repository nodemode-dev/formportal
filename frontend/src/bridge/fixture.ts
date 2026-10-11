import apps from "../../../catalog/fixtures/apps.json";
import extensions from "../../../catalog/fixtures/extensions.json";
import { DEFAULT_PREFS, versionNewer } from "../engine/index.ts";
import type { Catalog, Channel, ExtensionIndex, InstalledExtension, InstallRecord, Os, Platform, Preferences, UpdateOutcome } from "../engine/types.ts";
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
  catalog: async () => catalog,
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
