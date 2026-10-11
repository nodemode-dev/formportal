import type { Catalog, Channel, ExtensionIndex, InstallRecord, Platform, Preferences, UpdateOutcome } from "../engine/types.ts";
import type { Bridge } from "./index.ts";

interface TauriGlobal {
  core: { invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> };
  event: { listen<T>(name: string, handler: (event: { payload: T }) => void): Promise<() => void> };
}

interface RawInstall {
  product: string;
  channel: Channel;
  current: { version: string };
  previous?: { version: string } | null;
}

interface RawProgress {
  product: string;
  channel: Channel;
  have: number;
  total: number;
}

export const CATALOG_KEY = "formportal-catalog-url";
export const UNSIGNED_KEY = "formportal-allow-unsigned";
export const DEFAULT_CATALOG = "https://formai.dev/catalog/v1/apps.json";

const tauri = (): TauriGlobal => (window as unknown as { __TAURI__: TauriGlobal }).__TAURI__;

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export const catalogUrl = (): string => stored(CATALOG_KEY) || DEFAULT_CATALOG;
export const allowUnsigned = (): boolean => stored(UNSIGNED_KEY) === "yes";

const record = (raw: RawInstall): InstallRecord => ({
  product: raw.product,
  channel: raw.channel,
  version: raw.current.version,
  previous: raw.previous?.version ?? null,
});

export const tauriBridge: Bridge = {
  source: "live",
  platform: () => tauri().core.invoke<Platform>("platform"),
  catalog: () => tauri().core.invoke<Catalog>("catalog", { url: catalogUrl(), allowUnsigned: allowUnsigned() }),
  extensions: async () =>
    ({ format: "formai-extensions", format_version: 1, name: "formai extensions", publishers: [], packages: [] }) as ExtensionIndex,
  installs: async () => (await tauri().core.invoke<RawInstall[]>("installs")).map(record),
  install: async (product, channel, progress) => {
    const stop = await tauri().event.listen<RawProgress>("install-progress", ({ payload }) => {
      if (payload.product === product && payload.channel === channel) progress(payload.total > 0 ? payload.have / payload.total : 0);
    });
    try {
      return record(await tauri().core.invoke<RawInstall>("install", { product, channel, url: catalogUrl(), allowUnsigned: allowUnsigned() }));
    } finally {
      stop();
    }
  },
  open: async (product, channel) => {
    await tauri().core.invoke<number>("open", { product, channel });
  },
  rollback: async (product, channel) => record(await tauri().core.invoke<RawInstall>("rollback", { product, channel })),
  remove: async (product, channel) => {
    await tauri().core.invoke<null>("remove", { product, channel });
  },
  preferences: () => tauri().core.invoke<Preferences>("preferences"),
  setPreferences: async (preferences) => {
    await tauri().core.invoke<null>("set_preferences", { preferences });
  },
  autoUpdate: async (progress) => {
    const stop = await tauri().event.listen<RawProgress>("install-progress", ({ payload }) =>
      progress(payload.product, payload.channel, payload.total > 0 ? payload.have / payload.total : 0),
    );
    try {
      return await tauri().core.invoke<UpdateOutcome[]>("auto_update", { url: catalogUrl(), allowUnsigned: allowUnsigned() });
    } finally {
      stop();
    }
  },
  onLink: (handler) => {
    void tauri().event.listen<string>("deep-link", ({ payload }) => handler(payload));
    void tauri()
      .core.invoke<string | null>("launch_link")
      .then((link) => {
        if (link) handler(link);
      });
  },
};
