import type { FileVersion, FolderView, ProjectFile } from "../../engine/types.ts";
import type { Extension } from "../registry.ts";

const size = (bytes: number) =>
  bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : bytes >= 1e6 ? `${Math.round(bytes / 1e6)} MB` : bytes >= 1e3 ? `${Math.round(bytes / 1e3)} KB` : `${bytes} B`;

const when = (seconds: number) => {
  const date = new Date(seconds * 1000);
  return date.toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const set = (root: HTMLElement, field: string, text: string) => {
  const node = root.querySelector<HTMLElement>(`[data-field='${field}']`);
  if (node && node.textContent !== text) node.textContent = text;
};

export const files: Extension = {
  id: "files",
  setup(engine) {
    const pane = document.querySelector<HTMLElement>("[data-pane='files']");
    const fileList = document.querySelector<HTMLElement>("[data-file-list]");
    const folderList = document.querySelector<HTMLElement>("[data-folder-list]");
    const storageList = document.querySelector<HTMLElement>("[data-storage-list]");
    const fileTpl = document.querySelector<HTMLTemplateElement>("#file-row");
    const folderTpl = document.querySelector<HTMLTemplateElement>("#folder-row");
    const query = document.querySelector<HTMLInputElement>("[data-files-query]");
    const dialog = document.querySelector<HTMLDialogElement>("[data-versions-dialog]");
    const versionList = document.querySelector<HTMLElement>("[data-versions-list]");
    if (!pane || !fileList || !folderList || !storageList || !fileTpl || !folderTpl || !dialog || !versionList) return;

    const mountedFiles = new Map<string, HTMLElement>();
    const mountedFolders = new Map<string, HTMLElement>();
    let current = "";

    const clone = (tpl: HTMLTemplateElement) => (tpl.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;

    const fileRow = (file: ProjectFile) => {
      let row = mountedFiles.get(file.path);
      if (!row) {
        row = clone(fileTpl);
        row.dataset.path = file.path;
        row.querySelector("[data-file-act='open']")?.addEventListener("click", () => void engine.dispatch("file.open", { path: row?.dataset.path, product: row?.dataset.product }));
        row.querySelector("[data-file-act='versions']")?.addEventListener("click", () => {
          current = row?.dataset.path ?? "";
          void engine.dispatch("file.versions", { path: current });
          if (!dialog.open) dialog.showModal();
        });
        mountedFiles.set(file.path, row);
      }
      if (row.dataset.product !== file.product) row.dataset.product = file.product;
      set(row, "short", engine.name(file.product).replace(/^Form\.?/, "").slice(0, 2));
      const tile = row.querySelector<HTMLElement>("[data-field='short']");
      const shot = file.preview ? `${file.preview}@${file.modified}` : "";
      if (tile && tile.dataset.shot !== shot) {
        tile.dataset.shot = shot;
        if (file.preview) void engine.dispatch("file.preview", { path: file.preview, into: tile });
        else {
          tile.style.backgroundImage = "";
          tile.toggleAttribute("data-has-shot", false);
        }
      }
      set(row, "name", file.name);
      const relative = file.path.startsWith(file.folder) ? file.path.slice(file.folder.length).replace(/^[\\/]/, "") : file.path;
      const dir = relative.includes("/") || relative.includes("\\") ? relative.slice(0, Math.max(relative.lastIndexOf("/"), relative.lastIndexOf("\\"))) : "";
      const top = file.folder.split(/[\\/]/).filter(Boolean).pop() ?? file.folder;
      set(row, "where", `${engine.name(file.product)} · ${dir ? `${top}/${dir}` : top}`);
      set(row, "when", when(file.modified));
      set(row, "meta", `${size(file.bytes)} · ${file.versions} ${file.versions === 1 ? "version" : "versions"}`);
      return row;
    };

    const folderRow = (folder: FolderView) => {
      let row = mountedFolders.get(folder.path);
      if (!row) {
        row = clone(folderTpl);
        row.dataset.path = folder.path;
        row.querySelector("[data-folder-remove]")?.addEventListener("click", () => void engine.dispatch("folder.remove", row?.dataset.path));
        mountedFolders.set(folder.path, row);
      }
      set(row, "path", folder.path);
      set(row, "meta", folder.exists ? `${folder.files} ${folder.files === 1 ? "project" : "projects"} · ${size(folder.bytes)}` : "Not found: renamed, moved or on a drive that is not connected");
      set(row, "history", folder.keep_versions ? "Keeps versions" : "No versions");
      return row;
    };

    const place = (list: HTMLElement, rows: HTMLElement[], mounted: Map<string, HTMLElement>) => {
      const keep = new Set(rows);
      for (const [key, row] of mounted) {
        if (!keep.has(row)) {
          row.remove();
          mounted.delete(key);
        }
      }
      rows.forEach((row, i) => {
        if (list.children[i] !== row) list.insertBefore(row, list.children[i] ?? null);
      });
    };

    engine.on("files", ({ result }) => {
      const { scan, suggested } = result;
      const any = scan.folders.length > 0;
      document.querySelectorAll<HTMLElement>("[data-files-main]").forEach((s) => {
        if (s.hidden === any) s.hidden = !any;
      });
      const start = document.querySelector<HTMLElement>("[data-files-start]");
      if (start && start.hidden !== any) start.hidden = any;
      const hint = document.querySelector<HTMLElement>("[data-files-suggested]");
      if (hint && hint.textContent !== suggested) hint.textContent = suggested;
      place(fileList, scan.files.map(fileRow), mountedFiles);
      place(folderList, scan.folders.map(folderRow), mountedFolders);
      const empty = document.querySelector<HTMLElement>("[data-files-empty]");
      if (empty && empty.hidden !== scan.files.length > 0) empty.hidden = scan.files.length > 0;
      const count = document.querySelector<HTMLElement>("[data-files-count]");
      const text = `${scan.files.length} ${scan.files.length === 1 ? "project" : "projects"}${scan.truncated ? ", first 5,000 only" : ""}`;
      if (count && count.textContent !== text) count.textContent = text;
      pane.dataset.suggested = suggested;
      pane.toggleAttribute("data-ready", true);
    });

    const storageRows = new Map<string, HTMLElement>();
    engine.on("storage", ({ view }) => {
      const rows = [...view.formportal.map((p) => [p.what, p.path, p.bytes] as const), ...view.folders.map((f) => [`Projects in ${f.path.split(/[\\/]/).pop() || f.path}`, f.path, f.bytes] as const)].map(([what, path, bytes]) => {
        let row = storageRows.get(what);
        if (!row) {
          row = document.createElement("li");
          row.className = "store";
          row.innerHTML = '<span class="store-what"></span><span class="store-path mono"></span><span class="store-bytes"></span>';
          storageRows.set(what, row);
        }
        const [w, p, b] = Array.from(row.children) as HTMLElement[];
        if (w.textContent !== what) w.textContent = what;
        if (p.textContent !== path) p.textContent = path;
        const s = size(bytes);
        if (b.textContent !== s) b.textContent = s;
        return row;
      });
      place(storageList, rows, storageRows);
      const total = document.querySelector<HTMLElement>("[data-storage-total]");
      const text = `FormPortal uses ${size(view.formportal_bytes)}`;
      if (total && total.textContent !== text) total.textContent = text;
    });

    const fresh = document.querySelector<HTMLElement>("[data-versions-new]");
    engine.on("saved", ({ paths }) => {
      if (dialog?.open && current && paths.includes(current)) fresh?.toggleAttribute("data-on", true);
    });
    document.querySelector("[data-versions-show]")?.addEventListener("click", () => {
      if (current) void engine.dispatch("file.versions", { path: current });
    });

    engine.on("versions", ({ path, list }) => {
      if (path !== current) return;
      fresh?.toggleAttribute("data-on", false);
      const title = document.querySelector<HTMLElement>("[data-versions-title]");
      const name = path.split(/[\\/]/).pop() ?? path;
      if (title) title.textContent = `Versions of ${name}`;
      const where = document.querySelector<HTMLElement>("[data-versions-path]");
      if (where) where.textContent = path;
      versionList.replaceChildren(
        ...list.map((v: FileVersion, i: number) => {
          const li = document.createElement("li");
          li.className = "version";
          const text = document.createElement("div");
          text.innerHTML = '<span class="row-name-text"></span><p class="row-sub"></p>';
          (text.firstElementChild as HTMLElement).textContent = `${when(v.at)}${i === 0 ? " (latest)" : ""}`;
          (text.lastElementChild as HTMLElement).textContent = `${size(v.size)} · ${v.reason}`;
          li.append(text);
          if (i > 0) {
            const back = document.createElement("button");
            back.type = "button";
            back.className = "btn";
            back.textContent = "Go back to this";
            back.addEventListener("click", () => void engine.dispatch("file.versions", { path, action: "revert", version: v.id }));
            li.append(back);
          }
          return li;
        }),
      );
    });

    dialog.querySelector("[data-versions-close]")?.addEventListener("click", () => dialog.close());
    dialog.querySelector("[data-versions-save]")?.addEventListener("click", () => current && void engine.dispatch("file.versions", { path: current, action: "save" }));
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });

    document.querySelectorAll<HTMLButtonElement>("[data-folder-add]").forEach((b) => b.addEventListener("click", () => void engine.dispatch("folder.add")));
    document.querySelector("[data-folder-suggested]")?.addEventListener("click", () => void engine.dispatch("folder.add", { path: pane.dataset.suggested, create: true }));

    let timer = 0;
    query?.addEventListener("input", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void engine.dispatch("files.scan", query.value), 200);
    });
    engine.on("route", ({ route }) => {
      if (route === "files") void engine.dispatch("files.scan");
    });
  },
};
