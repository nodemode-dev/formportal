import type { RepairReport, WebPlan, AssistantAgent, LearnView, AgentClient, AgentsView, FontsView, MediaView, FilesScan, FileVersion, StorageView, Catalog, Channel, ExtensionsView, InstalledExtension, InstallRecord, Platform, PolicyView, Preferences, SelfUpdate, UpdateOutcome, GithubStatus, DeviceCode, GithubPoll, SharesView, SyncReport, PublishedFile, UpcomingView, SupporterView } from "../engine/types.ts";
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
export const DEFAULT_CATALOG = "https://dl.formai.studio/catalog/apps.json";

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
  catalogKept: () => tauri().core.invoke<Catalog>("catalog_kept", { url: catalogUrl(), allowUnsigned: allowUnsigned() }).catch(() => null),
  extensions: () => tauri().core.invoke<ExtensionsView>("extensions", { allowUnsigned: allowUnsigned() }),
  installExtension: ({ id, path }) =>
    tauri().core.invoke<InstalledExtension>("extension_install", { id: id ?? null, path: path ?? null, allowUnsigned: allowUnsigned() }),
  removeExtension: async (product, id) => {
    await tauri().core.invoke<null>("extension_remove", { product, id });
  },
  enableExtension: async (product, id, enabled) => {
    await tauri().core.invoke<InstalledExtension>("extension_enable", { product, id, enabled });
  },
  selfUpdateCheck: () => tauri().core.invoke<SelfUpdate>("self_update_check"),
  selfUpdateInstall: async () => {
    await tauri().core.invoke<null>("self_update_install");
  },
  onVersionsKept: (handler) => {
    void tauri().event.listen<string[]>("versions-kept", ({ payload }) => handler(payload));
  },
  onFileDrop: (handler) => {
    const events = tauri().event;
    void events.listen<{ paths?: string[] }>("tauri://drag-enter", ({ payload }) => handler(payload?.paths ?? [], "over"));
    void events.listen<{ paths?: string[] }>("tauri://drag-over", () => handler([], "over"));
    void events.listen<unknown>("tauri://drag-leave", () => handler([], "leave"));
    void events.listen<{ paths?: string[] }>("tauri://drag-drop", ({ payload }) => handler(payload?.paths ?? [], "drop"));
  },
  onPackage: (handler) => {
    void tauri().event.listen<string>("package-open", ({ payload }) => handler(payload));
    void tauri()
      .core.invoke<string | null>("launch_package")
      .then((path) => {
        if (path) handler(path);
      });
  },
  installs: async () => (await tauri().core.invoke<RawInstall[]>("installs")).map(record),
  install: async (product, channel, progress, version) => {
    const stop = await tauri().event.listen<RawProgress>("install-progress", ({ payload }) => {
      if (payload.product === product && payload.channel === channel) progress(payload.total > 0 ? payload.have / payload.total : 0);
    });
    try {
      return record(await tauri().core.invoke<RawInstall>("install", { product, channel, url: catalogUrl(), allowUnsigned: allowUnsigned(), version: version ?? null }));
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
  siteUpcoming: () => tauri().core.invoke<UpcomingView>("site_upcoming"),
  supporterCheck: (code) => tauri().core.invoke<SupporterView>("supporter_check", { code }),
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
  stillOpen: (product, channel) => tauri().core.invoke<number[]>("still_open", { product, channel }),
  openWeb: async (url) => {
    await tauri().core.invoke<null>("open_web", { url });
  },
  policy: () => tauri().core.invoke<PolicyView | null>("policy"),
  githubStatus: () => tauri().core.invoke<GithubStatus>("github_status"),
  githubStart: (share) => tauri().core.invoke<DeviceCode>("github_start", { share }),
  githubPoll: (deviceCode, interval) => tauri().core.invoke<GithubPoll>("github_poll", { deviceCode, interval }),
  githubSignOut: async () => {
    await tauri().core.invoke<null>("github_sign_out");
  },
  shares: () => tauri().core.invoke<SharesView>("shares_view"),
  shareFolder: (folder, invite) => tauri().core.invoke<SyncReport>("share_folder", { folder, invite }),
  shareSend: (folder) => tauri().core.invoke<SyncReport>("share_send", { folder }),
  shareAccept: (id) => tauri().core.invoke<SyncReport>("share_accept", { id }),
  sharePull: (repo) => tauri().core.invoke<SyncReport>("share_pull", { repo }),
  publishFile: (file, remove) => tauri().core.invoke<PublishedFile>("publish_file", { file, remove }),
  filesScan: (query) => tauri().core.invoke<FilesScan>("files_scan", { query: query ?? null }),
  folderPick: () => tauri().core.invoke<string | null>("folder_pick"),
  folderAdd: async (path, keepVersions, create) => {
    await tauri().core.invoke("folder_add", { path, keepVersions, create });
  },
  folderRemove: async (path) => {
    await tauri().core.invoke("folder_remove", { path });
  },
  fileOpen: (path) => tauri().core.invoke<string>("file_open", { path }),
  fileVersions: (path, action, version) => tauri().core.invoke<FileVersion[]>("file_versions", { path, action: action ?? null, version: version ?? null }),
  storage: () => tauri().core.invoke<StorageView>("storage"),
  media: () => tauri().core.invoke<MediaView>("media_view", { url: catalogUrl(), allowUnsigned: allowUnsigned() }),
  mediaSave: (id, useTemplate) => tauri().core.invoke("media_save", { id, useTemplate, url: catalogUrl(), allowUnsigned: allowUnsigned() }),
  mediaRemove: async (id) => {
    await tauri().core.invoke("media_remove", { id });
  },
  mediaThumb: (url) => tauri().core.invoke<string>("media_thumb", { url }),
  filePreview: (path) => tauri().core.invoke<string>("file_preview", { path }),
  repair: (fix) => tauri().core.invoke<RepairReport>("repair", { url: catalogUrl(), allowUnsigned: allowUnsigned(), fix }),
  laterList: () => tauri().core.invoke<string[]>("later_list"),
  updateLater: (product, channel, on) => tauri().core.invoke<string[]>("update_later", { product, channel, on }),
  webPlan: (url) => tauri().core.invoke<WebPlan>("web_plan", { url }),
  webFetch: (url) => tauri().core.invoke<{ saved: string; product: string; opened_with: string | null }>("web_fetch", { url }),
  learn: () => tauri().core.invoke<LearnView>("learn_view", { url: catalogUrl(), allowUnsigned: allowUnsigned() }),
  learnMark: async (id, step, done, reset) => {
    await tauri().core.invoke("learn_mark", { id, step, done, reset, url: catalogUrl(), allowUnsigned: allowUnsigned() });
  },
  assistantAgents: () => tauri().core.invoke<AssistantAgent[]>("assistant_agents"),
  assistantAsk: (client, question) => tauri().core.invoke<{ client: string; answer: string }>("assistant_ask", { client, question, url: catalogUrl(), allowUnsigned: allowUnsigned() }),
  fonts: () => tauri().core.invoke<FontsView>("fonts_view", { url: catalogUrl(), allowUnsigned: allowUnsigned() }),
  fontInstall: async (id, style) => {
    await tauri().core.invoke("font_install", { id, style: style ?? null, url: catalogUrl(), allowUnsigned: allowUnsigned() });
  },
  fontPick: () => tauri().core.invoke<string | null>("font_pick"),
  fontAdd: async (path, rightsConfirmed) => {
    await tauri().core.invoke("font_add", { path, rightsConfirmed });
  },
  fontRemove: async (family, style) => {
    await tauri().core.invoke("font_remove", { family, style: style ?? null });
  },
  appAgents: (product, channel) => tauri().core.invoke<AgentsView>("app_agents", { product, channel }),
  connectAgents: async (product, channel, disconnect) => (await tauri().core.invoke<{ clients: AgentClient[] }>("connect_agents", { product, channel, disconnect })).clients,
};
