import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { loadJson, renderMarkers, type Facts, type IconSet } from "../design/markers.ts";
import { buildPortal } from "../frontend/markup.ts";

const DEMO_PORT = 3270;
const HERE = fileURLToPath(new URL(".", import.meta.url));
const FRONTEND = resolve(HERE, "../frontend");
const DESIGN = resolve(HERE, "../design");
const CATALOG = resolve(HERE, "../catalog");
const CORE = resolve(HERE, "../core");
const PUBLIC = resolve(FRONTEND, "public");

const FONT_FAMILIES = ["space-grotesk", "instrument-serif", "syne", "manrope", "jetbrains-mono", "caveat"];
const PUBLIC_FILES = ["favicon.png", "favicon-light.png", "favicon.svg", "prepaint.js", "prelive.js", "fonts/inter-4-var-latin.woff2", "fonts/LICENSE-Inter.txt"];

const pkg = loadJson<{ version: string }>(resolve(FRONTEND, "package.json"));
const icons = loadJson<IconSet>(resolve(DESIGN, "icons.json"));
const facts: Facts = { version: pkg.version };
const built = buildPortal(FRONTEND, CATALOG, DESIGN);
const registry = loadJson<{ products: { id: string }[] }>(resolve(CATALOG, "products.json"));

function renderPortal(html: string): string {
  return html
    .replace(/<!-- @portal:([a-z-]+) -->/g, (_, which: string) => (built.parts[which] ?? []).join("\n"))
    .replace(/<html lang="en"/, `<html lang="en"${built.rootState}`);
}

function walk(dir: string, base = ""): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    return statSync(full).isDirectory() ? walk(full, rel) : [rel];
  });
}

function portalPlugin(): Plugin {
  return {
    name: "formportal-demo",
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
        const page = source.replace('src="/src/main.ts"', 'src="../demo/src/entry.ts"');
        const rendered = renderMarkers(renderPortal(page), { icons, facts, chromeDir: FRONTEND, origin: "", rel: "" });
        const tools = '<div class="top-tools" data-tauri-drag-region>';
        const bench = readFileSync(resolve(HERE, "src/bench.html"), "utf8");
        const button = '<button class="icon-btn demo-open" type="button" data-demo-open aria-label="Demo bench" title="Demo bench"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3.5h6M10 3.5v5.2L5.2 17a2 2 0 0 0 1.7 3h10.2a2 2 0 0 0 1.7-3L14 8.7V3.5M8 14h8"/></svg></button>';
        return rendered.replace(tools, `${tools}${button}`).replace("</body>", `${bench}\n</body>`);
      },
    },
  };
}

function finishPlugin(): Plugin {
  return {
    name: "formportal-demo-finish",
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
      for (const rel of PUBLIC_FILES) {
        this.emitFile({ type: "asset", fileName: rel, source: readFileSync(join(PUBLIC, rel)) });
      }
      for (const rel of walk(join(PUBLIC, "apps"))) this.emitFile({ type: "asset", fileName: `apps/${rel}`, source: readFileSync(join(PUBLIC, "apps", rel)) });
      for (const product of registry.products) {
        for (const suffix of ["", "-light"]) {
          const rel = `heroes/${product.id}${suffix}.webp`;
          if (existsSync(join(PUBLIC, rel))) this.emitFile({ type: "asset", fileName: rel, source: readFileSync(join(PUBLIC, rel)) });
        }
      }
      for (const rel of walk(join(PUBLIC, "store/thumbs"))) this.emitFile({ type: "asset", fileName: `store/thumbs/${rel}`, source: readFileSync(join(PUBLIC, "store/thumbs", rel)) });

      const fonts: Record<string, string> = {};
      for (const family of FONT_FAMILIES) {
        for (const rel of walk(join(PUBLIC, "store/fonts", family))) {
          if (!/\.(ttf|otf)$/i.test(rel)) continue;
          fonts[`fonts/${family}/${rel}`] = gzipSync(readFileSync(join(PUBLIC, "store/fonts", family, rel)), { level: 9 }).toString("base64");
        }
      }
      const media: Record<string, string> = {};
      for (const rel of walk(join(PUBLIC, "store/media"))) media[rel] = readFileSync(join(PUBLIC, "store/media", rel)).toString("base64");
      const keys = readFileSync(join(CORE, "catalog_keys.txt"), "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
      const source = `window.__FORMPORTAL_STORE__=${JSON.stringify({ fonts, media, keys })};`;
      this.emitFile({ type: "asset", fileName: "assets/store.js", source });
    },
  };
}

function storeScript(): Plugin {
  return {
    name: "formportal-demo-store",
    transformIndexHtml: {
      order: "post",
      handler: () => [{ tag: "script", attrs: { src: "./assets/store.js" }, injectTo: "head-prepend" }],
    },
  };
}

export default defineConfig({
  root: FRONTEND,
  base: "./",
  publicDir: false,
  plugins: [portalPlugin(), storeScript(), finishPlugin()],
  clearScreen: false,
  server: {
    port: DEMO_PORT,
    host: false,
    strictPort: true,
    fs: { allow: [FRONTEND, DESIGN, CATALOG, CORE, HERE] },
  },
  preview: {
    port: DEMO_PORT + 1,
    host: false,
    strictPort: true,
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
});
