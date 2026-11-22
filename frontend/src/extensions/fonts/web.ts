import { pickBridge } from "../../bridge/index.ts";
import type { Engine } from "../../engine/index.ts";
import type { InstalledFont, WebFontCatalogue, WebFontDetail, WebFontFamily, WebFontSource } from "../../engine/types.ts";
import { t } from "../../i18n/index.ts";

const KEY = "google-fonts";
const KEY_PAGE = "https://console.cloud.google.com/apis/credentials";
const STEP = 40;

const put = (node: Element | null | undefined, text: string) => {
  if (node && node.textContent !== text) node.textContent = text;
};

const flag = (node: Element, name: string, on: boolean) => {
  if (node.hasAttribute(name) !== on) node.toggleAttribute(name, on);
};

const sourceName = (source: WebFontSource) => (source === "google" ? "Google Fonts" : "Fontsource");

export function setupWeb(engine: Engine, pane: HTMLElement): void {
  const bridge = pickBridge();
  const box = pane.querySelector<HTMLElement>("[data-font-web]");
  const list = pane.querySelector<HTMLElement>("[data-font-web-list]");
  const mine = pane.querySelector<HTMLElement>("[data-font-web-installed]");
  const tpl = document.querySelector<HTMLTemplateElement>("#font-web-row");
  const subsetPick = pane.querySelector<HTMLSelectElement>("[data-font-web-subset]");
  const sample = pane.querySelector<HTMLInputElement>("[data-font-web-sample]");
  const line = pane.querySelector<HTMLElement>("[data-font-web-line]");
  const keyBox = pane.querySelector<HTMLElement>("[data-font-key]");
  const keyInput = pane.querySelector<HTMLInputElement>("[data-font-key-input]");
  const keyRemove = pane.querySelector<HTMLButtonElement>("[data-font-key-remove]");
  const more = pane.querySelector<HTMLButtonElement>("[data-font-web-more]");
  const empty = pane.querySelector<HTMLElement>("[data-font-web-empty]");
  const query = pane.querySelector<HTMLInputElement>("[data-fonts-query]");
  if (!box || !list || !mine || !tpl || !subsetPick || !sample || !line || !keyBox || !keyInput || !keyRemove || !more || !empty) return;

  let source: WebFontSource = "fontsource";
  let limit = STEP;
  let keyKept = false;
  let installed: InstalledFont[] = [];
  const catalogues = new Map<WebFontSource, WebFontCatalogue>();
  const failed = new Map<WebFontSource, string>();
  const loading = new Set<WebFontSource>();
  const rows = new Map<string, HTMLElement>();
  const details = new Map<string, WebFontDetail>();
  const faces = new Set<string>();
  const mineRows = new Map<string, HTMLElement>();
  const fallbackSample = t("The quick brown fox jumps over the lazy dog");
  const sampleText = () => sample.value.trim() || fallbackSample;

  const fault = (e: unknown) => engine.setNotice(e instanceof Error ? e.message : String(e), "fault", "library");
  const haveOf = (key: string) => installed.filter((f) => f.family_id === key);

  const describe = () => {
    const cat = catalogues.get(source);
    const text = loading.has(source)
      ? t("Reading the {source} catalogue.", { source: sourceName(source) })
      : failed.has(source)
        ? t("{source} could not be read: {why}", { source: sourceName(source), why: failed.get(source) ?? "" })
        : source === "google" && !cat?.on
          ? t("Google Fonts is off. It needs your own API key from Google Cloud.")
          : source === "google"
            ? t("Google Fonts through your own key: FormPortal asks www.googleapis.com and fonts.gstatic.com, and reads each family's licence from Fontsource's copy at cdn.jsdelivr.net.")
            : t("Fontsource's public catalogue, with no account: FormPortal asks api.fontsource.org and cdn.jsdelivr.net, and sends nothing about you.");
    put(line, text);
    flag(keyBox, "hidden", source !== "google");
    keyRemove.disabled = !keyKept;
  };

  const subsets = () => {
    const all = new Set<string>();
    for (const f of catalogues.get(source)?.families ?? []) for (const s of f.subsets) all.add(s);
    const want = ["", ...Array.from(all).sort()];
    const have = Array.from(subsetPick.options).map((o) => o.value);
    if (want.join("|") === have.join("|")) return;
    const keep = subsetPick.value;
    while (subsetPick.options.length > 1) subsetPick.remove(1);
    for (const s of want.slice(1)) subsetPick.add(new Option(s, s));
    subsetPick.value = want.includes(keep) ? keep : "";
  };

  const loadFace = async (row: HTMLElement, detail: WebFontDetail, weight: number) => {
    const name = `fp-web-${detail.source}-${detail.id}`;
    const slot = `${name}-${weight}`;
    row.style.setProperty("--web-face", `"${name}"`);
    if (faces.has(slot)) return;
    faces.add(slot);
    try {
      const data = await bridge.fontWebPreview(detail.source, detail.id, weight, false);
      const raw = atob(data);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
      const face = new FontFace(name, bytes.buffer, { weight: String(weight) });
      document.fonts.add(await face.load());
      if (row.dataset.weight === String(weight)) flag(row, "data-face-ready", true);
    } catch (e) {
      faces.delete(slot);
      put(row.querySelector("[data-field='note']"), e instanceof Error ? e.message : String(e));
    }
  };

  const pickWeight = (row: HTMLElement, detail: WebFontDetail, weight: number) => {
    row.dataset.weight = String(weight);
    row.style.setProperty("--web-weight", String(weight));
    flag(row, "data-face-ready", faces.has(`fp-web-${detail.source}-${detail.id}-${weight}`));
    row.querySelectorAll<HTMLButtonElement>("[data-weight]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.weight === String(weight))));
    void loadFace(row, detail, weight);
  };

  const fillDetail = (row: HTMLElement, detail: WebFontDetail) => {
    put(row.querySelector("[data-field='licence']"), detail.licence ? `${t("Licence")} ${detail.licence}${detail.credit ? ` · ${detail.credit}` : ""}` : t("The source does not state a licence for this family, so FormPortal does not install it."));
    const weights = Array.from(new Set(detail.faces.filter((f) => !f.italic).map((f) => f.weight)));
    const seg = row.querySelector<HTMLElement>("[data-font-web-weights]");
    if (seg && !seg.childElementCount) {
      for (const w of weights) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "seg-item";
        b.dataset.weight = String(w);
        b.textContent = String(w);
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", () => pickWeight(row, detail, w));
        seg.append(b);
      }
    }
    const install = row.querySelector<HTMLButtonElement>("[data-font-web-act='install']");
    if (install) install.disabled = !detail.installable;
    const styles = detail.faces.length === 1 ? t("1 style") : t("{n} styles", { n: detail.faces.length });
    put(
      row.querySelector("[data-field='note']"),
      detail.installable
        ? detail.subset
          ? t("{styles}, {subset} characters, licence saved beside the files", { styles, subset: detail.subset })
          : t("{styles}, licence saved beside the files", { styles })
        : detail.licence
          ? t("FormPortal installs fonts licensed OFL-1.1, Apache-2.0 or MIT.")
          : t("Not installable: no licence is stated."),
    );
    const start = weights.includes(400) ? 400 : (weights[0] ?? 400);
    if (!row.dataset.weight) pickWeight(row, detail, start);
  };

  const openDetail = async (row: HTMLElement, family: WebFontFamily, from: WebFontSource) => {
    const panel = row.querySelector<HTMLElement>("[data-font-web-detail]");
    const toggle = row.querySelector<HTMLButtonElement>("[data-font-web-act='preview']");
    if (!panel || !toggle) return;
    const open = panel.hidden;
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    put(toggle, open ? t("Close") : t("Preview"));
    if (!open) return;
    panel.querySelectorAll("[data-sample]").forEach((p) => put(p, sampleText()));
    const key = `${from}:${family.id}`;
    const known = details.get(key);
    if (known) return fillDetail(row, known);
    put(row.querySelector("[data-field='licence']"), t("Reading the licence and styles."));
    try {
      const detail = await bridge.fontWebFamily(from, family.id);
      details.set(key, detail);
      fillDetail(row, detail);
    } catch (e) {
      put(row.querySelector("[data-field='licence']"), e instanceof Error ? e.message : String(e));
    }
  };

  const stateOf = (row: HTMLElement, key: string) => {
    const have = haveOf(key).length;
    put(row.querySelector("[data-field='state']"), have ? t("Installed") : "");
    const status = have ? "all" : "none";
    if (row.dataset.have !== status) row.dataset.have = status;
  };

  const row = (family: WebFontFamily, from: WebFontSource) => {
    const key = `${from}:${family.id}`;
    let r = rows.get(key);
    if (!r) {
      r = (tpl.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
      r.dataset.webFont = key;
      r.dataset.source = from;
      put(r.querySelector("[data-field='family']"), family.family);
      const shown = family.subsets.slice(0, 3).join(", ") + (family.subsets.length > 3 ? ` +${family.subsets.length - 3}` : "");
      const weights = family.weights.length === 1 ? t("1 weight") : t("{n} weights", { n: family.weights.length });
      put(r.querySelector("[data-field='meta']"), [family.category, weights, family.italic ? t("italic") : "", shown].filter(Boolean).join(" · "));
      const it = r;
      r.querySelector("[data-font-web-act='preview']")?.addEventListener("click", () => void openDetail(it, family, from));
      r.querySelector("[data-font-web-act='remove']")?.addEventListener("click", () => void engine.dispatch("font.remove", { family: key, label: family.family }));
      r.querySelector("[data-font-web-act='install']")?.addEventListener("click", (ev) => {
        const b = ev.currentTarget as HTMLButtonElement;
        b.disabled = true;
        void bridge
          .fontWebInstall(from, family.id)
          .then(() => {
            engine.setNotice(t("{font} is installed for you. Apps see it after they restart.", { font: family.family }), "info", "library");
            return engine.dispatch("fonts.load");
          }, fault)
          .finally(() => {
            b.disabled = !details.get(key)?.installable;
          });
      });
      rows.set(key, r);
      list.append(r);
    }
    stateOf(r, key);
    return r;
  };

  const apply = () => {
    const words = (query?.value ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    const cat = pane.dataset.category ?? "all";
    const sub = subsetPick.value;
    const fams = catalogues.get(source)?.families ?? [];
    const show = new Set<string>();
    let hits = 0;
    for (const f of fams) {
      const kind = f.category === "handwriting" ? "display" : f.category;
      const hit = words.every((w) => `${f.family} ${f.category}`.toLowerCase().includes(w)) && (cat === "all" || kind === cat) && (!sub || f.subsets.includes(sub));
      if (!hit) continue;
      hits += 1;
      if (hits <= limit) {
        row(f, source);
        show.add(`${source}:${f.id}`);
      }
    }
    for (const [k, r] of rows) if (r.hidden === show.has(k)) r.hidden = !show.has(k);
    flag(more, "hidden", hits <= limit);
    const on = catalogues.get(source)?.on ?? false;
    const none = on && hits === 0 && !loading.has(source);
    flag(empty, "hidden", !none);
    put(empty, none ? t("No family in {source} matches.", { source: sourceName(source) }) : "");
    put(pane.querySelector("[data-font-web-count]"), on ? `${hits} ${hits === 1 ? "family" : "families"}` : "");
  };

  const paintMine = () => {
    const groups = new Map<string, InstalledFont[]>();
    for (const f of installed) if ((f.source === "fontsource" || f.source === "google") && f.family_id) groups.set(f.family_id, [...(groups.get(f.family_id) ?? []), f]);
    for (const [k, li] of mineRows) if (!groups.has(k)) {
      li.remove();
      mineRows.delete(k);
    }
    for (const [k, fonts] of groups) {
      let li = mineRows.get(k);
      if (!li) {
        li = document.createElement("li");
        li.className = "row font font-web-mine";
        li.innerHTML = '<span class="tile tile-font" aria-hidden="true">Aa</span><div class="row-main"><span class="row-name-text"></span><p class="row-sub"></p></div><p class="row-state"><span class="state-text"></span></p><div class="acts acts-files"><button class="btn" type="button"></button></div>';
        const label = fonts[0].family;
        li.querySelector("button")?.addEventListener("click", () => void engine.dispatch("font.remove", { family: k, label }));
        put(li.querySelector("button"), t("Remove"));
        put(li.querySelector(".state-text"), t("Installed"));
        put(li.querySelector(".row-name-text"), label);
        mineRows.set(k, li);
        mine.append(li);
      }
      const from = fonts[0].source === "google" ? "Google Fonts" : "Fontsource";
      const styles = fonts.length === 1 ? t("1 style") : t("{n} styles", { n: fonts.length });
      put(li.querySelector(".row-sub"), [t("From {source}", { source: from }), fonts[0].licence ?? "", styles].filter(Boolean).join(" · "));
    }
    const title = pane.querySelector("[data-font-web-mine-title]");
    if (title) flag(title, "hidden", groups.size === 0);
  };

  const load = async (from: WebFontSource, again = false) => {
    if (loading.has(from) || (catalogues.has(from) && !again)) return;
    loading.add(from);
    failed.delete(from);
    if (from === source) describe();
    try {
      catalogues.set(from, await bridge.fontWeb(from));
    } catch (e) {
      failed.set(from, e instanceof Error ? e.message : String(e));
    } finally {
      loading.delete(from);
    }
    if (from !== source) return;
    describe();
    subsets();
    apply();
  };

  const choose = (to: WebFontSource) => {
    source = to;
    box.dataset.source = to;
    limit = STEP;
    for (const b of pane.querySelectorAll<HTMLButtonElement>("[data-font-src]")) b.setAttribute("aria-pressed", String(b.dataset.fontSrc === to));
    describe();
    subsets();
    apply();
    void load(to);
  };

  const keys = async (work: Promise<{ provider: string; present: boolean }[]>) => {
    try {
      keyKept = (await work).some((k) => k.provider === KEY && k.present);
    } catch (e) {
      fault(e);
    }
    describe();
  };

  for (const b of pane.querySelectorAll<HTMLButtonElement>("[data-font-src]")) b.addEventListener("click", () => choose(b.dataset.fontSrc === "google" ? "google" : "fontsource"));
  for (const b of pane.querySelectorAll<HTMLButtonElement>("[data-font-cat]")) b.addEventListener("click", () => {
    limit = STEP;
    apply();
  });
  query?.addEventListener("input", () => {
    limit = STEP;
    apply();
  });
  subsetPick.addEventListener("change", () => {
    limit = STEP;
    apply();
  });
  more.addEventListener("click", () => {
    limit += STEP;
    apply();
  });
  sample.addEventListener("input", () => {
    const text = sampleText();
    list.querySelectorAll("[data-font-web-detail]:not([hidden]) [data-sample]").forEach((p) => put(p, text));
  });
  pane.querySelector("[data-font-key-save]")?.addEventListener("click", () => {
    const value = keyInput.value;
    void keys(bridge.setProviderKey(KEY, value)).then(() => {
      if (!keyKept) return;
      keyInput.value = "";
      for (const k of Array.from(details.keys())) if (k.startsWith("google:")) details.delete(k);
      void load("google", true);
    });
  });
  keyRemove.addEventListener("click", () => {
    void keys(bridge.clearProviderKey(KEY)).then(() => {
      if (keyKept) return;
      catalogues.set("google", { source: "google", on: false, families: [] });
      describe();
      subsets();
      apply();
    });
  });
  pane.querySelector("[data-font-key-get]")?.addEventListener("click", () => void bridge.openWeb(KEY_PAGE).catch(fault));

  engine.on("fonts", ({ view }) => {
    installed = view.installed;
    for (const [k, r] of rows) stateOf(r, k);
    paintMine();
    if (!catalogues.has(source)) void load(source);
  });
  void keys(bridge.providerKeys());
  describe();
}
