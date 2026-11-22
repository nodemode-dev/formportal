import { t } from "../../i18n/index.ts";
import type { Extension } from "../registry.ts";
import { Wheel } from "./wheel.ts";

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
    let railed = () => {};
    const setMini = (on: boolean) => {
      if (mini() === on) return;
      if (on) root.setAttribute("data-rail", "mini");
      else root.removeAttribute("data-rail");
      label();
      railed();
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

    const WAIT = 1670;
    const PICK = ".nav-item, .soc-link";
    const tip = document.createElement("div");
    tip.className = "side-tip";
    tip.id = "side-tip";
    tip.setAttribute("role", "tooltip");
    document.body.append(tip);
    const targets = Array.from(nav.querySelectorAll<HTMLElement>(PICK));
    const lent = new Set<HTMLElement>();
    for (const el of targets) {
      if (el.title) {
        el.dataset.tip = el.title;
        el.removeAttribute("title");
      }
      if (!el.hasAttribute("aria-label") && el.dataset.tip) lent.add(el);
    }
    const names = () => {
      for (const el of lent) {
        if (mini()) el.setAttribute("aria-label", el.dataset.tip ?? "");
        else el.removeAttribute("aria-label");
      }
    };
    const eligible = (el: HTMLElement | null) => (el && nav.contains(el) && el.dataset.tip && (mini() || el.classList.contains("soc-link")) ? el : null);
    const at = (x: number, y: number) => eligible((document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>(PICK) ?? null);
    let over: HTMLElement | null = null;
    let shown: HTMLElement | null = null;
    let timer = 0;
    let px = -1;
    let py = -1;
    const hide = () => {
      window.clearTimeout(timer);
      timer = 0;
      if (!shown) return;
      shown.removeAttribute("aria-describedby");
      shown = null;
      tip.removeAttribute("data-on");
    };
    const show = (el: HTMLElement) => {
      const box = el.getBoundingClientRect();
      const say = el.dataset.tip ?? "";
      if (tip.textContent !== say) tip.textContent = say;
      tip.style.setProperty("--tx", `${Math.round(box.right + 8)}px`);
      tip.style.setProperty("--ty", `${Math.round(box.top + box.height / 2)}px`);
      tip.setAttribute("data-on", "");
      el.setAttribute("aria-describedby", tip.id);
      shown = el;
    };
    let wheels: Wheel[] = [];
    const still = () => !wheels.some((w) => w.busy);
    const arm = () => {
      window.clearTimeout(timer);
      timer = 0;
      const el = over;
      if (!el || !still()) return;
      timer = window.setTimeout(() => {
        timer = 0;
        if (over === el && still() && el.isConnected) show(el);
      }, WAIT);
    };
    const rested = () => {
      over = px >= 0 ? at(px, py) : null;
      arm();
    };
    nav.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      px = event.clientX;
      py = event.clientY;
      const el = eligible((event.target as HTMLElement).closest<HTMLElement>(PICK));
      if (el === over) return;
      hide();
      over = el;
      arm();
    });
    nav.addEventListener("pointerleave", () => {
      over = null;
      px = py = -1;
      hide();
    });
    nav.addEventListener("pointerdown", hide);
    let calm = 0;
    nav.addEventListener(
      "scroll",
      () => {
        hide();
        window.clearTimeout(calm);
        calm = window.setTimeout(rested, 150);
      },
      { passive: true },
    );
    nav.addEventListener("focusin", (event) => {
      const el = eligible((event.target as HTMLElement).closest<HTMLElement>(PICK));
      if (!el || !el.matches(":focus-visible")) return;
      hide();
      show(el);
    });
    nav.addEventListener("focusout", hide);

    const mine = nav.querySelector<HTMLElement>(".nav-mine");
    const rows = mine ? (Array.from(mine.children) as HTMLElement[]) : [];
    const fade = () => (mine ? Number.parseFloat(getComputedStyle(mine).getPropertyValue("--sp-5")) || 0 : 0);
    const apps = mine ? new Wheel(mine, rows, { centred: false, snap: false, lead: fade, onMove: hide, onRest: rested }) : null;
    const socBox = nav.querySelector<HTMLElement>("[data-soc-wheel]");
    const soc = socBox ? new Wheel(socBox, Array.from(socBox.children) as HTMLElement[], { centred: true, snap: true, onMove: hide, onRest: rested }) : null;
    wheels = [apps, soc].filter((w): w is Wheel => w !== null);
    const settle = () => {
      for (const w of wheels) w.measure();
    };
    railed = () => {
      hide();
      over = null;
      names();
      soc?.enable(mini());
      soc?.home();
      settle();
    };
    soc?.enable(mini());
    names();
    const watch = new ResizeObserver(settle);
    if (mine) watch.observe(mine);
    for (const row of rows) watch.observe(row);
    if (socBox) watch.observe(socBox);
    settle();

    label();
  },
};
