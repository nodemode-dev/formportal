import type { Engine } from "../../engine/index.ts";
import type { StockItem, StockKind, StockSource } from "../../engine/types.ts";
import { pickBridge } from "../../bridge/index.ts";
import { t } from "../../i18n/index.ts";

const OFFERS: Record<string, string> = {
  pexels: "Photos and video",
  pixabay: "Images and video",
  openverse: "Images and audio",
  freesound: "Sounds",
  ccmixter: "Music",
};
const PER: Record<string, number> = { pexels: 24, pixabay: 24, openverse: 20, freesound: 24, ccmixter: 24 };
const KIND_WORD: Record<StockKind, string> = { image: "images", video: "video", audio: "audio" };
const THUMBS_AT_ONCE = 6;

const q = <T extends Element>(root: ParentNode, sel: string) => root.querySelector<T>(sel);
const setText = (node: Element | null | undefined, text: string) => {
  if (node && node.textContent !== text) node.textContent = text;
};
const show = (node: HTMLElement | null | undefined, on: boolean) => {
  if (node && node.hidden === on) node.hidden = !on;
};
const clock = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};
const toBlobUrl = (data: string): string => {
  const at = data.indexOf(",");
  const head = data.slice(5, at);
  const mime = head.split(";")[0] || "application/octet-stream";
  if (!head.includes("base64")) return URL.createObjectURL(new Blob([decodeURIComponent(data.slice(at + 1))], { type: mime }));
  const bin = atob(data.slice(at + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
};

interface Cell {
  li: HTMLLIElement;
  shot: HTMLButtonElement;
  img: HTMLImageElement;
  badge: HTMLElement;
  title: HTMLElement;
  by: HTMLElement;
  lic: HTMLElement;
  save: HTMLButtonElement;
  item: StockItem | null;
}

export function stockSearch(engine: Engine): void {
  const bridge = pickBridge();
  const pane = q<HTMLElement>(document, "[data-pane='stock']");
  const list = q<HTMLUListElement>(document, "[data-stock-src-list]");
  const form = q<HTMLFormElement>(document, "[data-stock-form]");
  const input = q<HTMLInputElement>(document, "[data-stock-query]");
  const chips = q<HTMLElement>(document, "[data-stock-chips]");
  const status = q<HTMLElement>(document, "[data-stock-status]");
  const grid = q<HTMLUListElement>(document, "[data-stock-grid]");
  const more = q<HTMLButtonElement>(document, "[data-stock-more]");
  const dlg = q<HTMLDialogElement>(document, "[data-stock-view]");
  if (!pane || !list || !form || !input || !chips || !status || !grid || !more || !dlg) return;

  let sources: StockSource[] = [];
  let kind: StockKind = "image";
  const left = new Set<string>();
  const rows = new Map<string, HTMLLIElement>();
  const chipFor = new Map<string, HTMLButtonElement>();
  const cells: Cell[] = [];
  let used = 0;
  let run = 0;
  let query = "";
  const pages = new Map<string, { page: number; more: boolean }>();
  const errors = new Map<string, string>();
  const busy = new Set<string>();
  const savedFiles = new Map<string, string>();
  const saving = new Map<string, number>();
  const thumbQueue: Cell[] = [];
  let thumbsBusy = 0;
  const provided = q<HTMLElement>(document, "[data-stock-provided]") ?? (() => {
    const p = document.createElement("p");
    p.className = "fine stock-provided";
    p.dataset.stockProvided = "";
    more.parentElement?.append(p);
    return p;
  })();

  const usable = (s: StockSource) => s.on && s.kinds.includes(kind);
  const chosen = () => sources.filter((s) => usable(s) && !left.has(s.id));

  const row = (s: StockSource) => {
    let r = rows.get(s.id);
    if (!r) {
      r = document.createElement("li");
      r.className = "stock-src";
      r.dataset.src = s.id;
      r.innerHTML =
        '<div class="stock-src-main"><span class="stock-src-name"></span><span class="stock-src-kinds fine"></span><span class="stock-src-state"></span></div><p class="fine stock-src-why"></p><form class="stock-src-key"><input type="password" autocomplete="off" spellcheck="false" maxlength="256" /><button class="btn" type="submit" data-key-save></button><button class="btn" type="button" data-key-remove></button><button class="link-btn" type="button" data-key-get></button></form>';
      setText(q(r, ".stock-src-name"), s.name);
      setText(q(r, ".stock-src-kinds"), t(OFFERS[s.id] ?? ""));
      const keyForm = q<HTMLFormElement>(r, ".stock-src-key");
      const field = q<HTMLInputElement>(r, "input");
      const saveBtn = q<HTMLButtonElement>(r, "[data-key-save]");
      const removeBtn = q<HTMLButtonElement>(r, "[data-key-remove]");
      const getBtn = q<HTMLButtonElement>(r, "[data-key-get]");
      setText(saveBtn, t("Save"));
      setText(removeBtn, t("Remove"));
      setText(getBtn, t("Get a free key"));
      if (field) {
        field.placeholder = t("Paste your {name} API key", { name: s.name });
        field.setAttribute("aria-label", t("{name} API key", { name: s.name }));
      }
      if (!s.needs_key) show(keyForm, false);
      keyForm?.addEventListener("submit", (e) => {
        e.preventDefault();
        const key = field?.value ?? "";
        void (async () => {
          try {
            await bridge.setProviderKey(s.id, key);
            if (field) field.value = "";
            engine.setNotice(t("Your {name} key is kept in this computer's keychain.", { name: s.name }), "info", "library");
            await refresh();
          } catch (err) {
            engine.setNotice(err instanceof Error ? err.message : String(err), "fault", "library");
          }
        })();
      });
      removeBtn?.addEventListener("click", () => {
        void (async () => {
          try {
            await bridge.clearProviderKey(s.id);
            engine.setNotice(t("Your {name} key is removed from this computer's keychain.", { name: s.name }), "info", "library");
            await refresh();
          } catch (err) {
            engine.setNotice(err instanceof Error ? err.message : String(err), "fault", "library");
          }
        })();
      });
      getBtn?.addEventListener("click", () => {
        if (s.key_page) void engine.dispatch("web.open", s.key_page);
      });
      rows.set(s.id, r);
      list.append(r);
    }
    r.toggleAttribute("data-on", s.on);
    setText(q(r, ".stock-src-state"), s.on ? t("On") : t("Off"));
    const why = !s.needs_key ? t("No key needed.") : s.on ? t("Your key is kept in this computer's keychain.") : t("Off until you add your own free {name} API key.", { name: s.name });
    setText(q(r, ".stock-src-why"), why);
    show(q<HTMLElement>(r, "[data-key-remove]"), s.needs_key && s.on);
    const field = q<HTMLInputElement>(r, "input");
    if (field) {
      const ph = s.on ? t("Replace the kept key") : t("Paste your {name} API key", { name: s.name });
      if (field.placeholder !== ph) field.placeholder = ph;
    }
  };

  const chip = (s: StockSource) => {
    let c = chipFor.get(s.id);
    if (!c) {
      c = document.createElement("button");
      c.type = "button";
      c.className = "stock-chip";
      c.textContent = s.name;
      c.addEventListener("click", () => {
        if (left.has(s.id)) left.delete(s.id);
        else left.add(s.id);
        paintChips();
        if (query) void search(true);
      });
      chipFor.set(s.id, c);
      chips.append(c);
    }
    const can = usable(s);
    const on = can && !left.has(s.id);
    if (c.disabled === can) c.disabled = !can;
    if (c.getAttribute("aria-pressed") !== String(on)) c.setAttribute("aria-pressed", String(on));
    const tip = !s.on ? t("Off until you add your own free {name} API key.", { name: s.name }) : !s.kinds.includes(kind) ? t("{name} offers no {kind} through its API.", { name: s.name, kind: t(KIND_WORD[kind]) }) : "";
    if (c.title !== tip) c.title = tip;
  };
  const paintChips = () => sources.forEach(chip);

  const refresh = async () => {
    sources = await bridge.stockSources();
    sources.forEach(row);
    paintChips();
  };

  const cell = (): Cell => {
    const li = document.createElement("li");
    li.className = "stock-cell";
    li.innerHTML =
      '<button class="stock-shot" type="button"><img alt="" decoding="async" hidden /><span class="stock-badge"></span></button><div class="stock-cell-text"><p class="stock-cell-title"></p><p class="fine stock-cell-by"></p><div class="stock-cell-foot"><span class="stock-lic"></span><button class="btn btn-s" type="button" data-cell-save></button></div></div>';
    const c: Cell = {
      li,
      shot: q<HTMLButtonElement>(li, ".stock-shot") as HTMLButtonElement,
      img: q<HTMLImageElement>(li, "img") as HTMLImageElement,
      badge: q<HTMLElement>(li, ".stock-badge") as HTMLElement,
      title: q<HTMLElement>(li, ".stock-cell-title") as HTMLElement,
      by: q<HTMLElement>(li, ".stock-cell-by") as HTMLElement,
      lic: q<HTMLElement>(li, ".stock-lic") as HTMLElement,
      save: q<HTMLButtonElement>(li, "[data-cell-save]") as HTMLButtonElement,
      item: null,
    };
    c.shot.addEventListener("click", () => {
      const at = cells.indexOf(c);
      if (c.item) open(at);
    });
    c.shot.addEventListener("keydown", (e) => {
      const at = cells.indexOf(c);
      const cols = Math.max(1, Math.round(grid.clientWidth / Math.max(1, li.offsetWidth)));
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" ? cols : e.key === "ArrowUp" ? -cols : 0;
      if (!step) return;
      const to = cells[at + step];
      if (to?.item) {
        e.preventDefault();
        to.shot.focus();
      }
    });
    c.save.addEventListener("click", () => {
      if (!c.item) return;
      const file = savedFiles.get(c.item.id);
      if (file) void reveal(file);
      else void save(c.item);
    });
    return c;
  };

  const paintSave = (c: Cell) => {
    const id = c.item?.id ?? "";
    const pct = saving.get(id);
    const label = pct !== undefined ? t("Saving {pct}%", { pct: Math.round(pct * 100) }) : savedFiles.has(id) ? t("Show in folder") : t("Save");
    setText(c.save, label);
    if (c.save.disabled !== (pct !== undefined)) c.save.disabled = pct !== undefined;
  };

  const reset = (c: Cell) => {
    c.item = null;
    c.li.dataset.state = "wait";
    c.li.removeAttribute("data-kind");
    c.li.removeAttribute("data-limit");
    c.img.hidden = true;
    c.img.removeAttribute("src");
    c.img.onload = null;
    c.li.removeAttribute("data-has-shot");
    setText(c.title, "");
    setText(c.by, "");
    setText(c.lic, "");
    setText(c.badge, "");
    c.shot.setAttribute("aria-label", t("Loading"));
    c.shot.tabIndex = -1;
  };

  const reserve = (n: number) => {
    for (let i = 0; i < n; i += 1) {
      const at = used + i;
      let c = cells[at];
      if (!c) {
        c = cell();
        cells.push(c);
      }
      reset(c);
      if (!c.li.isConnected) grid.append(c.li);
    }
  };

  const trim = () => {
    const want = used + [...busy].reduce((n, id) => n + (PER[id] ?? 24), 0);
    for (let i = want; i < cells.length; i += 1) {
      const c = cells[i];
      if (c.li.isConnected) c.li.remove();
      c.item = null;
    }
  };

  const pumpThumbs = () => {
    while (thumbsBusy < THUMBS_AT_ONCE && thumbQueue.length) {
      const c = thumbQueue.shift() as Cell;
      const item = c.item;
      if (!item || !item.thumb) continue;
      thumbsBusy += 1;
      void bridge
        .stockPreview(item.id, "thumb")
        .then((src) => {
          if (c.item?.id !== item.id) return;
          c.img.onload = () => {
            if (c.item?.id !== item.id) return;
            c.img.hidden = false;
            c.li.toggleAttribute("data-has-shot", true);
          };
          c.img.src = src;
        })
        .catch(() => undefined)
        .finally(() => {
          thumbsBusy -= 1;
          pumpThumbs();
        });
    }
  };

  const fill = (c: Cell, item: StockItem) => {
    c.item = item;
    c.li.dataset.state = "item";
    c.li.dataset.kind = item.kind;
    c.li.toggleAttribute("data-limit", item.nc || item.nd);
    setText(c.title, item.title);
    setText(c.by, `${item.author} · ${item.source_name}`);
    setText(c.lic, item.licence);
    c.lic.title = item.nc || item.nd ? limitText(item) : "";
    setText(c.badge, item.kind === "image" ? "" : clock(item.seconds ?? 0));
    c.shot.setAttribute("aria-label", t("Preview {title}", { title: item.title }));
    c.shot.tabIndex = 0;
    c.li.title = item.credit;
    paintSave(c);
    if (item.thumb) {
      thumbQueue.push(c);
      pumpThumbs();
    }
  };

  const paintStatus = () => {
    const names = sources.filter((s) => busy.has(s.id)).map((s) => s.name);
    const parts: string[] = [];
    if (names.length) parts.push(t("Searching {names}", { names: names.join(", ") }));
    else if (query) parts.push(used === 1 ? t("1 result") : t("{n} results", { n: used }));
    for (const [id, why] of errors) {
      const name = sources.find((s) => s.id === id)?.name ?? id;
      parts.push(`${name}: ${why}`);
    }
    setText(status, parts.join(" · "));
    status.toggleAttribute("data-fault", errors.size > 0 && !names.length && used === 0);
    const anyMore = [...pages.values()].some((p) => p.more);
    show(more, anyMore && !busy.size);
    const from = sources.filter((s) => cells.slice(0, used).some((c) => c.item?.source === s.id));
    paintProvided(from);
  };

  const paintProvided = (from: StockSource[]) => {
    const key = from.map((s) => s.id).join(",");
    if (provided.dataset.from === key) return;
    provided.dataset.from = key;
    provided.replaceChildren();
    if (!from.length) return;
    provided.append(document.createTextNode(`${t("Results provided by")} `));
    from.forEach((s, i) => {
      if (i) provided.append(document.createTextNode(", "));
      const b = document.createElement("button");
      b.type = "button";
      b.className = "link-btn";
      b.textContent = s.name;
      b.addEventListener("click", () => void engine.dispatch("web.open", s.home));
      provided.append(b);
    });
  };

  const ask = async (s: StockSource, page: number, mine: number) => {
    busy.add(s.id);
    errors.delete(s.id);
    try {
      const got = await bridge.stockSearch(s.id, kind, query, page);
      if (mine !== run) return;
      busy.delete(s.id);
      pages.set(s.id, { page: got.page, more: got.more });
      for (const item of got.items) {
        const c = cells[used];
        used += 1;
        if (c) fill(c, item);
      }
    } catch (err) {
      if (mine !== run) return;
      busy.delete(s.id);
      pages.set(s.id, { page, more: false });
      errors.set(s.id, err instanceof Error ? err.message : String(err));
    }
    trim();
    paintStatus();
  };

  const search = async (fresh: boolean) => {
    if (fresh) {
      query = input.value.trim();
      run += 1;
      used = 0;
      pages.clear();
      errors.clear();
      busy.clear();
      thumbQueue.length = 0;
    }
    const mine = run;
    if (!query) {
      trim();
      setText(status, t("Type what to look for, then Search."));
      return;
    }
    const pick = chosen().filter((s) => fresh || pages.get(s.id)?.more);
    if (!pick.length) {
      trim();
      const off = sources.filter((s) => s.kinds.includes(kind) && !s.on).map((s) => s.name);
      setText(status, off.length ? t("No source that is on offers {kind}. Add a key for {names} under Your sources.", { kind: t(KIND_WORD[kind]), names: off.join(", ") }) : t("Choose at least one source."));
      show(more, false);
      return;
    }
    reserve(pick.reduce((n, s) => n + (PER[s.id] ?? 24), 0));
    for (const s of pick) busy.add(s.id);
    trim();
    paintStatus();
    await Promise.all(pick.map((s) => ask(s, fresh ? 1 : (pages.get(s.id)?.page ?? 0) + 1, mine)));
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void search(true);
  });
  more.addEventListener("click", () => void search(false));
  const kinds = Array.from(pane.querySelectorAll<HTMLButtonElement>("[data-stock-kind]"));
  for (const b of kinds) {
    b.addEventListener("click", () => {
      const next = (b.dataset.stockKind ?? "image") as StockKind;
      if (next === kind) return;
      kind = next;
      for (const o of kinds) o.setAttribute("aria-pressed", String(o === b));
      paintChips();
      if (query || input.value.trim()) void search(true);
    });
  }

  const limitText = (item: StockItem) => {
    const parts: string[] = [];
    if (item.nc) parts.push(t("Non-commercial use only (NC)."));
    if (item.nd) parts.push(t("No changed versions may be shared (ND)."));
    return parts.join(" ");
  };

  const reveal = async (file: string) => {
    try {
      await bridge.stockReveal(file);
    } catch (err) {
      engine.setNotice(err instanceof Error ? err.message : String(err), "fault", "library");
    }
  };

  const paintAllSaves = () => cells.slice(0, used).forEach((c) => c.item && paintSave(c));

  const save = async (item: StockItem) => {
    if (saving.has(item.id)) return;
    saving.set(item.id, 0);
    paintAllSaves();
    paintView();
    try {
      const done = await bridge.stockSave(item.id, (f) => {
        saving.set(item.id, Math.max(0, Math.min(1, f)));
        paintAllSaves();
        paintView();
      });
      savedFiles.set(item.id, done.file);
      engine.setNotice(t("{title} is saved in your Library with its credit.", { title: item.title }), "info", "library");
      void engine.dispatch("media.load");
    } catch (err) {
      engine.setNotice(err instanceof Error ? err.message : String(err), "fault", "library");
    } finally {
      saving.delete(item.id);
      paintAllSaves();
      paintView();
    }
  };

  engine.on("media", ({ view }) => {
    const now = new Map(view.saved.map((s) => [s.id, s.file]));
    let changed = false;
    for (const id of [...savedFiles.keys()]) if (!now.has(id)) {
      savedFiles.delete(id);
      changed = true;
    }
    for (const [id, file] of now) if (savedFiles.get(id) !== file) {
      savedFiles.set(id, file);
      changed = true;
    }
    if (changed) {
      paintAllSaves();
      paintView();
    }
  });

  const v = {
    stage: q<HTMLElement>(dlg, "[data-view-stage]") as HTMLElement,
    img: q<HTMLImageElement>(dlg, "[data-view-img]") as HTMLImageElement,
    video: q<HTMLVideoElement>(dlg, "[data-view-video]") as HTMLVideoElement,
    player: q<HTMLElement>(dlg, "[data-view-audio]") as HTMLElement,
    play: q<HTMLButtonElement>(dlg, "[data-audio-play]") as HTMLButtonElement,
    seek: q<HTMLInputElement>(dlg, "[data-audio-seek]") as HTMLInputElement,
    time: q<HTMLElement>(dlg, "[data-audio-time]") as HTMLElement,
    wait: q<HTMLElement>(dlg, "[data-view-wait]") as HTMLElement,
    title: q<HTMLElement>(dlg, "[data-view-title]") as HTMLElement,
    author: q<HTMLButtonElement>(dlg, "[data-view-author]") as HTMLButtonElement,
    authorText: q<HTMLElement>(dlg, "[data-view-author-text]") as HTMLElement,
    source: q<HTMLElement>(dlg, "[data-view-source]") as HTMLElement,
    licence: q<HTMLElement>(dlg, "[data-view-licence]") as HTMLElement,
    licenceLink: q<HTMLButtonElement>(dlg, "[data-view-licence-link]") as HTMLButtonElement,
    limit: q<HTMLElement>(dlg, "[data-view-limit]") as HTMLElement,
    credit: q<HTMLElement>(dlg, "[data-view-credit]") as HTMLElement,
    file: q<HTMLElement>(dlg, "[data-view-file]") as HTMLElement,
    save: q<HTMLButtonElement>(dlg, "[data-view-save]") as HTMLButtonElement,
    showBtn: q<HTMLButtonElement>(dlg, "[data-view-show]") as HTMLButtonElement,
    page: q<HTMLButtonElement>(dlg, "[data-view-page]") as HTMLButtonElement,
    progress: q<HTMLElement>(dlg, "[data-view-progress]") as HTMLElement,
    bar: q<HTMLElement>(dlg, "[data-view-bar]") as HTMLElement,
    note: q<HTMLElement>(dlg, "[data-view-note]") as HTMLElement,
    playIcon: q<SVGElement>(dlg, "[data-icon-play]") as SVGElement,
    pauseIcon: q<SVGElement>(dlg, "[data-icon-pause]") as SVGElement,
  };
  const audio = new Audio();
  audio.preload = "metadata";
  let at = -1;
  let ticket = 0;
  let blob = "";
  const current = () => cells[at]?.item ?? null;

  const dropBlob = () => {
    if (blob) URL.revokeObjectURL(blob);
    blob = "";
  };

  const paintPlayer = () => {
    const playing = !audio.paused;
    v.playIcon.toggleAttribute("hidden", playing);
    v.pauseIcon.toggleAttribute("hidden", !playing);
    const label = playing ? t("Pause") : t("Play");
    if (v.play.getAttribute("aria-label") !== label) v.play.setAttribute("aria-label", label);
    const d = Number.isFinite(audio.duration) ? audio.duration : current()?.seconds ?? 0;
    setText(v.time, `${clock(audio.currentTime)} / ${clock(d)}`);
    if (document.activeElement !== v.seek) {
      const pos = d > 0 ? String(Math.round((audio.currentTime / d) * 1000)) : "0";
      if (v.seek.value !== pos) v.seek.value = pos;
    }
  };
  audio.addEventListener("timeupdate", paintPlayer);
  audio.addEventListener("play", () => {
    v.video.pause();
    paintPlayer();
  });
  audio.addEventListener("pause", paintPlayer);
  audio.addEventListener("loadedmetadata", paintPlayer);
  audio.addEventListener("ended", paintPlayer);
  v.video.addEventListener("play", () => audio.pause());
  v.play.addEventListener("click", () => {
    if (!audio.src) return;
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  });
  v.seek.addEventListener("input", () => {
    const d = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (d > 0) audio.currentTime = (Number(v.seek.value) / 1000) * d;
    paintPlayer();
  });

  const paintView = () => {
    const item = current();
    if (!item || !dlg.open) return;
    const pct = saving.get(item.id);
    const file = savedFiles.get(item.id);
    setText(v.save, pct !== undefined ? t("Saving {pct}%", { pct: Math.round(pct * 100) }) : file ? t("Save again") : t("Save"));
    if (v.save.disabled !== (pct !== undefined)) v.save.disabled = pct !== undefined;
    show(v.showBtn, Boolean(file) && pct === undefined);
    show(v.progress, pct !== undefined);
    v.bar.style.inlineSize = `${Math.round((pct ?? 0) * 100)}%`;
    setText(v.note, file && pct === undefined ? t("Saved to {file}", { file }) : "");
  };

  const paintMeta = (item: StockItem) => {
    setText(v.title, item.title);
    const link = Boolean(item.author_url);
    show(v.author, link);
    show(v.authorText, !link);
    setText(v.author, link ? item.author : "");
    setText(v.authorText, link ? "" : item.author);
    setText(v.source, t("on {source}", { source: item.source_name }));
    setText(v.licence, item.licence);
    v.licence.toggleAttribute("data-limit", item.nc || item.nd);
    show(v.licenceLink, Boolean(item.licence_url));
    const lim = limitText(item);
    setText(v.limit, lim);
    show(v.limit, Boolean(lim));
    setText(v.credit, t("Credit: {line}", { line: item.credit }));
    const size = item.width && item.height ? ` · ${item.width} x ${item.height}` : "";
    setText(v.file, t("Save gets: {what}", { what: item.file_note }) + size);
    setText(v.page, t("Open its page on {source}", { source: item.source_name }));
  };

  const load = async (item: StockItem, cellAt: number) => {
    const mine = ++ticket;
    audio.pause();
    v.video.pause();
    dropBlob();
    dlg.dataset.kind = item.kind;
    const thumb = cells[cellAt]?.img;
    show(v.wait, true);
    setText(v.wait, t("Loading the preview"));
    if (item.kind === "image") {
      show(v.video, false);
      show(v.player, false);
      if (thumb?.src && !thumb.hidden) {
        v.img.src = thumb.src;
        show(v.img, true);
      } else show(v.img, false);
    } else if (item.kind === "video") {
      show(v.img, false);
      show(v.player, false);
      v.video.removeAttribute("src");
      v.video.poster = thumb?.src && !thumb.hidden ? thumb.src : "";
      show(v.video, true);
    } else {
      show(v.video, false);
      if (thumb?.src && !thumb.hidden) {
        v.img.src = thumb.src;
        show(v.img, true);
      } else show(v.img, false);
      audio.removeAttribute("src");
      show(v.player, true);
      paintPlayer();
    }
    try {
      const data = await bridge.stockPreview(item.id, "view");
      if (mine !== ticket || !dlg.open) return;
      if (!data) throw new Error(t("No preview came back."));
      if (item.kind === "image") {
        v.img.src = data;
        show(v.img, true);
      } else {
        blob = toBlobUrl(data);
        if (item.kind === "video") v.video.src = blob;
        else {
          audio.src = blob;
          paintPlayer();
        }
      }
      show(v.wait, false);
    } catch (err) {
      if (mine !== ticket) return;
      setText(v.wait, t("The preview could not be loaded: {why}", { why: err instanceof Error ? err.message : String(err) }));
    }
  };

  const open = (index: number) => {
    const item = cells[index]?.item;
    if (!item) return;
    at = index;
    paintMeta(item);
    if (!dlg.open) dlg.showModal();
    paintView();
    void load(item, index);
  };

  const step = (by: number) => {
    let i = at + by;
    while (i >= 0 && i < used && !cells[i]?.item) i += by;
    if (i >= 0 && i < used) open(i);
  };

  dlg.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement && e.target !== v.seek) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      if (e.target === v.seek || e.target === v.video) return;
      e.preventDefault();
      step(e.key === "ArrowRight" ? 1 : -1);
    }
  });
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });
  dlg.addEventListener("close", () => {
    ticket += 1;
    audio.pause();
    audio.removeAttribute("src");
    v.video.pause();
    v.video.removeAttribute("src");
    v.video.load();
    dropBlob();
    cells[at]?.shot.focus();
  });
  q<HTMLButtonElement>(dlg, "[data-view-close]")?.addEventListener("click", () => dlg.close());
  dlg.querySelectorAll<HTMLButtonElement>("[data-view-step]").forEach((b) => b.addEventListener("click", () => step(Number(b.dataset.viewStep))));
  v.save.addEventListener("click", () => {
    const item = current();
    if (item) void save(item);
  });
  v.showBtn.addEventListener("click", () => {
    const item = current();
    const file = item ? savedFiles.get(item.id) : undefined;
    if (file) void reveal(file);
  });
  v.page.addEventListener("click", () => {
    const item = current();
    if (item) void engine.dispatch("web.open", item.page_url);
  });
  v.author.addEventListener("click", () => {
    const item = current();
    if (item?.author_url) void engine.dispatch("web.open", item.author_url);
  });
  v.licenceLink.addEventListener("click", () => {
    const item = current();
    if (item?.licence_url) void engine.dispatch("web.open", item.licence_url);
  });

  setText(status, t("Type what to look for, then Search."));
  let loaded = false;
  engine.on("route", ({ route }) => {
    if (route !== "stock") return;
    if (!loaded) {
      loaded = true;
      void refresh().catch(() => {
        loaded = false;
      });
    }
  });
}
