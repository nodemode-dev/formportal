import { versionNewer } from "../../engine/index.ts";
import type { Channel, ChannelView } from "../../engine/types.ts";
import type { Extension } from "../registry.ts";

const WORDS: Record<Channel, Record<ChannelView["availability"], string>> = {
  stable: {
    unreleased: "Not released yet",
    "no-release": "No release yet",
    available: "Available",
    "other-platform": "Not built for this computer yet",
  },
  beta: {
    unreleased: "No beta build",
    "no-release": "No beta build",
    available: "Beta available",
    "other-platform": "No beta for this computer yet",
  },
  nightly: {
    unreleased: "No nightly build",
    "no-release": "No nightly build",
    available: "Nightly available",
    "other-platform": "No nightly for this computer yet",
  },
};

export const apps: Extension = {
  id: "apps",
  setup(engine) {
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-row]"));

    const notice = document.querySelector<HTMLElement>("[data-notice]");
    const target = (row: HTMLElement) => ({ product: row.dataset.product ?? "", channel: (row.dataset.row ?? "stable") as Channel });

    const write = (node: HTMLElement | null, text: string) => {
      if (!node || node.textContent === text) return;
      const only = node.childNodes.length === 1 ? node.firstChild : null;
      if (only && only.nodeType === Node.TEXT_NODE) only.nodeValue = text;
      else node.textContent = text;
    };

    const patch = (row: HTMLElement) => {
      const { product, channel } = target(row);
      const view = engine.view(product, channel);
      const key = engine.key(product, channel);
      const record = engine.installs.get(key) ?? null;
      const progress = engine.progress.get(key);
      const offered = view.availability === "available" ? view.version : null;
      const state = progress !== undefined ? "busy" : !record ? "none" : offered && versionNewer(offered, record.version) ? "update" : "ready";
      row.setAttribute("data-availability", view.availability);
      row.setAttribute("data-install", state);
      row.toggleAttribute("data-previous", Boolean(record?.previous) && state !== "busy");
      row.style.setProperty("--p", String(progress ?? 0));
      const words =
        state === "busy"
          ? `Installing ${Math.round((progress ?? 0) * 100)}%`
          : state === "update"
            ? `Update to ${offered}`
            : state === "ready"
              ? "Installed"
              : WORDS[channel][view.availability];
      write(row.querySelector<HTMLElement>("[data-field='status']"), words);
      write(row.querySelector<HTMLElement>("[data-field='version']"), record?.version ?? view.version ?? "");
      const bytes = view.artifact && state !== "ready" ? view.artifact.bytes : 0;
      const size = bytes >= 1_000_000 ? `${Math.round(bytes / 1_000_000)} MB` : bytes > 0 ? `${Math.max(1, Math.round(bytes / 1000))} KB` : "";
      write(row.querySelector<HTMLElement>("[data-field='size']"), size);
      const info = engine.product(product);
      const release = info?.channels[channel];
      const field = (name: string, text: string) => write(row.querySelector<HTMLElement>(`[data-field='${name}']`), text);
      field("date", release ? release.published.slice(0, 10) : "");
      field("notes", release?.notes ?? "");
      const auto = row.querySelector<HTMLInputElement>("[data-auto]");
      const on = engine.automatic(product, channel);
      if (auto && auto.checked !== on) auto.checked = on;
      field("file", view.artifact?.file ?? "");
      field("minimum", view.artifact?.minimum_os ?? "");
      field("sha256", view.artifact?.sha256 ?? "");
      field("project", info?.project_extensions?.join(", ") ?? "");
      field("licence", info?.licence ?? "");
      row.toggleAttribute("data-release", Boolean(view.artifact));
      const waiting = document.querySelectorAll(".up[data-install='update']").length;
      document.documentElement.setAttribute("data-updates", String(waiting));
      write(document.querySelector<HTMLElement>("[data-updates-count]"), waiting > 0 ? String(waiting) : "");
    };

    engine.on("product", ({ id }) => {
      for (const row of rows) if (row.dataset.product === id) patch(row);
    });
    engine.on("install", ({ key }) => {
      for (const row of rows) {
        const { product, channel } = target(row);
        if (engine.key(product, channel) === key) patch(row);
      }
    });
    const open = () => Array.from(document.querySelectorAll<HTMLDetailsElement>("details.drop[open]"));
    document.addEventListener("click", (event) => {
      const at = event.target as HTMLElement;
      for (const drop of open()) if (!drop.contains(at) || at.closest(".drop-item")) drop.open = false;
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") for (const drop of open()) drop.open = false;
    });
    document.querySelector<HTMLButtonElement>("[data-updates-all]")?.addEventListener("click", () => void engine.dispatch("app.updateAll"));

    engine.on("source", () => rows.forEach(patch));
    engine.on("prefs", () => rows.forEach(patch));
    for (const row of rows) {
      const auto = row.querySelector<HTMLInputElement>("[data-auto]");
      auto?.addEventListener("change", () => {
        const { product } = target(row);
        void engine.dispatch("prefs.set", { per_app: { [product]: auto.checked } });
      });
    }
    engine.on("notice", ({ text }) => write(notice, text));

    for (const row of rows) {
      row.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((button) => {
        button.addEventListener("click", () => {
          const act = button.dataset.act === "update" ? "install" : button.dataset.act;
          void engine.dispatch(`app.${act}`, target(row));
        });
      });
    }
  },
};
