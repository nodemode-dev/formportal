import registry from "../../../../catalog/products.json";
import schedule from "../../../../catalog/schedule.json";
import type { Engine } from "../../engine/index.ts";
import type { Extension } from "../registry.ts";

const KEY = "formportal.live";
const ALIAS: Record<string, string> = { formportal: "formai", formdeck: "formslide", formskill: "formskills" };
const IDS = registry.products.map((p) => p.id).filter((id) => id !== "formai");
const GROUPS = schedule.releases.map((g) => ({ at: Date.parse(g.at), apps: g.apps.map((id) => ALIAS[id] ?? id).filter((id) => IDS.includes(id)) }));

export function isLive(engine: Engine, id: string): boolean {
  for (const channel of ["stable", "beta"] as const) {
    const seen = engine.view(id, channel).availability;
    if (seen === "available" || seen === "other-platform") return true;
  }
  for (const record of engine.installs.values()) if (record.product === id) return true;
  return false;
}

export function liveNow(id: string): boolean {
  return (document.documentElement.getAttribute("data-live") ?? "").split(" ").includes(id);
}

export const live: Extension = {
  id: "live",
  setup(engine) {
    const root = document.documentElement;
    const groups = Array.from(document.querySelectorAll<HTMLElement>("[data-soon-group]"));
    const count = document.querySelector<HTMLElement>("[data-route-to='apps'] .nav-count");
    const write = (name: string, value: string) => {
      if (root.getAttribute(name) !== value) root.setAttribute(name, value);
    };
    const apply = () => {
      if (!engine.state.catalog) {
        const kept = (root.getAttribute("data-live") ?? "").split(" ").filter(Boolean);
        const installed = IDS.filter((id) => !kept.includes(id) && Array.from(engine.installs.values()).some((r) => r.product === id));
        if (installed.length) write("data-live", [...kept, ...installed].join(" "));
        return;
      }
      const shown = IDS.filter((id) => isLive(engine, id));
      const soon = GROUPS.map((g) => g.apps.filter((id) => !shown.includes(id)).length);
      write("data-live", shown.join(" "));
      soon.forEach((n, i) => write(`data-soon-g${i}`, String(n)));
      write("data-soon-left", String(soon.reduce((a, b) => a + b, 0)));
      const now = Date.now();
      for (const el of groups) {
        const due = now >= (GROUPS[Number(el.dataset.soonGroup)]?.at ?? Infinity);
        if (el.hasAttribute("data-due") !== due) el.toggleAttribute("data-due", due);
      }
      if (count && count.textContent !== String(shown.length)) count.textContent = String(shown.length);
      try {
        localStorage.setItem(KEY, JSON.stringify({ live: shown.join(" "), soon, more: Number(root.getAttribute("data-soon-more")) || 0 }));
      } catch {}
    };
    engine.on("source", apply);
    engine.on("install", apply);
    engine.on("policy", apply);
  },
};
