import type { Bridge } from "../../../frontend/src/bridge/index.ts";
import portal from "../../../core/data/learn-portal.json";
import { demoBridge, isInstalled } from "../../../demo/src/bridge.ts";
import { inspectFile } from "../../../demo/src/inspect.ts";
import * as lib from "../../../demo/src/library.ts";
import { addOwnFont, fontsView, installFont, pickFont, queueFont, removeFont } from "./fonts.ts";
import { kept, remember } from "./state.ts";
import { bytesOf, items, mediaView, save, unsave } from "./stock.ts";
import mine from "./tutorials.json";
import { openLook, openOwnLook, openTemplate } from "./viewer.ts";

const MOODBOARD = "/Demo/Moodboard";

interface Step {
  title: string;
  body: string;
  route?: string | null;
  url?: string | null;
}
interface Tutorial {
  id: string;
  product: string;
  title: string;
  summary: string;
  minutes: number;
  level: string;
  steps: Step[];
}
const tutorials: Tutorial[] = [...(portal.tutorials as Tutorial[]), ...(mine as Tutorial[])];

export const seeded: Promise<void> = (async () => {
  if (kept().apps) return;
  const have = await demoBridge.installs();
  await Promise.all(["formcut", "formvfx"].filter((p) => !have.some((h) => h.product === p)).map((p) => demoBridge.install(p, "stable", () => undefined)));
  kept().apps = true;
  remember();
})().catch(() => undefined);

let board: Promise<void> | null = null;
function moodboard(): Promise<void> {
  board ??= (async () => {
    for (const m of items.filter((x) => x.kind === "image")) await lib.put(MOODBOARD, m.file, await bytesOf(m), "image/jpeg", "first seen");
  })();
  return board;
}

function chooseFiles(options: { directory?: boolean; accept?: string }): Promise<File[]> {
  return new Promise((done) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    if (options.directory) input.setAttribute("webkitdirectory", "");
    if (options.accept) input.accept = options.accept;
    input.addEventListener("change", () => done(Array.from(input.files ?? [])));
    input.addEventListener("cancel", () => done([]));
    input.click();
  });
}

const click = (sel: string) => document.querySelector<HTMLElement>(sel)?.click();

export async function handleDropped(file: File): Promise<void> {
  const name = file.name.toLowerCase();
  if (/\.(ttf|otf)$/.test(name)) {
    queueFont(file);
    click("[data-route-to='fonts']");
    click("[data-font-own-add]");
  } else if (name.endsWith(".cube")) await openOwnLook(file);
  else if (file.type.startsWith("image/")) await openLook({ file });
  else await inspectFile(file);
}

export const libraryBridge: Bridge = {
  ...demoBridge,
  installs: async () => {
    await seeded;
    return demoBridge.installs();
  },
  fonts: fontsView,
  fontInstall: installFont,
  fontRemove: async (family, style) => removeFont(family, style),
  fontPick: () => pickFont(() => chooseFiles({ accept: ".ttf,.otf" })),
  fontAdd: addOwnFont,
  media: async () => {
    await seeded;
    return mediaView();
  },
  mediaThumb: async (url) => `./${url.replace(/^\.?\//, "")}`,
  mediaSave: async (id, useTemplate) => {
    const item = await save(id);
    if (!useTemplate) return {};
    const opened = item.product && isInstalled(item.product) ? item.product : null;
    if (opened) {
      window.setTimeout(() => {
        if (item.file.endsWith(".cube")) void openLook({ look: item.id });
        else void openTemplate(item);
      }, 120);
    }
    return { copied_to: `~/Documents/Form/Templates/${item.file}`, opened_with: opened };
  },
  mediaRemove: async (id) => unsave(id),
  learn: async () => ({
    index_error: null,
    tutorials: tutorials.map((t) => {
      const done = [...(kept().learn[t.id] ?? [])].sort((a, b) => a - b);
      return { ...t, steps: t.steps.map((s) => ({ title: s.title, body: s.body, route: s.route ?? null, url: s.url ?? null })), done_steps: done, finished: done.length === t.steps.length };
    }),
  }),
  learnMark: async (id, step, done, reset) => {
    const t = tutorials.find((x) => x.id === id);
    if (!t) throw new Error(`there is no tutorial ${id}`);
    const set = new Set(kept().learn[id] ?? []);
    if (reset) set.clear();
    else if (step !== null) {
      if (step < 1 || step > t.steps.length) throw new Error(`${t.title} has ${t.steps.length} steps; there is no step ${step}`);
      if (done) set.add(step);
      else set.delete(step);
    }
    kept().learn[id] = Array.from(set);
    remember();
  },
  filesScan: async (query) => {
    await moodboard();
    return { scan: { folders: lib.folderViews(), files: lib.scan(query), truncated: false, new_versions: 0 }, suggested: MOODBOARD };
  },
  folderPick: async () => {
    const files = await chooseFiles({ directory: true });
    if (!files.length) return null;
    await moodboard();
    const root = (files[0].webkitRelativePath || files[0].name).split("/")[0];
    const folder = `/Picked/${root}`;
    lib.addFolder(folder);
    for (const file of files.slice(0, 200)) {
      if (file.size > 40_000_000) continue;
      const rel = (file.webkitRelativePath || file.name).split("/").slice(1).join(" - ") || file.name;
      await lib.put(folder, rel, new Uint8Array(await file.arrayBuffer()), file.type, "first seen");
    }
    return folder;
  },
  fileOpen: async (path) => {
    if (!lib.has(path)) throw new Error(`${path} does not exist`);
    return lib.current(path)?.product ?? "formai";
  },
  onFileDrop: (handler) => {
    document.addEventListener("dragover", (event) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.preventDefault();
      handler([], "over");
    });
    document.addEventListener("dragleave", (event) => {
      if (!event.relatedTarget) handler([], "leave");
    });
    document.addEventListener("drop", (event) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.preventDefault();
      handler([], "leave");
      const file = event.dataTransfer.files[0];
      if (file) void handleDropped(file);
    });
  },
};

export async function openFromFiles(path: string): Promise<boolean> {
  const entry = lib.current(path);
  if (!entry) return false;
  if (entry.type.startsWith("image/")) {
    const m = items.find((x) => x.file === entry.name);
    if (m) await openLook({ photo: m.id });
    else await openLook({ blob: new Blob([entry.data as BlobPart], { type: entry.type }), name: entry.name });
  } else await inspectFile(new File([entry.data as BlobPart], entry.name, { type: entry.type }));
  return true;
}
