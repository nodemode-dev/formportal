import { pickBridge } from "../../bridge/index.ts";
import { MAKER } from "../../engine/hosts.ts";
import { t } from "../../i18n/index.ts";
import type { Extension } from "../registry.ts";

export const account: Extension = {
  id: "account",
  setup(engine) {
    const group = document.querySelector<HTMLElement>("[data-github]");
    const box = document.querySelector<HTMLElement>("[data-account]");
    if (!box) return;
    const fork = box.querySelector<HTMLElement>("[data-fork]");
    const forkError = box.querySelector<HTMLElement>("[data-fork-error]");
    const forkMade = box.querySelector<HTMLElement>("[data-fork-made]");
    const forkUrl = box.querySelector<HTMLAnchorElement>("[data-fork-url]");
    const forkExt = box.querySelector<HTMLButtonElement>("[data-fork-ext]");
    let forkRun = 0;
    const forkState = (name: string) => {
      if (fork && fork.dataset.fork !== name) fork.dataset.fork = name;
    };
    const shown = (on: boolean) => {
      if (group && group.hidden === on) group.hidden = !on;
    };
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
      shown(status.configured);
      if (!status.configured) return state("unset");
      if (!status.account) {
        forkRun += 1;
        forkState("idle");
        return state("off");
      }
      write(login, status.account.login);
      const repo = status.account.scopes.includes("repo");
      const pub = status.account.scopes.includes("public_repo");
      write(scopes, repo ? t("Access granted: your profile and your repositories.") : pub ? t("Access granted: your profile and your public repositories, for the registry fork.") : t("Access granted: your profile only."));
      if (box.dataset.scope !== (repo ? "repo" : "profile")) box.dataset.scope = repo ? "repo" : "profile";
      const have = repo || pub ? "have" : "need";
      if (fork && fork.dataset.forkScope !== have) fork.dataset.forkScope = have;
      state("on");
    });

    box.querySelector("[data-fork-start]")?.addEventListener("click", () => forkState("confirm"));
    box.querySelector("[data-fork-cancel]")?.addEventListener("click", () => {
      forkRun += 1;
      forkState("idle");
    });
    box.querySelector("[data-fork-approve]")?.addEventListener("click", () => void engine.dispatch("account.start", "fork"));
    forkExt?.addEventListener("click", () => void engine.dispatch("ext.make"));
    box.querySelector("[data-fork-go]")?.addEventListener("click", async () => {
      const run = ++forkRun;
      forkState("busy");
      try {
        const made = await pickBridge().githubFork();
        if (run !== forkRun) return;
        write(forkMade, made.existed ? t("You already have a fork:") : t("Your fork is ready:"));
        write(forkUrl, made.repo);
        if (forkUrl && forkUrl.getAttribute("href") !== made.url) forkUrl.setAttribute("href", made.url);
        const ext = [...engine.installs.values()].some((r) => r.product === MAKER);
        if (forkExt && forkExt.hidden === ext) forkExt.hidden = !ext;
        forkState("done");
      } catch (e) {
        if (run !== forkRun) return;
        write(forkError, e instanceof Error ? e.message : String(e));
        forkState("error");
      }
    });

    document.querySelector("[data-prefs-tab='account']")?.addEventListener("click", () => void engine.dispatch("account.check"));
    box.querySelector("[data-account-in]")?.addEventListener("click", () => void engine.dispatch("account.start", false));
    box.querySelector("[data-account-share]")?.addEventListener("click", () => void engine.dispatch("account.start", true));
    box.querySelector("[data-account-cancel]")?.addEventListener("click", () => void engine.dispatch("account.cancel"));
    box.querySelector("[data-account-out]")?.addEventListener("click", () => void engine.dispatch("account.signOut"));
    box.querySelector("[data-account-open]")?.addEventListener("click", () => {
      if (uri) void engine.dispatch("web.open", uri);
    });
  },
};
