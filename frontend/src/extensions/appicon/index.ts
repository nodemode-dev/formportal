import type { Extension } from "../registry.ts";

interface TauriGlobal {
  core: { invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> };
}

export const appIcon: Extension = {
  id: "app-icon",
  setup(engine) {
    if (!("__TAURI_INTERNALS__" in window) || window.parent !== window) return;
    const tauri = (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__;
    if (!tauri) return;
    let last: boolean | null = null;
    const set = (light: boolean) => {
      if (light === last) return;
      last = light;
      void tauri.core.invoke<void>("set_app_icon", { light }).catch(() => undefined);
    };
    engine.on("theme", ({ light }) => set(light));
    set(document.documentElement.getAttribute("data-theme") === "light");
  },
};
