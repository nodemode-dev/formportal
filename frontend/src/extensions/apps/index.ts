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
      const state = progress !== undefined ? "busy" : !record ? "none" : offered && offered !== record.version ? "update" : "ready";
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
    engine.on("source", () => rows.forEach(patch));
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
