import type { SharesView } from "../../engine/types.ts";
import { t } from "../../i18n/index.ts";
import type { Extension } from "../registry.ts";

export const share: Extension = {
  id: "share",
  setup(engine) {
    const dialog = document.querySelector<HTMLDialogElement>("[data-share-dialog]");
    const block = document.querySelector<HTMLElement>("[data-shared-block]");
    const list = document.querySelector<HTMLElement>("[data-shared-list]");
    const tpl = document.querySelector<HTMLTemplateElement>("#shared-row");
    if (!dialog || !block || !list || !tpl) return;
    const pathLine = dialog.querySelector<HTMLElement>("[data-share-path]");
    const invite = dialog.querySelector<HTMLInputElement>("[data-share-invite]");
    const status = dialog.querySelector<HTMLElement>("[data-share-status]");
    const link = dialog.querySelector<HTMLAnchorElement>("[data-share-url]");
    const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>("[data-share-go], [data-share-publish], [data-share-unpublish]"));
    let target = "";
    let last: SharesView = { shared: [], joined: [], published: [], invitations: [] };

    const write = (node: HTMLElement | null, text: string) => {
      if (node && node.textContent !== text) node.textContent = text;
    };
    const showLink = (url: string) => {
      if (!link) return;
      if (link.getAttribute("href") !== (url || "#")) link.setAttribute("href", url || "#");
      write(link, url);
    };
    const open = (mode: "folder" | "file", path: string) => {
      target = path;
      if (dialog.dataset.mode !== mode) dialog.dataset.mode = mode;
      write(pathLine, path);
      const shared = last.shared.find((s) => s.folder === path);
      const published = last.published.find((p) => p.file === path);
      write(status, mode === "folder" && shared ? t("Shared with: {list}", { list: shared.invited.join(", ") || t("nobody invited yet") }) : mode === "file" && published ? t("Anyone with this link can open the file:") : "");
      showLink(mode === "folder" ? shared?.url ?? "" : published?.url ?? "");
      const go = dialog.querySelector<HTMLButtonElement>("[data-share-go]");
      write(go, shared ? t("Send changes and invite") : t("Share"));
      const unpublish = dialog.querySelector<HTMLButtonElement>("[data-share-unpublish]");
      if (unpublish && unpublish.disabled !== !published) unpublish.disabled = !published;
      if (invite) invite.value = "";
      if (!dialog.open) dialog.showModal();
    };

    document.addEventListener("click", (event) => {
      const at = event.target as HTMLElement;
      const folder = at.closest<HTMLElement>("[data-folder-share]")?.closest<HTMLElement>(".row");
      if (folder?.dataset.path) open("folder", folder.dataset.path);
      const file = at.closest<HTMLElement>("[data-file-act='link']")?.closest<HTMLElement>(".row");
      if (file?.dataset.path) open("file", file.dataset.path);
    });
    dialog.querySelector("[data-share-close]")?.addEventListener("click", () => dialog.close());
    dialog.querySelector("[data-share-go]")?.addEventListener("click", () => {
      const names = (invite?.value ?? "").split(",").map((n) => n.trim()).filter(Boolean);
      void engine.dispatch("share.folder", { folder: target, invite: names });
    });
    dialog.querySelector("[data-share-publish]")?.addEventListener("click", () => void engine.dispatch("share.publish", { file: target, remove: false }));
    dialog.querySelector("[data-share-unpublish]")?.addEventListener("click", () => void engine.dispatch("share.publish", { file: target, remove: true }));

    engine.on("shareResult", ({ busy, text, url }) => {
      for (const b of buttons) if (b.disabled !== busy) b.disabled = busy;
      if (!dialog.open) return;
      if (text) write(status, text);
      if (!busy) showLink(url);
    });

    const rows = new Map<string, HTMLElement>();
    engine.on("shares", ({ view }) => {
      last = view;
      const unpublish = dialog.querySelector<HTMLButtonElement>("[data-share-unpublish]");
      const has = view.published.some((p) => p.file === target);
      if (unpublish && dialog.dataset.mode === "file" && unpublish.disabled !== !has) unpublish.disabled = !has;
      const wanted: [string, string, string, string][] = [
        ...view.invitations.map((i): [string, string, string, string] => [`invite:${i.id}`, "invite", i.repo, t("From {who}, waiting for you to accept", { who: i.from })]),
        ...view.joined.map((j): [string, string, string, string] => [`joined:${j.repo}`, "joined", j.repo, j.folder]),
      ];
      const keep = new Set(wanted.map((w) => w[0]));
      for (const [key, row] of rows) {
        if (!keep.has(key)) {
          row.remove();
          rows.delete(key);
        }
      }
      wanted.forEach(([key, kind, repo, sub], i) => {
        let row = rows.get(key);
        if (!row) {
          row = (tpl.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
          row.dataset.kind = kind;
          row.dataset.key = key;
          row.querySelector("[data-shared-accept]")?.addEventListener("click", () => void engine.dispatch("share.accept", Number(key.slice(7))));
          row.querySelector("[data-shared-pull]")?.addEventListener("click", () => void engine.dispatch("share.pull", repo));
          rows.set(key, row);
        }
        write(row.querySelector<HTMLElement>("[data-field='name']"), repo.replace("formportal-library-", ""));
        write(row.querySelector<HTMLElement>("[data-field='sub']"), sub);
        if (list.children[i] !== row) list.insertBefore(row, list.children[i] ?? null);
      });
      const empty = wanted.length === 0;
      if (block.hidden !== empty) block.hidden = empty;
    });

    engine.on("route", ({ route }) => {
      if (route === "files") void engine.dispatch("shares.load");
    });
  },
};
