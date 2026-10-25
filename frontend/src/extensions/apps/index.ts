import { versionNewer } from "../../engine/index.ts";
import { t } from "../../i18n/index.ts";
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
      const blocked = engine.blocked(product, channel);
      if (row.hasAttribute("data-blocked") !== blocked) row.toggleAttribute("data-blocked", blocked);
      row.setAttribute("data-availability", view.availability);
      row.setAttribute("data-install", state);
      row.toggleAttribute("data-previous", Boolean(record?.previous) && state !== "busy");
      const later = engine.later.has(key);
      if (row.hasAttribute("data-later") !== later) row.toggleAttribute("data-later", later);
      row.style.setProperty("--p", String(progress ?? 0));
      const words =
        state === "busy"
          ? t("Installing {n}%", { n: Math.round((progress ?? 0) * 100) })
          : blocked && (state === "none" || state === "update")
            ? t("Not allowed by your organisation")
            : state === "update" && engine.later.has(key)
            ? t("Updates to {version} when closed", { version: offered ?? "" })
            : state === "update"
            ? t("Update to {version}", { version: offered ?? "" })
            : state === "ready"
              ? t("Installed")
              : t(WORDS[channel][view.availability]);
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
      const picker = row.querySelector<HTMLSelectElement>("[data-versions]");
      const all = release ? [release, ...(release.history ?? [])].filter((r) => r.artifacts.some((a) => a.platform === engine.state.platform.os)) : [];
      const label = (r: (typeof all)[number]) => `${r.version} · ${r.published.slice(0, 10)}${r.version === record?.version ? ` ${t("(installed)")}` : ""}`;
      const list = all.map(label).join("|");
      if (picker && picker.dataset.list !== list) {
        picker.dataset.list = list;
        const wanted = picker.value;
        picker.replaceChildren(...all.map((r) => new Option(label(r), r.version)));
        if (all.some((r) => r.version === wanted)) picker.value = wanted;
      }
      row.toggleAttribute("data-history", all.length > 1);
      const auto = row.querySelector<HTMLInputElement>("[data-auto]");
      const on = engine.automatic(product, channel);
      if (auto && auto.checked !== on) auto.checked = on;
      field("file", view.artifact?.file ?? "");
      field("minimum", view.artifact?.minimum_os ?? "");
      field("sha256", view.artifact?.sha256 ?? "");
      field("project", info?.project_extensions?.join(", ") ?? "");
      field("licence", info?.licence ?? "");
      const skills = row.querySelector<HTMLElement>("[data-skills]");
      const has = info ? (info.agents?.skills ? "yes" : "no") : "";
      if (skills && (skills.dataset.has ?? "") !== has) skills.dataset.has = has;
      row.toggleAttribute("data-release", Boolean(view.artifact));
      const waiting = document.querySelectorAll(".list-updates .row[data-install='update']").length;
      document.documentElement.setAttribute("data-updates", String(waiting));
      const count = waiting > 0 ? String(waiting) : "";
      document.querySelectorAll<HTMLElement>("[data-updates-count]").forEach((node) => write(node, count));
      const installed = document.querySelectorAll(".list-updates .row[data-install='ready'], .list-updates .row[data-install='update'], .list-updates .row[data-install='busy']").length;
      if (document.documentElement.dataset.installed !== String(installed)) document.documentElement.dataset.installed = String(installed);
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
    document.querySelectorAll<HTMLButtonElement>("[data-updates-all]").forEach((button) => button.addEventListener("click", () => void engine.dispatch("app.updateAll")));

    engine.on("source", () => rows.forEach(patch));
    engine.on("prefs", () => rows.forEach(patch));
    engine.on("policy", () => rows.forEach(patch));
    for (const row of rows) {
      const picker = row.querySelector<HTMLSelectElement>("[data-versions]");
      row.querySelector<HTMLButtonElement>("[data-version-go]")?.addEventListener("click", () => {
        if (picker?.value) void engine.dispatch("app.install", { ...target(row), version: picker.value });
      });
      const auto = row.querySelector<HTMLInputElement>("[data-auto]");
      auto?.addEventListener("change", () => {
        const { product } = target(row);
        void engine.dispatch("prefs.set", { per_app: { [product]: auto.checked } });
      });
    }
    document.addEventListener("click", (event) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[data-web]");
      if (!link) return;
      event.preventDefault();
      void engine.dispatch("web.open", link.href);
    });

    for (const row of rows) {
      row.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((button) => {
        button.addEventListener("click", () => {
          const act = button.dataset.act === "update" ? "install" : button.dataset.act;
          void engine.dispatch(`app.${act}`, target(row));
        });
      });
      row.querySelectorAll<HTMLButtonElement>("[data-later]").forEach((button) => {
        button.addEventListener("click", () => void engine.dispatch("app.later", { ...target(row), on: button.dataset.later === "on" }));
      });
    }
  },
};
