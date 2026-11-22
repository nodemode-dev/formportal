import apps from "../../../catalog/fixtures/apps.json";
import fixtureIndex from "../../../catalog/fixtures/extensions.json";
import registry from "../../../catalog/products.json";
import schedule from "../../../catalog/schedule.json";
import agentClients from "../../../core/data/agent-clients.json";
import learnPortal from "../../../core/data/learn-portal.json";
import storeFonts from "../../../core/data/store-fonts.json";
import storeMedia from "../../../core/data/store-media.json";
import { DEFAULT_PREFS, versionNewer } from "../engine/index.ts";
import type { AgentAccess, RepairFinding, AgentClient, OwnAgent, MediaItem, SavedMedia, FontFamilyEntry, InstalledFont, WebFontSource, WebFontFamily,FileVersion, FolderView, ProjectFile, Catalog, Channel, ExtensionBlocked, ExtensionIndex, ExtensionTurnedOff, InstalledExtension, InstallRecord, Os, Platform, Preferences, UpdateOutcome, GithubAccount, SharesView } from "../engine/types.ts";
import type { KeyState } from "../engine/types.ts";
import type { StepReport } from "../engine/types.ts";
import type { Bridge } from "./index.ts";
import { templatesFixture } from "./fixture-templates.ts";
import { stockFixture } from "./stockfixture.ts";

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
const SOON = new URLSearchParams(window.location.search).get("soon") ?? "sealed";
if (SOON.startsWith("ask")) for (const p of registry.products) if (p.id !== "formai" && !catalog.products.some((c) => c.id === p.id)) catalog.products.push({ ...(catalog.products.find((c) => c.id === "formcut") ?? catalog.products[0]), id: p.id, name: p.name });
const installed = new Map<string, InstallRecord>();
for (const item of (new URLSearchParams(window.location.search).get("installed") ?? "").split(",").filter(Boolean)) {
  const [product, wanted] = item.split("@");
  const offered = catalog.products.find((p) => p.id === product)?.channels.stable?.version;
  const version = wanted ?? offered;
  if (version) installed.set(`${product}:stable`, { product, channel: "stable", version, previous: null });
}
const pause = (ms: number) => new Promise<void>((done) => window.setTimeout(done, ms));
const failure = (step: StepReport["step"], file: string, sha256: string): string =>
  step === "sha256"
    ? `${file} does not match the catalogue: expected SHA-256 ${sha256}, found ${"0".repeat(64)}. It was not installed (browser mode, ?fail=sha256)`
    : step === "signature"
      ? "the catalogue's signature is not valid: it is not signed (browser mode, ?fail=signature)"
      : `the download did not complete: no network (browser mode, ?fail=${step})`;
const key = (product: string, channel: Channel) => `${product}:${channel}`;
const SAMPLE = "/home/you/Documents/Form";
const folders: FolderView[] = new URLSearchParams(window.location.search).has("files") ? [{ path: SAMPLE, keep_versions: true, exists: true, files: 0, bytes: 0 }] : [];
const day = 86400;
const SAMPLE_TEXT = "# Shot list\n\nNorthern coast, four days on the road.\n\n- Hamnoy village at blue hour\n- Mountain lake, first light\n- Lighthouse at dusk\n- Slow waves on the shore\n- Drone pass over the headland\n";
const stamp = Math.floor(Date.parse("2026-10-12T09:00:00Z") / 1000);
const sampleFiles = (folder: string): ProjectFile[] => [
  { path: `${folder}/Trailer.fc`, name: "Trailer.fc", folder, product: "formcut", bytes: 18_400_000, modified: stamp, versions: 4, preview: `${folder}/Trailer.fc.preview.webp` },
  { path: `${folder}/Posters/Launch poster.fmv`, name: "Launch poster.fmv", folder, product: "formvis", bytes: 52_300_000, modified: stamp - day, versions: 2 },
  { path: `${folder}/Audio/Interview mix.fmw`, name: "Interview mix.fmw", folder, product: "formwav", bytes: 9_100_000, modified: stamp - 3 * day, versions: 1 },
  { path: `${folder}/Cutdowns/Teaser 15s.fc`, name: "Teaser 15s.fc", folder, product: "formcut", bytes: 4_200_000, modified: stamp - 9 * day, versions: 1 },
  { path: `${folder}/Northern coast/shot-list.fcel`, name: "shot-list.fcel", folder, product: "formcel", bytes: new TextEncoder().encode(SAMPLE_TEXT).length, modified: stamp - 2 * day, versions: 2 },
];
const sampleHash = async (path: string) => {
  const text = path.endsWith(".fcel") ? SAMPLE_TEXT : path;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
};
const kept = new Map<string, FileVersion[]>();
const versionsOf = (path: string, count: number): FileVersion[] => {
  if (!kept.has(path)) kept.set(path, Array.from({ length: count }, (_, i) => ({ id: `${stamp - i * day}-${(i + 1).toString(16).padStart(12, "0")}`, at: stamp - i * day, size: 1000 * (count - i), sha256: "0".repeat(64), reason: i === count - 1 ? "first seen" : "changed since the last version" })));
  return kept.get(path) ?? [];
};
const fontIndex: FontFamilyEntry[] = (storeFonts as unknown as { families: FontFamilyEntry[] }).families;
const fontsIn: InstalledFont[] = new URLSearchParams(window.location.search).has("fontupdate")
  ? [{ family: "Inter", style: "Variable", family_id: "inter", file: "~/.local/share/fonts/FormPortal/FormPortal-Inter-Variable.ttf", sha256: "1".repeat(64), source: "index" as const, licence: "OFL-1.1" }]
  : [];
const mediaIndex: MediaItem[] = (storeMedia as unknown as { items: MediaItem[] }).items.map((item) => ({ ...item, product: item.product ?? null, thumbnail: item.thumbnail ?? null }));
const savedMedia: SavedMedia[] = [];
const params = new URLSearchParams(window.location.search);
const sampleTutorial = {
  id: "formcut-first-cut", product: "formcut", title: "Make your first cut", summary: "A sample of an app's tutorial from the tutorial index: import a clip, trim it and export.", minutes: 5, level: "beginner",
  steps: [
    { title: "Import a clip", body: "Sample step from the browser preview.", route: null, url: "https://github.com/nodemode-dev/formcut#readme" },
    { title: "Trim it", body: "Sample step from the browser preview.", route: null, url: null },
    { title: "Export", body: "Sample step from the browser preview.", route: null, url: null },
  ],
};
type FixtureTutorial = { id: string; product: string; title: string; summary: string; minutes: number; level: string; steps: { title: string; body: string; route?: string | null; url?: string | null }[] };
const tutorials: FixtureTutorial[] = [...(learnPortal.tutorials as FixtureTutorial[]), sampleTutorial];
const progress = new Map<string, Set<number>>();
const later = new Set<string>();
const github: { account: GithubAccount | null; polls: number; share: boolean; fork: boolean; forked: boolean } = { account: null, polls: 0, share: false, fork: false, forked: false };
const githubMode = new URLSearchParams(window.location.search).get("github") ?? "";
if (githubMode === "on" || githubMode === "forked") github.account = { login: "octo-tester", name: "Octo Tester", scopes: ["read:user"] };
if (githubMode === "forked") github.forked = true;
const PROVIDER_KEYS = ["pexels", "pixabay", "freesound", "google-fonts"];
const providerKept = new Set<string>();
const providerStates = (): KeyState[] => PROVIDER_KEYS.map((provider) => ({ provider, present: providerKept.has(provider) }));
const providerKnown = (provider: string): void => {
  if (!PROVIDER_KEYS.includes(provider)) throw new Error(`FormPortal keeps an API key only for ${PROVIDER_KEYS.join(", ")}`);
};
type WebRow = [string, string, string, string, number[], boolean, string | null, string, string];
const webFonts: Record<WebFontSource, WebRow[]> = {
  fontsource: [
    ["abel", "Abel", "sans-serif", "latin", [400], false, "OFL-1.1", "Copyright 2011 Matthew Desmond", "dm-sans/DMSans-Variable.ttf"],
    ["archivo", "Archivo", "sans-serif", "latin,latin-ext,vietnamese", [100, 200, 300, 400, 500, 600, 700, 800, 900], true, "OFL-1.1", "Copyright 2019 The Archivo Project Authors", "manrope/Manrope-Variable.ttf"],
    ["bebas-neue", "Bebas Neue", "display", "latin,latin-ext", [400], false, "OFL-1.1", "Copyright 2019 The Bebas Neue Project Authors", "syne/Syne-Variable.ttf"],
    ["cormorant-garamond", "Cormorant Garamond", "serif", "cyrillic,latin,latin-ext,vietnamese", [300, 400, 500, 600, 700], true, "OFL-1.1", "Copyright 2015 The Cormorant Project Authors", "fraunces/Fraunces-Variable.ttf"],
    ["fira-code", "Fira Code", "monospace", "cyrillic,greek,latin,latin-ext", [300, 400, 500, 600, 700], false, "OFL-1.1", "Copyright 2014 The Fira Code Project Authors", "jetbrains-mono/JetBrainsMono-Variable.ttf"],
    ["ibm-plex-sans", "IBM Plex Sans", "sans-serif", "cyrillic,greek,latin,latin-ext,vietnamese", [100, 200, 300, 400, 500, 600, 700], true, "OFL-1.1", "Copyright 2017 IBM Corp.", "inter/Inter-Variable.ttf"],
    ["merriweather", "Merriweather", "serif", "cyrillic,latin,latin-ext,vietnamese", [300, 400, 700, 900], true, "OFL-1.1", "Copyright 2016 The Merriweather Project Authors", "lora/Lora-Variable.ttf"],
    ["noto-sans-jp", "Noto Sans JP", "sans-serif", "japanese,latin", [100, 300, 400, 500, 700, 900], false, "OFL-1.1", "Copyright 2014-2021 Adobe", "inter/Inter-Variable.ttf"],
    ["pacifico", "Pacifico", "handwriting", "cyrillic,latin,latin-ext,vietnamese", [400], false, "OFL-1.1", "Copyright 2018 The Pacifico Project Authors", "caveat/Caveat-Variable.ttf"],
    ["roboto-mono", "Roboto Mono", "monospace", "cyrillic,greek,latin,latin-ext,vietnamese", [100, 200, 300, 400, 500, 600, 700], true, "Apache-2.0", "Copyright 2015 Google Inc.", "ibm-plex-mono/IBMPlexMono-Regular.ttf"],
    ["ubuntu", "Ubuntu", "sans-serif", "cyrillic,greek,latin,latin-ext", [300, 400, 500, 700], true, "UFL-1.0", "Copyright 2011 Canonical Ltd.", "dm-sans/DMSans-Variable.ttf"],
    ["work-sans", "Work Sans", "sans-serif", "latin,latin-ext,vietnamese", [100, 200, 300, 400, 500, 600, 700, 800, 900], true, null, "", "space-grotesk/SpaceGrotesk-Variable.ttf"],
  ],
  google: [
    ["roboto", "Roboto", "sans-serif", "cyrillic,greek,latin,latin-ext,vietnamese", [100, 300, 400, 500, 700, 900], true, "OFL-1.1", "Copyright 2011 Google Inc.", "inter/Inter-Variable.ttf"],
    ["open-sans", "Open Sans", "sans-serif", "cyrillic,greek,hebrew,latin,latin-ext,vietnamese", [300, 400, 500, 600, 700, 800], true, "OFL-1.1", "Copyright 2020 The Open Sans Project Authors", "manrope/Manrope-Variable.ttf"],
    ["playfair-display", "Playfair Display", "serif", "cyrillic,latin,latin-ext,vietnamese", [400, 500, 600, 700, 800, 900], true, "OFL-1.1", "Copyright 2017 The Playfair Display Project Authors", "fraunces/Fraunces-Variable.ttf"],
    ["source-code-pro", "Source Code Pro", "monospace", "cyrillic,greek,latin,latin-ext,vietnamese", [200, 300, 400, 500, 600, 700, 800, 900], true, "OFL-1.1", "Copyright 2010 Adobe", "jetbrains-mono/JetBrainsMono-Variable.ttf"],
    ["dancing-script", "Dancing Script", "handwriting", "latin,latin-ext,vietnamese", [400, 500, 600, 700], false, "OFL-1.1", "Copyright 2016 The Dancing Script Project Authors", "caveat/Caveat-Variable.ttf"],
    ["oswald", "Oswald", "sans-serif", "cyrillic,latin,latin-ext,vietnamese", [200, 300, 400, 500, 600, 700], false, "OFL-1.1", "Copyright 2016 The Oswald Project Authors", "space-grotesk/SpaceGrotesk-Variable.ttf"],
    ["lobster", "Lobster", "display", "cyrillic,latin,latin-ext,vietnamese", [400], false, "OFL-1.1", "Copyright 2010 Pablo Impallari", "bricolage-grotesque/BricolageGrotesque-Variable.ttf"],
    ["eb-garamond", "EB Garamond", "serif", "cyrillic,greek,latin,latin-ext,vietnamese", [400, 500, 600, 700, 800], true, "OFL-1.1", "Copyright 2017 The EB Garamond Project Authors", "lora/Lora-Variable.ttf"],
  ],
};
const webFamilies = (source: WebFontSource): WebFontFamily[] => webFonts[source].map(([id, family, category, subsets, weights, italic]) => ({ id, family, category, subsets: subsets.split(","), weights, italic, variable: weights.length > 3 }));
const webRow = (source: WebFontSource, id: string): WebRow => {
  if (source === "google" && !providerKept.has("google-fonts")) throw new Error("Google Fonts is off until you give FormPortal your Google Fonts API key");
  const row = webFonts[source].find((r) => r[0] === id);
  if (!row) throw new Error(`${id} is not in ${source === "google" ? "Google Fonts" : "Fontsource"}'s catalogue`);
  return row;
};
if (new URLSearchParams(window.location.search).has("fontkey")) providerKept.add("google-fonts");
const shares: SharesView = { shared: [], joined: [], published: [], invitations: [{ id: 7, repo: "riley/formportal-library-launch-film", from: "riley" }] };
const repairFindings: RepairFinding[] = params.has("repair")
  ? [
      { kind: "broken", product: "formcut", channel: "stable", path: "/home/you/.local/share/formportal/apps/formcut/stable/2.6.2", bytes: 0, problem: "formcut 2.6.2 has nothing FormPortal can open in its folder", fix: "install the same version again from the catalogue, checking its SHA-256", fixed: false, error: null },
      { kind: "leftover", product: "formcut", channel: null, path: "/home/you/.local/share/formportal/apps/formcut/stable/2.5.0", bytes: 84_000_000, problem: "formcut 2.5.0 is on disk but no install record points to it", fix: "delete the folder", fixed: false, error: null },
      { kind: "download", product: null, channel: null, path: "/home/you/.local/share/formportal/downloads/formcut-2.6.1.zip", bytes: 61_000_000, problem: "formcut-2.6.1.zip is a download that was not cleaned up", fix: "delete it", fixed: false, error: null },
    ]
  : [];
const credit = (m: MediaItem) => (m.licence === "CC0-1.0" ? `${m.title} by ${m.creator}, public domain (CC0 1.0), ${m.source_url}` : `${m.title} by ${m.creator}, licensed ${m.licence}, ${m.source_url}`);
const LABELS: Record<AgentClient["client"], string> = { claude: "Claude Code", codex: "Codex", cursor: "Cursor", antigravity: "Antigravity" };
const linked = new Set<string>();
const OWN_PROGRAM = "/Applications/FormPortal.app/Contents/MacOS/FormPortal";
const ownSeen = new Map<string, string>((new URLSearchParams(window.location.search).get("own") ?? "").split(",").filter(Boolean).map((pair) => pair.split(":") as [string, string]));
const ownFor = (row: { id: string; label: string; programs: string[] }): OwnAgent => {
  const seen = ownSeen.get(row.id) ?? "open";
  const base = { client: row.id, label: row.label, program: seen === "none" ? null : `/usr/local/bin/${row.programs[0]}`, config: null, command: null, current: false, note: null };
  if (seen === "none") return { ...base, state: "no-client", note: `FormPortal did not find ${row.label} on this computer. It looked for ${row.programs.join(" and ")} on your PATH, in the PATH your shell reports and in the usual install folders.` };
  if (seen === "taken") return { ...base, state: "taken", command: "npx", note: "another server named formportal is set up; left alone" };
  if (seen === "stale") return { ...base, state: "connected", command: "/home/you/formportal/formportal", note: `its entry starts /home/you/formportal/formportal, not this FormPortal (${OWN_PROGRAM}); connecting again changes it` };
  if (seen === "connected") return { ...base, state: "connected", command: OWN_PROGRAM, current: true };
  return { ...base, state: "not-connected" };
};
const agentsFor = (product: string, channel: Channel): AgentClient[] =>
  (["claude", "codex", "cursor", "antigravity"] as const).map((client) => ({ client, label: LABELS[client], state: linked.has(`${key(product, channel)}:${client}`) ? "connected" : "not-connected", note: null }));

for (const seed of (new URLSearchParams(window.location.search).get("installed") ?? "").split(",")) {
  const [product, version, previous] = seed.split(":");
  if (product && version) installed.set(key(product, "stable"), { product, channel: "stable", version, previous: previous ?? null });
}

const extInstalled = new Map<string, InstalledExtension>();
const REGISTRY_INDEX = "https://github.com/nodemode-dev/form.ext-registry/releases/download/index/extensions.json";
const blockedFor = (blocked: ExtensionBlocked[], id: string, version: string) => blocked.find((b) => b.id === id && (b.versions.length === 0 || b.versions.includes("*") || b.versions.includes(version)))?.reason;
const readIndex = async (): Promise<ExtensionIndex> => {
  const search = new URLSearchParams(window.location.search);
  const url = search.get("extindex");
  if (!url) {
    if (search.has("extfixture")) return fixtureIndex as unknown as ExtensionIndex;
    throw new Error(`the registry is private or unreachable: browser mode does not fetch ${REGISTRY_INDEX}; add ?extindex=<address of a test index>`);
  }
  const answer = await fetch(url).catch((e: unknown) => {
    throw new Error(`the registry is private or unreachable: ${String(e)}`);
  });
  if (!answer.ok) throw new Error(`the registry is private or unreachable: ${url} answered ${answer.status}`);
  const index = (await answer.json()) as ExtensionIndex;
  const list = await fetch(url.replace(/[^/]*$/, "blocklist.json")).then((r) => (r.ok ? (r.json() as Promise<{ blocked?: ExtensionBlocked[] }>) : { blocked: [] })).catch(() => ({ blocked: [] as ExtensionBlocked[] }));
  const blocked = list.blocked ?? [];
  return { ...index, blocked, packages: index.packages.map((p) => ({ ...p, blocked: blockedFor(blocked, p.id, p.version) })) };
};
let extensions: ExtensionIndex | null = null;
const HOST_NAMES: Record<string, string> = { formportal: "FormPortal", formdeck: "FormDeck" };
const hostName = (product: string) => HOST_NAMES[product] ?? registry.products.find((p) => p.id === product)?.name ?? product;

const SUPPORTER_FIXTURE_CODE = "d1.0.00000000000000000000000000000000.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const SITE_ALIAS: Record<string, string> = { formportal: "formai", formdeck: "formslide", formskill: "formskills" };
const SITE_UNDATED = 9;
const SITE_SUPPORTERS = 11;
const SITE_RELEASES = schedule.releases as { at: string; apps: string[]; names?: string[]; sealed?: boolean }[];
const SITE_DATED = SITE_RELEASES.map((g) => (g.sealed ? { at: g.at, count: 1, sealed: true } : { at: g.at, count: g.apps.length + (g.names?.length ?? 0) }));
const SITE_NAMES = new Map(registry.products.map((p) => [p.id, p.name]));
const SITE_TILES: { name: string; at: string | null }[] = [
  ...SITE_RELEASES.flatMap((g) => [...g.apps.filter((id) => id !== "formportal").map((id) => SITE_NAMES.get(SITE_ALIAS[id] ?? id) ?? id), ...(g.names ?? [])].map((name) => ({ name, at: g.at as string | null }))),
  ...["FormDAM", "FormSculpt", "FormSurface", "FormWeb", "Planned app 1", "Planned app 2", "Planned app 3", "Planned app 4", "Planned app 5"].slice(0, SITE_UNDATED).map((name) => ({ name, at: null })),
  ...Array.from({ length: SITE_SUPPORTERS }, (_, i) => ({ name: `Codename ${i + 1}`, at: null })),
  { name: "FormRig", at: "2027-01-15T17:00:00Z" },
  { name: "Planned app 6", at: "2027-01-15T17:00:00Z" },
];
let access: AgentAccess = new URLSearchParams(window.location.search).get("agents") === "broken" ? { outside_agents: "ask", stored: "allowed", seal: "broken", seal_broken: true } : { outside_agents: "ask", stored: "ask", seal: "none", seal_broken: false };
let prefs: Preferences ={ ...DEFAULT_PREFS, auto_update: new URLSearchParams(window.location.search).get("auto") !== "off", per_app: {} };
if (params.has("supporter")) prefs = { ...prefs, supporter_code: SUPPORTER_FIXTURE_CODE };

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
  catalogKept: async () => (new URLSearchParams(window.location.search).has("cold") ? null : catalog),
  extensions: async () => {
    try {
      extensions = await readIndex();
    } catch (e) {
      return { index: null, index_error: e instanceof Error ? e.message : String(e), store: null, installed: Array.from(extInstalled.values()) };
    }
    const turned_off: ExtensionTurnedOff[] = [];
    for (const [k, have] of extInstalled) {
      const reason = blockedFor(extensions.blocked ?? [], have.id, have.version);
      if (reason && have.enabled) turned_off.push({ id: have.id, name: have.name, product: have.product, version: have.version, reason });
      if (reason !== have.blocked || (reason && have.enabled)) extInstalled.set(k, { ...have, enabled: reason ? false : have.enabled, blocked: reason });
    }
    return { index: { ...extensions, turned_off }, index_error: null, store: new URLSearchParams(window.location.search).get("extindex"), installed: Array.from(extInstalled.values()) };
  },
  installExtension: async ({ id, path }) => {
    const index = extensions ?? (await readIndex());
    const entry = id ? index.packages.find((p) => p.id === id) : undefined;
    if (id && !entry) throw new Error(`${id} is not in the extension index`);
    if (entry?.blocked) throw new Error(`${entry.name} ${entry.version} is on form.ext-registry's block list: ${entry.blocked}. It was not installed`);
    if (entry && !entry.signature) throw new Error(`${entry.name} carries no publisher signature; only the developer setting installs it. It was not installed`);
    const name = path ? path.split(/[\\/]/).pop()?.replace(/\.formpkg$/i, "") ?? "package" : "";
    const file = path ? index.packages.find((p) => `${p.id}-${p.version}` === name) : undefined;
    if (/api2/.test(name)) throw new Error(`${name}: it needs extension API 2; this ${hostName("formcut")} offers API 1`);
    if (/native/.test(name)) throw new Error(`${name}: native extensions are not supported by ${hostName("formcut")}`);
    const listed = entry ?? file;
    const record: InstalledExtension = listed
      ? { id: listed.id, name: listed.name, product: listed.product, kind: listed.kind, version: listed.version, sha256: listed.sha256, source: "catalogue", signed_by: listed.signature?.publisher ?? null, native: listed.native, permissions: listed.permissions, enabled: true, description: listed.description, api: listed.api, contributes: { panels: [], commands: [] } }
      : { id: name, name, product: "formcut", kind: "preset", version: "0.1.0", sha256: "", source: "sideload", signed_by: null, native: false, permissions: [], enabled: true, contributes: { panels: [], commands: [] } };
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
    if (enabled && record.blocked) throw new Error(`${record.name} ${record.version} stays off: it is on form.ext-registry's block list (${record.blocked})`);
    extInstalled.set(`${product}:${id}`, { ...record, enabled });
  },
  selfUpdateCheck: async () => {
    await pause(200);
    const offered = new URLSearchParams(window.location.search).get("self");
    return { configured: offered !== null, current: "0.0.0", available: offered || null, notes: null, action: offered ? "download" : "none", page: "https://formai.studio/download/" };
  },
  selfUpdateInstall: async () => {
    await pause(300);
    throw new Error("the browser mode cannot restart FormPortal");
  },
  onFileDrop: (handler) => {
    const files = (event: DragEvent) => Array.from(event.dataTransfer?.files ?? []).map((f) => f.name);
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
      handler(files(event), "drop");
    });
  },
  onPackage: (handler) => {
    const path = new URLSearchParams(window.location.search).get("package");
    if (path) handler(path);
  },
  onVersionsKept: (handler) => {
    if (!params.has("saves") || !folders.length) return;
    window.setTimeout(() => {
      const path = `${folders[0].path}/Trailer.fc`;
      const list = versionsOf(path, 4);
      list.unshift({ id: `${stamp + 300}-${"c".repeat(12)}`, at: stamp + 300, size: (list[0]?.size ?? 0) + 512, sha256: "c".repeat(64), reason: "saved" });
      handler([path]);
    }, 6000);
  },
  installs: async () =>
    Array.from(installed.values()).map((r) => {
      const latest = catalog.products.find((p) => p.id === r.product)?.channels[r.channel];
      const release = [latest, ...(latest?.history ?? [])].find((x) => x?.version === r.version);
      return { ...r, path: `/home/you/.local/share/formportal/apps/${r.product}/${r.channel}/${r.version}`, sha256: release?.artifacts[0]?.sha256 ?? "0".repeat(64) };
    }),
  install: async (product, channel, progress, version, step) => {
    const latest = catalog.products.find((p) => p.id === product)?.channels[channel];
    const release = version ? [latest, ...(latest?.history ?? [])].find((r) => r?.version === version) : latest;
    if (!release) throw new Error(`the catalogue offers this computer nothing for ${product}${version ? ` ${version}` : ""}`);
    const fail = params.get("fail");
    const report = async (name: StepReport["step"], detail: string, wait: number) => {
      await pause(step ? wait : 0);
      if (fail === name) throw new Error(failure(name, artifact.file, artifact.sha256));
      step?.({ step: name, detail });
    };
    const artifact = release.artifacts.find((a) => a.platform === browserPlatform().os) ?? release.artifacts[0];
    await report("signature", "signed", 500);
    await report("pick", artifact.file, 400);
    await report("address", artifact.url, 400);
    for (let tick = 1; tick <= 10; tick += 1) {
      await pause(step ? 280 : 90);
      progress(tick / 10);
    }
    await report("download", String(artifact.bytes), 0);
    await report("sha256", artifact.sha256, 600);
    await report("unpack", `/home/you/.local/share/formportal/apps/${product}/${channel}/${release.version}.tmp`, 700);
    const before = installed.get(key(product, channel));
    if (version && latest && versionNewer(latest.version, release.version) && prefs.per_app[product] !== false && (prefs.per_app[product] || prefs.auto_update)) {
      prefs = { ...prefs, per_app: { ...prefs.per_app, [product]: false } };
    }
    const kept = before && before.version !== release.version ? before.version : (before?.previous ?? null);
    const record: InstallRecord = { product, channel, version: release.version, previous: prefs.keep_previous ? kept : null };
    await pause(step ? 500 : 0);
    installed.set(key(product, channel), record);
    step?.({ step: "place", detail: record.previous ?? "" });
    return record;
  },
  open: async (product, channel) => {
    if (!installed.has(key(product, channel))) throw missing(product);
  },
  rollback: async (product, channel, step) => {
    const record = installed.get(key(product, channel));
    if (!record || !record.previous) throw missing(`an earlier version of ${product}`);
    await pause(step ? 600 : 0);
    step?.({ step: "find", detail: `/home/you/.local/share/formportal/apps/${product}/${channel}/${record.previous}` });
    const swapped: InstallRecord = { product, channel, version: record.previous, previous: record.version };
    await pause(step ? 600 : 0);
    installed.set(key(product, channel), swapped);
    step?.({ step: "swap", detail: record.version });
    if (versionNewer(record.version, record.previous)) {
      if (prefs.per_app[product] !== false && (prefs.per_app[product] || prefs.auto_update)) prefs = { ...prefs, per_app: { ...prefs.per_app, [product]: false } };
      later.delete(key(product, channel));
      await pause(step ? 500 : 0);
      step?.({ step: "hold", detail: "" });
    }
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
    if (path.startsWith(`${SAMPLE}/Templates/`)) return path.split("/")[6] ?? "";
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
  media: async () => ({ index: { items: mediaIndex }, credits: mediaIndex.map(credit), index_error: null, saved: savedMedia.map((s) => ({ ...s })), library: "/home/you/Documents/Form/Library" }),
  mediaSave: async (id, useTemplate) => {
    await pause(250);
    const m = mediaIndex.find((x) => x.id === id);
    if (!m) throw new Error(`${id} is not in the media index`);
    if (!savedMedia.some((s) => s.id === id)) savedMedia.push({ id, title: m.title, kind: m.kind, creator: m.creator, licence: m.licence, source_url: m.source_url, file: `/home/you/Documents/Form/Library/${m.kind}/${m.file}`, credit: credit(m) });
    if (useTemplate) return { copied_to: `/home/you/Documents/Form/${m.title}${m.file.slice(m.file.lastIndexOf("."))}`, opened_with: m.product && installed.has(key(m.product, "stable")) ? m.product : null };
    return {};
  },
  mediaRemove: async (id) => {
    const at = savedMedia.findIndex((s) => s.id === id);
    if (at >= 0) savedMedia.splice(at, 1);
  },
  mediaThumb: async (url) => url,
  filePreview: async (path) => {
    if (!path.endsWith(".preview.webp")) throw new Error("only a project's .preview.webp is shown");
    return "/media/formcut.webp";
  },
  repair: async (fix) => {
    await pause(400);
    const findings = repairFindings.map((f) => ({ ...f }));
    if (fix) {
      for (const f of findings) f.fixed = true;
      repairFindings.length = 0;
    }
    return { checked: installed.size, findings, fixed: fix ? findings.length : 0, freed: fix ? findings.filter((f) => f.kind !== "missing" && f.kind !== "broken" && f.kind !== "previous").reduce((n, f) => n + f.bytes, 0) : 0 };
  },
  laterList: async () => Array.from(later),
  updateLater: async (product, channel, on) => {
    if (on && !installed.has(key(product, channel))) throw new Error(`${product} is not installed`);
    if (on) later.add(key(product, channel));
    else later.delete(key(product, channel));
    return Array.from(later);
  },
  webPlan: async (url) => {
    if (!/^(https:\/\/|http:\/\/(127\.0\.0\.1|localhost)[:/])/.test(url)) throw new Error(`refused address "${url}": only https, or http on this computer, is fetched`);
    const name = decodeURIComponent(url.split(/[?#]/)[0].split("/").pop() ?? "");
    const ext = name.includes(".") ? `.${name.split(".").pop()?.toLowerCase()}` : "";
    const owner: Record<string, string> = { ".fc": "formcut", ".fmv": "formvis", ".formvis": "formvis", ".fmw": "formwav" };
    if (!owner[ext]) throw new Error(`${name || url} is not a Form project file (.fc, .fmv, .fmw, .formvis), so FormPortal will not download it`);
    return { url, host: url.split("/")[2] ?? "", name, product: owner[ext], folder: `${folders[0]?.path ?? "/home/you/Documents/Form"}/From the web` };
  },
  webFetch: async (url) => {
    const plan = await fixtureBridge.webPlan(url);
    await pause(500);
    return { saved: `${plan.folder}/${plan.name}`, product: plan.product, opened_with: installed.has(key(plan.product, "stable")) ? plan.product : null };
  },
  learn: async () => ({
    index_error: null,
    tutorials: tutorials.map((t) => {
      const done = Array.from(progress.get(t.id) ?? []).sort((a, b) => a - b);
      return { ...t, steps: t.steps.map((s) => ({ title: s.title, body: s.body, route: s.route ?? null, url: s.url ?? null })), done_steps: done, finished: done.length === t.steps.length };
    }),
  }),
  learnMark: async (id, step, done, reset) => {
    const t = tutorials.find((x) => x.id === id);
    if (!t) throw new Error(`there is no tutorial ${id}`);
    const set = progress.get(id) ?? new Set<number>();
    if (reset) set.clear();
    else if (step !== null) {
      if (step < 1 || step > t.steps.length) throw new Error(`${t.title} has ${t.steps.length} steps; there is no step ${step}`);
      if (done) set.add(step);
      else set.delete(step);
    }
    progress.set(id, set);
  },
  assistantAgents: async () => [
    { client: "claude", label: "Claude Code", path: params.get("assistant") === "none" ? null : "/usr/local/bin/claude" },
    { client: "codex", label: "Codex", path: null },
  ],
  assistantAsk: async (client, question) => {
    await pause(900);
    if (params.get("assistant") === "fail") throw new Error("Claude Code could not answer: not signed in");
    return { client, answer: `This is the browser preview, so no agent ran. In the app, Claude Code would answer "${question.slice(0, 80)}" using FormPortal's reading tools.` };
  },
  fonts: async () => ({
    index: { families: fontIndex },
    index_error: null,
    installed: fontsIn.map((f) => ({ ...f })),
    updates: fontsIn.filter((f) => f.source === "index" && fontIndex.find((x) => x.id === f.family_id)?.styles.some((s) => s.style === f.style && s.sha256 !== f.sha256)).map((f) => ({ ...f })),
    folder: "~/.local/share/fonts/FormPortal",
  }),
  fontInstall: async (id, style) => {
    await pause(250);
    const family = fontIndex.find((f) => f.id === id);
    if (!family) throw new Error(`${id} is not in the font index`);
    for (const s of family.styles.filter((x) => !style || x.style === style)) {
      const had = fontsIn.find((f) => f.family_id === id && f.style === s.style);
      if (had) had.sha256 = s.sha256;
      else fontsIn.push({ family: family.family, style: s.style, family_id: id, file: `~/.local/share/fonts/FormPortal/FormPortal-${id}-${s.style}.ttf`, sha256: s.sha256, source: "index", licence: family.licence });
    }
  },
  fontPick: async () => "/home/you/Downloads/Studio Grotesk.otf",
  fontAdd: async (path, rights) => {
    if (!rights) throw new Error("adding your own font needs your confirmation that you have the right to use it on this computer");
    const stem = path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "font";
    fontsIn.push({ family: stem, style: "as in the file", family_id: null, file: `~/.local/share/fonts/FormPortal/FormPortal-own-${stem}.otf`, sha256: "c".repeat(64), source: "own", licence: null });
  },
  fontRemove: async (family, style) => {
    for (let i = fontsIn.length - 1; i >= 0; i -= 1) {
      const f = fontsIn[i];
      if ((f.family === family || f.family_id === family) && (!style || f.style === style)) fontsIn.splice(i, 1);
    }
  },
  fontWeb: async (source) => {
    ((window as unknown as { __fontWebCalls?: string[] }).__fontWebCalls ??= []).push(source);
    await pause(400);
    const on = source === "fontsource" || providerKept.has("google-fonts");
    return { source, on, families: on ? webFamilies(source) : [] };
  },
  fontWebFamily: async (source, id) => {
    await pause(300);
    const [, family, category, subsets, weights, italic, licence, credit] = webRow(source, id);
    const faces = weights.flatMap((weight) => (italic ? [false, true] : [false]).map((it) => ({ weight, italic: it, style: `${weight}${it ? " Italic" : ""}` })));
    const ok = licence !== null && ["OFL-1.1", "Apache-2.0", "MIT"].includes(licence);
    return { source, id, family, category, licence, licence_url: licence === "OFL-1.1" ? "https://openfontlicense.org" : null, credit: credit || null, subset: source === "fontsource" ? subsets.split(",").includes("latin") ? "latin" : subsets.split(",")[0] : null, faces, installable: ok };
  },
  fontWebPreview: async (source, id) => {
    const file = webRow(source, id)[8];
    await pause(900);
    const bytes = new Uint8Array(await (await fetch(`/store/fonts/${file}`)).arrayBuffer());
    let text = "";
    for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(text);
  },
  fontWebInstall: async (source, id) => {
    await pause(500);
    const [, family, , , weights, italic, licence] = webRow(source, id);
    if (licence === null || !["OFL-1.1", "Apache-2.0", "MIT"].includes(licence)) throw new Error(licence === null ? `${family} cannot be installed: its licence is not stated` : `${family} is licensed ${licence}; FormPortal installs fonts licensed OFL-1.1, Apache-2.0 or MIT`);
    for (const weight of weights) for (const it of italic ? [false, true] : [false]) {
      const style = `${weight}${it ? " Italic" : ""}`;
      if (!fontsIn.some((f) => f.family_id === `${source}:${id}` && f.style === style)) fontsIn.push({ family, style, family_id: `${source}:${id}`, file: `~/.local/share/fonts/FormPortal/FormPortal-${family.replace(/ /g, "-")}-${style.replace(/ /g, "-")}.ttf`, sha256: "d".repeat(64), source, licence });
    }
  },
  appAgents: async (product, channel) => {
    const surface = installed.has(key(product, channel)) && (new URLSearchParams(window.location.search).get("agents") ?? "").split(",").includes(product);
    return { surface, server_name: channel === "stable" ? product : `${product}-${channel}`, clients: surface ? agentsFor(product, channel) : [] };
  },
  connectAgents: async (product, channel, disconnect) => {
    await pause(300);
    for (const client of ["claude", "codex", "cursor", "antigravity"]) {
      const id = `${key(product, channel)}:${client}`;
      if (disconnect) linked.delete(id);
      else linked.add(id);
    }
    return agentsFor(product, channel);
  },
  ownAgents: async () => {
    await pause(Number(new URLSearchParams(window.location.search).get("ownwait") ?? 0));
    return agentClients.clients.map(ownFor);
  },
  connectOwn: async (client, disconnect) => {
    await pause(300);
    const before = ownSeen.get(client) ?? "open";
    if (disconnect && (before === "connected" || before === "stale")) ownSeen.set(client, "open");
    if (!disconnect && (before === "open" || before === "stale")) ownSeen.set(client, "connected");
    return agentClients.clients.filter((row) => row.id === client).map(ownFor);
  },
  githubStatus: async () => ({ configured: new URLSearchParams(window.location.search).has("github"), account: github.account }),
  githubStart: async (share) => {
    github.polls = 0;
    github.share = share;
    github.fork = false;
    return { device_code: "fixture-device-code", user_code: "WDJB-MJHT", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 1 };
  },
  githubPoll: async (_code, interval) => {
    github.polls += 1;
    if (github.polls < 3) return { state: "waiting", interval };
    github.account = { login: "octo-tester", name: "Octo Tester", scopes: github.share ? ["read:user", "repo"] : github.fork ? ["read:user", "public_repo"] : ["read:user"] };
    return { state: "signed-in", account: github.account };
  },
  githubSignOut: async () => {
    github.account = null;
  },
  githubStartFork: async () => {
    github.polls = 0;
    github.share = false;
    github.fork = true;
    return { device_code: "fixture-device-code", user_code: "WDJB-MJHT", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 1 };
  },
  githubFork: async () => {
    if (!github.account) throw new Error("GitHub sign-in: you are not connected; connect from Preferences, Profile, Connect to GitHub first");
    if (!github.account.scopes.some((s) => s === "public_repo" || s === "repo")) throw new Error("GitHub sign-in: forking the extension registry needs the public_repo permission; choose Set up my extension registry fork in Preferences, Profile and approve it on GitHub");
    await new Promise((done) => window.setTimeout(done, 600));
    const existed = github.forked;
    github.forked = true;
    const repo = `${github.account.login}/form.ext-registry`;
    return { repo, url: `https://github.com/${repo}`, existed };
  },
  shares: async () => ({ ...shares, invitations: github.account && params.has("shared") ? shares.invitations : [] }),
  shareFolder: async (folder, invite) => {
    if (!github.account) throw new Error("GitHub sign-in: you are not connected; connect from Preferences, Profile, Connect to GitHub first");
    const repo = `${github.account.login}/formportal-library-${folder.split(/[\\/]/).pop()?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ?? "library"}`;
    const url = `https://github.com/${repo}`;
    const row = shares.shared.find((s) => s.folder === folder) ?? { folder, repo, url, invited: [] as string[] };
    row.invited = Array.from(new Set([...row.invited, ...invite]));
    if (!shares.shared.includes(row)) shares.shared.push(row);
    return { repo, url, folder, sent: 3, received: 0, unchanged: 0, skipped: [], invited: invite };
  },
  shareSend: async (folder) => ({ repo: shares.shared.find((s) => s.folder === folder)?.repo ?? "", url: "", folder, sent: 0, received: 0, unchanged: 3, skipped: [], invited: [] }),
  shareAccept: async (id) => {
    const i = shares.invitations.find((x) => x.id === id);
    if (!i) throw new Error("there is no invitation to that library");
    shares.invitations = shares.invitations.filter((x) => x !== i);
    const folder = `/home/you/Documents/Form/Shared/${i.repo.split("/")[1].replace("formportal-library-", "")} from ${i.from}`;
    shares.joined.push({ repo: i.repo, folder });
    return { repo: i.repo, url: `https://github.com/${i.repo}`, folder, sent: 0, received: 4, unchanged: 0, skipped: [], invited: [] };
  },
  sharePull: async (repo) => ({ repo, url: `https://github.com/${repo}`, folder: shares.joined.find((j) => j.repo === repo)?.folder ?? "", sent: 0, received: 1, unchanged: 3, skipped: [], invited: [] }),
  publishFile: async (file, remove) => {
    if (!github.account) throw new Error("GitHub sign-in: you are not connected; connect from Preferences, Profile, Connect to GitHub first");
    const found = shares.published.find((p) => p.file === file);
    if (remove) {
      if (!found) throw new Error(`${file} has no public link`);
      shares.published = shares.published.filter((p) => p !== found);
      return found;
    }
    const name = file.split(/[\\/]/).pop() ?? "file";
    const made = found ?? { file, repo: `${github.account.login}/formportal-public`, path: `0a1b2c3d4e5f/${name}`, sha: "0a1b2c3d4e5f", url: `https://github.com/${github.account.login}/formportal-public/blob/main/0a1b2c3d4e5f/${encodeURIComponent(name)}` };
    if (!found) shares.published.push(made);
    return made;
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
  agentAccess: async () => ({ ...access }),
  setAgentAccess: async (choice) => {
    access = { outside_agents: choice, stored: choice, seal: "sealed", seal_broken: false };
    return { ...access };
  },
  siteUpcoming: async () => {
    const now = Math.floor(Date.now() / 1000);
    if (SOON === "bundled") return { known: false, dated: [], undated: 0, supporters: 0, checked: 0, stale: true, launched: null };
    const undated = params.has("undated") ? SITE_UNDATED : 0;
    if (!SOON.startsWith("ask")) return { known: true, dated: SITE_DATED, undated, supporters: SITE_SUPPORTERS, checked: now, stale: false, launched: null };
    const dated = SOON === "ask-new" ? [{ at: "2027-01-15T17:00:00Z", count: 2 }] : SOON === "ask-out" ? [{ at: "2027-01-15T17:00:00Z", count: 0 }] : [];
    return { known: true, dated, undated, supporters: SITE_SUPPORTERS, checked: now, stale: false, launched: now - (SOON === "ask-soon" ? 30 * 60 : 2 * 3600) };
  },
  ...templatesFixture,
  supporterCheck: async (code) => {
    const given = code === null ? (prefs.supporter_code ?? "") : code.trim();
    if (code === "") {
      prefs = { ...prefs, supporter_code: null };
      return { state: "none", supporter: false, until: null, upcoming: [], checked: 0, stale: false };
    }
    if (given === "") return { state: "none", supporter: false, until: null, upcoming: [], checked: 0, stale: false };
    if (given !== SUPPORTER_FIXTURE_CODE) return { state: "no", supporter: false, until: null, upcoming: [], checked: Math.floor(Date.now() / 1000), stale: false };
    prefs = { ...prefs, supporter_code: given };
    return { state: "supporter", supporter: true, until: new Date(Date.now() + 90 * 86400000).toISOString().replace(/\.\d+Z$/, "Z"), upcoming: SITE_TILES, checked: Math.floor(Date.now() / 1000), stale: false };
  },
  providerKeys: async () => providerStates(),
  setProviderKey: async (provider, key) => {
    providerKnown(provider);
    const kept = key.trim();
    if (kept === "") throw new Error("there is no key to keep");
    if ([...kept].length > 256) throw new Error("an API key is never longer than 256 characters");
    if (!/^[\x21-\x7e]+$/.test(kept)) throw new Error("an API key is letters, digits and punctuation, with no spaces");
    providerKept.add(provider);
    return providerStates();
  },
  clearProviderKey: async (provider) => {
    providerKnown(provider);
    providerKept.delete(provider);
    return providerStates();
  },
  stockSources: async () => stockFixture.sources(providerKept),
  stockSearch: (source, kind, query, page) => stockFixture.search(providerKept, source, kind, query, page),
  stockPreview: (id, which) => stockFixture.preview(id, which),
  stockSave: (id, progress) => stockFixture.save(id, savedMedia, progress),
  stockReveal: async () => undefined,
  fileText: async (path) => {
    await pause(350);
    if (!folders.flatMap((f) => sampleFiles(f.path)).some((f) => f.path === path)) throw new Error(`${path} is not a project in one of FormPortal's folders`);
    if (!path.endsWith(".fcel")) return null;
    return { lines: SAMPLE_TEXT.split("\n").filter((l, i, all) => i < all.length - 1 || l).length, words: SAMPLE_TEXT.split(/\s+/).filter(Boolean).length, whole: true, first_lines: SAMPLE_TEXT.split("\n").slice(0, 12).join("\n").trimEnd() };
  },
  fileHash: async (path) => {
    await pause(700);
    const file = folders.flatMap((f) => sampleFiles(f.path)).find((f) => f.path === path);
    if (!file) throw new Error(`${path} is not a project in one of FormPortal's folders`);
    const limit = params.has("hashlimit") ? 1_000_000 : 2 * 1024 * 1024 * 1024;
    return { sha256: file.bytes <= limit ? await sampleHash(path) : null, bytes: file.bytes, limit };
  },
  fileDownload: async (path) => {
    await pause(400);
    const file = folders.flatMap((f) => sampleFiles(f.path)).find((f) => f.path === path);
    if (!file) throw new Error(`${path} is not a project in one of FormPortal's folders`);
    return { path: `/home/you/Downloads/${file.name}`, zipped: false };
  },
  fileDownloadReveal: async () => undefined,
  autoUpdate: async (progress) => {
    const done: UpdateOutcome[] = [];
    for (const record of Array.from(installed.values())) {
      const release = catalog.products.find((p) => p.id === record.product)?.channels[record.channel];
      if (!release || !versionNewer(release.version, record.version)) continue;
      const own = prefs.per_app[record.product];
      const automatic = own !== undefined ? own && (record.channel === "stable" || prefs.auto_update_beta) : record.channel === "stable" ? prefs.auto_update : prefs.auto_update && prefs.auto_update_beta;
      const k = key(record.product, record.channel);
      const putOff = later.has(k);
      const open = (params.get("open") ?? "").split(",").includes(record.product);
      if (!(automatic || putOff) || (putOff && open)) continue;
      if ((params.get("fail") ?? "").split(",").includes(record.product)) {
        done.push({ product: record.product, channel: record.channel, from: record.version, to: release.version, error: `${record.product}-${release.version}-macos-arm64.dmg does not match the catalogue: expected SHA-256 7d0372d3fb5c59e1dd80fea0bc8655b397adb351e296161f20dac18cd5973269, found a3371971d8281fe352d0e318d48f911a6ecac6a4b35f57a697e5e82d7055f053. It was not installed` });
        continue;
      }
      await fixtureBridge.install(record.product, record.channel, (f) => progress(record.product, record.channel, f));
      later.delete(k);
      done.push({ product: record.product, channel: record.channel, from: record.version, to: release.version, error: null });
    }
    return done;
  },
};
