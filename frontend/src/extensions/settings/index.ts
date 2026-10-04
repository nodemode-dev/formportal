import type { Os, Source } from "../../engine/types.ts";
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
    });
    engine.on("source", ({ source: s, generated: when }) => {
      document.documentElement.setAttribute("data-source", s);
      if (source) source.textContent = SOURCE[s];
      if (generated) generated.textContent = when ? when.slice(0, 10) : "";
    });
  },
};
