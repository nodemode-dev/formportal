import { versionNewer } from "../../engine/index.ts";
import { t } from "../../i18n/index.ts";
import { sizeText } from "../versions/index.ts";
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

const pillSizeText = (bytes: number): string => {
  const mb = Math.max(1, Math.round(bytes / 1_000_000));
  return mb >= 1000 ? t("{n} GB", { n: (bytes / 1_000_000_000).toFixed(2) }) : t("{n} MB", { n: mb });
};

const NOTE_HEADS = new Set(["new", "improved", "changed", "fixed", "known issues", "under the hood", "unchanged", "removed", "security"]);

const renderNotes = (node: HTMLElement, text: string) => {
  if (node.dataset.src === text) return;
  node.dataset.src = text;
  const out: HTMLElement[] = [];
  let list: HTMLUListElement | null = null;
  let para: HTMLParagraphElement | null = null;
  let item: HTMLLIElement | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      para = null;
      item = null;
      continue;
    }
    const bare = line.replace(/:$/, "");
    if (NOTE_HEADS.has(bare.toLowerCase()) || /^[A-Z][A-Za-z]{1,19}:?$/.test(line)) {
      const head = document.createElement("h4");
      head.className = "rn-head";
      head.textContent = bare;
      out.push(head);
      list = null;
      para = null;
      item = null;
    } else if (/^[-*] /.test(line)) {
      if (!list) {
        list = document.createElement("ul");
        list.className = "rn-list";
        out.push(list);
      }
      item = document.createElement("li");
      item.textContent = line.slice(2);
      list.append(item);
      para = null;
    } else if (item && /^\s/.test(raw)) {
      item.textContent = `${item.textContent} ${line}`;
    } else if (para) {
      para.textContent = `${para.textContent} ${line}`;
    } else {
      para = document.createElement("p");
      para.className = "rn-p";
      para.textContent = line;
      out.push(para);
      list = null;
      item = null;
    }
  }
  node.replaceChildren(...out);
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
      const back = record?.previous ? t("Go back to {version}", { version: record.previous }) : t("Go back to the version before");
      row.querySelectorAll<HTMLElement>("[data-act='rollback']").forEach((button) => write(button, back));
      write(row.querySelector<HTMLElement>("[data-field='previous']"), record?.previous ?? t("nothing"));
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
      const info = engine.product(product);
      const release = info?.channels[channel];
      const field = (name: string, text: string) => write(row.querySelector<HTMLElement>(`[data-field='${name}']`), text);
      const mine = record && release ? [release, ...(release.history ?? [])].find((r) => r.version === record.version) : undefined;
      const own = mine ? engine.artifactFor(mine) : null;
      field("size", sizeText((own ?? view.artifact)?.bytes ?? 0));
      field("update-size", state === "update" && view.artifact ? sizeText(view.artifact.bytes) : "");
      const pillVersion = record?.version ?? (view.availability === "available" ? view.version : null);
      const pillBytes = record ? own?.bytes : view.artifact?.bytes;
      const pillSize = pillBytes ? pillSizeText(pillBytes) : "";
      field(
        "pill",
        !pillVersion
          ? ""
          : record
            ? pillSize
              ? t("v{version} installed | {size}", { version: pillVersion, size: pillSize })
              : t("v{version} installed", { version: pillVersion })
            : pillSize
              ? t("v{version} | {size}", { version: pillVersion, size: pillSize })
              : t("v{version}", { version: pillVersion }),
      );
      row.toggleAttribute("data-notes", Boolean(release?.notes));
      field("date", release ? release.published.slice(0, 10) : "");
      const notesNode = row.querySelector<HTMLElement>("[data-field='notes']");
      if (notesNode?.classList.contains("row-notes-in")) renderNotes(notesNode, release?.notes ?? "");
      else field("notes", release?.notes ?? "");
      const picker = row.querySelector<HTMLSelectElement>("[data-versions]");
      const all = release ? [release, ...(release.history ?? [])].filter((r) => engine.artifactFor(r) !== null) : [];
      const label = (r: (typeof all)[number]) => `${r.version} · ${r.published.slice(0, 10)}${r.version === record?.version ? ` ${t("(installed)")}` : ""}`;
      const list = all.map(label).join("|");
      if (picker && picker.dataset.list !== list) {
        picker.dataset.list = list;
        const wanted = picker.value;
        picker.replaceChildren(...all.map((r) => new Option(label(r), r.version)));
        const other = all.find((r) => r.version !== record?.version);
        if (wanted !== record?.version && all.some((r) => r.version === wanted)) picker.value = wanted;
        else if (other) picker.value = other.version;
      }
      const go = row.querySelector<HTMLButtonElement>("[data-version-go]");
      const same = !picker?.value || picker.value === record?.version;
      if (go && go.disabled !== same) go.disabled = same;
      row.toggleAttribute("data-history", all.length > 1);
      const auto = row.querySelector<HTMLInputElement>("[data-auto]");
      const on = engine.automatic(product, channel);
      if (auto && auto.checked !== on) auto.checked = on;
      const { os, arch } = engine.state.platform;
      const translated = Boolean(view.artifact && view.artifact.arch !== arch);
      const under = os === "macos" ? "{file}, an Intel build that runs under Rosetta" : "{file}, an x64 build that runs under emulation";
      field("file", view.artifact ? (translated ? t(under, { file: view.artifact.file }) : view.artifact.file) : "");
      field("minimum", view.artifact?.minimum_os ?? "");
      field("sha256", view.artifact?.sha256 ?? "");
      field("path", record?.path ?? "");
      field("installed-sha256", record?.sha256 ?? "");
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
      const go = row.querySelector<HTMLButtonElement>("[data-version-go]");
      go?.addEventListener("click", () => {
        if (picker?.value) void engine.dispatch("app.install", { ...target(row), version: picker.value });
      });
      picker?.addEventListener("change", () => {
        const { product, channel } = target(row);
        if (go) go.disabled = picker.value === engine.installs.get(engine.key(product, channel))?.version;
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
      const ask = row.querySelector<HTMLButtonElement>("[data-remove-ask]");
      const keep = row.querySelector<HTMLButtonElement>("[data-remove-keep]");
      const asking = (on: boolean) => {
        ask?.closest(".menu")?.toggleAttribute("data-asking", on);
        ask?.setAttribute("aria-expanded", String(on));
      };
      ask?.addEventListener("click", (event) => {
        event.stopPropagation();
        asking(true);
        keep?.focus();
      });
      keep?.addEventListener("click", () => {
        asking(false);
        ask?.focus();
      });
      ask?.closest("details")?.addEventListener("toggle", (event) => {
        if (!(event.currentTarget as HTMLDetailsElement).open) asking(false);
      });
      const notes = row.querySelector<HTMLButtonElement>("[data-notes-toggle]");
      notes?.addEventListener("click", () => {
        const open = row.toggleAttribute("data-notes-open");
        notes.setAttribute("aria-expanded", String(open));
      });
      row.querySelectorAll<HTMLButtonElement>("[data-later]").forEach((button) => {
        button.addEventListener("click", () => void engine.dispatch("app.later", { ...target(row), on: button.dataset.later === "on" }));
      });
    }
  },
};
