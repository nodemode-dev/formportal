import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { loadJson, renderMarkers } from "../../design/markers.ts";
import { buildPortal } from "../../frontend/markup.ts";

const PORT = 3280;
const HERE = fileURLToPath(new URL(".", import.meta.url));
const FRONTEND = resolve(HERE, "../../frontend");
const DESIGN = resolve(HERE, "../../design");
const CATALOG = resolve(HERE, "../../catalog");
const CORE = resolve(HERE, "../../core");
const DEMO = resolve(HERE, "../../demo");
const PUBLIC = resolve(FRONTEND, "public");
const SRC = resolve(HERE, "media-src");

const PUBLIC_FILES = ["favicon.png", "favicon-light.png", "favicon.svg", "prepaint.js", "prelive.js", "fonts/inter-4-var-latin.woff2", "fonts/LICENSE-Inter.txt"];

const pkg = loadJson(resolve(FRONTEND, "package.json"));
const icons = loadJson(resolve(DESIGN, "icons.json"));
const facts = { version: pkg.version };
const built = buildPortal(FRONTEND, CATALOG, DESIGN);

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
      .replace(/<html lang="en"/, `<html lang="en"${built.rootState}`),
  );
}

function walk(dir, base = "") {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    return statSync(full).isDirectory() ? walk(full, rel) : [rel];
  });
}

function inspectorMarkup() {
  const bench = readFileSync(resolve(DEMO, "src/bench.html"), "utf8");
  const found = /<dialog class="prefs versions demo-inspect"[\s\S]*?<\/dialog>/.exec(bench);
  return found ? found[0] : "";
}

const FLASK =
  '<button class="icon-btn demo-open" type="button" data-demo-open aria-label="Demo bench" title="Demo bench"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3.5h6M10 3.5v5.2L5.2 17a2 2 0 0 0 1.7 3h10.2a2 2 0 0 0 1.7-3L14 8.7V3.5M8 14h8"/></svg></button>';

const LINKS =
  '<p class="demo-links" aria-label="The three demos"><a href="../../demo/index.html">Installs and files</a><a href="../updates/index.html">Updates and trust</a><a href="./index.html" aria-current="page">Fonts, stock, templates</a></p>';

function portalPlugin() {
  return {
    name: "formportal-library",
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
        const page = source.replace('src="/src/main.ts"', 'src="../demos/library/src/entry.ts"');
        const rendered = renderMarkers(renderPortal(page), { icons, facts, chromeDir: FRONTEND, origin: "", rel: "" });
        const tools = '<div class="top-tools" data-tauri-drag-region>';
        const ownAdd = '<button class="btn" type="button" data-font-own-add>Add a font file</button>';
        const note = '<span class="block-note mono" data-media-library></span>';
        const foot = /(<a class="nav-item" href="[^"]*" data-web title="Help">[\s\S]*?<\/a>)/;
        const bench = readFileSync(resolve(HERE, "src/bench.html"), "utf8");
        return rendered
          .replace(tools, `${tools}${FLASK}`)
          .replace(ownAdd, `<span class="block-tools"><button class="btn" type="button" data-lib-tester>Try your fonts</button>${ownAdd}</span>`)
          .replace(note, `<span class="block-tools">${note}<button class="btn" type="button" data-lib-download>Download Library</button></span>`)
          .replace(foot, `$1${LINKS}`)
          .replace("</body>", `${bench}\n${inspectorMarkup()}\n</body>`);
      },
    },
  };
}

function finishPlugin() {
  return {
    name: "formportal-library-finish",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        return {
          html: html
            .replace(/<link rel="preload"[^>]*inter-4-var-latin[^>]*>\s*/g, "")
            .replace(/ crossorigin(="[^"]*")?/g, "")
            .replace(/<script type="module" src="([^"]+)"><\/script>/g, '<script defer src="$1"></script>')
            .replace(/\b(src|href)="\/(?!\/)/g, '$1="./'),
          tags: [
            { tag: "script", attrs: { src: "./assets/launch.js" }, injectTo: "head-prepend" },
            { tag: "script", attrs: { src: "./assets/store.js" }, injectTo: "head-prepend" },
          ],
        };
      },
    },
    generateBundle() {
      for (const rel of PUBLIC_FILES) this.emitFile({ type: "asset", fileName: rel, source: readFileSync(join(PUBLIC, rel)) });
      for (const rel of walk(join(PUBLIC, "apps"))) this.emitFile({ type: "asset", fileName: `apps/${rel}`, source: readFileSync(join(PUBLIC, "apps", rel)) });
      for (const rel of walk(join(PUBLIC, "store/thumbs"))) this.emitFile({ type: "asset", fileName: `store/thumbs/${rel}`, source: readFileSync(join(PUBLIC, "store/thumbs", rel)) });
      for (const rel of walk(join(SRC, "thumbs"))) this.emitFile({ type: "asset", fileName: `store/thumbs/${rel}`, source: readFileSync(join(SRC, "thumbs", rel)) });
      this.emitFile({ type: "asset", fileName: "assets/launch.js", source: readFileSync(resolve(HERE, "src/launch.js")) });

      const fonts = {};
      for (const family of readdirSync(join(PUBLIC, "store/fonts"))) {
        for (const rel of walk(join(PUBLIC, "store/fonts", family))) {
          if (!/\.(ttf|otf)$/i.test(rel)) continue;
          fonts[`fonts/${family}/${rel}`] = gzipSync(readFileSync(join(PUBLIC, "store/fonts", family, rel)), { level: 9 }).toString("base64");
        }
      }
      const media = {};
      for (const rel of walk(join(PUBLIC, "store/media"))) media[rel] = readFileSync(join(PUBLIC, "store/media", rel)).toString("base64");
      for (const rel of walk(join(SRC, "looks"))) media[rel] = readFileSync(join(SRC, "looks", rel)).toString("base64");
      const keys = readFileSync(join(CORE, "catalog_keys.txt"), "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
      this.emitFile({ type: "asset", fileName: "assets/store.js", source: `window.__FORMPORTAL_STORE__=${JSON.stringify({ fonts, media, keys })};` });
    },
  };
}

export default {
  root: FRONTEND,
  base: "./",
  publicDir: false,
  plugins: [portalPlugin(), finishPlugin()],
  clearScreen: false,
  server: { port: PORT, host: false, strictPort: true, fs: { allow: [FRONTEND, DESIGN, CATALOG, CORE, DEMO, HERE] } },
  preview: { port: PORT + 1, host: false, strictPort: true },
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
        entryFileNames: "assets/library.js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
};
