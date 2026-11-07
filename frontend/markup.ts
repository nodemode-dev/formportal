import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadJson } from "../design/markers.ts";
import { EXT_PRODUCTS, catalogueId } from "./src/engine/hosts.ts";

export interface App {
  id: string;
  name: string;
  kind: string;
  summary: string;
  alt_of?: string;
  note?: string;
  group?: string;
  licence?: string;
  repository?: string;
  project_extensions?: string[];
}

interface Caps {
  kind?: string;
  lede?: string;
  project?: string;
  runs_on?: string;
  checks?: string[];
}

export interface Built {
  parts: Record<string, string[]>;
  rootState: string;
  liveRules: string;
}

const SVG: Record<string, string> = {
  home: '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>',
  apps: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  updates: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.2h-4.2"/>',
  files: '<path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4.2l2 2H19a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
  fonts: '<path d="M4 19 9.5 5h1L16 19M6.2 14h7.6"/><path d="M19.7 12.5V19"/><circle cx="17.5" cy="15.8" r="2.2"/>',
  stock: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="m4.5 16.5 4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5"/><circle cx="15.5" cy="9.5" r="1.4"/>',
  extensions: '<path d="M10 4.5h4v3a1.5 1.5 0 1 0 3 0v-3h2.5V9h-3a1.5 1.5 0 1 0 0 3h3v7.5H14v-3a1.5 1.5 0 1 0-3 0v3H4.5V15h3a1.5 1.5 0 1 0 0-3h-3V4.5z"/>',
  learn: '<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19"/>',
  prefs: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.5a2.4 2.4 0 1 1 3.3 2.2c-.6.3-1 .8-1 1.5v.5M12 16.8v.2"/>',
  drop: '<path d="M12 4v10M8 10l4 4 4-4M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chevron: '<path d="m14.5 6-6 6 6 6"/>',
  file: '<path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5zM14 3.5V8h4"/>',
};

export const svg = (name: string, cls = "ic") =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${SVG[name] ?? ""}</svg>`;

const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const GROUPS: [string, string][] = [
  ["adobe", "Instead of Adobe"],
  ["other", "Everything around them"],
];
const ALIAS: Record<string, string> = { formportal: "formai", formdeck: "formslide", formskill: "formskills" };
const ICON_FILE: Record<string, string> = { formai: "formportal", formslide: "formdeck" };
const UPSTREAM: Record<string, string> = Object.fromEntries(Object.entries(ALIAS).map(([theirs, ours]) => [ours, theirs]));

const COMMON: Record<string, string> = {
  psd: "formvis", psb: "formvis", png: "formvis", tif: "formvis", tiff: "formvis", webp: "formvis", heic: "formvis", exr: "formvis", ora: "formvis",
  dng: "formlit", cr2: "formlit", cr3: "formlit", nef: "formlit", arw: "formlit", raf: "formlit", orf: "formlit", rw2: "formlit", jpg: "formlit", jpeg: "formlit",
  aep: "formvfx", lottie: "formvfx", mp4: "formcut", mov: "formcut", mkv: "formcut", webm: "formcut", avi: "formcut", prproj: "formcut",
  wav: "formwav", mp3: "formwav", flac: "formwav", aif: "formwav", aiff: "formwav", ogg: "formwav", m4a: "formwav",
  md: "formmd", markdown: "formmd", pptx: "formslide", ppt: "formslide", key: "formslide", odp: "formslide",
  pdf: "formpdf", svg: "formpath", ai: "formpath", eps: "formpath", indd: "formdesign", idml: "formdesign",
  xlsx: "formcel", xls: "formcel", csv: "formcel", ods: "formcel", docx: "formtxt", doc: "formtxt", odt: "formtxt", rtf: "formtxt",
  obj: "formsculpt", fbx: "formsculpt", glb: "formsculpt", gltf: "formsculpt", stl: "formsculpt", ztl: "formsculpt",
};

export function buildPortal(root: string, catalog: string, design: string): Built {
  const all = loadJson<{ products: App[] }>(resolve(catalog, "products.json")).products;
  const apps = all.filter((p) => p.id !== "formai");
  const hues = loadJson<Record<string, string>>(resolve(design, "app-hues.json"));
  const schedule = loadJson<{ releases: { label: string; at: string; apps: string[] }[] }>(resolve(catalog, "schedule.json")).releases.map((g) => ({
    ...g,
    apps: g.apps.map((id) => ALIAS[id] ?? id).filter((id) => apps.some((p) => p.id === id)),
  }));
  const scheduled = new Set(schedule.flatMap((g) => g.apps));
  const undated = apps.filter((p) => !scheduled.has(p.id)).length;
  const caps = (p: App): Caps => {
    const file = resolve(catalog, "apps", `${UPSTREAM[p.id] ?? p.id}.json`);
    return existsSync(file) ? loadJson<Caps>(file) : {};
  };
  const group = (p: App) => (p.group === "adobe" ? "adobe" : "other");
  const hue = (p: App | string) => hues[typeof p === "string" ? p : p.id] ?? "#f3ebe3";
  const has = (dir: string, id: string) => existsSync(resolve(root, "public", dir, `${id}.webp`));
  const line = (p: App) => esc(p.alt_of ? `Instead of ${p.alt_of}` : (p.note ?? ""));
  const name = (p: App, cls = "nm") => {
    const m = /^Form(.+)$/.exec(p.name);
    return m ? `<span class="${cls}"><span class="nm-f">Form</span><span class="nm-s">${esc(m[1])}</span></span>` : `<span class="${cls}"><span class="nm-f">${esc(p.name)}</span></span>`;
  };
  const icon = (pid: string, size: number, cls = "app-ic") => {
    const id = ICON_FILE[pid] ?? pid;
    return has("apps", id)
      ? `<span class="${cls}" aria-hidden="true"><img class="ic-dark" src="/apps/${esc(id)}.webp" alt="" width="${size}" height="${size}" decoding="async" /><img class="ic-light" src="/apps/${esc(id)}-light.webp" alt="" width="${size}" height="${size}" decoding="async" /></span>`
      : `<span class="${cls} app-ic-none" aria-hidden="true"></span>`;
  };
  const style = (p: App) => ` style="--hue:${hue(p)}"`;
  const searchable = (p: App) => esc(`${p.name} ${p.summary} ${p.alt_of ?? ""} ${p.note ?? ""} ${p.kind}`.toLowerCase());
  const repo = (p: App) => (p.repository?.startsWith("https://github.com/nodemode-dev/") ? p.repository.replace(/\/$/, "") : null);
  const web = (href: string, text: string) => `<a class="link" href="${esc(href)}" data-web>${text}</a>`;
  const state = '<span class="st-text" data-field="status"></span><span class="st-ver mono" data-field="version"></span>';
  const bar = '<span class="bar" aria-hidden="true"><i></i></span>';
  const more = "<!-- @include more-menu.html -->";
  const acts = (withMore: boolean) =>
    `<div class="acts"><button class="btn" type="button" data-act="update">Update</button><button class="btn" type="button" data-act="install">Install</button><button class="btn btn-primary" type="button" data-act="open">Open</button><span class="acts-wait">Release being prepared</span>${withMore ? more : ""}</div>`;

  const sidemine = apps.map(
    (p) =>
      `<li class="side-app" data-row="stable" data-product="${p.id}"${style(p)}><button class="nav-item nav-app" type="button" data-act="open" title="Open ${esc(p.name)}">${icon(p.id, 18, "app-ic app-ic-xs")}<span class="nav-label">${esc(p.name)}</span><span class="side-dot" aria-hidden="true"></span><span class="side-bar" aria-hidden="true"><i></i></span></button></li>`,
  );

  const dock = [
    `<li class="dk dk-self"${style(all.find((p) => p.id === "formai") ?? apps[0])}>${icon("formai", 40)}<span class="dk-tip">FormPortal</span></li>`,
    ...apps.map(
      (p) =>
        `<li class="dk" data-slot="${p.id}"${style(p)}><button class="dk-hit" type="button" data-route-to="app-${p.id}" tabindex="-1">${icon(p.id, 40)}<span class="dk-tip">${esc(p.name)}</span></button><span class="dk-seal" aria-hidden="true">?</span></li>`,
    ),
  ];

  const cards = apps.map(
    (p) =>
      `<li class="ucard" data-row="stable" data-product="${p.id}"${style(p)}><button class="ucard-art" type="button" data-route-to="app-${p.id}" tabindex="-1">${icon(p.id, 64)}</button><div class="ucard-body"><button class="ucard-name" type="button" data-route-to="app-${p.id}">${name(p)}</button><p class="sub">${line(p)}</p><p class="ucard-meta"><span class="st-ver mono" data-field="version"></span><span class="st-text" data-field="status"></span></p>${bar}${acts(false)}</div></li>`,
  );

  const tiles = apps.map(
    (p) =>
      `<li class="gtile" data-row="stable" data-product="${p.id}" data-group="${group(p)}"${style(p)}><button class="gtile-art" type="button" data-route-to="app-${p.id}" tabindex="-1">${icon(p.id, 44)}</button><div class="gtile-body"><button class="gtile-name" type="button" data-route-to="app-${p.id}">${name(p)}</button><p class="sub">${line(p)}</p>${bar}${acts(false)}</div></li>`,
  );

  const sealTile = '<li class="seal soon-tile"><span class="soon-mark" aria-hidden="true">?</span><span class="soon-name">Form?</span></li>';
  const opens = (at: string) => new Date(at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const MORE = 40;
  const soon = [
    ...schedule.map(
      (g, i) =>
        `<li class="wave soon-group" data-soon-group="${i}" data-soon-at="${esc(g.at)}"><p class="wave-head"><b class="soon-date">${esc(opens(g.at))}</b><b class="soon-due">Being prepared</b><span class="wave-n" data-wave-n></span></p><ul class="wave-tiles soon-tiles">${g.apps.map(() => sealTile).join("")}</ul></li>`,
    ),
    `<li class="wave soon-group" data-soon-extra><p class="wave-head"><b class="soon-date">Date to come</b><span class="wave-n" data-wave-n></span></p><ul class="wave-tiles soon-tiles">${Array.from({ length: MORE }, () => sealTile).join("")}</ul></li>`,
  ];

  const rows = (p: App, channel: "stable" | "beta") =>
    `<li class="row" data-row="${channel}" data-product="${p.id}" data-group="${group(p)}" data-search="${searchable(p)}"${style(p)}>${icon(p.id, 40)}<div class="row-id"><button class="row-name" type="button" data-route-to="app-${p.id}">${name(p)}${channel === "beta" ? ' <span class="chip">BETA</span>' : ""}</button><p class="sub">${line(p)}</p></div><p class="row-sum">${esc(p.summary)}</p><p class="row-state">${state}${bar}</p>${acts(true)}</li>`;

  const list = GROUPS.map(
    ([g, title]) => `<section class="group" data-group-head="${g}"><h2 class="group-title">${title}</h2><ul class="rows">${apps.filter((p) => group(p) === g).map((p) => rows(p, "stable")).join("")}</ul></section>`,
  );
  const updates = apps.flatMap((p) => (["stable", "beta"] as const).map((channel) => rows(p, channel)));

  const pages = apps.map((p) => {
    const c = caps(p);
    const r = repo(p);
    const hero = has("heroes", p.id)
      ? `<div class="hero-shot"><img class="ic-dark" src="/heroes/${p.id}.webp" alt="${esc(p.name)} on screen" width="1600" height="1000" decoding="async" loading="lazy" /><img class="ic-light" src="/heroes/${p.id}-light.webp" alt="${esc(p.name)} on screen" width="1600" height="1000" decoding="async" loading="lazy" /></div>`
      : `<div class="hero-shot hero-plate" aria-hidden="true">${icon(p.id, 120)}</div>`;
    const opensList = [...new Set([...(p.project_extensions ?? []), ...(c.project ? [c.project] : []), ...Object.entries(COMMON).filter(([, id]) => id === p.id).map(([ext]) => `.${ext}`)])].slice(0, 12);
    const does = (c.checks ?? []).slice(0, 6).map((t) => `<li>${esc(t)}</li>`).join("");
    const links = r ? `${web(`${r}#readme`, "Guide and docs")}${web("https://formai.studio/download/", "Every release")}${web(`${r}/issues/new`, "Report a problem")}${web(`${r}/discussions`, "Ask the community")}` : "";
    const beta = `<div class="beta-row" data-row="beta" data-product="${p.id}"${style(p)}><div><h3 class="h3">Beta</h3><p class="sub">The next version while it is still being tested. It installs beside ${esc(p.name)}, keeps its own settings, and can be unstable.</p><p class="row-state">${state}${bar}</p></div>${acts(false)}${r ? `<p class="links">${web(`${r}/issues/new?labels=beta&title=${encodeURIComponent(`${p.name} beta: `)}`, "Send feedback on the beta")}</p>` : ""}</div>`;
    const agents = `<section class="ap-agents" data-agents="${p.id}" hidden aria-label="${esc(p.name)} with your AI tools"><h3 class="h3">Use ${esc(p.name)} with your AI tools</h3><p class="sub">${esc(p.name)} has its own MCP server. FormPortal adds it to Claude Code, Codex and Cursor and starts whichever version is installed.</p><ul class="agent-list">${[["claude", "Claude Code"], ["codex", "Codex"], ["cursor", "Cursor"]].map(([id, label]) => `<li class="agent" data-client="${id}"><span class="agent-name">${label}</span><span class="agent-state" data-agent-state>Checking</span></li>`).join("")}</ul><div class="agent-acts"><button class="btn btn-primary" type="button" data-agents-connect>Connect</button><button class="btn" type="button" data-agents-disconnect>Disconnect</button></div></section>`;
    return `<section class="pane pane-app" data-pane="app-${p.id}" data-title="${esc(p.name)}" data-product="${p.id}" data-tab="overview" aria-label="${esc(p.name)}"${style(p)}>
<header class="hero" data-row="stable" data-product="${p.id}"><div class="hero-in"><button class="back" type="button" data-route-to="apps">${svg("back")}<span>Apps</span></button>
<div class="hero-id">${icon(p.id, 88, "app-ic app-ic-hero")}<div class="hero-text"><h1 class="hero-name">${name(p, "nm nm-big")}</h1><p class="hero-alt">${line(p) || esc(c.kind ?? "")}</p><p class="chips"><span class="mono" data-field="version"></span><span class="mono" data-field="size"></span><span>${esc((p.licence ?? "").toUpperCase())}</span><span>MACOS · WINDOWS · LINUX</span></p></div></div>
<div class="hero-acts"><p class="row-state">${state}${bar}</p>${acts(true)}</div>${hero}</div></header>
<div class="page page-app"><nav class="tabs" role="tablist" aria-label="${esc(p.name)}"><button type="button" role="tab" data-tab-to="overview">Overview</button><button type="button" role="tab" data-tab-to="new">What's new</button><button type="button" role="tab" data-tab-to="versions">Versions and beta</button><button type="button" role="tab" data-tab-to="ai">AI tools</button></nav>
<div class="tab" data-tab-pane="overview"><div class="ov"><div class="ov-main"><p class="lede">${esc(c.lede ?? p.summary)}</p>${does ? `<h3 class="h3">What it does</h3><ul class="does">${does}</ul>` : ""}</div>
<aside class="facts" data-row="stable" data-product="${p.id}"><dl><div><dt>Released</dt><dd data-field="date"></dd></div><div><dt>Opens</dt><dd class="chips">${opensList.map((e) => `<span>${esc(e.toUpperCase())}</span>`).join("")}</dd></div><div><dt>Runs on</dt><dd>${esc(c.runs_on ?? "macOS, Windows and Linux")}</dd></div><div><dt>Licence</dt><dd>${esc(p.licence ?? "")} · free</dd></div><div><dt>Agent skills</dt><dd class="facts-skills" data-skills><button class="link-btn skills-yes" type="button" data-route-to="app-formskills">Read them in FormSkills ${svg("arrow")}</button><span class="skills-no">None published yet</span></dd></div><div><dt>Download</dt><dd class="mono" data-field="file"></dd></div><div><dt>SHA-256</dt><dd class="mono facts-hash" data-field="sha256"></dd></div></dl></aside></div><p class="links">${links}</p></div>
<div class="tab" data-tab-pane="new"><div class="notes" data-row="stable" data-product="${p.id}"><p class="sub"><span data-field="version" class="mono"></span> · <span data-field="date"></span></p><div class="notes-text" data-field="notes"></div></div></div>
<div class="tab" data-tab-pane="versions">${beta}</div>
<div class="tab" data-tab-pane="ai">${agents}<p class="sub ai-none">${esc(p.name)} has no MCP server of its own yet. <button class="link-btn" type="button" data-route-to="app-formmcp">FormMCP</button> connects your AI tools to every Form app at once.</p></div>
</div></section>`;
  });

  const autolist = apps.map(
    (p) => `<li class="auto-item" data-row="stable" data-product="${p.id}">${`<label class="check">${icon(p.id, 22, "app-ic app-ic-s")}<span class="auto-name">${esc(p.name)}</span><input type="checkbox" class="switch" data-auto /></label>`}</li>`,
  );

  const learn = apps.filter((p) => repo(p)).map((p) => `<li class="learn" data-product="${p.id}"${style(p)}>${icon(p.id, 40)}<div class="learn-text"><h3 class="learn-name">${name(p)}</h3><p class="links">${web(`${repo(p)}#readme`, "Guide and docs")}${web("https://formai.studio/download/", "Every release")}${web(`${repo(p)}/discussions`, "Ask the community")}</p></div></li>`);

  const extIds = EXT_PRODUCTS.map(catalogueId).filter((id) => all.some((p) => p.id === id));
  const extfilters = extIds.map((id) => `<button class="seg-item" type="button" data-ext-filter="${id}" data-product="${id}" aria-pressed="false">${esc(all.find((p) => p.id === id)?.name ?? id)}</button>`);

  const fileApps: Record<string, string> = { ...COMMON };
  for (const p of apps) {
    for (const ext of [...(p.project_extensions ?? []), ...(caps(p).project ? [caps(p).project as string] : [])]) fileApps[ext.replace(/^\./, "").toLowerCase()] = p.id;
  }

  const parts: Record<string, string[]> = {
    sidemine,
    dock,
    cards,
    tiles,
    soon,
    all: list,
    updates,
    pages,
    autolist,
    learn,
    extfilters,
    total: [String(apps.length)],
    fileapps: [esc(JSON.stringify(fileApps))],
  };
  const left = schedule.map((g) => g.apps.length);
  const rootState = ` data-live=""${left.map((n, i) => ` data-soon-g${i}="${n}"`).join("")} data-soon-left="${left.reduce((a, b) => a + b, 0)}" data-soon-more="${Math.min(MORE, undated)}"`;

  const liveRules = [
    ...apps.map((p) => `html:not([data-live~="${p.id}"]) [data-product="${p.id}"]:not([data-path]) { display: none !important; }`),
    ...apps.map((p) => `html[data-live~="${p.id}"] .dk[data-slot="${p.id}"] { order: 0; } html[data-live~="${p.id}"] .dk[data-slot="${p.id}"] .dk-hit { display: grid; } html[data-live~="${p.id}"] .dk[data-slot="${p.id}"] .dk-seal { display: none; }`),
    ...schedule.flatMap((g, i) => [
      `html[data-soon-g${i}="0"] [data-soon-group="${i}"] { display: none; }`,
      ...g.apps.map((_, k) => `html[data-soon-g${i}="${k}"] [data-soon-group="${i}"] .soon-tile:nth-child(n + ${k + 1}) { display: none; }`),
    ]),
    `html[data-soon-more="0"] [data-soon-extra] { display: none; }`,
    ...Array.from({ length: MORE - 1 }, (_, k) => `html[data-soon-more="${k + 1}"] [data-soon-extra] .soon-tile:nth-child(n + ${k + 2}) { display: none; }`),
    `html[data-soon-left="0"][data-soon-more="0"] [data-soon] { display: none; }`,
    ...extIds.map((id) => `[data-pane="extensions"][data-filter="${id}"] .ext:not([data-product="${id}"]) { display: none; }`),
    ...GROUPS.map(([g]) => {
      const none = apps.filter((p) => group(p) === g).map((p) => `:not([data-live~="${p.id}"])`).join("");
      return `html${none} [data-group-head="${g}"] { display: none; }`;
    }),
  ].join("\n");

  return { parts, rootState, liveRules };
}
