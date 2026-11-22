import { pickBridge } from "../../bridge/index.ts";
import type { KeyState } from "../../engine/types.ts";
import { t } from "../../i18n/index.ts";
import type { Extension } from "../registry.ts";

export const KEYS_EVENT = "formportal-keys";

const NAMES: Record<string, string> = { pexels: "Pexels", pixabay: "Pixabay", freesound: "Freesound", "google-fonts": "Google Fonts" };

const put = (node: Element | null | undefined, text: string) => {
  if (node && node.textContent !== text) node.textContent = text;
};

const where = (k: KeyState): string => {
  const end = k.last4 ? t("ending in {last4}", { last4: k.last4 }) : "";
  if (k.kept === "file") return end ? t("Kept in a file only you can read, {end}.", { end }) : t("Kept in a file only you can read.");
  if (k.kept === "page") return end ? t("Kept in this page's memory only, {end}.", { end }) : t("Kept in this page's memory only.");
  return end ? t("Kept in this computer's keychain, {end}.", { end }) : t("Kept in this computer's keychain.");
};

export const keys: Extension = {
  id: "keys",
  setup(engine) {
    const bridge = pickBridge();
    const box = document.querySelector<HTMLElement>("[data-keys]");
    if (!box) return;
    const rows = new Map<string, HTMLElement>();
    for (const row of box.querySelectorAll<HTMLElement>("[data-key-row]")) rows.set(row.dataset.keyRow ?? "", row);

    const paint = (list: KeyState[]) => {
      for (const k of list) {
        const row = rows.get(k.provider);
        if (!row) continue;
        if (row.hasAttribute("data-on") !== k.present) row.toggleAttribute("data-on", k.present);
        put(row.querySelector("[data-key-state]"), k.present ? t("On") : t("Off"));
        put(row.querySelector("[data-key-why]"), k.present ? where(k) : t("No key kept."));
        const remove = row.querySelector<HTMLButtonElement>("[data-key-remove]");
        if (remove && remove.disabled === k.present) remove.disabled = !k.present;
        const field = row.querySelector<HTMLInputElement>("input");
        const name = NAMES[k.provider] ?? k.provider;
        const hint = k.present ? t("Replace the kept key") : t("Paste your {name} API key", { name });
        if (field && field.placeholder !== hint) field.placeholder = hint;
      }
      document.dispatchEvent(new CustomEvent<KeyState[]>(KEYS_EVENT, { detail: list }));
    };

    const act = async (work: () => Promise<KeyState[]>, said: (list: KeyState[]) => string) => {
      try {
        const list = await work();
        paint(list);
        engine.setNotice(said(list), "info", "library");
      } catch (e) {
        engine.setNotice(e instanceof Error ? e.message : String(e), "fault", "library");
      }
    };

    for (const [provider, row] of rows) {
      const name = NAMES[provider] ?? provider;
      const form = row.querySelector<HTMLFormElement>("[data-key-form]");
      const field = row.querySelector<HTMLInputElement>("input");
      form?.addEventListener("submit", (event) => {
        event.preventDefault();
        const value = field?.value ?? "";
        void act(
          async () => {
            const list = await bridge.setProviderKey(provider, value);
            if (field) field.value = "";
            return list;
          },
          (list) => {
            const k = list.find((x) => x.provider === provider);
            return k?.kept === "file" ? t("Your {name} key is kept in a file only you can read: this computer has no keychain FormPortal can use.", { name }) : k?.kept === "page" ? t("Your {name} key is kept in this page's memory only; the demo sends it nowhere.", { name }) : t("Your {name} key is kept in this computer's keychain.", { name });
          },
        );
      });
      row.querySelector("[data-key-remove]")?.addEventListener("click", () => void act(() => bridge.clearProviderKey(provider), () => t("Your {name} key is removed.", { name })));
      row.querySelector("[data-key-get]")?.addEventListener("click", () => {
        const page = row.dataset.keyPage;
        if (page) void engine.dispatch("web.open", page);
      });
    }

    void bridge.providerKeys().then(paint, () => undefined);
  },
};
