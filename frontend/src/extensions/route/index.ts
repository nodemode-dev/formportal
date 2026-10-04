import type { Route } from "../../engine/types.ts";
import type { Extension } from "../registry.ts";

const ROUTES: Route[] = ["apps", "beta", "extensions", "updates", "settings"];

export const route: Extension = {
  id: "route",
  setup(engine) {
    const root = document.documentElement;
    const stage = document.querySelector<HTMLElement>(".stage");
    const links = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-route-to]"));

    engine.command("route.go", (arg) => {
      if (ROUTES.includes(arg as Route)) engine.setRoute(arg as Route);
    });

    engine.on("route", ({ route: next }) => {
      root.setAttribute("data-route", next);
      for (const link of links) {
        if (link.dataset.routeTo === next) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
      if (stage) stage.scrollTop = 0;
    });

    for (const link of links) link.addEventListener("click", () => engine.dispatch("route.go", link.dataset.routeTo));
  },
};
