import type { Os, Source } from "../../engine/types.ts";
import { CATALOG_KEY, UNSIGNED_KEY } from "../../bridge/tauri.ts";
import type { Extension } from "../registry.ts";

const OS: Record<Os, string> = { macos: "macOS", windows: "Windows", linux: "Linux", other: "Unknown" };
const ARCH: Record<string, string> = { arm64: "ARM64", x86_64: "x86-64" };
const SOURCE: Record<Source, string> = {
  none: "Not loaded",
  fixture: "Sample catalogue bundled with this build",
  live: "formai.dev",
};

export const settings: Extension = {
  id: "settings",
  setup(engine) {
    const field = (name: string) => document.querySelector<HTMLElement>(`[data-setting='${name}']`);
    const platform = field("platform");
    const source = field("source");
    const generated = field("generated");

    engine.on("platform", ({ platform: p }) => {
      if (platform) platform.textContent = `${OS[p.os]}, ${ARCH[p.arch] ?? p.arch}`;
      const folder = field("folder");
      const where: Record<Os, string> = {
        macos: "~/Library/Application Support/dev.formai.hub",
        windows: "%LOCALAPPDATA%\\formai",
        linux: "~/.local/share/formai",
        other: "",
      };
      if (folder) folder.textContent = where[p.os];
    });
    engine.on("source", ({ source: s, generated: when }) => {
      document.documentElement.setAttribute("data-source", s);
      if (source) source.textContent = SOURCE[s];
      if (generated) generated.textContent = when ? when.slice(0, 10) : "";
    });

    const address = document.querySelector<HTMLInputElement>("[data-setting-input='catalog']");
    const unsigned = document.querySelector<HTMLInputElement>("[data-setting-input='unsigned']");
    const keep = (key: string, value: string) => {
      try {
        if (value) localStorage.setItem(key, value);
        else localStorage.removeItem(key);
      } catch {
        engine.setNotice("This choice could not be saved on this computer.");
      }
    };
    try {
      if (address) address.value = localStorage.getItem(CATALOG_KEY) ?? "";
      if (unsigned) unsigned.checked = localStorage.getItem(UNSIGNED_KEY) === "yes";
    } catch {
      engine.setNotice("");
    }
    address?.addEventListener("change", () => {
      keep(CATALOG_KEY, address.value.trim());
      void engine.dispatch("catalog.load");
    });
    unsigned?.addEventListener("change", () => {
      keep(UNSIGNED_KEY, unsigned.checked ? "yes" : "");
      void engine.dispatch("catalog.load");
    });
  },
};
