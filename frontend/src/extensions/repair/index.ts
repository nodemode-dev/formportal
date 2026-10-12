import type { WebPlan } from "../../engine/types.ts";
import { t } from "../../i18n/index.ts";
import type { Extension } from "../registry.ts";

const mb = (bytes: number) => (bytes >= 1_000_000 ? `${Math.round(bytes / 1_000_000)} MB` : bytes > 0 ? `${Math.max(1, Math.round(bytes / 1000))} KB` : "");

export const repair: Extension = {
  id: "repair",
  setup(engine) {
    const check = document.querySelector<HTMLButtonElement>("[data-repair-check]");
    const fix = document.querySelector<HTMLButtonElement>("[data-repair-fix]");
    const status = document.querySelector<HTMLElement>("[data-repair-status]");
    const list = document.querySelector<HTMLElement>("[data-repair-list]");
    if (check && fix && status && list) {
      check.addEventListener("click", () => void engine.dispatch("repair.run", false));
      fix.addEventListener("click", () => void engine.dispatch("repair.run", true));
      engine.on("repair", ({ pending, report }) => {
        check.disabled = pending;
        fix.disabled = pending;
        if (pending) {
          status.textContent = t("Checking");
          return;
        }
        if (!report) {
          status.textContent = "";
          return;
        }
        const open = report.findings.filter((f) => !f.fixed);
        status.textContent = report.findings.length === 0
          ? t("Everything checks out ({n} installed).", { n: report.checked })
          : open.length === 0
            ? t("Repaired.")
            : t("{n} to repair.", { n: open.length });
        fix.hidden = open.length === 0;
        list.replaceChildren(
          ...report.findings.map((f) => {
            const li = document.createElement("li");
            li.className = "repair-item";
            li.toggleAttribute("data-fixed", f.fixed);
            li.toggleAttribute("data-fault", Boolean(f.error));
            const what = document.createElement("p");
            what.textContent = f.problem;
            const how = document.createElement("p");
            how.className = "fine";
            const size = mb(f.bytes);
            how.textContent = f.error ? f.error : f.fixed ? t("Done.") : `${f.fix}${size ? ` (${size})` : ""}`;
            li.append(what, how);
            return li;
          }),
        );
      });
    }

    const dialog = document.querySelector<HTMLDialogElement>("[data-webfile]");
    const what = document.querySelector<HTMLElement>("[data-webfile-what]");
    const url = document.querySelector<HTMLElement>("[data-webfile-url]");
    const folder = document.querySelector<HTMLElement>("[data-webfile-folder]");
    const go = document.querySelector<HTMLButtonElement>("[data-webfile-go]");
    if (!dialog || !what || !url || !folder || !go) return;
    let plan: WebPlan | null = null;
    engine.on("webfile", ({ plan: next }) => {
      plan = next;
      what.textContent = t("A web page on {host} wants {app} to open {name}.", { host: next.host, app: engine.name(next.product), name: next.name });
      url.textContent = next.url;
      folder.textContent = next.folder;
      if (!dialog.open) dialog.showModal();
    });
    go.addEventListener("click", () => {
      dialog.close();
      if (plan) void engine.dispatch("web.fetch", plan);
    });
    document.querySelector("[data-webfile-cancel]")?.addEventListener("click", () => dialog.close());
  },
};
