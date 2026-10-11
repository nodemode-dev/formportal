import { defineConfig, type Plugin } from "vite";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";
import { loadJson, renderMarkers, type Facts, type IconSet } from "../design/markers.ts";

const FRONTEND_PORT = 3250;
const ROOT = fileURLToPath(new URL(".", import.meta.url));
const DESIGN = resolve(ROOT, "../design");
const CATALOG = resolve(ROOT, "../catalog");

const pkg = loadJson<{ version: string }>(resolve(ROOT, "package.json"));
const icons = loadJson<IconSet>(resolve(DESIGN, "icons.json"));
const facts: Facts = { version: pkg.version };

interface App {
  id: string;
  name: string;
  kind: string;
  summary: string;
  alt_of?: string;
  note?: string;
  status?: string;
}

const GROUPS = ["adobe", "other", "next"];
const APPS = loadJson<{ products: (App & { group?: string })[] }>(resolve(CATALOG, "products.json"))
  .products.filter((p) => p.id !== "formai")
  .sort((a, b) => GROUPS.indexOf(a.group ?? "other") - GROUPS.indexOf(b.group ?? "other"));
const SHOTS = new Set(["formcut", "formvis", "formwav"]);
const FIRST = "formcut";

const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const name = (p: App) => `<span class="app-form">Form</span><span class="app-suffix">${esc(p.name.replace(/^Form/, ""))}</span>`;
const kind = (p: App) => esc(p.kind.charAt(0).toUpperCase() + p.kind.slice(1));
const line = (p: App) => esc(p.alt_of ? `Instead of ${p.alt_of}` : (p.note ?? ""));
const shot = (p: App, cls: string) =>
  SHOTS.has(p.id)
    ? `<img class="${cls}" src="/media/${p.id}.webp" width="1600" height="1000" alt="" />`
    : `<span class="${cls} app-plate" aria-hidden="true">${esc(p.name.replace(/^Form/, ""))}</span>`;
const meta = (extra = "") => `<span data-field="status"></span><span data-field="version"></span>${extra}`;

function renderPortal(html: string): string {
  const cards = APPS.map(
    (p) => `<li class="card" data-row="stable" data-product="${p.id}"${p.id === FIRST ? " data-on" : ""}>${shot(p, "card-shot")}<div class="card-body"><h2 class="card-name">${name(p)}</h2><p class="card-kind">${line(p)}</p><p class="card-sum">${esc(p.summary)}</p><p class="card-meta">${meta('<span data-field="size"></span>')}</p><!-- @include row-actions.html --></div></li>`,
  );
  const shelf = APPS.map(
    (p) => `<button class="shelf-item" type="button" data-app-to="${p.id}" data-row="stable" data-product="${p.id}" aria-pressed="${p.id === FIRST}">${shot(p, "shelf-shot")}<span class="shelf-text"><span class="shelf-name">${esc(p.name)}</span><span class="shelf-kind">${kind(p)}</span><span class="shelf-status" data-field="status"></span></span></button>`,
  );
  const beta = APPS.filter((p) => (p.status ?? "available") === "available").map(
    (p) => `<li class="tile" data-row="beta" data-product="${p.id}">${shot(p, "tile-shot")}<div class="tile-body"><h2 class="tile-name">${name(p)}</h2><p class="tile-kind">${kind(p)}, beta</p><p class="tile-meta">${meta()}</p><!-- @include row-actions.html --></div></li>`,
  );
  const updates = APPS.flatMap((p) =>
    ["stable", "beta"].map(
      (channel) => `<li class="up" data-row="${channel}" data-product="${p.id}">${shot(p, "up-shot")}<div class="up-text"><h2 class="up-name">${esc(p.name)}${channel === "beta" ? ", beta" : ""}</h2><p class="up-meta">${meta('<span data-field="date"></span>')}</p></div><!-- @include row-actions.html --></li>`,
    ),
  );
  const words: Record<string, string> = { available: "Available", "in-progress": "In progress", "in-development": "In development" };
  const icons = APPS.map(
    (p) => `<li data-product="${p.id}"><a class="lu-icon" href="#cell-${p.id}"><span class="lu-icon-tile">${esc(p.name.replace(/^Form/, "").slice(0, 2))}</span><span class="lu-icon-name">${esc(p.name)}</span></a></li>`,
  );
  const lineup = APPS.map((p, i) => {
    const n = String(i + 1).padStart(2, "0");
    const status = p.status ?? "available";
    return `<li class="cell" id="cell-${p.id}" data-row="stable" data-product="${p.id}" data-status="${status}"><div class="cell-top"><span class="cell-num">${n}</span><span class="cell-cat">${kind(p)}</span></div><div class="cell-shot">${shot(p, "cell-img")}<span class="cell-icon" aria-hidden="true">${esc(p.name.replace(/^Form/, "").slice(0, 2))}</span></div><div class="cell-body"><h2 class="cell-name">${name(p)}</h2><p class="cell-line">${line(p)}</p><p class="cell-sum">${esc(p.summary)}</p><p class="cell-chips"><span class="chip chip-status">${words[status]}</span><span class="chip" data-field="status"></span><span class="chip">macOS</span><span class="chip">Windows</span><span class="chip">Linux</span></p><p class="cell-meta">${meta('<span data-field="size"></span>')}</p><!-- @include row-actions.html --></div></li>`;
  });
  const badge = (p: App) => ({ "in-progress": "Soon", "in-development": "Later" })[p.status ?? ""] ?? "";
  const tag = (p: App) => (badge(p) ? `<span class="tag">${badge(p)}</span>` : "");
  const glyph = (p: App) => `<span class="glyph" aria-hidden="true">${esc(p.name.replace(/^Form/, "").slice(0, 2))}</span>`;
  const nav = (group: string) =>
    APPS.filter((p) => (p as App & { group?: string }).group === group).map(
      (p) => `<li data-product="${p.id}"><button class="rail-item" type="button" data-route-to="app-${p.id}">${glyph(p)}<span class="rail-label">${esc(p.name)}</span>${tag(p)}</button></li>`,
    );
  const titles: Record<string, string> = { adobe: "Instead of Adobe", other: "More apps", next: "On the way" };
  const home = GROUPS.map(
    (group) =>
      `<h2 class="home-group">${titles[group]}</h2><ul class="tools">${APPS.filter((p) => (p as App & { group?: string }).group === group)
        .map(
          (p) => `<li data-product="${p.id}"><button class="tool" type="button" data-route-to="app-${p.id}">${glyph(p)}<span class="tool-text"><span class="tool-name">${esc(p.name)}${tag(p)}</span><span class="tool-sum">${esc(p.summary)}</span></span><span class="tool-go" aria-hidden="true">%icon:arrow-right:ic-s%</span></button></li>`,
        )
        .join("")}</ul>`,
  );
  const pages = APPS.map((p) => {
    const status = p.status ?? "available";
    return `<section class="pane pane-app" data-pane="app-${p.id}" data-product="${p.id}" aria-label="${esc(p.name)}"><div class="ap-grid"><div class="ap-text"><p class="home-kicker">${kind(p)}</p><h1 class="ap-name">${name(p)}</h1><p class="ap-line">${line(p)}</p><p class="ap-sum">${esc(p.summary)}</p><p class="cell-chips"><span class="chip chip-status">${words[status]}</span><span class="chip">GPL-3.0-only</span><span class="chip">macOS</span><span class="chip">Windows</span><span class="chip">Linux</span></p><div class="cell ap-cell" data-row="stable" data-product="${p.id}"><p class="cell-meta">${meta('<span data-field="size"></span>')}</p><!-- @include row-actions.html --></div></div><div class="ap-shot">${shot(p, "cell-img")}</div></div><h2 class="home-group">More in this group</h2><ul class="tools">${APPS.filter((q) => q.id !== p.id && (q as App & { group?: string }).group === (p as App & { group?: string }).group)
      .slice(0, 6)
      .map((q) => `<li data-product="${q.id}"><button class="tool" type="button" data-route-to="app-${q.id}">${glyph(q)}<span class="tool-text"><span class="tool-name">${esc(q.name)}${tag(q)}</span><span class="tool-sum">${esc(q.summary)}</span></span></button></li>`)
      .join("")}</ul></section>`;
  });
  const parts: Record<string, string[]> = {
    cards, shelf, beta, updates, icons, lineup, count: [String(APPS.length)],
    "nav-adobe": nav("adobe"), "nav-other": nav("other"), "nav-next": nav("next"), home, pages,
    "count-adobe": [String(nav("adobe").length)], "count-other": [String(nav("other").length)], "count-next": [String(nav("next").length)],
  };
  return html.replace(/<!-- @portal:([a-z-]+) -->/g, (_, which: string) => (parts[which] ?? []).join("\n"));
}

function hubPlugin(): Plugin {
  return {
    name: "formai-hub",
    transformIndexHtml: {
      order: "pre",
      handler(source) {
        const html = renderPortal(source);
        const rows = /(<li class="row" data-row="[a-z]+" data-product="[a-z]+">[\s\S]*?<p class="row-version" data-field="version"><\/p>)/g;
        const withActions = html.replace(rows, "$1\n              <!-- @include row-actions.html -->");
        return renderMarkers(withActions, { icons, facts, chromeDir: ROOT, origin: "", rel: "" });
      },
    },
  };
}

export default defineConfig({
  root: ".",
  publicDir: "public",
  plugins: [hubPlugin()],
  clearScreen: false,
  server: {
    port: FRONTEND_PORT,
    host: false,
    strictPort: true,
    fs: { allow: [ROOT, DESIGN, CATALOG] },
  },
  preview: {
    port: FRONTEND_PORT + 1,
    host: false,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2022",
    assetsInlineLimit: 0,
  },
});
