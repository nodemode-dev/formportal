import { t } from "../../i18n/index.ts";
import type { Channel, Release } from "../../engine/types.ts";
import type { Extension } from "../registry.ts";

export const sizeText = (bytes: number): string => (bytes >= 1_000_000 ? `${Math.round(bytes / 1_000_000)} MB` : bytes > 0 ? `${Math.max(1, Math.round(bytes / 1000))} KB` : "");

export const localDay = (iso: string): string => {
  const at = new Date(iso);
  if (!iso || Number.isNaN(at.getTime())) return iso.slice(0, 10);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
};

export const versions: Extension = {
  id: "versions",
  setup(engine) {
    const lists = Array.from(document.querySelectorAll<HTMLElement>("[data-ver-list]"));

    const target = (list: HTMLElement) => {
      const row = list.closest<HTMLElement>("[data-row]");
      return { product: row?.dataset.product ?? "", channel: (row?.dataset.row ?? "stable") as Channel };
    };

    const set = (node: HTMLElement | null, text: string) => {
      if (node && node.textContent !== text) node.textContent = text;
    };

    const part = (tag: string, cls: string, field: string) => {
      const node = document.createElement(tag);
      node.className = cls;
      node.dataset.ver = field;
      return node;
    };

    const make = (version: string): HTMLLIElement => {
      const item = document.createElement("li");
      item.className = "ver";
      item.dataset.version = version;
      const head = document.createElement("div");
      head.className = "ver-head";
      const go = part("button", "btn btn-small", "install") as HTMLButtonElement;
      go.type = "button";
      head.append(part("span", "ver-num mono", "version"), part("span", "ver-date", "date"), part("span", "ver-size mono", "size"), part("span", "ver-mark", "mark"), go);
      const fold = document.createElement("details");
      fold.className = "fold";
      fold.append(part("summary", "fold-head", "fold"), part("div", "notes-text", "notes"));
      item.append(head, fold);
      return item;
    };

    const fill = (item: HTMLElement, release: Release, installed: string | null, busy: boolean, blocked: boolean) => {
      const artifact = engine.artifactFor(release);
      const here = release.version === installed;
      const field = (name: string) => item.querySelector<HTMLElement>(`[data-ver='${name}']`);
      set(field("version"), release.version);
      set(field("date"), localDay(release.published));
      set(field("size"), artifact ? sizeText(artifact.bytes) : "");
      set(field("mark"), here ? t("Installed") : artifact ? "" : t("No file for this computer"));
      set(field("fold"), t("What changed"));
      set(field("notes"), release.notes ?? "");
      const go = field("install") as HTMLButtonElement | null;
      set(go, t("Install"));
      if (go) {
        const off = busy || blocked;
        if (go.disabled !== off) go.disabled = off;
        go.setAttribute("aria-label", t("Install {version}", { version: release.version }));
      }
      item.toggleAttribute("data-installed", here);
      item.toggleAttribute("data-file", Boolean(artifact));
      item.toggleAttribute("data-notes", Boolean(release.notes));
    };

    const patch = (list: HTMLElement) => {
      const { product, channel } = target(list);
      const key = engine.key(product, channel);
      const release = engine.product(product)?.channels[channel];
      const all = release ? [release, ...(release.history ?? [])] : [];
      const installed = engine.installs.get(key)?.version ?? null;
      const busy = engine.progress.has(key);
      const blocked = engine.blocked(product, channel);
      const have = new Map(Array.from(list.children).map((node) => [(node as HTMLElement).dataset.version ?? "", node as HTMLElement]));
      all.forEach((r, i) => {
        const item = have.get(r.version) ?? make(r.version);
        have.delete(r.version);
        fill(item, r, installed, busy, blocked);
        if (list.children[i] !== item) list.insertBefore(item, list.children[i] ?? null);
      });
      for (const gone of have.values()) gone.remove();
    };

    const patchFor = (product: string) => {
      for (const list of lists) if (target(list).product === product) patch(list);
    };

    engine.on("product", ({ id }) => patchFor(id));
    engine.on("install", ({ key }) => patchFor(key.split(":")[0]));
    engine.on("policy", () => lists.forEach(patch));

    for (const list of lists) {
      list.addEventListener("click", (event) => {
        const go = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-ver='install']");
        const version = go?.closest<HTMLElement>("[data-version]")?.dataset.version;
        if (go && version) void engine.dispatch("app.install", { ...target(list), version });
      });
    }
  },
};
