import type { Extension } from "../registry.ts";

const KEY = "formportal-theme";

type Mode = "system" | "light" | "dark";

export const theme: Extension = {
  id: "theme",
  setup(engine) {
    const root = document.documentElement;
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-theme-set]"));

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const read = (): Mode => {
      try {
        const stored = localStorage.getItem(KEY);
        return stored === "light" || stored === "dark" ? stored : "system";
      } catch {
        return "system";
      }
    };
    let mode = read();
    const effective = () => (mode === "system" ? media.matches : mode === "light");

    const paint = (light: boolean) => {
      if (light) {
        if (root.getAttribute("data-theme") !== "light") root.setAttribute("data-theme", "light");
      } else if (root.hasAttribute("data-theme")) root.removeAttribute("data-theme");
      for (const b of buttons) {
        const on = String(b.dataset.themeSet === mode);
        if (b.getAttribute("aria-pressed") !== on) b.setAttribute("aria-pressed", on);
      }
    };

    engine.command("theme.set", (arg) => {
      mode = arg === "light" || arg === "dark" ? arg : "system";
      try {
        if (mode === "system") localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, mode);
      } catch {
        root.toggleAttribute("data-theme-unsaved", true);
      }
      if (engine.state.light === effective()) paint(effective());
      else engine.setTheme(effective());
    });
    engine.on("theme", ({ light }) => paint(light));
    media.addEventListener("change", () => {
      if (mode === "system") engine.setTheme(media.matches);
    });
    for (const b of buttons) b.addEventListener("click", () => engine.dispatch("theme.set", b.dataset.themeSet));
    paint(engine.state.light);
  },
};
