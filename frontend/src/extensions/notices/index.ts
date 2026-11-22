import type { NoticeCategory } from "../../engine/types.ts";
import type { NoticeAction } from "../../engine/index.ts";
import { t } from "../../i18n/index.ts";
import type { Extension } from "../registry.ts";
import hues from "../../../../design/app-hues.json";

const KEEP = 30;
const SHOW_MS = 5000;
const STACK = 3;
const MONO = 24;
const SHORTEN = 40;
const ROW = /^(.+) (\S+) → (\S+)$/;
const SVG = "http://www.w3.org/2000/svg";

const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const arrow = (path: string) => {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(SVG, "path");
  p.setAttribute("d", path);
  p.setAttribute("fill", "none");
  p.setAttribute("stroke", "currentColor");
  p.setAttribute("stroke-width", "1.6");
  p.setAttribute("stroke-linecap", "round");
  p.setAttribute("stroke-linejoin", "round");
  svg.append(p);
  return svg;
};

const words = (into: HTMLElement, line: string, short: boolean) => {
  for (const part of line.split(/(\s+)/)) {
    const m = /^(\S*?)([.,;:)]*)$/.exec(part);
    const word = m?.[1] ?? part;
    if (word.length < MONO) {
      into.append(part);
      continue;
    }
    const code = document.createElement("code");
    code.className = "notice-val";
    if (short && word.length > SHORTEN) {
      code.textContent = `${word.slice(0, 10)}…${word.slice(-8)}`;
      code.title = word;
    } else code.textContent = word;
    into.append(code, m?.[2] ?? "");
  }
};

const fill = (into: HTMLElement, text: string, fault: boolean, short: boolean) => {
  const lines = text
    .split("\n")
    .flatMap((l) => (fault ? l.split(/(?<=[.!?])\s+(?=\p{Lu})/u) : [l]))
    .map((l) => l.trim())
    .filter(Boolean);
  let rows: HTMLElement | null = null;
  for (const line of lines) {
    const row = ROW.exec(line);
    if (row) {
      if (!rows) {
        rows = document.createElement("span");
        rows.className = "notice-rows";
        into.append(rows);
      }
      const r = document.createElement("span");
      r.className = "notice-row";
      for (const [cls, value] of [["notice-app", row[1]], ["notice-from", row[2]], ["", ""], ["notice-to", row[3]]] as const) {
        const cell = document.createElement("span");
        if (cls) {
          cell.className = cls;
          cell.textContent = value;
        } else cell.append(arrow("M3 8h9M8.5 4.5 12 8l-3.5 3.5"));
        r.append(cell);
      }
      rows.append(r);
      continue;
    }
    rows = null;
    const span = document.createElement("span");
    span.className = "notice-line";
    words(span, fault && !/[.!?:]$/.test(line) ? `${line}.` : line, short);
    into.append(span);
  }
  return lines.filter((l) => ROW.test(l)).length;
};

export const notices: Extension = {
  id: "notices",
  setup(engine) {
    const root = document.documentElement;
    const bell = document.querySelector<HTMLButtonElement>("[data-bell]");
    const panel = document.querySelector<HTMLElement>("[data-bell-panel]");
    const list = document.querySelector<HTMLOListElement>("[data-bell-list]");
    const toasts = document.getElementById("toast-root");
    if (!bell || !panel || !list || !toasts) return;

    const open = (on: boolean) => {
      if (panel.hidden === !on) return;
      if (!on && panel.contains(document.activeElement)) bell.focus();
      panel.hidden = !on;
      bell.setAttribute("aria-expanded", String(on));
      if (on) root.removeAttribute("data-unread");
    };
    bell.addEventListener("click", (event) => {
      event.stopPropagation();
      open(panel.hidden !== false);
    });
    document.addEventListener("click", (event) => {
      if (!panel.hidden && !panel.contains(event.target as Node)) open(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") open(false);
    });
    document.querySelector("[data-bell-clear]")?.addEventListener("click", () => {
      list.replaceChildren();
      root.removeAttribute("data-unread");
    });

    const named = Object.keys(hues)
      .filter((id) => id !== "formai")
      .map((id) => ({ id, name: engine.name(id) }))
      .filter((a) => a.name && a.name !== a.id)
      .sort((a, b) => b.name.length - a.name.length);
    const appOf = (text: string) => {
      let best: { id: string; at: number } | null = null;
      for (const a of named) {
        const at = text.indexOf(a.name);
        if (at >= 0 && (!best || at < best.at)) best = { id: a.id, at };
      }
      return best?.id ?? null;
    };

    const leave = (item: HTMLElement, now = false) => {
      if (item.dataset.leaving !== undefined) return;
      item.dataset.leaving = "";
      window.clearTimeout(Number(item.dataset.timer));
      if (item.contains(document.activeElement)) bell.focus({ preventScroll: true });
      const gone = () => item.remove();
      if (now && still()) return gone();
      const fade = item.animate([{ opacity: 1 }, { opacity: 0, transform: still() ? "none" : "translateY(6px)" }], { duration: 160, easing: "ease-in", fill: "forwards" });
      fade.onfinish = () => {
        if (still() || !item.previousElementSibling) return gone();
        const gap = parseFloat(getComputedStyle(toasts).rowGap) || 0;
        item.style.overflow = "hidden";
        item.animate([{ blockSize: `${item.offsetHeight}px`, marginBlockStart: "0px" }, { blockSize: "0px", paddingBlock: "0px", borderWidth: "0px", marginBlockStart: `${-gap}px` }], { duration: 160, easing: "ease-out", fill: "forwards" }).onfinish = gone;
      };
    };

    const toast = (text: string, tone: "info" | "fault", action?: NoticeAction) => {
      const item = document.createElement("div");
      item.className = "toast";
      item.dataset.tone = tone;
      item.setAttribute("role", tone === "fault" ? "alert" : "status");
      const body = document.createElement("p");
      const listed = fill(body, text, tone === "fault", true);
      const app = tone === "fault" || listed > 1 ? null : appOf(text);
      if (app) {
        item.dataset.app = app;
        item.style.setProperty("--hue", (hues as Record<string, string>)[app] ?? "");
      }
      const more = document.createElement("span");
      more.className = "toast-more";
      more.append(arrow("M4 6l4 4 4-4"));
      const close = document.createElement("button");
      close.type = "button";
      close.className = "toast-close";
      close.setAttribute("aria-label", t("Dismiss"));
      close.textContent = t("Dismiss");
      close.addEventListener("click", () => leave(item, true));
      item.append(body);
      if (action) {
        const act = document.createElement("button");
        act.type = "button";
        act.className = "toast-act";
        act.textContent = action.label;
        act.addEventListener("click", () => {
          leave(item, true);
          void engine.dispatch(action.command, action.arg);
        });
        item.append(act);
      }
      item.append(close, more);
      const rest = () => {
        const on = body.scrollTop + body.clientHeight < body.scrollHeight - 1;
        if (item.hasAttribute("data-more") !== on) item.toggleAttribute("data-more", on);
      };
      body.addEventListener("scroll", rest, { passive: true });
      const arm = () => {
        window.clearTimeout(Number(item.dataset.timer));
        item.dataset.timer = String(window.setTimeout(() => leave(item), SHOW_MS));
      };
      const hold = () => window.clearTimeout(Number(item.dataset.timer));
      item.addEventListener("pointerenter", hold);
      item.addEventListener("pointerleave", () => {
        if (!item.contains(document.activeElement)) arm();
      });
      item.addEventListener("focusin", hold);
      item.addEventListener("focusout", (event) => {
        if (!item.contains(event.relatedTarget as Node | null) && !item.matches(":hover")) arm();
      });
      toasts.prepend(item);
      if (body.scrollHeight > body.clientHeight + 1) body.tabIndex = 0;
      rest();
      const live = Array.from(toasts.children).filter((c) => (c as HTMLElement).dataset.leaving === undefined) as HTMLElement[];
      for (const old of live.slice(STACK)) leave(old);
      if (!still()) item.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 200, easing: "ease-out" });
      else item.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120 });
      arm();
    };

    let showing = "all";
    const cats = Array.from(panel.querySelectorAll<HTMLButtonElement>("[data-bell-cat]"));
    const filter = () => {
      for (const item of Array.from(list.children) as HTMLElement[]) {
        const hide = showing !== "all" && item.dataset.cat !== showing;
        if (item.hidden !== hide) item.hidden = hide;
      }
    };
    for (const b of cats) {
      b.addEventListener("click", (event) => {
        event.stopPropagation();
        showing = b.dataset.bellCat ?? "all";
        for (const o of cats) o.setAttribute("aria-pressed", String(o === b));
        filter();
      });
    }
    const quietBoxes = Array.from(document.querySelectorAll<HTMLInputElement>("[data-quiet]"));
    engine.on("prefs", ({ prefs }) => {
      for (const box of quietBoxes) {
        const on = !(prefs.quiet ?? []).includes(box.dataset.quiet as NoticeCategory);
        if (box.checked !== on) box.checked = on;
      }
    });
    for (const box of quietBoxes) {
      box.addEventListener("change", () => {
        const quiet = quietBoxes.filter((b) => !b.checked).map((b) => b.dataset.quiet as NoticeCategory);
        void engine.dispatch("prefs.set", { quiet });
      });
    }

    engine.on("notice", ({ text, tone, category, action }) => {
      if (!text) return;
      const entry = document.createElement("li");
      entry.className = "bell-item";
      entry.dataset.tone = tone;
      entry.dataset.cat = category;
      if (showing !== "all" && showing !== category) entry.hidden = true;
      const when = document.createElement("time");
      const now = new Date();
      when.dateTime = now.toISOString();
      when.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const body = document.createElement("p");
      fill(body, text, tone === "fault", false);
      if (action) {
        const act = document.createElement("button");
        act.type = "button";
        act.className = "toast-act";
        act.textContent = action.label;
        act.addEventListener("click", (event) => {
          event.stopPropagation();
          void engine.dispatch(action.command, action.arg);
        });
        body.append(" ", act);
      }
      entry.append(when, body);
      list.prepend(entry);
      while (list.children.length > KEEP) (Array.from(list.children).reverse().find((c) => (c as HTMLElement).dataset.tone !== "fault") ?? list.lastElementChild)?.remove();
      if (panel.hidden) root.setAttribute("data-unread", "");
      if (tone === "fault" || !(engine.state.prefs.quiet ?? []).includes(category)) toast(text, tone, action);
    });
    if (import.meta.env.DEV) Object.assign(window, { __notice: engine.setNotice.bind(engine) });
  },
};
