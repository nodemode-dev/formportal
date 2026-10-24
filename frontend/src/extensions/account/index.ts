import { t } from "../../i18n/index.ts";
import type { Extension } from "../registry.ts";

export const account: Extension = {
  id: "account",
  setup(engine) {
    const box = document.querySelector<HTMLElement>("[data-account]");
    if (!box) return;
    const login = box.querySelector<HTMLElement>("[data-account-login]");
    const error = box.querySelector<HTMLElement>("[data-account-error]");
    const code = box.querySelector<HTMLElement>("[data-account-code]");
    const scopes = box.querySelector<HTMLElement>("[data-account-scopes]");
    let uri = "";
    const write = (node: HTMLElement | null, text: string) => {
      if (node && node.textContent !== text) node.textContent = text;
    };
    const state = (name: string) => {
      if (box.dataset.account !== name) box.dataset.account = name;
    };

    engine.on("account", ({ status, code: device, busy, error: why }) => {
      if (why !== null) {
        write(error, why);
        state("error");
        return;
      }
      if (busy) return state("busy");
      if (device) {
        uri = device.verification_uri;
        write(code, device.user_code);
        return state("code");
      }
      if (!status) return;
      if (!status.configured) return state("unset");
      if (!status.account) return state("off");
      write(login, status.account.login);
      write(scopes, status.account.scopes.includes("repo") ? t("Access granted: your profile and your repositories.") : t("Access granted: your profile only."));
      state("on");
    });

    document.querySelector("[data-prefs-tab='account']")?.addEventListener("click", () => void engine.dispatch("account.check"));
    box.querySelector("[data-account-in]")?.addEventListener("click", () => void engine.dispatch("account.start", false));
    box.querySelector("[data-account-cancel]")?.addEventListener("click", () => void engine.dispatch("account.cancel"));
    box.querySelector("[data-account-out]")?.addEventListener("click", () => void engine.dispatch("account.signOut"));
    box.querySelector("[data-account-open]")?.addEventListener("click", () => {
      if (uri) void engine.dispatch("web.open", uri);
    });
  },
};
