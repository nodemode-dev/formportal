import type { FileVersion, FolderView, ProjectFile } from "../../engine/types.ts";
import { t } from "../../i18n/index.ts";
import { pickBridge } from "../../bridge/index.ts";
import type { Extension } from "../registry.ts";

const size = (bytes: number) =>
  bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : bytes >= 1e6 ? `${Math.round(bytes / 1e6)} MB` : bytes >= 1e3 ? `${Math.round(bytes / 1e3)} KB` : `${bytes} B`;

const when = (seconds: number) => {
  const date = new Date(seconds * 1000);
  return date.toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const ICON_FILE: Record<string, string> = { formai: "formportal", formslide: "formdeck" };
const iconFile = (product: string) => ICON_FILE[product] ?? product;

const appIcon = (tile: HTMLElement, product: string, name: string) => {
  if (tile.dataset.icon === product) return;
  tile.dataset.icon = product;
  const pick = (tone: string) => {
    const img = tile.querySelector<HTMLImageElement>(`img.${tone}`) ?? document.createElement("img");
    img.className = tone;
    img.alt = "";
    img.width = 176;
    img.height = 176;
    img.decoding = "async";
    img.onerror = () => {
      tile.querySelectorAll("img").forEach((i) => i.remove());
      tile.classList.remove("tile-icon");
      tile.textContent = name.replace(/^Form\.?/, "").slice(0, 2);
    };
    return img;
  };
  const dark = pick("ic-dark");
  const light = pick("ic-light");
  dark.src = `/apps/${iconFile(product)}.webp`;
  light.src = `/apps/${iconFile(product)}-light.webp`;
  if (!dark.isConnected) {
    tile.textContent = "";
    tile.classList.add("tile-icon");
    tile.append(dark, light);
  }
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
    const known = new Map<string, ProjectFile>();
    const versionRows = new Map<string, HTMLLIElement>();
    const inspector = document.querySelector<HTMLDialogElement>("[data-inspect-dialog]");
    let inspected = "";
    const fact = (field: string, text: string) => {
      const node = inspector?.querySelector<HTMLElement>(`[data-inspect='${field}']`);
      if (node && node.textContent !== text) node.textContent = text;
    };
    const bridge = pickBridge();
    const textBox = inspector?.querySelector<HTMLElement>("[data-inspect-text]");
    const said = inspector?.querySelector<HTMLElement>("[data-inspect-said]");
    const reveal = inspector?.querySelector<HTMLButtonElement>("[data-inspect-reveal]");
    const download = inspector?.querySelector<HTMLButtonElement>("[data-inspect-download]");
    let asked = 0;
    let nowHash: string | null | undefined;
    let keptHash: string | null | undefined;
    let saved = "";
    const sameness = () => {
      const text = nowHash === undefined || keptHash === undefined ? "" : !nowHash || !keptHash ? "" : nowHash === keptHash ? t("Same as the last kept version") : t("Changed since the last kept version");
      fact("same", text);
    };
    const note = (text: string, isNote: boolean) => {
      if (!textBox) return;
      if (textBox.textContent !== text) textBox.textContent = text;
      textBox.toggleAttribute("data-note", isNote);
    };
    const tell = (text: string, fault: boolean, path = "") => {
      fact("said", text);
      said?.toggleAttribute("data-fault", fault);
      saved = path;
      if (reveal && reveal.hidden !== !path) reveal.hidden = !path;
    };
    const facts = (path: string, file: ProjectFile) => {
      const ask = ++asked;
      nowHash = undefined;
      keptHash = undefined;
      fact("text", t("Looking"));
      fact("now", t("Looking"));
      fact("same", "");
      if (textBox) {
        textBox.hidden = Boolean(file.preview);
        note(t("Looking"), true);
      }
      tell("", false);
      if (download) download.disabled = false;
      bridge.fileText(path).then(
        (text) => {
          if (ask !== asked) return;
          if (!text) {
            fact("text", t("Not a text file"));
            note(t("No text preview for this kind of file"), true);
            return;
          }
          const counts = `${text.lines === 1 ? t("1 line") : t("{n} lines", { n: text.lines })}, ${text.words === 1 ? t("1 word") : t("{n} words", { n: text.words })}`;
          fact("text", text.whole ? counts : t("{counts} in the first 64 KB", { counts }));
          if (text.first_lines) note(text.first_lines, false);
          else note(t("The file is empty"), true);
        },
        (error: unknown) => {
          if (ask !== asked) return;
          fact("text", String(error instanceof Error ? error.message : error));
          note("", true);
        },
      );
      bridge.fileHash(path).then(
        (hash) => {
          if (ask !== asked) return;
          nowHash = hash.sha256;
          fact("now", hash.sha256 ?? t("Too large to hash here, over {size}", { size: size(hash.limit) }));
          sameness();
        },
        (error: unknown) => {
          if (ask !== asked) return;
          nowHash = null;
          fact("now", String(error instanceof Error ? error.message : error));
        },
      );
    };
    const inspect = (path: string) => {
      const file = known.get(path);
      if (!inspector || !file) return;
      inspected = path;
      current = path;
      facts(path, file);
      const dot = file.name.lastIndexOf(".");
      fact("name", file.name);
      fact("path", file.path);
      fact("size", size(file.bytes));
      fact("when", when(file.modified));
      fact("app", engine.name(file.product));
      fact("kind", dot > 0 ? file.name.slice(dot + 1).toUpperCase() : t("No extension"));
      fact("versions", t("Looking"));
      fact("sha256", "");
      const shot = inspector.querySelector<HTMLElement>("[data-inspect-shot]");
      if (shot) {
        shot.hidden = !file.preview;
        shot.style.backgroundImage = "";
        if (file.preview) void engine.dispatch("file.preview", { path: file.preview, into: shot });
      }
      if (!inspector.open) inspector.showModal();
      void engine.dispatch("file.versions", { path });
    };

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
        row.querySelector("[data-file-act='inspect']")?.addEventListener("click", () => inspect(row?.dataset.path ?? ""));
        mountedFiles.set(file.path, row);
      }
      known.set(file.path, file);
      if (row.dataset.product !== file.product) row.dataset.product = file.product;
      const tile = row.querySelector<HTMLElement>("[data-field='short']");
      if (tile) appIcon(tile, file.product, engine.name(file.product));
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
        let row = storageRows.get(`${what}\n${path}`);
        if (!row) {
          row = document.createElement("li");
          row.className = "store";
          row.innerHTML = '<span class="store-what"></span><span class="store-path mono"></span><span class="store-bytes"></span>';
          storageRows.set(`${what}\n${path}`, row);
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
      if (title) title.textContent = t("Versions of {file}", { file: name });
      const where = document.querySelector<HTMLElement>("[data-versions-path]");
      if (where) where.textContent = path;
      if (versionList.dataset.path !== path) {
        versionList.dataset.path = path;
        versionRows.clear();
        versionList.replaceChildren();
      }
      const rows = list.map((v: FileVersion, i: number) => {
        let li = versionRows.get(v.id);
        if (!li) {
          li = document.createElement("li");
          li.className = "version";
          li.dataset.version = v.id;
          const text = document.createElement("div");
          text.innerHTML = '<span class="row-name-text"></span><p class="row-sub"></p>';
          const back = document.createElement("button");
          back.type = "button";
          back.className = "btn";
          back.textContent = t("Go back to this");
          back.addEventListener("click", () => void engine.dispatch("file.versions", { path: versionList.dataset.path, action: "revert", version: v.id }));
          li.append(text, back);
          versionRows.set(v.id, li);
        }
        const [head, sub] = Array.from(li.querySelectorAll<HTMLElement>(".row-name-text, .row-sub"));
        const top = `${when(v.at)}${i === 0 ? ` ${t("(latest)")}` : ""}`;
        const meta = `${size(v.size)} · ${v.reason}`;
        if (head.textContent !== top) head.textContent = top;
        if (sub.textContent !== meta) sub.textContent = meta;
        const back = li.querySelector<HTMLButtonElement>("button");
        if (back && back.hidden !== (i === 0)) back.hidden = i === 0;
        return li;
      });
      for (const [id, li] of versionRows) {
        if (!rows.includes(li)) {
          li.remove();
          versionRows.delete(id);
        }
      }
      rows.forEach((li, i) => {
        if (versionList.children[i] !== li) versionList.insertBefore(li, versionList.children[i] ?? null);
      });
    });

    engine.on("versions", ({ path, list }) => {
      if (!inspector?.open || path !== inspected) return;
      fact("versions", list.length === 0 ? t("None kept yet") : list.length === 1 ? t("1 version") : t("{n} versions", { n: list.length }));
      fact("sha256", list[0]?.sha256 ?? t("None kept yet"));
      keptHash = list[0]?.sha256 ?? null;
      sameness();
    });
    download?.addEventListener("click", () => {
      const path = inspected;
      const ask = asked;
      if (!path) return;
      download.disabled = true;
      tell(t("Copying to Downloads"), false);
      bridge.fileDownload(path).then(
        (done) => {
          if (ask !== asked) return;
          download.disabled = false;
          tell(done.zipped ? t("Zipped into {path}", { path: done.path }) : t("Copied to {path}", { path: done.path }), false, done.path);
        },
        (error: unknown) => {
          if (ask !== asked) return;
          download.disabled = false;
          tell(String(error instanceof Error ? error.message : error), true);
        },
      );
    });
    reveal?.addEventListener("click", () => {
      if (saved) bridge.fileDownloadReveal(saved).catch((error: unknown) => tell(String(error instanceof Error ? error.message : error), true));
    });
    inspector?.querySelector("[data-inspect-keep]")?.addEventListener("click", () => inspected && void engine.dispatch("file.versions", { path: inspected, action: "save" }));
    inspector?.querySelector("[data-inspect-close]")?.addEventListener("click", () => inspector.close());
    inspector?.addEventListener("click", (event) => {
      if (event.target === inspector) inspector.close();
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
