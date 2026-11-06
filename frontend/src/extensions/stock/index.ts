import type { MediaItem, SavedMedia } from "../../engine/types.ts";
import type { Extension } from "../registry.ts";
import { t } from "../../i18n/index.ts";
import { storeNote } from "../storenote.ts";

const KIND: Record<string, string> = { image: "Image", video: "Video", audio: "Audio", template: "Template" };

const set = (root: HTMLElement, field: string, text: string) => {
  const node = root.querySelector<HTMLElement>(`[data-field='${field}']`);
  if (node && node.textContent !== text) node.textContent = text;
};

export const stock: Extension = {
  id: "stock",
  setup(engine) {
    const pane = document.querySelector<HTMLElement>("[data-pane='stock']");
    const grid = document.querySelector<HTMLElement>("[data-media-grid]");
    const savedList = document.querySelector<HTMLElement>("[data-media-saved]");
    const tpl = document.querySelector<HTMLTemplateElement>("#media-card");
    const query = document.querySelector<HTMLInputElement>("[data-media-query]");
    if (!pane || !grid || !savedList || !tpl) return;
    const cards = new Map<string, HTMLElement>();
    const savedRows = new Map<string, HTMLElement>();
    const thumbs = new Set<string>();

    const card = (item: MediaItem, credit: string) => {
      let c = cards.get(item.id);
      if (!c) {
        c = (tpl.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
        c.dataset.media = item.id;
        c.dataset.kind = item.kind;
        c.dataset.search = `${item.title} ${item.creator} ${item.kind} ${item.tags.join(" ")}`.toLowerCase();
        if (item.product) c.dataset.product = item.product;
        c.querySelector("[data-media-act='save']")?.addEventListener("click", () => void engine.dispatch("media.save", { id: item.id, title: item.title }));
        c.querySelector("[data-media-act='use']")?.addEventListener("click", () => void engine.dispatch("media.save", { id: item.id, title: item.title, use: true }));
        cards.set(item.id, c);
        grid.append(c);
        if (item.thumbnail && !thumbs.has(item.id)) {
          thumbs.add(item.id);
          const shot = c.querySelector<HTMLElement>("[data-field='shot']");
          void engine.dispatch("media.thumb", { url: item.thumbnail, into: shot });
        }
      }
      set(c, "title", item.title);
      set(c, "by", `${item.creator} · ${item.licence}`);
      set(c, "kind", KIND[item.kind] ?? item.kind);
      c.title = credit;
      return c;
    };

    const apply = () => {
      const words = (query?.value ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
      const kind = pane.dataset.kind ?? "all";
      for (const c of cards.values()) {
        const hit = words.every((w) => (c.dataset.search ?? "").includes(w)) && (kind === "all" || c.dataset.kind === kind);
        if (c.hidden === hit) c.hidden = !hit;
      }
    };

    const savedRow = (s: SavedMedia) => {
      let r = savedRows.get(s.id);
      if (!r) {
        r = document.createElement("li");
        r.className = "row saved";
        r.innerHTML = '<span class="mark" aria-hidden="true"></span><div class="row-main"><span class="row-name-text"></span><p class="row-sub credit"></p></div><p class="row-state"><span class="state-text"></span></p><div class="acts acts-files"><button class="btn" type="button">Remove</button></div>';
        r.querySelector("button")?.addEventListener("click", () => void engine.dispatch("media.remove", { id: s.id, title: s.title }));
        savedRows.set(s.id, r);
      }
      (r.querySelector(".mark") as HTMLElement).textContent = (KIND[s.kind] ?? s.kind).slice(0, 2);
      (r.querySelector(".row-name-text") as HTMLElement).textContent = s.title;
      (r.querySelector(".credit") as HTMLElement).textContent = s.credit;
      (r.querySelector(".state-text") as HTMLElement).textContent = s.licence;
      return r;
    };

    engine.on("media", ({ view }) => {
      storeNote(pane, view.store, t("Photos and templates"));
      const items = view.index?.items ?? [];
      items.forEach((item, i) => card(item, view.credits[i] ?? ""));
      const saved = new Set(view.saved.map((s) => s.id));
      for (const [id, c] of cards) {
        const on = saved.has(id);
        if (c.hasAttribute("data-saved") !== on) c.toggleAttribute("data-saved", on);
      }
      const keep = new Set(view.saved.map((s) => s.id));
      for (const [id, r] of savedRows) if (!keep.has(id)) {
        r.remove();
        savedRows.delete(id);
      }
      for (const s of view.saved) {
        const r = savedRow(s);
        if (!r.isConnected) savedList.append(r);
      }
      const empty = document.querySelector<HTMLElement>("[data-media-saved-empty]");
      if (empty && empty.hidden !== view.saved.length > 0) empty.hidden = view.saved.length > 0;
      const lib = document.querySelector<HTMLElement>("[data-media-library]");
      if (lib && lib.textContent !== view.library) lib.textContent = view.library;
      const error = document.querySelector<HTMLElement>("[data-media-error]");
      if (error) {
        const text = view.index_error ? `The media index could not be read: ${view.index_error}` : "";
        if (error.textContent !== text) error.textContent = text;
        if (error.hidden === Boolean(text)) error.hidden = !text;
      }
      apply();
      pane.toggleAttribute("data-ready", true);
    });

    query?.addEventListener("input", apply);
    const kinds = Array.from(pane.querySelectorAll<HTMLButtonElement>("[data-media-kind]"));
    for (const b of kinds) {
      b.addEventListener("click", () => {
        pane.dataset.kind = b.dataset.mediaKind ?? "all";
        for (const o of kinds) o.setAttribute("aria-pressed", String(o === b));
        apply();
      });
    }
    engine.on("route", ({ route }) => {
      if (route === "stock") void engine.dispatch("media.load");
    });
  },
};
