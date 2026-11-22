import registry from "../../../../catalog/products.json";
import { pickBridge } from "../../bridge/index.ts";
import type { TemplateApp, TemplateItem, TemplatesView } from "../../engine/types.ts";
import type { Extension } from "../registry.ts";
import { t } from "../../i18n/index.ts";

const ALIAS: Record<string, string> = { formportal: "formai", formdeck: "formslide", formskill: "formskills" };
const ICON_FILE: Record<string, string> = { formai: "formportal", formslide: "formdeck" };
const PRODUCTS = new Map((registry.products as { id: string; group?: string; project_extensions?: string[] }[]).map((p) => [p.id, p]));
const CHEVRON = '<svg class="ic ic-s tpl-chev" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SEARCH = '<svg class="ic ic-s" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 15l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

const size = (bytes: number) => (bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(bytes >= 100_000_000 ? 0 : 1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`);
const write = (node: Element | null, text: string) => {
  if (node && node.textContent !== text) node.textContent = text;
};
const show = (node: HTMLElement | null, on: boolean) => {
  if (node && node.hidden === on) node.hidden = !on;
};
const extOf = (path: string) => {
  const file = path.split(/[\\/]/).pop() ?? "";
  const dot = file.lastIndexOf(".");
  return dot > 0 ? file.slice(dot).toLowerCase() : "";
};

interface AppNode {
  data: TemplateApp;
  cid: string | null;
  el: HTMLElement;
  toggle: HTMLButtonElement;
  body: HTMLElement;
  list: HTMLUListElement;
  all: HTMLButtonElement;
  built: boolean;
  open: boolean;
  byFilter: boolean;
  busy: boolean;
  rows: Map<string, HTMLElement>;
}

export const templates: Extension = {
  id: "templates",
  setup(engine) {
    const mount = document.getElementById("templates-mount");
    if (!mount) return;
    const bridge = pickBridge();
    mount.className = "tpl";
    mount.innerHTML = `<header class="tpl-head"><h2 class="block-title"></h2><span class="block-note mono" data-tpl-when></span></header><p class="fine tpl-intro"></p><div class="tpl-bar"><button class="btn btn-primary" type="button" data-tpl-get></button><label class="search search-local tpl-filter">${SEARCH}<input type="search" data-tpl-filter autocomplete="off" spellcheck="false" /></label><span class="fine tpl-status" data-tpl-status></span></div><p class="empty tpl-error" data-tpl-error hidden></p><div class="tpl-apps" data-tpl-apps></div><p class="empty" data-tpl-none hidden></p>`;
    write(mount.querySelector(".block-title"), t("Templates and demos"));
    write(mount.querySelector(".tpl-intro"), t("Templates and demos for every public Form app, organised by app. The list comes from the public repository nodemode-dev/formai-templates on GitHub. Nothing is downloaded until you press a button, and a download is a plain request to GitHub, with no account."));
    const get = mount.querySelector<HTMLButtonElement>("[data-tpl-get]")!;
    const filter = mount.querySelector<HTMLInputElement>("[data-tpl-filter]")!;
    const filterBox = mount.querySelector<HTMLElement>(".tpl-filter")!;
    const when = mount.querySelector<HTMLElement>("[data-tpl-when]")!;
    const status = mount.querySelector<HTMLElement>("[data-tpl-status]")!;
    const error = mount.querySelector<HTMLElement>("[data-tpl-error]")!;
    const host = mount.querySelector<HTMLElement>("[data-tpl-apps]")!;
    const none = mount.querySelector<HTMLElement>("[data-tpl-none]")!;
    write(get, t("Get the list"));
    filter.placeholder = t("Filter templates and demos");
    filter.setAttribute("aria-label", t("Filter templates and demos"));
    filterBox.toggleAttribute("data-off", true);
    filter.disabled = true;

    const apps = new Map<string, AppNode>();
    const texts = new Map<string, string>();
    let downloaded: Record<string, string> = {};
    let folder = "";
    let asked = false;

    const nameOf = (node: AppNode) => (node.cid ? engine.name(node.cid) : node.data.name);
    const installed = (cid: string | null) => cid !== null && Array.from(engine.installs.values()).some((r) => r.product === cid);
    const opens = (node: AppNode, path: string) => installed(node.cid) && (PRODUCTS.get(node.cid ?? "")?.project_extensions ?? []).map((e) => e.toLowerCase()).includes(extOf(path));
    const rank = (cid: string | null) => {
      if (!cid) return 10_000;
      const heads = Array.from(document.querySelectorAll("[data-pane='apps'] [data-group-head]"));
      const head = document.querySelector(`[data-pane='apps'] [data-product='${cid}']`)?.closest("[data-group-head]");
      const at = head ? heads.indexOf(head) : -1;
      return at >= 0 ? at : PRODUCTS.get(cid)?.group === "adobe" ? 0 : 1;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const box = entry.target as HTMLElement;
          observer.unobserve(box);
          const path = box.dataset.preview;
          if (!path) continue;
          bridge.templatesPreview(path).then(
            (src) => {
              const img = box.querySelector("img");
              if (img && img.getAttribute("src") !== src) img.src = src;
            },
            () => box.toggleAttribute("data-missed", true),
          );
        }
      },
      { rootMargin: "240px 0px" },
    );

    const KIND_TEXT = { demo: t("Demo"), template: t("Template") };
    const rowTpl = document.createElement("template");
    rowTpl.innerHTML = `<li class="tpl-item"><div class="tpl-shot" aria-hidden="true"><img alt="" decoding="async" /></div><div class="tpl-text"><p class="tpl-name"><span class="tpl-name-text"></span> <span class="chip"></span></p><p class="row-sub tpl-desc" data-tpl-desc hidden></p><p class="fine tpl-meta" data-tpl-meta></p><p class="fine tpl-state" data-tpl-state></p></div><div class="tpl-acts"><button class="btn" type="button" data-tpl-act="open" hidden></button><button class="btn" type="button" data-tpl-act="show" hidden></button><button class="btn btn-primary" type="button" data-tpl-act="download"></button></div></li>`;
    write(rowTpl.content.querySelector("[data-tpl-act='download']"), t("Download"));
    write(rowTpl.content.querySelector("[data-tpl-act='show']"), t("Show in folder"));

    const rowState = (node: AppNode, item: TemplateItem, row: HTMLElement) => {
      const path = downloaded[item.id];
      const acts = row.lastElementChild as HTMLElement;
      const [open, reveal, get] = Array.from(acts.children) as HTMLElement[];
      show(get, !path);
      show(reveal, Boolean(path));
      const can = Boolean(path) && opens(node, path);
      if (can) write(open, t("Open in {app}", { app: nameOf(node) }));
      show(open, can);
      if (path && !row.hasAttribute("data-fault")) write(row.querySelector("[data-tpl-state]"), t("Saved in {path}", { path }));
    };

    const fill = (node: AppNode, item: TemplateItem, row: HTMLElement) => {
      write(row.querySelector(".tpl-name-text"), item.name);
      write(row.querySelector(".chip"), KIND_TEXT[item.kind] ?? item.kind);
      const desc = row.querySelector<HTMLElement>("[data-tpl-desc]");
      write(desc, item.description);
      show(desc, Boolean(item.description));
      write(row.querySelector("[data-tpl-meta]"), [size(item.bytes), item.licence, item.credit].filter(Boolean).join(" · "));
      if (downloaded[item.id] || row.isConnected) rowState(node, item, row);
    };

    const download = async (node: AppNode, item: TemplateItem, quiet = false): Promise<boolean> => {
      const row = node.rows.get(item.id);
      const btn = row?.querySelector<HTMLButtonElement>("[data-tpl-act='download']");
      const state = row?.querySelector<HTMLElement>("[data-tpl-state]") ?? null;
      if (btn) {
        btn.disabled = true;
        write(btn, t("Downloading"));
      }
      row?.removeAttribute("data-fault");
      write(state, "");
      if (state) state.title = "";
      try {
        const done = await bridge.templatesDownload(item.id);
        downloaded = { ...downloaded, [item.id]: done.path };
        if (!quiet) engine.setNotice(t("{name} is saved in {path}.", { name: item.name, path: done.path }), "info", "library");
        return true;
      } catch (e) {
        const full = e instanceof Error ? e.message : String(e);
        const why = full.replace(/ \(expected SHA-256 [0-9a-fA-F]+, found [0-9a-fA-F]+\)$/, ".");
        row?.toggleAttribute("data-fault", true);
        write(state, why);
        if (state) state.title = full;
        engine.setNotice(why.startsWith(item.name) ? t("Not downloaded: {why}", { why }) : t("{name} was not downloaded: {why}", { name: item.name, why }), "fault", "library");
        return false;
      } finally {
        if (btn) {
          btn.disabled = false;
          write(btn, t("Download"));
        }
        if (row) rowState(node, item, row);
      }
    };

    const makeRow = (item: TemplateItem) => {
      const row = rowTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      row.dataset.tplItem = item.id;
      const shot = row.firstElementChild as HTMLElement;
      if (item.preview) {
        shot.dataset.preview = item.preview;
        observer.observe(shot);
      } else shot.toggleAttribute("data-none", true);
      return row;
    };

    const syncRows = (node: AppNode) => {
      const keep = new Set(node.data.items.map((i) => i.id));
      for (const [id, row] of node.rows) if (!keep.has(id)) {
        row.remove();
        node.rows.delete(id);
      }
      const fresh = document.createDocumentFragment();
      let anchor: Element | null = node.list.firstElementChild;
      for (const item of node.data.items) {
        let row = node.rows.get(item.id);
        if (!row) {
          row = makeRow(item);
          node.rows.set(item.id, row);
        }
        fill(node, item, row);
        if (row === anchor) {
          anchor = anchor.nextElementSibling;
          continue;
        }
        if (!anchor) fresh.append(row);
        else node.list.insertBefore(row, anchor);
      }
      if (fresh.childNodes.length) node.list.append(fresh);
    };

    const setOpen = (node: AppNode, open: boolean) => {
      if (node.open === open) return;
      node.open = open;
      if (open && !node.built) {
        node.built = true;
        syncRows(node);
      }
      node.toggle.setAttribute("aria-expanded", String(open));
      node.el.toggleAttribute("data-open", open);
      show(node.body, open);
    };

    const head = (node: AppNode) => {
      const items = node.data.items;
      const nt = items.filter((i) => i.kind === "template").length;
      const nd = items.length - nt;
      const counts = [nt ? (nt === 1 ? t("1 template") : t("{n} templates", { n: nt })) : "", nd ? (nd === 1 ? t("1 demo") : t("{n} demos", { n: nd })) : ""].filter(Boolean).join(" · ");
      write(node.el.querySelector(".tpl-app-name"), nameOf(node));
      write(node.el.querySelector(".tpl-counts"), counts || t("Nothing yet"));
      write(node.el.querySelector(".tpl-total"), t("{size} in all", { size: size(items.reduce((s, i) => s + i.bytes, 0)) }));
      if (!node.busy) write(node.all, t("Download all for {app}", { app: nameOf(node) }));
      node.all.disabled = node.busy || items.length === 0;
    };

    const makeApp = (data: TemplateApp) => {
      const known = ALIAS[data.id] ?? data.id;
      const cid = PRODUCTS.has(known) ? known : null;
      const el = document.createElement("section");
      el.className = "tpl-app";
      el.dataset.tplApp = data.id;
      const bodyId = `tpl-body-${data.id}`;
      const icon = cid ? ICON_FILE[cid] ?? cid : "";
      const art = cid ? `<span class="app-ic tpl-ic" aria-hidden="true"><img class="ic-dark" src="/apps/${icon}.webp" alt="" width="28" height="28" decoding="async" /><img class="ic-light" src="/apps/${icon}-light.webp" alt="" width="28" height="28" decoding="async" /></span>` : '<span class="app-ic tpl-ic app-ic-none" aria-hidden="true"></span>';
      el.innerHTML = `<div class="tpl-app-head"><button class="tpl-toggle" type="button" aria-expanded="false" aria-controls="${bodyId}">${CHEVRON}${art}<span class="tpl-app-name"></span><span class="fine tpl-counts"></span></button><span class="fine mono tpl-total"></span><button class="btn" type="button" data-tpl-all></button></div><div class="tpl-body" id="${bodyId}" hidden><ul class="tpl-items"></ul></div>`;
      const node: AppNode = {
        data,
        cid,
        el,
        toggle: el.querySelector(".tpl-toggle")!,
        body: el.querySelector(".tpl-body")!,
        list: el.querySelector(".tpl-items")!,
        all: el.querySelector("[data-tpl-all]")!,
        built: false,
        open: false,
        byFilter: false,
        busy: false,
        rows: new Map(),
      };
      node.list.addEventListener("click", (event) => {
        const btn = (event.target as Element).closest<HTMLElement>("[data-tpl-act]");
        const id = btn?.closest<HTMLElement>("[data-tpl-item]")?.dataset.tplItem;
        const item = id ? node.data.items.find((i) => i.id === id) : undefined;
        if (!btn || !item) return;
        const fail = (e: unknown) => engine.setNotice(e instanceof Error ? e.message : String(e), "fault", "library");
        const path = downloaded[item.id];
        if (btn.dataset.tplAct === "download") void download(node, item);
        else if (btn.dataset.tplAct === "show" && path) bridge.templatesReveal(path).catch(fail);
        else if (btn.dataset.tplAct === "open" && path) bridge.fileOpen(path).catch(fail);
      });
      node.toggle.addEventListener("click", () => {
        node.byFilter = false;
        setOpen(node, !node.open);
      });
      node.all.addEventListener("click", async () => {
        const waiting = node.data.items.filter((i) => !downloaded[i.id]);
        if (!waiting.length || node.busy) return;
        node.busy = true;
        node.all.disabled = true;
        setOpen(node, true);
        let ok = 0;
        for (const [n, item] of waiting.entries()) {
          write(node.all, t("Downloading {done} of {total}", { done: n + 1, total: waiting.length }));
          if (await download(node, item, true)) ok += 1;
        }
        node.busy = false;
        head(node);
        engine.setNotice(t("{n} of {total} from {app} are saved in {path}.", { n: ok, total: waiting.length, app: nameOf(node), path: `${folder}/${node.data.id}` }), ok === waiting.length ? "info" : "fault", "library");
      });
      return node;
    };

    const applyFilter = () => {
      const words = filter.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      let any = false;
      for (const node of apps.values()) {
        if (!words.length) {
          show(node.el, true);
          if (node.byFilter) {
            node.byFilter = false;
            setOpen(node, false);
          }
          for (const row of node.rows.values()) show(row, true);
          any = true;
          continue;
        }
        const appText = `${nameOf(node)} ${node.data.id}`.toLowerCase();
        const hits = new Set(node.data.items.filter((i) => words.every((w) => appText.includes(w) || (texts.get(i.id) ?? "").includes(w))).map((i) => i.id));
        show(node.el, hits.size > 0);
        if (hits.size > 0) {
          any = true;
          if (!node.open) {
            node.byFilter = true;
            setOpen(node, true);
          }
        }
        for (const [id, row] of node.rows) show(row, hits.has(id));
      }
      write(none, words.length && !any ? t("Nothing matches {query}.", { query: filter.value.trim() }) : "");
      show(none, Boolean(words.length) && !any);
    };

    const render = (view: TemplatesView) => {
      downloaded = { ...view.downloaded };
      folder = view.folder;
      texts.clear();
      const list = view.index.apps.filter((a) => a.id !== "formsculpt");
      for (const a of list) for (const i of a.items) texts.set(i.id, `${i.name} ${i.description} ${i.kind} ${i.licence} ${i.credit}`.toLowerCase());
      const keep = new Set(list.map((a) => a.id));
      for (const [id, node] of apps) if (!keep.has(id)) {
        node.el.remove();
        apps.delete(id);
      }
      for (const data of list) {
        let node = apps.get(data.id);
        if (!node) {
          node = makeApp(data);
          apps.set(data.id, node);
        }
        node.data = data;
        head(node);
        if (node.built) syncRows(node);
      }
      const ordered = Array.from(apps.values()).sort((a, b) => rank(a.cid) - rank(b.cid) || nameOf(a).localeCompare(nameOf(b)));
      let anchor: Element | null = host.firstElementChild;
      const fresh = document.createDocumentFragment();
      for (const node of ordered) {
        if (node.el === anchor) {
          anchor = anchor.nextElementSibling;
          continue;
        }
        if (!anchor) fresh.append(node.el);
        else host.insertBefore(node.el, anchor);
      }
      if (fresh.childNodes.length) host.append(fresh);
      const stamp = new Date(view.fetched * 1000);
      const total = list.reduce((s, a) => s + a.items.length, 0);
      write(when, t("List from {date}", { date: stamp.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) }));
      write(status, list.length === 1 ? t("1 app · {n} items", { n: total }) : t("{apps} apps · {n} items", { apps: list.length, n: total }));
      write(get, t("Check again"));
      filter.disabled = false;
      filterBox.removeAttribute("data-off");
      mount.toggleAttribute("data-listed", true);
      applyFilter();
    };

    get.addEventListener("click", async () => {
      get.disabled = true;
      write(get, t("Getting the list"));
      show(error, false);
      try {
        render(await bridge.templatesFetch());
      } catch (e) {
        const why = e instanceof Error ? e.message : String(e);
        write(error, t("The list could not be read: {why}", { why }));
        show(error, true);
        write(get, mount.hasAttribute("data-listed") ? t("Check again") : t("Get the list"));
      } finally {
        get.disabled = false;
      }
    });
    filter.addEventListener("input", applyFilter);

    engine.on("install", () => {
      for (const node of apps.values()) for (const [id, row] of node.rows) if (downloaded[id]) {
        const item = node.data.items.find((i) => i.id === id);
        if (item) rowState(node, item, row);
      }
    });
    engine.on("route", ({ route }) => {
      if (route !== "stock" || asked) return;
      asked = true;
      bridge.templatesKept().then(
        (view) => {
          if (view) render(view);
        },
        () => {},
      );
    });
  },
};
