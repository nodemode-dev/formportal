import type { Extension } from "../registry.ts";

const KEY = "formportal-theme";

export const theme: Extension = {
  id: "theme",
  setup(engine) {
    const root = document.documentElement;
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-theme-set]"));

    const paint = (light: boolean) => {
      if (light) root.setAttribute("data-theme", "light");
      else root.removeAttribute("data-theme");
      for (const b of buttons) b.setAttribute("aria-pressed", String((b.dataset.themeSet === "light") === light));
    };

    engine.command("theme.set", (arg) => engine.setTheme(arg === "light"));
    engine.on("theme", ({ light }) => {
      paint(light);
      try {
        localStorage.setItem(KEY, light ? "light" : "dark");
      } catch {
        root.toggleAttribute("data-theme-unsaved", true);
      }
    });
    for (const b of buttons) b.addEventListener("click", () => engine.dispatch("theme.set", b.dataset.themeSet));
    paint(engine.state.light);
  },
};
