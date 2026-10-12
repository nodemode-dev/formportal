import apps from "../../../catalog/fixtures/apps.json";
import extensions from "../../../catalog/fixtures/extensions.json";
import learnPortal from "../../../core/data/learn-portal.json";
import { DEFAULT_PREFS, versionNewer } from "../engine/index.ts";
import type { RepairFinding, AgentClient, MediaItem, SavedMedia, FontFamilyEntry, InstalledFont, FileVersion, FolderView, ProjectFile, Catalog, Channel, ExtensionIndex, InstalledExtension, InstallRecord, Os, Platform, Preferences, UpdateOutcome } from "../engine/types.ts";
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
  { path: `${folder}/Trailer.fc`, name: "Trailer.fc", folder, product: "formcut", bytes: 18_400_000, modified: stamp, versions: 4, preview: `${folder}/Trailer.fc.preview.webp` },
  { path: `${folder}/Posters/Launch poster.fmv`, name: "Launch poster.fmv", folder, product: "formvis", bytes: 52_300_000, modified: stamp - day, versions: 2 },
  { path: `${folder}/Audio/Interview mix.fmw`, name: "Interview mix.fmw", folder, product: "formwav", bytes: 9_100_000, modified: stamp - 3 * day, versions: 1 },
  { path: `${folder}/Cutdowns/Teaser 15s.fc`, name: "Teaser 15s.fc", folder, product: "formcut", bytes: 4_200_000, modified: stamp - 9 * day, versions: 1 },
];
const kept = new Map<string, FileVersion[]>();
const versionsOf = (path: string, count: number): FileVersion[] => {
  if (!kept.has(path)) kept.set(path, Array.from({ length: count }, (_, i) => ({ id: `${stamp - i * day}-${(i + 1).toString(16).padStart(12, "0")}`, at: stamp - i * day, size: 1000 * (count - i), sha256: "0".repeat(64), reason: i === count - 1 ? "first seen" : "changed since the last version" })));
  return kept.get(path) ?? [];
};
const fam = (id: string, family: string, foundry: string, category: string, styles: [string, number][]): FontFamilyEntry => ({
  id, family, foundry, licence: "OFL-1.1", category,
  styles: styles.map(([style, weight]) => ({ style, weight, italic: /Italic/.test(style), file: `${id}-${style}.ttf`, url: `https://fonts.example/${id}-${style}.ttf`, bytes: 300_000, sha256: "0".repeat(64) })),
});
const fontIndex: FontFamilyEntry[] = [
  fam("inter", "Inter", "Rasmus Andersson", "sans-serif", [["Regular", 400], ["Italic", 400], ["SemiBold", 600], ["Bold", 700]]),
  fam("source-serif-4", "Source Serif 4", "Adobe", "serif", [["Regular", 400], ["Bold", 700]]),
  fam("ibm-plex-mono", "IBM Plex Mono", "IBM", "monospace", [["Regular", 400], ["Medium", 500], ["Bold", 700]]),
  fam("fira-sans", "Fira Sans", "Mozilla", "sans-serif", [["Regular", 400], ["Bold", 700]]),
  fam("literata", "Literata", "TypeTogether", "serif", [["Regular", 400], ["Italic", 400]]),
  fam("space-grotesk", "Space Grotesk", "Florian Karsten", "display", [["Regular", 400], ["Bold", 700]]),
];
const fontsIn: InstalledFont[] = new URLSearchParams(window.location.search).has("fontupdate")
  ? ["Regular", "Bold"].map((style) => ({ family: "Inter", style, family_id: "inter", file: `~/.local/share/fonts/FormPortal/FormPortal-inter-${style}.ttf`, sha256: "1".repeat(64), source: "index" as const, licence: "OFL-1.1" }))
  : [];
const mediaItem = (id: string, title: string, kind: MediaItem["kind"], licence: string, thumbnail: string | null, product: string | null = null): MediaItem => ({
  id, title, kind, product, creator: "Sample creator", licence, source_url: `https://media.example/${id}`, file: `${id}${product === "formcut" ? ".fc" : product === "formwav" ? ".fmw" : ".bin"}`, bytes: 2_400_000, thumbnail, tags: [kind],
});
const mediaIndex: MediaItem[] = [
  mediaItem("orange-render", "Orange swirl render", "image", "CC0-1.0", "/media/formvis.webp"),
  mediaItem("dark-timeline", "Timeline at night", "image", "CC-BY-4.0", "/media/formcut.webp"),
  mediaItem("wave-session", "Waveform session", "image", "CC-BY-SA-4.0", "/media/formwav.webp"),
  mediaItem("rain-roof", "Rain on a roof", "audio", "CC0-1.0", null),
  mediaItem("city-drone", "City from above", "video", "CC-BY-4.0", null),
  mediaItem("social-cut", "Social cut 9:16", "template", "CC0-1.0", "/media/formcut.webp", "formcut"),
  mediaItem("podcast-mix", "Podcast mix", "template", "CC0-1.0", "/media/formwav.webp", "formwav"),
];
const savedMedia: SavedMedia[] = [];
const params = new URLSearchParams(window.location.search);
const sampleTutorial = {
  id: "formcut-first-cut", product: "formcut", title: "Make your first cut", summary: "A sample of an app's tutorial from the tutorial index: import a clip, trim it and export.", minutes: 5, level: "beginner",
  steps: [
    { title: "Import a clip", body: "Sample step from the browser preview.", route: null, url: "https://github.com/nodemode-ai/formcut#readme" },
    { title: "Trim it", body: "Sample step from the browser preview.", route: null, url: null },
    { title: "Export", body: "Sample step from the browser preview.", route: null, url: null },
  ],
};
type FixtureTutorial = { id: string; product: string; title: string; summary: string; minutes: number; level: string; steps: { title: string; body: string; route?: string | null; url?: string | null }[] };
const tutorials: FixtureTutorial[] = [...(learnPortal.tutorials as FixtureTutorial[]), sampleTutorial];
const progress = new Map<string, Set<number>>();
const later = new Set<string>();
const repairFindings: RepairFinding[] = params.has("repair")
  ? [
      { kind: "broken", product: "formcut", channel: "stable", path: "/home/you/.local/share/formportal/apps/formcut/stable/2.6.2", bytes: 0, problem: "formcut 2.6.2 has nothing FormPortal can open in its folder", fix: "install the same version again from the catalogue, checking its SHA-256", fixed: false, error: null },
      { kind: "leftover", product: "formcut", channel: null, path: "/home/you/.local/share/formportal/apps/formcut/stable/2.5.0", bytes: 84_000_000, problem: "formcut 2.5.0 is on disk but no install record points to it", fix: "delete the folder", fixed: false, error: null },
      { kind: "download", product: null, channel: null, path: "/home/you/.local/share/formportal/downloads/formcut-2.6.1.zip", bytes: 61_000_000, problem: "formcut-2.6.1.zip is a download that was not cleaned up", fix: "delete it", fixed: false, error: null },
    ]
  : [];
const credit = (m: MediaItem) => (m.licence === "CC0-1.0" ? `${m.title} by ${m.creator}, public domain (CC0 1.0), ${m.source_url}` : `${m.title} by ${m.creator}, licensed ${m.licence}, ${m.source_url}`);
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
  onVersionsKept: (handler) => {
    if (!params.has("saves") || !folders.length) return;
    window.setTimeout(() => {
      const path = `${folders[0].path}/Trailer.fc`;
      const list = versionsOf(path, 4);
      list.unshift({ id: `${stamp + 300}-${"c".repeat(12)}`, at: stamp + 300, size: (list[0]?.size ?? 0) + 512, sha256: "c".repeat(64), reason: "saved" });
      handler([path]);
    }, 6000);
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
      const k = key(record.product, record.channel);
      const putOff = later.has(k);
      const open = (params.get("open") ?? "").split(",").includes(record.product);
      if (!(automatic || putOff) || (putOff && open)) continue;
      await fixtureBridge.install(record.product, record.channel, (f) => progress(record.product, record.channel, f));
      later.delete(k);
      done.push({ product: record.product, channel: record.channel, from: record.version, to: release.version, error: null });
    }
    return done;
  },
};
