import type { Extension } from "../registry.ts";

const KEY = "formportal-open-group";

export const accordion: Extension = {
  id: "accordion",
  setup(engine) {
    const groups = Array.from(document.querySelectorAll<HTMLDetailsElement>("details.rail-group"));
    if (!groups.length) return;

    const open = (target: HTMLDetailsElement) => {
      for (const group of groups) if (group !== target && group.open) group.open = false;
      if (!target.open) target.open = true;
    };

    let remembered: string | null = null;
    try {
      remembered = localStorage.getItem(KEY);
    } catch {
      remembered = null;
    }
    const start = groups.find((group) => group.dataset.group === remembered);
    if (start) open(start);

    for (const group of groups) {
      group.addEventListener("toggle", () => {
        if (!group.open) return;
        for (const other of groups) if (other !== group && other.open) other.open = false;
        try {
          localStorage.setItem(KEY, group.dataset.group ?? "");
        } catch {
          engine.setNotice("");
        }
      });
    }

    engine.on("route", ({ route }) => {
      const link = document.querySelector<HTMLElement>(`.rail-group [data-route-to="${route}"]`);
      const holder = link?.closest<HTMLDetailsElement>("details.rail-group");
      if (holder) open(holder);
    });
  },
};
