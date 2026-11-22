import registry from "../../../../catalog/products.json";
import { pickBridge } from "../../bridge/index.ts";
import type { Engine } from "../../engine/index.ts";
import type { SupporterTile, SupporterView, UpcomingView } from "../../engine/types.ts";
import { language, t } from "../../i18n/index.ts";
import type { Extension } from "../registry.ts";
import { UNDATED } from "../live/index.ts";
import { upcomingOnce } from "../live/soon.ts";

const NAMES_KEY = "formportal.site";
const LIVE_KEY = "formportal.live";
const MOST = 40;

const stamp = (text: string | null): number => (text ? Date.parse(text) : Number.NaN);
const PRODUCTS: { id: string; name: string; alt_of?: string }[] = registry.products;
const fold = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");
const known = (name: string) => PRODUCTS.find((p) => fold(p.name) === fold(name) || p.id === fold(name));

export const supporter: Extension = {
  id: "supporter",
  setup(engine: Engine) {
    const bridge = pickBridge();
    const root = document.documentElement;
    const box = document.querySelector<HTMLElement>("[data-supporter]");
    const input = box?.querySelector<HTMLInputElement>("[data-supporter-input]") ?? null;
    const check = box?.querySelector<HTMLButtonElement>("[data-supporter-check]") ?? null;
    const forget = box?.querySelector<HTMLButtonElement>("[data-supporter-forget]") ?? null;
    const say = box?.querySelector<HTMLElement>("[data-supporter-say]") ?? null;
    const extra = document.querySelector<HTMLElement>("[data-soon-extra]");
    const fallback = new WeakMap<Element, string>();

    const put = (node: Element | null, text: string) => {
      if (node && node.textContent !== text) node.textContent = text;
    };
    const attr = (node: Element | null, name: string, value: string) => {
      if (node && node.getAttribute(name) !== value) node.setAttribute(name, value);
    };

    const faces = document.querySelector<HTMLTemplateElement>("[data-soon-faces]")?.content ?? null;
    const slot = (tile: Element, cls: string, after: Element | null): HTMLElement => {
      const have = tile.querySelector<HTMLElement>(`:scope > .${cls}`);
      if (have) return have;
      const made = document.createElement("span");
      made.className = cls;
      if (after) after.after(made);
      else tile.append(made);
      return made;
    };
    const face = (tile: HTMLElement, id: string) => {
      if ((tile.dataset.face ?? "") === id) return;
      tile.querySelector(":scope > .soon-face")?.remove();
      const art = id ? faces?.querySelector(`[data-face="${id}"]`) : null;
      if (art) tile.querySelector(".soon-mark")?.after(art.cloneNode(true));
      if (art) tile.dataset.face = id;
      else delete tile.dataset.face;
    };
    const names = (group: Element | null, list: string[]) => {
      const nodes = Array.from(group?.querySelectorAll<HTMLElement>(".soon-name") ?? []);
      nodes.forEach((node, i) => {
        if (!fallback.has(node)) fallback.set(node, node.textContent ?? "");
        const tile = node.closest<HTMLElement>(".soon-tile");
        const given = list[i];
        const app = given === undefined ? undefined : known(given);
        put(node, given ?? fallback.get(node) ?? "");
        if (!tile) return;
        face(tile, app?.id ?? "");
        const line = app ? (app.alt_of ? t("Instead of {x}", { x: app.alt_of }) : t("A FormAI original")) : "";
        if (line || tile.querySelector(":scope > .soon-line")) put(slot(tile, "soon-line", node), line);
      });
    };

    const place = (tiles: SupporterTile[]) => {
      for (const group of document.querySelectorAll<HTMLElement>("[data-soon-at]")) {
        const when = stamp(group.getAttribute("data-soon-at"));
        names(
          group,
          tiles.filter((tile) => tile.at !== null && stamp(tile.at) === when).map((tile) => tile.name),
        );
      }
      names(
        extra,
        tiles.filter((tile) => tile.at === null).map((tile) => tile.name),
      );
    };

    const remember = (tiles: SupporterTile[]) => {
      try {
        if (tiles.length) localStorage.setItem(NAMES_KEY, JSON.stringify(tiles));
        else localStorage.removeItem(NAMES_KEY);
      } catch {}
    };

    const more = (view: UpcomingView) => {
      const n = Math.max(0, Math.min(MOST, Math.max(view.known ? view.undated : 0, UNDATED)));
      attr(root, "data-soon-more", String(n));
      try {
        const kept = JSON.parse(localStorage.getItem(LIVE_KEY) ?? "null");
        if (kept && typeof kept === "object" && kept.more !== n) localStorage.setItem(LIVE_KEY, JSON.stringify({ ...kept, more: n }));
      } catch {}
    };

    const date = (until: string | null): string => {
      const at = stamp(until);
      return Number.isNaN(at) ? "" : new Date(at).toLocaleDateString(language(), { day: "numeric", month: "long", year: "numeric" });
    };

    const show = (view: SupporterView) => {
      let text = t("Not set");
      if (view.state === "supporter") text = t("Supporter until {date}. Upcoming Form apps show their names.", { date: date(view.until) });
      else if (view.state === "no") text = t("That code is not a supporter code.");
      else if (view.state === "unreachable") text = t("formai.studio cannot be reached; the last answer is kept.");
      if (view.stale && view.state !== "unreachable") text = `${text} ${t("formai.studio cannot be reached; the last answer is kept.")}`;
      put(say, text);
      attr(say, "data-state", view.state);
    };

    const busy = (on: boolean) => {
      if (on) put(say, t("Checking"));
      for (const button of [check, forget]) if (button && button.disabled !== on) button.disabled = on;
      if (box && box.getAttribute("aria-busy") !== String(on)) box.setAttribute("aria-busy", String(on));
    };

    const apply = (view: SupporterView) => {
      show(view);
      if (view.state === "unreachable") return;
      const tiles = view.state === "supporter" ? view.upcoming : [];
      place(tiles);
      remember(tiles);
    };

    const keepPrefs = async () => {
      try {
        engine.setPrefs(await bridge.preferences());
      } catch {}
    };

    const run = async (code: string | null) => {
      busy(true);
      try {
        const view = await bridge.supporterCheck(code);
        apply(view);
        if (input && view.state !== "no" && input.value !== "") input.value = "";
        await keepPrefs();
      } catch {
        put(say, t("formai.studio cannot be reached; the last answer is kept."));
      } finally {
        busy(false);
      }
    };

    try {
      const kept = JSON.parse(localStorage.getItem(NAMES_KEY) ?? "null");
      if (Array.isArray(kept)) place(kept.filter((tile): tile is SupporterTile => typeof tile?.name === "string" && (tile.at === null || typeof tile.at === "string")));
    } catch {}

    check?.addEventListener("click", () => void run(input && input.value.trim() !== "" ? input.value.trim() : null));
    forget?.addEventListener("click", () => {
      if (input) input.value = "";
      void run("");
    });
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        check?.click();
      }
    });

    void (async () => {
      try {
        more(await upcomingOnce());
      } catch {}
      try {
        apply(await bridge.supporterCheck(null));
      } catch {}
    })();
  },
};
