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

function hubPlugin(): Plugin {
  return {
    name: "formai-hub",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
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
