import { t } from "../../i18n/index.ts";
import type { Extension } from "../registry.ts";

export interface DemoEntry {
  id: string;
  path: string;
  title: string;
}

export const DEMOS: DemoEntry[] = [
  { id: "install", path: "/demo/index.html", title: "Installs and files" },
  { id: "updates", path: "/demos/updates/index.html", title: "Updates and trust" },
  { id: "library", path: "/demos/library/index.html", title: "Fonts, stock and templates" },
];

const KEPT = "formportal-demo:";

export const demos: Extension = {
  id: "demos",
  setup(engine) {
    const here = DEMOS.find((d) => location.pathname.endsWith(d.path));
    if (here) {
      const root = location.pathname.slice(0, location.pathname.length - here.path.length);
      document.addEventListener("click", (event) => {
        const go = DEMOS.find((d) => d.id === (event.target as Element | null)?.closest<HTMLElement>("[data-demo-go]")?.dataset.demoGo);
        if (go) location.href = `${root}${go.path}`;
      });
      return;
    }
    const stage = document.querySelector<HTMLElement>("[data-demo-stage]");
    const frame = stage?.querySelector<HTMLIFrameElement>("[data-demo-frame]");
    const name = stage?.querySelector("[data-demo-name]");
    if (!stage || !frame) return;

    const show = (entry: DemoEntry) => {
      const title = t(entry.title);
      if (name && name.textContent !== title) name.textContent = title;
      if (stage.dataset.demo !== entry.id) stage.dataset.demo = entry.id;
    };

    const open = (id: string) => {
      const entry = DEMOS.find((d) => d.id === id);
      if (!entry) {
        engine.setNotice(t("There is no demo called {id}.", { id }), "fault", "installs");
        return;
      }
      for (const dialog of document.querySelectorAll<HTMLDialogElement>("dialog[open]")) dialog.close();
      show(entry);
      frame.src = entry.path;
      stage.hidden = false;
      document.documentElement.setAttribute("data-demo", entry.id);
    };

    const end = () => {
      stage.hidden = true;
      frame.src = "about:blank";
      delete stage.dataset.demo;
      document.documentElement.removeAttribute("data-demo");
    };

    const reset = () => {
      try {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(KEPT)) keys.push(key);
        }
        for (const key of keys) localStorage.removeItem(key);
      } catch {
        return;
      }
      const entry = DEMOS.find((d) => d.id === stage.dataset.demo);
      if (entry) frame.src = entry.path;
    };

    frame.addEventListener("load", () => {
      let path = "";
      try {
        path = frame.contentWindow?.location.pathname ?? "";
      } catch {
        path = "";
      }
      const entry = DEMOS.find((d) => path.endsWith(d.path));
      if (entry) show(entry);
    });

    engine.command("demo.open", (arg) => open(String(arg ?? "")));
    engine.command("demo.end", end);
    document.addEventListener("click", (event) => {
      const button = (event.target as Element | null)?.closest<HTMLElement>("[data-demo-go]");
      if (button) void engine.dispatch("demo.open", button.dataset.demoGo);
    });
    stage.querySelector("[data-demo-end]")?.addEventListener("click", end);
    stage.querySelector("[data-demo-reset]")?.addEventListener("click", reset);
  },
};
