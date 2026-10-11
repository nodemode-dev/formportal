import apps from "../../../catalog/fixtures/apps.json";
import extensions from "../../../catalog/fixtures/extensions.json";
import type { Catalog, Channel, ExtensionIndex, InstallRecord, Os, Platform } from "../engine/types.ts";
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

function missing(product: string): Error {
  return new Error(`${product} is not installed`);
}

export const fixtureBridge: Bridge = {
  source: "fixture",
  platform: async () => browserPlatform(),
  catalog: async () => catalog,
  extensions: async () => extensions as unknown as ExtensionIndex,
  installs: async () => Array.from(installed.values()),
  install: async (product, channel, progress) => {
    const release = catalog.products.find((p) => p.id === product)?.channels[channel];
    if (!release) throw new Error(`the catalogue offers this computer nothing for ${product}`);
    for (let step = 1; step <= 10; step += 1) {
      await pause(90);
      progress(step / 10);
    }
    const before = installed.get(key(product, channel));
    const record: InstallRecord = { product, channel, version: release.version, previous: before && before.version !== release.version ? before.version : (before?.previous ?? null) };
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
};
