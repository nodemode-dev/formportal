import { defineConfig, type Plugin } from "vite";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
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
  plugins: [portalPlugin(), languagePlugin()],
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
