import type { FontFamilyEntry, FontsView, InstalledFont } from "../../../frontend/src/engine/types.ts";
import storeFonts from "../../../core/data/store-fonts.json";
import { bundledFamilies, fontBytes, fontsReady } from "../../../demo/src/store.ts";
import { readFont } from "../../../demo/src/sfnt.ts";
import { sha256 } from "../../../demo/src/util.ts";
import { kept, remember } from "./state.ts";

const index: FontFamilyEntry[] = (storeFonts as unknown as { families: FontFamilyEntry[] }).families.filter((f) => bundledFamilies.has(f.id));
const folder = "~/.local/share/fonts/FormPortal";
const installed: InstalledFont[] = [];
const faces = new Map<string, FontFace>();
const owned = new Map<string, { variable: boolean; italic: boolean }>();
const picked = new Map<string, File>();
let waiting: File | null = null;
const listeners = new Set<() => void>();

export function onFontsChange(run: () => void): void {
  listeners.add(run);
}

function changed(): void {
  listeners.forEach((run) => run());
}

function register(key: string, family: string, weight: string, italic: boolean, data: Uint8Array): Promise<void> {
  const old = faces.get(key);
  if (old) document.fonts.delete(old);
  const face = new FontFace(family, data.slice().buffer as ArrayBuffer, { weight, style: italic ? "italic" : "normal" });
  return face.load().then((done) => {
    document.fonts.add(done);
    faces.set(key, done);
    changed();
  });
}

function weightOf(style: { style: string; weight: number }): string {
  return style.style.includes("Variable") ? "100 900" : String(style.weight);
}

async function put(family: FontFamilyEntry, style: FontFamilyEntry["styles"][number], recorded?: string): Promise<void> {
  const data = fontBytes(style.url.replace(/^bundled:/, ""));
  if (!data) throw new Error(`${style.file} is not bundled in the demo`);
  if ((await sha256(data)) !== style.sha256) throw new Error(`${style.file} does not match its SHA-256 in the font index; it was not installed`);
  await register(`${family.id}:${style.style}`, family.family, weightOf(style), style.italic, data);
  const had = installed.find((f) => f.family_id === family.id && f.style === style.style);
  const sha = recorded ?? style.sha256;
  if (had) had.sha256 = sha;
  else installed.push({ family: family.family, style: style.style, family_id: family.id, file: `${folder}/FormPortal-${family.id}-${style.style}.ttf`, sha256: sha, source: "index", licence: family.licence });
}

function persist(): void {
  kept().fonts = installed.filter((f) => f.source === "index").map((f) => ({ id: f.family_id ?? "", style: f.style, sha256: f.sha256 }));
  remember();
}

export const fontsStart: Promise<void> = (async () => {
  await fontsReady;
  for (const record of kept().fonts) {
    const family = index.find((f) => f.id === record.id);
    const style = family?.styles.find((s) => s.style === record.style);
    if (family && style) await put(family, style, record.sha256 && record.sha256 !== "" ? (record.sha256 === "earlier" ? "0".repeat(52) + "4a1c" : record.sha256) : undefined);
  }
})();

export async function fontsView(): Promise<FontsView> {
  await fontsStart;
  const updates = installed.filter((f) => f.source === "index" && index.find((x) => x.id === f.family_id)?.styles.some((s) => s.style === f.style && s.sha256 !== f.sha256));
  return { index: { families: index }, index_error: null, installed: installed.map((f) => ({ ...f })), updates: updates.map((f) => ({ ...f })), folder };
}

export async function installFont(id: string, style?: string): Promise<void> {
  const family = index.find((f) => f.id === id);
  if (!family) throw new Error(`${id} is not in the font index`);
  for (const s of family.styles.filter((x) => !style || x.style === style)) await put(family, s);
  persist();
}

export function removeFont(family: string, style?: string): void {
  for (let i = installed.length - 1; i >= 0; i -= 1) {
    const f = installed[i];
    if ((f.family === family || f.family_id === family) && (!style || f.style === style)) {
      const key = f.family_id ? `${f.family_id}:${f.style}` : `own:${f.family}:${f.style}`;
      const face = faces.get(key);
      if (face) document.fonts.delete(face);
      faces.delete(key);
      owned.delete(key);
      installed.splice(i, 1);
    }
  }
  persist();
  changed();
}

export function queueFont(file: File): void {
  waiting = file;
}

export async function pickFont(choose: () => Promise<File[]>): Promise<string | null> {
  const file = waiting ?? (await choose())[0];
  waiting = null;
  if (!file) return null;
  picked.set(`/Picked/${file.name}`, file);
  return `/Picked/${file.name}`;
}

export async function addOwnFont(path: string, rights: boolean): Promise<void> {
  if (!rights) throw new Error("adding your own font needs your confirmation that you have the right to use it on this computer");
  const file = picked.get(path);
  if (!file) throw new Error(`${path} was not picked in this session`);
  const data = new Uint8Array(await file.arrayBuffer());
  const facts = readFont(data);
  const key = `own:${facts.family}:${facts.style}`;
  await register(key, facts.family, "400", /italic|oblique/i.test(facts.style), data);
  owned.set(key, { variable: false, italic: /italic|oblique/i.test(facts.style) });
  installed.push({ family: facts.family, style: facts.style, family_id: null, file: `${folder}/FormPortal-own-${file.name}`, sha256: await sha256(data), source: "own", licence: null });
}

export interface Usable {
  family: string;
  variable: boolean;
  italic: boolean;
  weights: number[];
  licence: string;
  source: string;
}

export function usable(): Usable[] {
  const by = new Map<string, Usable>();
  for (const f of installed) {
    const entry = index.find((x) => x.id === f.family_id);
    const style = entry?.styles.find((s) => s.style === f.style);
    const row = by.get(f.family) ?? { family: f.family, variable: false, italic: false, weights: [], licence: f.licence ?? "your own file", source: f.source === "own" ? "Your own" : "Font library" };
    if (style?.style.includes("Variable")) row.variable = true;
    if (style?.italic || /italic|oblique/i.test(f.style)) row.italic = true;
    else if (style && !style.style.includes("Variable")) row.weights.push(style.weight);
    by.set(f.family, row);
  }
  return Array.from(by.values());
}
