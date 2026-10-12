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
        macos: "~/Library/Application Support/dev.formai.portal",
        windows: "%LOCALAPPDATA%\\FormPortal",
        linux: "~/.local/share/formportal",
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
    const checkButton = document.querySelector<HTMLButtonElement>("[data-self-check]");
    const installButton = document.querySelector<HTMLButtonElement>("[data-self-install]");
    const selfStatus = document.querySelector<HTMLElement>("[data-self-status]");
    const say = (text: string) => {
      if (selfStatus && selfStatus.textContent !== text) selfStatus.textContent = text;
    };
    engine.on("self", ({ status, installable }) => {
      say(status);
      if (installButton && installButton.hidden === installable) installButton.hidden = !installable;
    });
    checkButton?.addEventListener("click", () => void engine.dispatch("self.check"));
    installButton?.addEventListener("click", () => void engine.dispatch("self.install"));

    const prefBoxes = Array.from(document.querySelectorAll<HTMLInputElement>("[data-pref]"));
    engine.on("prefs", ({ prefs }) => {
      for (const box of prefBoxes) {
        const on = Boolean(prefs[box.dataset.pref as "auto_update" | "auto_update_beta" | "only_when_closed" | "notices" | "keep_previous"]);
        if (box.checked !== on) box.checked = on;
      }
    });
    for (const box of prefBoxes) box.addEventListener("change", () => void engine.dispatch("prefs.set", { [box.dataset.pref ?? ""]: box.checked }));

    const managedRow = document.querySelector<HTMLElement>("[data-managed]");
    const LOCKS: Record<string, string> = {
      catalog: "the catalogue address",
      allow_unsigned: "unsigned catalogues refused",
      auto_update: "automatic updates",
      auto_update_beta: "automatic beta updates",
      only_when_closed: "updating only apps that are not open",
      keep_previous: "keeping the version before",
    };
    engine.on("policy", ({ policy }) => {
      document.documentElement.toggleAttribute("data-policy", policy !== null);
      document.documentElement.toggleAttribute("data-no-extensions", policy !== null && !policy.extensions);
      if (managedRow && managedRow.hidden === (policy !== null)) managedRow.hidden = policy === null;
      const locked = new Set(policy?.locked ?? []);
      for (const box of prefBoxes) {
        const on = locked.has(box.dataset.pref ?? "");
        if (box.disabled !== on) box.disabled = on;
        box.title = on ? "Set by your organisation" : "";
      }
      if (address) {
        address.disabled = locked.has("catalog");
        if (policy?.catalog && address.value !== policy.catalog) address.value = policy.catalog;
      }
      if (unsigned) {
        unsigned.disabled = locked.has("allow_unsigned");
        if (unsigned.disabled && unsigned.checked) unsigned.checked = false;
      }
      if (!policy) return;
      const names = (ids: string[]) => ids.map((id) => engine.name(id)).join(", ");
      const fixed = Array.from(locked).filter((k) => k in LOCKS).map((k) => LOCKS[k]);
      const parts = [
        fixed.length ? `Fixed: ${fixed.join("; ")}.` : "",
        policy.apps ? `Apps allowed: ${names(policy.apps)}.` : "",
        policy.channels ? `Builds allowed: ${policy.channels.join(", ")}.` : "",
        !policy.extensions ? "Extensions are turned off." : !policy.sideload ? "Extensions from a file are not allowed." : "",
      ].filter(Boolean);
      const head = `By ${policy.managed_by ?? "your organisation"}, through ${policy.path}${policy.system ? "" : " (a test policy from FORMPORTAL_POLICY)"}.`;
      const managed = field("managed");
      const detail = field("managed-detail");
      if (managed && managed.textContent !== head) managed.textContent = head;
      const rest = parts.join(" ");
      if (detail && detail.textContent !== rest) detail.textContent = rest;
    });
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
