import type { Route } from "../../engine/types.ts";
import type { Extension } from "../registry.ts";

export const route: Extension = {
  id: "route",
  setup(engine) {
    const root = document.documentElement;
    const stage = document.querySelector<HTMLElement>(".stage");
    const links = Array.from(document.querySelectorAll<HTMLElement>("[data-route-to]"));
    const panes = Array.from(document.querySelectorAll<HTMLElement>("[data-pane]"));
    const routes = new Set(panes.map((pane) => pane.dataset.pane as Route));
    const label = document.querySelector<HTMLElement>("[data-route-label]");

    engine.command("route.go", (arg) => {
      if (routes.has(arg as Route)) engine.setRoute(arg as Route);
    });

    engine.on("route", ({ route: next }) => {
      root.setAttribute("data-route", next);
      for (const pane of panes) pane.toggleAttribute("data-on-route", pane.dataset.pane === next);
      const named = links.find((link) => link.dataset.routeTo === next)?.querySelector(".rail-label")?.textContent ?? next;
      if (label && label.firstChild) label.firstChild.nodeValue = named;
      for (const link of links) {
        if (link.dataset.routeTo === next) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
      if (stage) stage.scrollTop = 0;
    });

    for (const link of links) link.addEventListener("click", () => engine.dispatch("route.go", link.dataset.routeTo));
  },
};
