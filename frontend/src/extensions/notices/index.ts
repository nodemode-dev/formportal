import type { NoticeCategory } from "../../engine/types.ts";
import { t } from "../../i18n/index.ts";
import type { Extension } from "../registry.ts";
import hues from "../../../../design/app-hues.json";

const KEEP = 30;
const SHOW_MS = 6000;

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

    const toast = (text: string, tone: "info" | "fault") => {
      const item = document.createElement("div");
      item.className = "toast";
      item.dataset.tone = tone;
      const app = tone === "fault" ? null : appOf(text);
      if (app) {
        item.dataset.app = app;
        item.style.setProperty("--hue", (hues as Record<string, string>)[app] ?? "");
      }
      item.setAttribute("role", tone === "fault" ? "alert" : "status");
      const body = document.createElement("p");
      body.textContent = text;
      const close = document.createElement("button");
      close.type = "button";
      close.className = "toast-close";
      close.setAttribute("aria-label", t("Dismiss"));
      close.textContent = t("Dismiss");
      close.addEventListener("click", () => item.remove());
      item.append(body, close);
      const showing = toasts.firstElementChild as HTMLElement | null;
      if (showing?.dataset.tone === "fault" && tone === "info") return;
      toasts.replaceChildren(item);
      if (tone === "info") window.setTimeout(() => item.remove(), SHOW_MS);
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

    engine.on("notice", ({ text, tone, category }) => {
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
      body.textContent = text;
      entry.append(when, body);
      list.prepend(entry);
      while (list.children.length > KEEP) list.lastElementChild?.remove();
      if (panel.hidden) root.setAttribute("data-unread", "");
      if (tone === "fault" || !(engine.state.prefs.quiet ?? []).includes(category)) toast(text, tone);
    });
  },
};
