import { defineConfig, type Plugin } from "vite";
import { fileURLToPath, URL } from "node:url";
import { resolve, join, extname } from "node:path";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { loadJson, renderMarkers, type Facts, type IconSet } from "../design/markers.ts";
import { translateHtml, type Table } from "./src/i18n/translate.ts";
import { buildPortal } from "./markup.ts";

const FRONTEND_PORT = 3250;
const ROOT = fileURLToPath(new URL(".", import.meta.url));
const DESIGN = resolve(ROOT, "../design");
const CATALOG = resolve(ROOT, "../catalog");

const pkg = loadJson<{ version: string }>(resolve(ROOT, "package.json"));
const icons = loadJson<IconSet>(resolve(DESIGN, "icons.json"));
const facts: Facts = { version: pkg.version };
const built = buildPortal(ROOT, CATALOG, DESIGN);

function renderPortal(html: string): string {
  return html
    .replace(/<!-- @portal:([a-z-]+) -->/g, (_, which: string) => (built.parts[which] ?? []).join("\n"))
    .replace(/<html lang="en"/, `<html lang="en"${built.rootState}`);
}

function portalPlugin(): Plugin {
  return {
    name: "formportal",
    transform(code, id) {
      if (id.split("?")[0].endsWith("/src/styles/live.css")) return { code: `${code}\n${built.liveRules}\n`, map: null };
      return null;
    },
    transformIndexHtml: {
      order: "pre",
      handler(source) {
        return renderMarkers(renderPortal(source), { icons, facts, chromeDir: ROOT, origin: "", rel: "" });
      },
    },
  };
}

const REPO = resolve(ROOT, "..");
const DEMO_DIRS = ["demo", "demos/updates", "demos/library"];
const DEMO_SHIPPED = /^(index\.html|CREDITS\.md|prepaint\.js|prelive\.js|favicon(-light)?\.(png|svg)|(assets|apps|store|fonts)\/.+)$/;
const SANDBOX = '<head>\n    <script src="/demo-sandbox.js"></script>';

function demoFiles(dir: string, base = ""): string[] {
  return readdirSync(join(REPO, dir, base)).flatMap((name) => {
    const rel = base ? `${base}/${name}` : name;
    return statSync(join(REPO, dir, rel)).isDirectory() ? (base || ["assets", "apps", "store", "fonts"].includes(name) ? demoFiles(dir, rel) : []) : DEMO_SHIPPED.test(rel) ? [rel] : [];
  });
}

function demoSource(dir: string, rel: string): Buffer | string {
  const raw = readFileSync(join(REPO, dir, rel));
  return rel === "index.html" ? raw.toString("utf8").replace("<head>", SANDBOX) : raw;
}

const DEMO_TYPES: Record<string, string> = { html: "text/html", js: "text/javascript", css: "text/css", png: "image/png", svg: "image/svg+xml", webp: "image/webp", jpg: "image/jpeg", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", md: "text/markdown", txt: "text/plain", json: "application/json" };

function demosPlugin(): Plugin {
  return {
    name: "formportal-demos",
    generateBundle() {
      for (const dir of DEMO_DIRS) for (const rel of demoFiles(dir)) this.emitFile({ type: "asset", fileName: `${dir}/${rel}`, source: demoSource(dir, rel) });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent((req.url ?? "").split("?")[0]);
        const dir = DEMO_DIRS.find((d) => path.startsWith(`/${d}/`));
        if (!dir) return next();
        const rel = path.slice(dir.length + 2) || "index.html";
        if (!DEMO_SHIPPED.test(rel) || rel.includes("..")) return next();
        try {
          const body = demoSource(dir, rel);
          res.setHeader("Content-Type", DEMO_TYPES[extname(rel).slice(1)] ?? "application/octet-stream");
          res.end(body);
        } catch {
          next();
        }
      });
    },
  };
}

const TABLES: Table[] = [loadJson<Table>(resolve(ROOT, "src/i18n/es.json"))];

function languagePlugin(): Plugin {
  return {
    name: "formportal-languages",
    enforce: "post",
    generateBundle(_options, bundle) {
      const page = bundle["index.html"];
      if (!page || page.type !== "asset") return;
      for (const table of TABLES) {
        this.emitFile({ type: "asset", fileName: `${table.language}/index.html`, source: translateHtml(String(page.source), table) });
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const table = TABLES.find((t) => req.url === `/${t.language}/` || req.url?.startsWith(`/${t.language}/index.html`));
        if (!table) return next();
        const html = await server.transformIndexHtml("/index.html", readFileSync(resolve(ROOT, "index.html"), "utf8"));
        res.setHeader("Content-Type", "text/html");
        res.end(translateHtml(html, table));
      });
    },
  };
}

export default defineConfig({
  root: ".",
  publicDir: "public",
  plugins: [portalPlugin(), languagePlugin(), demosPlugin()],
  clearScreen: false,
  server: {
    port: FRONTEND_PORT,
    host: false,
    strictPort: true,
    fs: { allow: [ROOT, DESIGN, CATALOG, ...DEMO_DIRS.map((d) => join(REPO, d))] },
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
