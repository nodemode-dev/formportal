import { defineConfig, type Plugin } from "vite";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";
import { loadJson, renderMarkers, type Facts, type IconSet } from "../../design/markers.ts";

const FRONTEND_PORT = 3250;
const ROOT = fileURLToPath(new URL(".", import.meta.url));
const DESIGN = resolve(ROOT, "../../design");
const CATALOG = resolve(ROOT, "../../catalog");

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

const APPS = loadJson<{ products: App[] }>(resolve(CATALOG, "products.json")).products.filter((p) => p.id !== "formai");
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
  const parts: Record<string, string[]> = { cards, shelf, beta, updates };
  return html.replace(/<!-- @portal:([a-z]+) -->/g, (_, which: string) => (parts[which] ?? []).join("\n"));
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
