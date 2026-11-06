import type { Route } from "../../engine/types.ts";
import type { Extension } from "../registry.ts";
import { liveNow } from "../live/index.ts";

export const route: Extension = {
  id: "route",
  setup(engine) {
    const root = document.documentElement;
    const stage = document.querySelector<HTMLElement>(".stage");
    const links = Array.from(document.querySelectorAll<HTMLElement>("[data-route-to]"));
    const nav = links.filter((link) => link.classList.contains("nav-item"));
    const panes = Array.from(document.querySelectorAll<HTMLElement>("[data-pane]"));
    const routes = new Set(panes.map((pane) => pane.dataset.pane as Route));
    const label = document.querySelector<HTMLElement>("[data-route-label]");

    engine.command("route.go", (arg) => {
      const next = arg as Route;
      if (!routes.has(next)) return;
      if (next.startsWith("app-") && !liveNow(next.slice(4))) return;
      engine.setRoute(next);
    });

    engine.command("route.launch", () => {
      const launch = root.dataset.launch;
      if (launch && routes.has(launch)) engine.setRoute(launch);
      root.removeAttribute("data-launch");
    });

    engine.on("route", ({ route: next }) => {
      root.setAttribute("data-route", next);
      let title = next;
      for (const pane of panes) {
        const on = pane.dataset.pane === next;
        pane.toggleAttribute("data-on-route", on);
        if (on) title = pane.dataset.title ?? next;
      }
      if (label && label.textContent !== title) label.textContent = title;
      const owner = next.startsWith("app-") ? "apps" : next;
      for (const link of nav) {
        if (link.dataset.routeTo === next) link.setAttribute("aria-current", "page");
        else if (link.dataset.routeTo === owner) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      }
      if (stage) stage.scrollTop = 0;
      try {
        localStorage.setItem("formportal-last", owner);
      } catch {
        return;
      }
    });

    for (const link of links) link.addEventListener("click", () => engine.dispatch("route.go", link.dataset.routeTo));
  },
};
