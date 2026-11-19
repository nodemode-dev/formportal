import { t } from "../../i18n/index.ts";
import type { Extension } from "../registry.ts";

const WIDTH = "formportal.side";
const RAIL = "formportal.rail";
const MIN = 180;
const MAX = 360;
const SNAP = 120;

export const side: Extension = {
  id: "side",
  setup() {
    const root = document.documentElement;
    const edge = document.querySelector<HTMLElement>("[data-side-edge]");
    const fold = document.querySelector<HTMLButtonElement>("[data-side-fold]");
    const nav = document.querySelector<HTMLElement>(".side");
    if (!edge || !fold || !nav) return;

    const mini = () => root.getAttribute("data-rail") === "mini";
    const keep = () => {
      try {
        localStorage.setItem(RAIL, mini() ? "mini" : "full");
        const w = root.style.getPropertyValue("--side-w").trim();
        if (w) localStorage.setItem(WIDTH, String(parseInt(w, 10)));
      } catch {
        return;
      }
    };
    const label = () => {
      const say = mini() ? t("Expand the side panel") : t("Collapse the side panel");
      if (fold.getAttribute("aria-label") !== say) {
        fold.setAttribute("aria-label", say);
        fold.title = say;
      }
      fold.setAttribute("aria-expanded", String(!mini()));
    };
    const setMini = (on: boolean) => {
      if (mini() === on) return;
      if (on) root.setAttribute("data-rail", "mini");
      else root.removeAttribute("data-rail");
      label();
    };

    fold.addEventListener("click", () => {
      setMini(!mini());
      keep();
    });

    edge.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const x0 = event.clientX;
      const start = mini() ? 64 : nav.getBoundingClientRect().width;
      edge.setPointerCapture(event.pointerId);
      root.setAttribute("data-side-drag", "");
      const move = (ev: PointerEvent) => {
        const raw = start + ev.clientX - x0;
        if (raw < SNAP) {
          setMini(true);
          return;
        }
        setMini(false);
        root.style.setProperty("--side-w", `${Math.round(Math.max(MIN, Math.min(MAX, raw)))}px`);
      };
      const up = () => {
        root.removeAttribute("data-side-drag");
        edge.removeEventListener("pointermove", move);
        edge.removeEventListener("pointerup", up);
        edge.removeEventListener("pointercancel", up);
        keep();
      };
      edge.addEventListener("pointermove", move);
      edge.addEventListener("pointerup", up);
      edge.addEventListener("pointercancel", up);
    });

    edge.addEventListener("dblclick", () => {
      setMini(!mini());
      keep();
    });

    edge.tabIndex = 0;
    edge.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const now = mini() ? 64 : nav.getBoundingClientRect().width;
      const next = now + (event.key === "ArrowRight" ? 16 : -16);
      if (next < SNAP) setMini(true);
      else {
        setMini(false);
        root.style.setProperty("--side-w", `${Math.round(Math.max(MIN, Math.min(MAX, next)))}px`);
      }
      keep();
    });

    const mine = nav.querySelector<HTMLElement>(".nav-mine");
    if (mine) {
      const more = () => {
        const above = mine.scrollTop > 1;
        const below = mine.scrollTop + mine.clientHeight < mine.scrollHeight - 1;
        const say = above && below ? "both" : above ? "above" : below ? "below" : "";
        if ((mine.dataset.more ?? "") === say) return;
        if (say) mine.dataset.more = say;
        else delete mine.dataset.more;
      };
      const rows = Array.from(mine.children) as HTMLElement[];
      let turned = 0;
      const turn = (count: number) => {
        let at = 0;
        for (const row of rows) {
          const want = row.offsetParent !== null && at++ < count ? "1" : "";
          if (row.style.order !== want) row.style.order = want;
        }
        turned = count;
      };
      const wrap = () => {
        const shown = rows.filter((row) => row.offsetParent !== null);
        const look = getComputedStyle(mine);
        const pitch = shown.length > 1 ? shown[0].offsetHeight + (Number.parseFloat(look.rowGap) || 0) : 0;
        const reach = mine.scrollHeight - mine.clientHeight;
        const slack = Math.min(pitch, (reach - pitch) / 2);
        if (pitch <= 0 || slack < 4) {
          if (turned) turn(0);
          if (mine.hasAttribute("data-wrap")) mine.removeAttribute("data-wrap");
          return;
        }
        const starting = !mine.hasAttribute("data-wrap");
        if (starting) mine.setAttribute("data-wrap", "");
        const count = shown.length;
        let top = starting && mine.scrollTop < 1 ? -(Number.parseFloat(look.getPropertyValue("--sp-5")) || 0) : mine.scrollTop;
        let next = turned % count;
        if (top > reach - slack || top < slack) {
          const steps = Math.round((top - reach / 2) / pitch) || (top < slack ? -1 : 1);
          next = (((next + steps) % count) + count) % count;
          top -= steps * pitch;
        }
        if (next === turned && !starting) return;
        turn(next);
        mine.scrollTop = top;
      };
      const settle = () => {
        wrap();
        more();
      };
      mine.addEventListener("scroll", settle, { passive: true });
      const watch = new ResizeObserver(settle);
      watch.observe(mine);
      for (const row of rows) watch.observe(row);
      settle();
    }

    label();
  },
};
