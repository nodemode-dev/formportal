import type { Extension } from "../registry.ts";

export const prefs: Extension = {
  id: "prefs",
  setup(engine) {
    const dialog = document.querySelector<HTMLDialogElement>("[data-prefs]");
    if (!dialog) return;
    const tabs = Array.from(dialog.querySelectorAll<HTMLButtonElement>("[data-prefs-tab]"));
    const panels = Array.from(dialog.querySelectorAll<HTMLElement>("[data-prefs-panel]"));

    const show = (name: string) => {
      for (const tab of tabs) {
        if (tab.dataset.prefsTab === name) tab.setAttribute("aria-current", "page");
        else tab.removeAttribute("aria-current");
      }
      for (const panel of panels) {
        const hide = panel.dataset.prefsPanel !== name;
        if (panel.hidden !== hide) panel.hidden = hide;
      }
    };

    engine.command("prefs.open", (arg) => {
      show(typeof arg === "string" && tabs.some((t) => t.dataset.prefsTab === arg) ? arg : "general");
      if (!dialog.open) dialog.showModal();
    });

    for (const tab of tabs) tab.addEventListener("click", () => show(tab.dataset.prefsTab ?? "general"));
    document.querySelectorAll<HTMLButtonElement>("[data-prefs-open]").forEach((b) => b.addEventListener("click", () => void engine.dispatch("prefs.open")));
    dialog.querySelector("[data-prefs-close]")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  },
};
