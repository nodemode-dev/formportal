import { t } from "../../i18n/index.ts";
import type { Extension } from "../registry.ts";

const KEY = "formportal-theme";
const SHARED = "nodemode_ui_settings";
const APPEARANCE = 3;
const ACCENT = "#f97316";
const HEX = /^#[0-9a-fA-F]{6}$/;

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
        return stored === "light" || stored === "system" ? stored : "dark";
      } catch {
        return "dark";
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
      mode = arg === "light" || arg === "system" ? arg : "dark";
      try {
        localStorage.setItem(KEY, mode);
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

    const picker = document.querySelector<HTMLInputElement>("[data-accent]");
    const reset = document.querySelector<HTMLButtonElement>("[data-accent-reset]");
    const apply = (hex: string) => {
      root.style.setProperty("--accent-color", hex);
      root.style.setProperty("--accent-color-dim", `${hex}33`);
      root.style.setProperty("--accent-color-hover", `color-mix(in srgb, ${hex} 82%, #ffffff)`);
    };
    const keep = (hex: string) => {
      try {
        const raw = localStorage.getItem(SHARED);
        const merged = { ...(raw ? JSON.parse(raw) : {}), accentColor: hex, appearance: APPEARANCE };
        localStorage.setItem(SHARED, JSON.stringify(merged));
      } catch {
        engine.setNotice(t("This choice could not be saved on this computer."));
      }
    };
    if (picker) {
      let current = ACCENT;
      try {
        const saved = JSON.parse(localStorage.getItem(SHARED) || "null");
        if (saved && typeof saved.accentColor === "string" && HEX.test(saved.accentColor)) current = saved.accentColor.toLowerCase();
      } catch {
        current = ACCENT;
      }
      if (picker.value !== current) picker.value = current;
      picker.addEventListener("input", () => apply(picker.value));
      picker.addEventListener("change", () => keep(picker.value));
      reset?.addEventListener("click", () => {
        if (picker.value !== ACCENT) picker.value = ACCENT;
        apply(ACCENT);
        keep(ACCENT);
      });
    }
  },
};
