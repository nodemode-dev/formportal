import type { Extension } from "../registry.ts";

export const stage: Extension = {
  id: "stage",
  setup(engine) {
    const pane = document.querySelector<HTMLElement>(".pane-apps");
    const items = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-app-to]"));
    if (!pane) return;

    engine.command("app.show", (arg) => {
      const id = String(arg);
      if (!items.some((item) => item.dataset.appTo === id)) return;
      pane.setAttribute("data-app", id);
      for (const item of items) item.setAttribute("aria-pressed", String(item.dataset.appTo === id));
    });

    for (const item of items) item.addEventListener("click", () => engine.dispatch("app.show", item.dataset.appTo));
  },
};
