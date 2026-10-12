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
  repository?: string;
  group?: string;
}

const GROUPS: [string, string][] = [
  ["adobe", "Instead of Adobe"],
  ["other", "More apps"],
  ["next", "On the way"],
];
const ORDER = GROUPS.map(([id]) => id);
const APPS = loadJson<{ products: App[] }>(resolve(CATALOG, "products.json"))
  .products.filter((p) => p.id !== "formai")
  .sort((a, b) => ORDER.indexOf(a.group ?? "other") - ORDER.indexOf(b.group ?? "other"));
const RELEASED = APPS.filter((p) => (p.status ?? "available") === "available");
const SHOTS = new Set(["formcut", "formvis", "formwav"]);
const STATUS: Record<string, string> = { available: "Available", "in-progress": "In progress", "in-development": "In development" };

const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const short = (p: App) => esc(p.name.replace(/^Form\.?/, "").slice(0, 2));
const line = (p: App) => esc(p.alt_of ? `Instead of ${p.alt_of}` : (p.note ?? ""));
const tile = (p: App, size = "") => `<span class="tile${size ? ` tile-${size}` : ""}" aria-hidden="true">${short(p)}</span>`;
const words = (p: App) => STATUS[p.status ?? "available"];
const searchable = (p: App) => esc(`${p.name} ${p.summary} ${p.alt_of ?? ""} ${p.kind}`.toLowerCase());
const repo = (p: App) => (p.repository?.startsWith("https://github.com/nodemode-ai/") ? p.repository.replace(/\/$/, "") : null);
const web = (href: string, text: string) => `<a class="link" href="${esc(href)}" data-web>${text}</a>`;
const help = (p: App) => {
  const r = repo(p);
  return r ? `${web(`${r}#readme`, "Guide and docs")}${web(`${r}/releases`, "Every release")}${web(`${r}/issues/new`, "Report a problem")}` : "";
};
const feedback = (p: App) => {
  const r = repo(p);
  return r ? `<p class="row-help">${web(`${r}/issues/new?labels=beta&title=${encodeURIComponent(`${p.name} beta: `)}`, "Send feedback on the beta")}</p>` : "";
};
const state = '<span class="state-text" data-field="status"></span><span class="state-ver" data-field="version"></span>';

function renderPortal(html: string): string {
  const row = (p: App, channel: "stable" | "beta", extra = "") =>
    `<li class="row" data-row="${channel}" data-product="${p.id}" data-group="${p.group ?? "other"}" data-status="${p.status ?? "available"}" data-search="${searchable(p)}">${tile(p)}<div class="row-main"><button class="row-name" type="button" data-route-to="app-${p.id}">${esc(p.name)}${channel === "beta" ? " beta" : ""}</button><p class="row-sub">${line(p)}</p></div><p class="row-state">${state}</p><!-- @include row-actions.html -->${extra}</li>`;

  const all = GROUPS.map(
    ([group, title]) =>
      `<li class="list-group" data-group-head="${group}"><h2 class="group-title">${title}</h2></li>${APPS.filter((p) => (p.group ?? "other") === group).map((p) => row(p, "stable")).join("")}`,
  );
  const updates = APPS.flatMap((p) => (["stable", "beta"] as const).map((channel) => row(p, channel)));
  const beta = RELEASED.map((p) => row(p, "beta", feedback(p)));

  const mine = RELEASED.flatMap((p) =>
    (["stable", "beta"] as const).map(
      (channel) =>
        `<li class="mine" data-row="${channel}" data-product="${p.id}">${tile(p, "l")}<button class="mine-name" type="button" data-route-to="app-${p.id}">${esc(p.name)}${channel === "beta" ? " beta" : ""}</button><p class="mine-state">${state}</p><!-- @include card-actions.html --></li>`,
    ),
  );

  const family = GROUPS.map(
    ([group, title]) =>
      `<section class="fam-group"><h3 class="group-title">${title}</h3><ul class="fam-list">${APPS.filter((p) => (p.group ?? "other") === group)
        .map(
          (p) =>
            `<li class="fam" data-row="stable" data-product="${p.id}" data-status="${p.status ?? "available"}">${tile(p)}<div class="fam-text"><button class="fam-name" type="button" data-route-to="app-${p.id}">${esc(p.name)}</button><p class="fam-sub">${line(p)}</p><p class="fam-state">${(p.status ?? "available") === "available" ? state : `<span class="chip">${words(p)}</span>`}</p></div>${(p.status ?? "available") === "available" ? "<!-- @include card-actions.html -->" : ""}</li>`,
        )
        .join("")}</ul></section>`,
  );

  const whatsnew = RELEASED.map(
    (p) =>
      `<li class="wn" data-row="stable" data-product="${p.id}">${tile(p)}<div class="wn-text"><h3 class="wn-name">${esc(p.name)} <span class="wn-version" data-field="version"></span></h3><p class="wn-status" data-field="status"></p><p class="wn-notes" data-field="notes"></p></div></li>`,
  );

  const pages = APPS.map((p) => {
    const available = (p.status ?? "available") === "available";
    const shot = SHOTS.has(p.id)
      ? `<img class="ap-shot" src="/media/${p.id}.webp" width="1600" height="1000" alt="${esc(p.name)} on screen" />`
      : `<span class="ap-shot ap-plate" aria-hidden="true">${esc(p.name.replace(/^Form\.?/, ""))}</span>`;
    const betaRow = available
      ? `<div class="ap-beta" data-row="beta" data-product="${p.id}"><p class="ap-beta-text"><span class="ap-beta-label">Beta</span>${state}</p><!-- @include card-actions.html --></div>`
      : "";
    const agents = available
      ? `<section class="ap-agents" data-agents="${p.id}" hidden aria-label="${esc(p.name)} with your AI tools"><h3 class="block-title">Use ${esc(p.name)} with your AI tools</h3><p class="fine">${esc(p.name)} has its own MCP server. FormPortal adds it to Claude Code, Codex and Cursor and starts whichever version is installed, so updates and going back a version need nothing more.</p><ul class="agent-list">${[["claude", "Claude Code"], ["codex", "Codex"], ["cursor", "Cursor"]].map(([id, label]) => `<li class="agent" data-client="${id}"><span class="agent-name">${label}</span><span class="agent-state" data-agent-state>Checking</span></li>`).join("")}</ul><div class="agent-acts"><button class="btn btn-primary" type="button" data-agents-connect>Connect</button><button class="btn" type="button" data-agents-disconnect>Disconnect</button></div></section>`
      : "";
    return `<section class="pane" data-pane="app-${p.id}" data-title="${esc(p.name)}" data-product="${p.id}" aria-label="${esc(p.name)}"><div class="page"><button class="back" type="button" data-route-to="apps">%icon:arrow-right:ic-s back-ic%<span>All apps</span></button><div class="ap" data-row="stable" data-product="${p.id}"><header class="ap-head">${tile(p, "xl")}<div class="ap-title"><h2 class="ap-name">${esc(p.name)}</h2><p class="ap-line">${line(p)}</p><p class="ap-state"><span class="chip">${words(p)}</span>${state}<span class="state-ver" data-field="size"></span></p></div><!-- @include row-actions.html --></header><p class="ap-sum">${esc(p.summary)}</p><div class="ap-body"><dl class="facts"><div><dt>Released</dt><dd data-field="date"></dd></div><div><dt>What's new</dt><dd class="facts-notes" data-field="notes"></dd></div><div><dt>Download</dt><dd data-field="file"></dd></div><div><dt>Needs</dt><dd data-field="minimum"></dd></div><div><dt>Project files</dt><dd data-field="project"></dd></div><div><dt>Licence</dt><dd data-field="licence"></dd></div><div><dt>SHA-256</dt><dd class="facts-hash" data-field="sha256"></dd></div></dl>${shot}</div></div>${betaRow}<p class="links">${help(p)}</p>${agents}</div></section>`;
  });

  const autolist = RELEASED.map(
    (p) => `<li class="auto-item" data-row="stable" data-product="${p.id}"><label class="check">${tile(p, "s")}<span class="auto-name">${esc(p.name)}</span><input type="checkbox" class="switch" data-auto /></label></li>`,
  );

  const learn = APPS.filter((p) => repo(p)).map(
    (p) => `<li class="learn" data-product="${p.id}">${tile(p)}<div class="learn-text"><h3 class="learn-name">${esc(p.name)}</h3><p class="links">${help(p)}</p></div></li>`,
  );

  const parts: Record<string, string[]> = {
    all, updates, beta, mine, family, whatsnew, pages, autolist, learn,
    count: [String(APPS.length)],
    released: [String(RELEASED.length)],
  };
  return html.replace(/<!-- @portal:([a-z-]+) -->/g, (_, which: string) => (parts[which] ?? []).join("\n"));
}

function portalPlugin(): Plugin {
  return {
    name: "formportal",
    transformIndexHtml: {
      order: "pre",
      handler(source) {
        return renderMarkers(renderPortal(source), { icons, facts, chromeDir: ROOT, origin: "", rel: "" });
      },
    },
  };
}

export default defineConfig({
  root: ".",
  publicDir: "public",
  plugins: [portalPlugin()],
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
