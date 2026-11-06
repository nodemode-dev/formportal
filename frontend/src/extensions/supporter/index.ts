import { pickBridge } from "../../bridge/index.ts";
import type { Engine } from "../../engine/index.ts";
import type { SupporterTile, SupporterView, UpcomingView } from "../../engine/types.ts";
import { language, t } from "../../i18n/index.ts";
import type { Extension } from "../registry.ts";

const NAMES_KEY = "formportal.site";
const LIVE_KEY = "formportal.live";
const MOST = 40;

const stamp = (text: string | null): number => (text ? Date.parse(text) : Number.NaN);

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
    const dated = Array.from(document.querySelectorAll<HTMLElement>("[data-soon-group][data-soon-at]"));
    const extra = document.querySelector<HTMLElement>("[data-soon-extra]");
    const fallback = new WeakMap<Element, string>();

    const put = (node: Element | null, text: string) => {
      if (node && node.textContent !== text) node.textContent = text;
    };
    const attr = (node: Element | null, name: string, value: string) => {
      if (node && node.getAttribute(name) !== value) node.setAttribute(name, value);
    };

    const names = (group: Element | null, list: string[]) => {
      const nodes = Array.from(group?.querySelectorAll<HTMLElement>(".soon-name") ?? []);
      nodes.forEach((node, i) => {
        if (!fallback.has(node)) fallback.set(node, node.textContent ?? "");
        put(node, list[i] ?? fallback.get(node) ?? "");
      });
    };

    const place = (tiles: SupporterTile[]) => {
      for (const group of dated) {
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
      if (!view.known) return;
      const n = Math.max(0, Math.min(MOST, view.undated + view.supporters));
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
        more(await bridge.siteUpcoming());
      } catch {}
      try {
        apply(await bridge.supporterCheck(null));
      } catch {}
    })();
  },
};
