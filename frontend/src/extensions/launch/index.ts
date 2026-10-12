import { language, pageFor } from "../../i18n/index.ts";
import type { Extension } from "../registry.ts";

const OPEN_KEY = "formportal-open";

export const launch: Extension = {
  id: "launch",
  setup(engine) {
    const langs = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-lang-set]"));
    const opens = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-open-set]"));
    const here = language();
    for (const b of langs) b.setAttribute("aria-pressed", String(b.dataset.langSet === here));

    let open = "home";
    try {
      open = localStorage.getItem(OPEN_KEY) === "last" ? "last" : "home";
    } catch {
      open = "home";
    }
    for (const b of opens) b.setAttribute("aria-pressed", String(b.dataset.openSet === open));
    for (const b of opens) {
      b.addEventListener("click", () => {
        const next = b.dataset.openSet ?? "home";
        try {
          if (next === "last") localStorage.setItem(OPEN_KEY, "last");
          else localStorage.removeItem(OPEN_KEY);
        } catch {
          engine.setNotice("This choice could not be saved on this computer.");
          return;
        }
        for (const o of opens) o.setAttribute("aria-pressed", String(o === b));
      });
    }

    for (const b of langs) {
      b.addEventListener("click", () => {
        const code = b.dataset.langSet ?? "en";
        if (code === here) return;
        void engine.dispatch("language.set", code);
      });
    }
  },
};

export function goToLanguage(code: string): void {
  const target = pageFor(code);
  if (window.location.pathname !== target) window.location.assign(`${target}${window.location.search}`);
}
