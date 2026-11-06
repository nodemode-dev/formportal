import { t } from "../../i18n/index.ts";
import type { Extension } from "../registry.ts";

const RAIL_KEY = "formportal.prefsRailCollapsed";
const MUTE_MS = 700;

export const prefs: Extension = {
  id: "prefs",
  setup(engine) {
    const dialog = document.querySelector<HTMLDialogElement>("[data-prefs]");
    if (!dialog) return;
    const pages = dialog.querySelector<HTMLElement>("[data-prefs-pages]");
    const nav = dialog.querySelector<HTMLElement>("[data-prefs-nav]");
    const rail = dialog.querySelector<HTMLElement>(".cv-prefs-rail");
    const head = dialog.querySelector<HTMLElement>(".cv-prefs-head");
    const foldRail = dialog.querySelector<HTMLButtonElement>("[data-prefs-rail-fold]");
    const port = dialog.querySelector<HTMLElement>(".cv-prefs-port");
    const shade = dialog.querySelector<SVGPathElement>(".cv-prefs-wire-shade");
    const line = dialog.querySelector<SVGPathElement>(".cv-prefs-wire-line");
    if (!pages || !nav || !rail || !head || !foldRail || !port || !shade || !line) return;

    const tabs = Array.from(nav.querySelectorAll<HTMLButtonElement>("[data-prefs-tab]"));
    const cards = new Map<string, HTMLElement>();
    for (const card of dialog.querySelectorAll<HTMLElement>("[data-prefs-panel]")) cards.set(card.dataset.prefsPanel ?? "", card);
    const names = Array.from(cards.keys());

    let current = names[0] ?? "general";
    let muted = 0;
    let spyFrame = 0;
    let wireFrame = 0;
    let wireD = shade.getAttribute("d") ?? "";
    let portY = -1;

    const wire = () => {
      if (wireFrame) return;
      wireFrame = requestAnimationFrame(() => {
        wireFrame = 0;
        draw();
      });
    };

    const draw = () => {
      if (!dialog.open) return;
      const tab = tabs.find((x) => x.dataset.prefsTab === current);
      const frame = dialog.getBoundingClientRect();
      if (!tab || !frame.width) return;
      const strip = nav.getBoundingClientRect();
      let at = tab.getBoundingClientRect();
      if (at.top < strip.top || at.bottom > strip.bottom) {
        nav.scrollTop += at.top < strip.top ? at.top - strip.top - 6 : at.bottom - strip.bottom + 6;
        at = tab.getBoundingClientRect();
      }
      const railBox = rail.getBoundingClientRect();
      const headBox = head.getBoundingClientRect();
      const toY = Math.round(headBox.bottom - frame.top);
      const fromX = Math.round(at.right - frame.left);
      const fromY = Math.round(at.top - frame.top + at.height / 2);
      const edge = railBox.right - frame.left;
      const trunk = Math.round(edge - edge * 0.45);
      const dy = toY - fromY;
      const r = 10;
      const dir = dy > 0 ? 1 : -1;
      const d =
        Math.abs(dy) < 2 * r
          ? `M ${fromX} ${fromY} H ${trunk} V ${toY} H -7`
          : `M ${fromX} ${fromY} H ${trunk - r} a ${r} ${r} 0 0 ${dir > 0 ? 1 : 0} ${r} ${dir * r} V ${toY - dir * r} a ${r} ${r} 0 0 ${dir > 0 ? 0 : 1} ${r} ${dir * r} H -7`;
      if (d !== wireD) {
        wireD = d;
        shade.setAttribute("d", d);
        line.setAttribute("d", d);
      }
      if (toY !== portY) {
        portY = toY;
        port.style.transform = `translateY(${toY}px)`;
      }
    };

    const mark = (name: string) => {
      if (current === name || !cards.has(name)) return;
      current = name;
      for (const [key, card] of cards) {
        const on = key === name;
        if (card.classList.contains("is-current") !== on) card.classList.toggle("is-current", on);
      }
      for (const tab of tabs) {
        const on = tab.dataset.prefsTab === name;
        if (tab.classList.contains("is-active") !== on) tab.classList.toggle("is-active", on);
        const sel = String(on);
        if (tab.getAttribute("aria-selected") !== sel) tab.setAttribute("aria-selected", sel);
      }
      wire();
    };

    const fold = (name: string, folded?: boolean) => {
      const card = cards.get(name);
      const body = card?.querySelector<HTMLElement>(".cv-prefs-secbody");
      const button = card?.querySelector<HTMLElement>(".cv-prefs-sechead");
      if (!card || !body || !button) return;
      const next = folded ?? !card.classList.contains("is-folded");
      if (card.classList.contains("is-folded") !== next) card.classList.toggle("is-folded", next);
      if (body.hidden !== next) body.hidden = next;
      button.setAttribute("aria-expanded", String(!next));
      wire();
      spy();
    };

    const scrollTo = (name: string, behavior: ScrollBehavior) => {
      const card = cards.get(name);
      if (!card) return;
      if (card.classList.contains("is-folded")) fold(name, false);
      const top = card.getBoundingClientRect().top - pages.getBoundingClientRect().top + pages.scrollTop - 12;
      muted = performance.now() + MUTE_MS;
      pages.scrollTo({ top, behavior });
    };

    const spy = () => {
      if (spyFrame) return;
      spyFrame = requestAnimationFrame(() => {
        spyFrame = 0;
        if (!pages.clientHeight || performance.now() < muted) return;
        const edge = pages.getBoundingClientRect().top + 24;
        let best = "";
        let bestD = Infinity;
        if (pages.scrollHeight > pages.clientHeight + 4 && pages.scrollTop + pages.clientHeight >= pages.scrollHeight - 2) best = names[names.length - 1] ?? "";
        else {
          for (const [key, card] of cards) {
            const top = card.getBoundingClientRect().top;
            const d = top <= edge ? edge - top : top - edge + 100000;
            if (d < bestD) {
              bestD = d;
              best = key;
            }
          }
        }
        if (best) mark(best);
      });
    };

    const show = (name: string, behavior: ScrollBehavior) => {
      if (!cards.has(name)) return;
      mark(name);
      scrollTo(name, behavior);
    };

    let collapsed = false;
    try {
      collapsed = localStorage.getItem(RAIL_KEY) === "1";
    } catch {
      collapsed = false;
    }
    const paintRail = () => {
      if (dialog.classList.contains("is-rail-collapsed") !== collapsed) dialog.classList.toggle("is-rail-collapsed", collapsed);
      const label = t(collapsed ? "Expand tabs" : "Collapse tabs");
      if (foldRail.title !== label) foldRail.title = label;
      if (foldRail.getAttribute("aria-label") !== label) foldRail.setAttribute("aria-label", label);
      foldRail.setAttribute("aria-expanded", String(!collapsed));
    };
    paintRail();
    foldRail.addEventListener("click", () => {
      collapsed = !collapsed;
      try {
        localStorage.setItem(RAIL_KEY, collapsed ? "1" : "0");
      } catch {
        engine.setNotice(t("This choice could not be saved on this computer."));
      }
      paintRail();
      wire();
    });

    for (const tab of tabs) tab.addEventListener("click", () => show(tab.dataset.prefsTab ?? "", "smooth"));
    nav.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const at = tabs.findIndex((x) => x === document.activeElement);
      if (at < 0) return;
      event.preventDefault();
      const next = tabs[(at + (event.key === "ArrowDown" ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      show(next.dataset.prefsTab ?? "", "smooth");
    });
    for (const button of dialog.querySelectorAll<HTMLElement>("[data-prefs-fold]")) button.addEventListener("click", () => fold(button.dataset.prefsFold ?? ""));

    pages.addEventListener("scroll", spy, { passive: true });
    new ResizeObserver(wire).observe(dialog);
    window.addEventListener("resize", wire);

    engine.command("prefs.open", (arg) => {
      const name = typeof arg === "string" && cards.has(arg) ? arg : "";
      if (!dialog.open) dialog.showModal();
      if (name) {
        mark(name);
        scrollTo(name, "auto");
      }
      wire();
    });

    document.querySelectorAll<HTMLButtonElement>("[data-prefs-open]").forEach((b) => b.addEventListener("click", () => void engine.dispatch("prefs.open")));
    dialog.querySelector("[data-prefs-close]")?.addEventListener("click", () => dialog.close());
    dialog.querySelector("[data-prefs-done]")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  },
};
