interface TauriGlobal {
  core: { invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> };
}

const tauri = (): TauriGlobal => (window as unknown as { __TAURI__: TauriGlobal }).__TAURI__;

let revealed = false;

export function revealApp(): void {
  if (revealed) return;
  revealed = true;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.body.classList.add("app-ready");
    if ("__TAURI_INTERNALS__" in window) {
      requestAnimationFrame(() => {
        void tauri().core.invoke<void>("app_ready").catch(() => undefined);
      });
    }
  }));
}
