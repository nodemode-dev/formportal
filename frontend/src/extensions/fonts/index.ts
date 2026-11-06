import type { FontFamilyEntry, InstalledFont } from "../../engine/types.ts";
import { t } from "../../i18n/index.ts";
import type { Extension } from "../registry.ts";
import { storeNote } from "../storenote.ts";

const set = (root: HTMLElement, field: string, text: string) => {
  const node = root.querySelector<HTMLElement>(`[data-field='${field}']`);
  if (node && node.textContent !== text) node.textContent = text;
};

export const fonts: Extension = {
  id: "fonts",
  setup(engine) {
    const pane = document.querySelector<HTMLElement>("[data-pane='fonts']");
    const list = document.querySelector<HTMLElement>("[data-font-list]");
    const own = document.querySelector<HTMLElement>("[data-font-own]");
    const tpl = document.querySelector<HTMLTemplateElement>("#font-row");
    const query = document.querySelector<HTMLInputElement>("[data-fonts-query]");
    const rights = document.querySelector<HTMLDialogElement>("[data-font-rights]");
    if (!pane || !list || !own || !tpl || !rights) return;
    const rows = new Map<string, HTMLElement>();
    const ownRows = new Map<string, HTMLElement>();
    let installed: InstalledFont[] = [];
    let outdated: InstalledFont[] = [];

    const row = (family: FontFamilyEntry) => {
      let r = rows.get(family.id);
      if (!r) {
        r = (tpl.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
        r.dataset.font = family.id;
        r.dataset.category = family.category;
        r.dataset.search = `${family.family} ${family.foundry} ${family.category}`.toLowerCase();
        r.querySelector("[data-font-act='install']")?.addEventListener("click", () => void engine.dispatch("font.install", { id: family.id }));
        r.querySelector("[data-font-act='update']")?.addEventListener("click", () => void engine.dispatch("font.update", { id: family.id, family: family.family, styles: outdated.filter((f) => f.family_id === family.id).map((f) => f.style) }));
        r.querySelector("[data-font-act='remove']")?.addEventListener("click", () => void engine.dispatch("font.remove", { family: family.id, label: family.family }));
        const styles = r.querySelector<HTMLElement>("[data-font-styles]");
        for (const s of family.styles) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "drop-item menu-style";
          b.dataset.style = s.style;
          b.innerHTML = '<span class="menu-style-name"></span><span class="menu-style-act"></span>';
          (b.firstElementChild as HTMLElement).textContent = `${s.style} · ${s.weight}`;
          b.addEventListener("click", () => {
            const have = installed.some((f) => f.family_id === family.id && f.style === s.style);
            void engine.dispatch(have ? "font.remove" : "font.install", have ? { family: family.id, style: s.style, label: `${family.family} ${s.style}` } : { id: family.id, style: s.style });
          });
          styles?.append(b);
        }
        const face = family.styles.find((s) => !s.italic && s.url.startsWith("bundled:")) ?? family.styles.find((s) => s.url.startsWith("bundled:"));
        if (face && typeof FontFace !== "undefined") {
          const name = `formportal-store-${family.id}`;
          const loaded = new FontFace(name, `url("/store/${face.url.slice("bundled:".length)}")`, { weight: "100 900", style: face.italic ? "italic" : "normal" });
          void loaded.load().then((done) => {
            document.fonts.add(done);
            r?.style.setProperty("--store-face", `"${name}"`);
            r?.toggleAttribute("data-face", true);
          }, () => undefined);
        }
        rows.set(family.id, r);
        list.append(r);
      }
      const have = installed.filter((f) => f.family_id === family.id).map((f) => f.style);
      set(r, "family", family.family);
      set(r, "meta", `${family.foundry} · ${family.licence} · ${family.styles.length} ${family.styles.length === 1 ? "style" : "styles"}`);
      const newer = outdated.filter((f) => f.family_id === family.id).length;
      const state = newer ? t("Update available") : have.length === 0 ? t("Not installed") : have.length === family.styles.length ? t("Installed") : t("{n} of {all} styles", { n: have.length, all: family.styles.length });
      set(r, "state", state);
      if (r.hasAttribute("data-update") !== newer > 0) r.toggleAttribute("data-update", newer > 0);
      const status = have.length === 0 ? "none" : have.length === family.styles.length ? "all" : "some";
      if (r.dataset.have !== status) r.dataset.have = status;
      r.querySelectorAll<HTMLElement>(".menu-style").forEach((b) => {
        const on = have.includes(b.dataset.style ?? "");
        const word = on ? "Remove" : "Install";
        const act = b.querySelector<HTMLElement>(".menu-style-act");
        if (act && act.textContent !== word) act.textContent = word;
      });
      return r;
    };

    const apply = () => {
      const words = (query?.value ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
      const cat = pane.dataset.category ?? "all";
      let shown = 0;
      for (const r of rows.values()) {
        const hit = words.every((w) => (r.dataset.search ?? "").includes(w)) && (cat === "all" || r.dataset.category === cat);
        if (r.hidden === hit) r.hidden = !hit;
        if (hit) shown += 1;
      }
      const count = document.querySelector<HTMLElement>("[data-fonts-count]");
      const text = `${shown} ${shown === 1 ? "family" : "families"}`;
      if (count && count.textContent !== text) count.textContent = text;
    };

    engine.on("fonts", ({ view }) => {
      installed = view.installed;
      outdated = view.updates ?? [];
      storeNote(pane, view.store, t("Fonts"));
      for (const f of view.index?.families ?? []) row(f);
      const error = document.querySelector<HTMLElement>("[data-fonts-error]");
      if (error) {
        const text = view.index_error ? `The font index could not be read: ${view.index_error}` : "";
        if (error.textContent !== text) error.textContent = text;
        if (error.hidden === Boolean(text)) error.hidden = !text;
      }
      const mine = view.installed.filter((f) => f.source === "own");
      const keep = new Set(mine.map((f) => f.file));
      for (const [k, r] of ownRows) if (!keep.has(k)) {
        r.remove();
        ownRows.delete(k);
      }
      for (const f of mine) {
        if (ownRows.has(f.file)) continue;
        const li = document.createElement("li");
        li.className = "row font";
        li.innerHTML = '<span class="tile tile-font" aria-hidden="true">Aa</span><div class="row-main"><span class="row-name-text"></span><p class="row-sub mono"></p></div><p class="row-state"><span class="state-text">Your own</span></p><div class="acts acts-files"><button class="btn" type="button">Remove</button></div>';
        (li.querySelector(".row-name-text") as HTMLElement).textContent = f.family;
        (li.querySelector(".row-sub") as HTMLElement).textContent = f.file;
        li.querySelector("button")?.addEventListener("click", () => void engine.dispatch("font.remove", { family: f.family, label: f.family }));
        ownRows.set(f.file, li);
        own.append(li);
      }
      const empty = document.querySelector<HTMLElement>("[data-font-own-empty]");
      if (empty && empty.hidden !== mine.length > 0) empty.hidden = mine.length > 0;
      apply();
      pane.toggleAttribute("data-ready", true);
    });

    query?.addEventListener("input", apply);
    const cats = Array.from(pane.querySelectorAll<HTMLButtonElement>("[data-font-cat]"));
    for (const b of cats) {
      b.addEventListener("click", () => {
        pane.dataset.category = b.dataset.fontCat ?? "all";
        for (const o of cats) o.setAttribute("aria-pressed", String(o === b));
        apply();
      });
    }

    const ok = rights.querySelector<HTMLInputElement>("[data-font-rights-ok]");
    const add = rights.querySelector<HTMLButtonElement>("[data-font-rights-add]");
    let picked = "";
    ok?.addEventListener("change", () => {
      if (add) add.disabled = !ok.checked;
    });
    engine.command("font.ownConfirm", (arg) => {
      picked = String(arg);
      const where = rights.querySelector<HTMLElement>("[data-font-rights-path]");
      if (where) where.textContent = picked;
      if (ok) ok.checked = false;
      if (add) add.disabled = true;
      if (!rights.open) rights.showModal();
    });
    add?.addEventListener("click", () => {
      rights.close();
      void engine.dispatch("font.add", { path: picked, rights: Boolean(ok?.checked) });
    });
    rights.querySelector("[data-font-rights-cancel]")?.addEventListener("click", () => rights.close());
    document.querySelector("[data-font-own-add]")?.addEventListener("click", () => void engine.dispatch("font.pick"));
    engine.on("route", ({ route }) => {
      if (route === "fonts") void engine.dispatch("fonts.load");
    });
  },
};
