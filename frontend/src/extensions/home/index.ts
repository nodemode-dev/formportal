import { t } from "../../i18n/index.ts";
import type { Channel } from "../../engine/types.ts";
import type { Extension } from "../registry.ts";
import { liveNow } from "../live/index.ts";

const write = (node: Element | null, text: string) => {
  if (node && node.textContent !== text) node.textContent = text;
};

export const home: Extension = {
  id: "home",
  setup(engine) {
    const root = document.documentElement;
    const greet = document.querySelector("[data-greeting]");
    const count = document.querySelector("[data-family-count]");
    const family = document.querySelector<HTMLElement>("[data-family]");
    const say = document.querySelector<HTMLElement>("[data-drop-say]");
    const appsSay = document.querySelector("[data-apps-say]");
    const slots = Array.from(document.querySelectorAll<HTMLElement>(".dk[data-slot]"));
    const waves = Array.from(document.querySelectorAll<HTMLElement>(".wave"));
    const allButton = document.querySelector<HTMLButtonElement>("[data-install-all]");
    const restSay = say?.textContent ?? "";
    let map: Record<string, string> = {};
    try {
      map = JSON.parse(family?.dataset.fileApps ?? "{}") as Record<string, string>;
    } catch {
      map = {};
    }

    const hour = new Date().getHours();
    write(greet, hour < 5 ? t("Good evening") : hour < 12 ? t("Good morning") : hour < 18 ? t("Good afternoon") : t("Good evening"));

    const apps = (n: number) => (n === 1 ? t("1 app") : t("{n} apps", { n }));
    const left = () => Number(root.getAttribute("data-soon-left")) || 0;
    const counts = () => {
      const live = slots.filter((s) => liveNow(s.dataset.slot ?? "")).length;
      let next = "";
      for (const wave of waves) {
        const at = wave.dataset.soonAt;
        const i = wave.dataset.soonGroup;
        const n = i === undefined ? Number(root.getAttribute("data-soon-more")) || 0 : Number(root.getAttribute(`data-soon-g${i}`)) || 0;
        write(wave.querySelector("[data-wave-n]"), apps(n));
        if (!next && at && n > 0 && Date.parse(at) > Date.now()) {
          const day = new Date(at).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
          next = t("next {n} open {day}", { n, day }).toUpperCase();
        }
      }
      write(count, [t("{live} of {total} out", { live, total: slots.length }).toUpperCase(), next].filter(Boolean).join(" · "));
      write(appsSay, left() ? t("{live} Form apps are out. {left} more open on the dates shown on Home.", { live, left: left() }) : t("{live} Form apps are out.", { live }));
    };
    const observer = new MutationObserver(counts);
    observer.observe(root, { attributes: true, attributeFilter: ["data-live", "data-soon-left", "data-soon-more"] });
    counts();

    const blank = document.querySelector(".soon-name")?.textContent ?? "";
    const named = () => {
      for (const node of document.querySelectorAll<HTMLElement>(".seal .soon-name")) {
        const tile = node.closest(".seal");
        const has = (node.textContent ?? "") !== blank;
        if (tile && tile.hasAttribute("data-named") !== has) tile.toggleAttribute("data-named", has);
      }
    };
    const waveList = document.querySelector(".waves");
    if (waveList) new MutationObserver(named).observe(waveList, { subtree: true, childList: true, characterData: true });
    named();

    const installable = () =>
      slots
        .map((s) => s.dataset.slot ?? "")
        .filter((id) => liveNow(id) && engine.view(id, "stable").availability === "available" && !engine.installs.has(engine.key(id, "stable")) && !engine.blocked(id, "stable"));
    const paintAll = () => {
      if (!allButton) return;
      const none = installable().length === 0;
      if (allButton.disabled !== none) allButton.disabled = none;
    };
    engine.on("install", paintAll);
    engine.on("source", paintAll);
    allButton?.addEventListener("click", async () => {
      allButton.disabled = true;
      for (const product of installable()) await engine.dispatch("app.install", { product, channel: "stable" as Channel });
      paintAll();
    });

    const get = document.querySelector<HTMLElement>("[data-get]");
    const pills = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-get-show]"));
    for (const pill of pills) {
      pill.addEventListener("click", () => {
        if (get) get.dataset.get = pill.dataset.getShow ?? "all";
        for (const other of pills) other.setAttribute("aria-pressed", String(other === pill));
      });
    }

    for (const pane of document.querySelectorAll<HTMLElement>(".pane-app")) {
      const tabs = Array.from(pane.querySelectorAll<HTMLButtonElement>("[data-tab-to]"));
      const show = (name: string) => {
        if (pane.dataset.tab !== name) pane.dataset.tab = name;
        for (const tab of tabs) tab.setAttribute("aria-selected", String(tab.dataset.tabTo === name));
      };
      for (const tab of tabs) tab.addEventListener("click", () => show(tab.dataset.tabTo ?? "overview"));
      show("overview");
    }
    engine.on("agents", ({ product, view }) => {
      const pane = document.querySelector<HTMLElement>(`.pane-app[data-product="${product}"]`);
      pane?.toggleAttribute("data-mcp", Boolean(view.surface));
    });

    const keyHint = document.querySelector("[data-search-key]");
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    write(keyHint, mac ? "⌘K" : "Ctrl K");
    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("[data-search]")?.focus();
      }
    });

    let rest = 0;
    const tell = (text: string) => {
      write(say, text);
      window.clearTimeout(rest);
      rest = window.setTimeout(() => write(say, restSay), 9000);
    };
    engine.on("filedrop", ({ paths, phase }) => {
      if (phase !== "drop") {
        family?.toggleAttribute("data-drop-over", phase === "over");
        return;
      }
      family?.removeAttribute("data-drop-over");
      const path = paths[0];
      if (!path) return;
      const file = path.split(/[\\/]/).pop() ?? path;
      const ext = file.includes(".") ? (file.split(".").pop() ?? "").toLowerCase() : "";
      const product = map[ext];
      if (!product) {
        tell(t("No Form app opens .{ext} files yet.", { ext: ext || "?" }));
        return;
      }
      if (!liveNow(product)) {
        tell(t("{file} opens in a Form app that is not out yet.", { file }));
        return;
      }
      const name = engine.name(product);
      const installed = engine.installs.has(engine.key(product, "stable"));
      if (installed && /[\\/]/.test(path)) {
        tell(t("Opening {file} in {app}.", { file, app: name }));
        void engine.dispatch("file.open", { path, product });
        return;
      }
      tell(installed ? t("{file} opens in {app}.", { file, app: name }) : t("{app} opens {file}. Install it, then drop the file again.", { app: name, file }));
      void engine.dispatch("route.go", `app-${product}`);
    });
  },
};
