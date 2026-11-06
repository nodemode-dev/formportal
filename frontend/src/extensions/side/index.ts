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

    label();
  },
};
