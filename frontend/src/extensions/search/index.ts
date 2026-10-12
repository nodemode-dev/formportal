import type { Extension } from "../registry.ts";

export const search: Extension = {
  id: "search",
  setup(engine) {
    const input = document.querySelector<HTMLInputElement>("[data-search]");
    const pane = document.querySelector<HTMLElement>("[data-pane='apps']");
    const list = document.querySelector<HTMLElement>("[data-app-list]");
    const empty = document.querySelector<HTMLElement>("[data-search-empty]");
    if (!input || !pane || !list) return;
    const rows = Array.from(list.querySelectorAll<HTMLElement>(".row[data-search]"));
    const heads = Array.from(list.querySelectorAll<HTMLElement>("[data-group-head]"));
    const shows = Array.from(pane.querySelectorAll<HTMLButtonElement>("[data-show-set]"));

    const apply = () => {
      const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      let shown = 0;
      for (const row of rows) {
        const hit = words.every((w) => (row.dataset.search ?? "").includes(w));
        if (row.hidden === hit) row.hidden = !hit;
        if (hit) shown += 1;
      }
      for (const head of heads) {
        const group = head.dataset.groupHead;
        const any = rows.some((r) => r.dataset.group === group && !r.hidden);
        if (head.hidden === any) head.hidden = !any;
      }
      pane.toggleAttribute("data-searching", words.length > 0);
      if (empty && empty.hidden !== shown > 0) empty.hidden = shown > 0;
    };

    input.addEventListener("input", () => {
      if (input.value.trim() && engine.state.route !== "apps") void engine.dispatch("route.go", "apps");
      apply();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && input.value) {
        input.value = "";
        apply();
      }
    });
    document.addEventListener("keydown", (event) => {
      const typing = (event.target as HTMLElement | null)?.closest("input, select, textarea, dialog");
      if (!typing && (event.key === "/" || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f"))) {
        event.preventDefault();
        input.focus();
      }
    });

    for (const button of shows) {
      button.addEventListener("click", () => {
        pane.dataset.show = button.dataset.showSet ?? "all";
        for (const other of shows) other.setAttribute("aria-pressed", String(other === button));
      });
    }
  },
};
