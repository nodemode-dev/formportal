import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { loadJson, renderMarkers } from "../../design/markers.ts";
import { buildPortal } from "../../frontend/markup.ts";

const PORT = 3271;
const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(HERE, "../..");
const FRONTEND = resolve(ROOT, "frontend");
const DESIGN = resolve(ROOT, "design");
const CATALOG = resolve(ROOT, "catalog");
const CORE = resolve(ROOT, "core");
const DEMO = resolve(ROOT, "demo");
const PUBLIC = resolve(FRONTEND, "public");

const PUBLIC_FILES = ["favicon.png", "favicon-light.png", "favicon.svg", "prepaint.js", "prelive.js", "fonts/inter-4-var-latin.woff2", "fonts/LICENSE-Inter.txt"];
const GONE = ["files", "fonts", "stock", "extensions", "learn"];

const pkg = loadJson(resolve(FRONTEND, "package.json"));
const icons = loadJson(resolve(DESIGN, "icons.json"));
const facts = { version: pkg.version };
const built = buildPortal(FRONTEND, CATALOG, DESIGN);
built.parts.updates = built.parts.updates.map((row) =>
  row.replace(/<\/li>$/, '<details class="row-notes"><summary>What changed</summary><div class="notes-text" data-field="notes"></div></details></li>'),
);

const trust = readFileSync(resolve(HERE, "src/trust.html"), "utf8");
const [trustPane, trustRest] = trust.split('<aside class="tr-card"');

const SHIELD = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 5 6v5.6c0 4.2 2.8 7.4 7 8.9 4.2-1.5 7-4.7 7-8.9V6z"/><path d="m9 12 2.3 2.3L15.3 10"/></svg>';
const TRUST_NAV = `<span class="badge" data-updates-count></span></button></li>\n            <li><button class="nav-item" type="button" data-route-to="trust" title="Trust">${SHIELD}<span class="nav-label">Trust</span></button></li>`;
const DEMO_LINKS =
  '<span class="nav-label">Help</span></a>\n            <p class="demo-links fine"><span>Demos</span><a href="../../demo/index.html">Install and files</a><a href="./index.html" aria-current="page">Updates and trust</a><a href="../library/index.html">Fonts and stock</a></p>';

function plateHeroes(html) {
  return html.replace(/<header class="hero"[\s\S]*?<\/header>/g, (block) => {
    const shot = /<div class="hero-shot"><img class="ic-dark" src="\/heroes\/[^"]*"[^>]*\/><img class="ic-light" src="\/heroes\/[^"]*"[^>]*\/><\/div>/.exec(block);
    const mark = /<span class="app-ic app-ic-hero"[^>]*>[\s\S]*?<\/span>/.exec(block);
    if (!shot || !mark) return block;
    const plate = mark[0].replace("app-ic app-ic-hero", "app-ic").replace(/width="88" height="88"/g, 'width="120" height="120"');
    return block.replace(shot[0], `<div class="hero-shot hero-plate" aria-hidden="true">${plate}</div>`);
  });
}

function renderPortal(html) {
  return plateHeroes(
    html
      .replace(/<!-- @portal:([a-z-]+) -->/g, (_, which) => (built.parts[which] ?? []).join("\n"))
      .replace(/<html lang="en"/, `<html lang="en"${built.rootState} data-launch="updates"`),
  );
}

function walk(dir, base = "") {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    return statSync(full).isDirectory() ? walk(full, rel) : [rel];
  });
}

function portalPlugin() {
  return {
    name: "formportal-updates-demo",
    enforce: "pre",
    resolveId(source, importer) {
      if (importer && importer.endsWith("/frontend/src/main.ts") && source === "./bridge/index.ts") return resolve(HERE, "src/pickbridge.ts");
      return null;
    },
    transform(code, id) {
      const file = id.split("?")[0];
      if (file.endsWith("/src/styles/live.css")) return { code: `${code}\n${built.liveRules}\n`, map: null };
      if (file.endsWith("/src/styles/main.css")) return { code: code.replace('url("/fonts/', 'url("../fonts/'), map: null };
      if (file.includes("/frontend/src/") && file.endsWith(".ts")) {
        const next = code.replaceAll("`/apps/", "`./apps/").replaceAll('url("/store/', 'url("./store/');
        return next === code ? null : { code: next, map: null };
      }
      return null;
    },
    transformIndexHtml: {
      order: "pre",
      handler(source) {
        const page = source.replace('src="/src/main.ts"', 'src="../demos/updates/src/entry.ts"');
        let out = renderMarkers(renderPortal(page), { icons, facts, chromeDir: FRONTEND, origin: "", rel: "" });
        out = out.replace(new RegExp(`<li><button class="nav-item" type="button" data-route-to="(${GONE.join("|")})"[\\s\\S]*?</button></li>\\n?`, "g"), "");
        out = out.replace('<span class="badge" data-updates-count></span></button></li>', TRUST_NAV);
        out = out.replace('<span class="nav-label">Help</span></a>', DEMO_LINKS);
        out = out.replace('<section class="pane" data-pane="files"', `${trustPane}\n<section class="pane" data-pane="files"`);
        out = out.replace("</body>", `<aside class="tr-card"${trustRest}\n</body>`);
        return out.replace("<title>FormPortal</title>", "<title>FormPortal updates and trust</title>");
      },
    },
  };
}

function finishPlugin() {
  return {
    name: "formportal-updates-demo-finish",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        return html
          .replace(/<link rel="preload"[^>]*inter-4-var-latin[^>]*>\s*/g, "")
          .replace(/ crossorigin(="[^"]*")?/g, "")
          .replace(/<script type="module" src="([^"]+)"><\/script>/g, '<script defer src="$1"></script>')
          .replace(/\b(src|href)="\/(?!\/)/g, '$1="./');
      },
    },
    generateBundle() {
      for (const rel of PUBLIC_FILES) this.emitFile({ type: "asset", fileName: rel, source: readFileSync(join(PUBLIC, rel)) });
      for (const rel of walk(join(PUBLIC, "apps"))) this.emitFile({ type: "asset", fileName: `apps/${rel}`, source: readFileSync(join(PUBLIC, "apps", rel)) });
    },
  };
}

export default {
  root: FRONTEND,
  base: "./",
  publicDir: false,
  plugins: [portalPlugin(), finishPlugin()],
  clearScreen: false,
  server: {
    port: PORT,
    host: false,
    strictPort: true,
    fs: { allow: [FRONTEND, DESIGN, CATALOG, CORE, DEMO, HERE] },
  },
  build: {
    outDir: HERE,
    emptyOutDir: false,
    sourcemap: false,
    target: "es2022",
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      input: resolve(FRONTEND, "index.html"),
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "assets/portal.js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
};
