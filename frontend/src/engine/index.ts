import type { Artifact, Release, RepairReport, WebPlan, AssistantAgent, LearnView, NoticeCategory, AgentsView, FontsView, MediaView, FilesScan, FileVersion, StorageView, Catalog, Channel, ChannelView, ExtensionIndex, InstalledExtension, InstallRecord, Platform, PolicyView, Preferences, Product, Route, Source, GithubStatus, DeviceCode, SharesView } from "./types.ts";

export interface EngineEvents {
  install: { key: string };
  notice: { text: string; tone: "info" | "fault"; category: NoticeCategory; action?: NoticeAction };
  learn: { view: LearnView };
  assistant: { agents: AssistantAgent[] };
  answer: { pending: boolean; answer: string | null; error: string | null };
  repair: { pending: boolean; report: RepairReport | null };
  webfile: { plan: WebPlan };
  saved: { paths: string[] };
  route: { route: Route };
  theme: { light: boolean };
  platform: { platform: Platform };
  source: { source: Source; generated: string | null };
  product: { id: string };
  extensions: { count: number };
  prefs: { prefs: Preferences };
  self: { status: string; installable: boolean };
  policy: { policy: PolicyView | null };
  agents: { product: string; view: AgentsView };
  files: { result: FilesScan };
  storage: { view: StorageView };
  versions: { path: string; list: FileVersion[] };
  fonts: { view: FontsView };
  media: { view: MediaView };
  account: { status: GithubStatus | null; code: DeviceCode | null; busy: boolean; error: string | null };
  shares: { view: SharesView };
  shareResult: { busy: boolean; text: string; url: string };
  filedrop: { paths: string[]; phase: "over" | "leave" | "drop" };
}

export interface NoticeAction {
  label: string;
  command: string;
  arg?: unknown;
}

export const DEFAULT_PREFS: Preferences = { auto_update: true, auto_update_beta: false, only_when_closed: true, notices: true, per_app: {}, keep_previous: true, quiet: [], language: null, open_at_login: false };

export function versionNewer(candidate: string, current: string): boolean {
  const split = (v: string): [number[], string | null] => {
    const [core, ...pre] = v.trim().replace(/^v/, "").split("+")[0].split("-");
    return [core.split(".").map((n) => Number.parseInt(n, 10) || 0), pre.length ? pre.join("-") : null];
  };
  const [a, ap] = split(candidate);
  const [b, bp] = split(current);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  if (ap === null) return bp !== null;
  if (bp === null) return false;
  const numeric = (part: string) => /^[0-9]+$/.test(part);
  const xs = ap.split(".");
  const ys = bp.split(".");
  for (let i = 0; ; i += 1) {
    const x = xs[i];
    const y = ys[i];
    if (x === undefined) return false;
    if (y === undefined) return true;
    if (numeric(x) && numeric(y)) {
      const p = x.replace(/^0+/, "");
      const q = y.replace(/^0+/, "");
      if (p.length !== q.length) return p.length > q.length;
      if (p !== q) return p > q;
    } else if (numeric(x) !== numeric(y)) {
      return !numeric(x);
    } else if (x !== y) {
      return x > y;
    }
  }
}

export interface HubState {
  route: Route;
  light: boolean;
  platform: Platform;
  source: Source;
  catalog: Catalog | null;
  extensions: ExtensionIndex | null;
  installedExtensions: InstalledExtension[];
  extensionsError: string | null;
  extensionsStore: string | null;
  prefs: Preferences;
}

type Handler<T> = (payload: T) => void;
type Command = (arg: unknown) => void | Promise<void>;

export class Engine {
  readonly state: HubState = {
    route: "home",
    light: false,
    platform: { os: "other", arch: "x86_64" },
    source: "none",
    catalog: null,
    extensions: null,
    installedExtensions: [],
    extensionsError: null,
    extensionsStore: null,
    prefs: { ...DEFAULT_PREFS },
  };
  private handlers = new Map<keyof EngineEvents, Set<Handler<never>>>();
  private commands = new Map<string, Command>();

  on<K extends keyof EngineEvents>(event: K, handler: Handler<EngineEvents[K]>): () => void {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler as Handler<never>);
    this.handlers.set(event, set);
    return () => set.delete(handler as Handler<never>);
  }

  emit<K extends keyof EngineEvents>(event: K, payload: EngineEvents[K]): void {
    this.handlers.get(event)?.forEach((h) => (h as Handler<EngineEvents[K]>)(payload));
  }

  command(name: string, run: Command): void {
    if (this.commands.has(name)) throw new Error(`duplicate command: ${name}`);
    this.commands.set(name, run);
  }

  dispatch(name: string, arg?: unknown): void | Promise<void> {
    const run = this.commands.get(name);
    if (!run) throw new Error(`unknown command: ${name}`);
    return run(arg);
  }

  setRoute(route: Route): void {
    if (this.state.route === route) return;
    this.state.route = route;
    this.emit("route", { route });
  }

  setTheme(light: boolean): void {
    if (this.state.light === light) return;
    this.state.light = light;
    this.emit("theme", { light });
  }

  setPlatform(platform: Platform): void {
    this.state.platform = platform;
    this.emit("platform", { platform });
    for (const p of this.state.catalog?.products ?? []) this.emit("product", { id: p.id });
  }

  setCatalog(catalog: Catalog, source: Source): void {
    this.state.catalog = catalog;
    this.state.source = source;
    this.emit("source", { source, generated: catalog.generated });
    for (const p of catalog.products) this.emit("product", { id: p.id });
  }

  setExtensions(index: ExtensionIndex | null, installed: InstalledExtension[] = this.state.installedExtensions, error: string | null = this.state.extensionsError, store: string | null = this.state.extensionsStore): void {
    this.state.extensions = index;
    this.state.installedExtensions = installed;
    this.state.extensionsError = error;
    this.state.extensionsStore = store;
    this.emit("extensions", { count: (index?.packages.length ?? 0) + installed.length });
  }

  readonly later = new Set<string>();

  setLater(keys: string[]): void {
    const touched = new Set([...this.later, ...keys]);
    this.later.clear();
    for (const k of keys) this.later.add(k);
    for (const key of touched) this.emit("install", { key });
  }

  readonly installs = new Map<string, InstallRecord>();
  readonly progress = new Map<string, number>();

  key(product: string, channel: Channel): string {
    return `${product}:${channel}`;
  }

  setInstalls(list: InstallRecord[]): void {
    const touched = new Set(this.installs.keys());
    this.installs.clear();
    for (const record of list) {
      const key = this.key(record.product, record.channel);
      this.installs.set(key, record);
      touched.add(key);
    }
    for (const key of touched) this.emit("install", { key });
  }

  setProgress(product: string, channel: Channel, fraction: number | null): void {
    const key = this.key(product, channel);
    if (fraction === null) this.progress.delete(key);
    else this.progress.set(key, Math.min(1, Math.max(0, fraction)));
    this.emit("install", { key });
  }

  setNotice(text: string, tone: "info" | "fault" = "fault", category: NoticeCategory = "system", action?: NoticeAction): void {
    this.emit("notice", { text, tone, category, action });
  }

  private names = new Map<string, string>();

  setNames(names: Record<string, string>): void {
    for (const [id, name] of Object.entries(names)) this.names.set(id, name);
  }

  name(id: string): string {
    return this.names.get(id) ?? this.product(id)?.name ?? id;
  }

  setSelf(status: string, installable: boolean): void {
    this.emit("self", { status, installable });
  }

  setPrefs(prefs: Preferences): void {
    this.state.prefs = prefs;
    this.emit("prefs", { prefs });
  }

  policy: PolicyView | null = null;
  lastFonts: FontsView | null = null;
  lastLearn: LearnView | null = null;

  setPolicy(policy: PolicyView | null): void {
    this.policy = policy;
    this.emit("policy", { policy });
    for (const p of this.state.catalog?.products ?? []) this.emit("product", { id: p.id });
  }

  blocked(product: string, channel: Channel): boolean {
    const p = this.policy;
    if (!p) return false;
    return (p.apps !== null && !p.apps.includes(product)) || (p.channels !== null && !p.channels.includes(channel));
  }

  automatic(product: string, channel: Channel): boolean {
    const p = this.state.prefs;
    const own = p.per_app[product];
    if (own !== undefined) return own && (channel === "stable" || p.auto_update_beta);
    return channel === "stable" ? p.auto_update : p.auto_update && p.auto_update_beta;
  }

  product(id: string): Product | null {
    return this.state.catalog?.products.find((p) => p.id === id) ?? null;
  }

  artifactFor(release: Release): Artifact | null {
    const { os, arch } = this.state.platform;
    const builtFor = (want: string) => release.artifacts.find((a) => a.platform === os && a.arch === want);
    const translates = arch === "arm64" && (os === "macos" || os === "windows");
    return builtFor(arch) ?? (translates ? builtFor("x86_64") : undefined) ?? null;
  }

  view(id: string, channel: Channel): ChannelView {
    const product = this.product(id);
    const base = { product: id, channel, version: null, artifact: null };
    if (!product || (product.state === "prelaunch" && Object.keys(product.channels).length === 0)) return { ...base, availability: "unreleased" };
    const release = product.channels[channel];
    if (!release) return { ...base, availability: "no-release" };
    const artifact = this.artifactFor(release);
    return { product: id, channel, version: release.version, artifact, availability: artifact ? "available" : "other-platform" };
  }
}
