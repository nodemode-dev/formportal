import type { MediaItem } from "../../../frontend/src/engine/types.ts";
import { decoder, download, sizeText } from "../../../demo/src/util.ts";
import { applyLut, parseCube, type Lut } from "./looks.ts";
import { usable } from "./fonts.ts";
import { bytesOf, find, items } from "./stock.ts";

const q = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const MAX_SHOW = 960;
const MAX_SAVE = 2048;

const looks = () => items.filter((m) => m.kind === "template" && m.file.endsWith(".cube"));
const photos = () => items.filter((m) => m.kind === "image");

interface Photo {
  name: string;
  bitmap: ImageBitmap;
}

const cache = new Map<string, Lut>();
let photo: Photo | null = null;
let original: ImageData | null = null;
let graded: ImageData | null = null;
let lut: Lut | null = null;
let lutName = "";
let own: { id: string; name: string; lut: Lut } | null = null;
let frame = 0;
let built = false;

async function lutFor(id: string): Promise<Lut> {
  if (own && id === own.id) return own.lut;
  const cached = cache.get(id);
  if (cached) return cached;
  const m = find(id);
  if (!m) throw new Error(`${id} is not a look`);
  const parsed = parseCube(decoder.decode(await bytesOf(m)));
  cache.set(id, parsed);
  return parsed;
}

function say(text: string, tone = ""): void {
  const node = q("[data-look-say]");
  node.textContent = text;
  if (tone) node.dataset.tone = tone;
  else delete node.dataset.tone;
}

function paint(): void {
  frame = 0;
  if (!original || !lut) return;
  const before = q<HTMLCanvasElement>("[data-look-before]");
  const after = q<HTMLCanvasElement>("[data-look-after]");
  const amount = Number(q<HTMLInputElement>("[data-look-amount]").value) / 100;
  graded = applyLut(original, lut, amount, graded && graded.width === original.width && graded.height === original.height ? graded : undefined);
  after.getContext("2d")?.putImageData(graded, 0, 0);
  before.getContext("2d")?.putImageData(original, 0, 0);
}

function queue(): void {
  if (!frame) frame = requestAnimationFrame(paint);
}

function useBitmap(next: Photo): void {
  photo = next;
  const scale = Math.min(1, MAX_SHOW / Math.max(next.bitmap.width, next.bitmap.height));
  const w = Math.max(1, Math.round(next.bitmap.width * scale));
  const h = Math.max(1, Math.round(next.bitmap.height * scale));
  const scratch = document.createElement("canvas");
  scratch.width = w;
  scratch.height = h;
  const g = scratch.getContext("2d", { willReadFrequently: true });
  if (!g) return;
  g.drawImage(next.bitmap, 0, 0, w, h);
  original = g.getImageData(0, 0, w, h);
  graded = null;
  for (const sel of ["[data-look-before]", "[data-look-after]"]) {
    const c = q<HTMLCanvasElement>(sel);
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
  }
  queue();
}

async function showPhoto(item: MediaItem): Promise<void> {
  const data = await bytesOf(item);
  useBitmap({ name: item.file, bitmap: await createImageBitmap(new Blob([data as BlobPart], { type: "image/jpeg" })) });
  for (const b of document.querySelectorAll<HTMLElement>("[data-look-photo]")) b.setAttribute("aria-pressed", String(b.dataset.lookPhoto === item.id));
  say(`${item.title}, ${item.creator}, ${item.licence}.`);
}

async function showFile(file: Blob, name: string): Promise<void> {
  try {
    useBitmap({ name, bitmap: await createImageBitmap(file) });
    for (const b of document.querySelectorAll<HTMLElement>("[data-look-photo]")) b.setAttribute("aria-pressed", "false");
    say(`${name}: your photo, graded on this page only.`);
  } catch {
    say(`${name} could not be read as a picture.`, "bad");
  }
}

async function selectLook(id: string): Promise<void> {
  try {
    lut = await lutFor(id);
    const m = find(id);
    lutName = m ? m.file.replace(/\.cube$/, "") : (own?.name ?? "look").replace(/\.cube$/i, "");
    const pick = q<HTMLSelectElement>("[data-look-pick]");
    if (pick.value !== id) pick.value = id;
    q("[data-look-sub]").textContent = `${m ? m.title : (own?.name ?? "Your look")}: ${lut.size} points per side, ${lut.size ** 3} colours read from the .cube.`;
    queue();
  } catch (e) {
    say(e instanceof Error ? e.message : String(e), "bad");
  }
}

function build(): void {
  if (built) return;
  built = true;
  const pick = q<HTMLSelectElement>("[data-look-pick]");
  for (const m of looks()) {
    const o = document.createElement("option");
    o.value = m.id;
    o.textContent = m.title.replace(/ \(.*\)$/, "");
    pick.append(o);
  }
  const list = q("[data-look-photos]");
  for (const m of photos()) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "look-photo";
    b.dataset.lookPhoto = m.id;
    b.setAttribute("aria-pressed", "false");
    b.setAttribute("aria-label", m.title);
    const img = document.createElement("img");
    img.alt = "";
    img.width = 64;
    img.height = 44;
    img.src = `./${m.thumbnail ?? ""}`;
    b.append(img);
    b.addEventListener("click", () => void showPhoto(m));
    li.append(b);
    list.append(li);
  }
}

export async function openLook(opts: { look?: string; photo?: string; file?: File; blob?: Blob; name?: string } = {}): Promise<void> {
  build();
  const dialog = q<HTMLDialogElement>("[data-look-dialog]");
  if (!dialog.open) dialog.showModal();
  await selectLook(opts.look ?? (lut ? q<HTMLSelectElement>("[data-look-pick]").value : "formencoder-look-teal-and-orange"));
  if (opts.file) await showFile(opts.file, opts.file.name);
  else if (opts.blob) await showFile(opts.blob, opts.name ?? "photo");
  else if (opts.photo) {
    const m = find(opts.photo);
    if (m) await showPhoto(m);
  } else if (!photo) {
    const m = find("photo-trajans-market-rome");
    if (m) await showPhoto(m);
  }
}

export async function openOwnLook(file: File): Promise<void> {
  try {
    const parsed = parseCube(await file.text());
    own = { id: "own-look", name: file.name, lut: parsed };
    const pick = q<HTMLSelectElement>("[data-look-pick]");
    build();
    let o = Array.from(pick.options).find((x) => x.value === "own-look");
    if (!o) {
      o = document.createElement("option");
      o.value = "own-look";
      pick.prepend(o);
    }
    o.textContent = `${file.name} (yours)`;
    await openLook({ look: "own-look" });
  } catch (e) {
    await openLook();
    say(e instanceof Error ? e.message : String(e), "bad");
  }
}

async function saveGraded(): Promise<void> {
  if (!photo || !lut) return;
  const scale = Math.min(1, MAX_SAVE / Math.max(photo.bitmap.width, photo.bitmap.height));
  const w = Math.round(photo.bitmap.width * scale);
  const h = Math.round(photo.bitmap.height * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return;
  g.drawImage(photo.bitmap, 0, 0, w, h);
  g.putImageData(applyLut(g.getImageData(0, 0, w, h), lut, Number(q<HTMLInputElement>("[data-look-amount]").value) / 100), 0, 0);
  const blob = await new Promise<Blob | null>((done) => c.toBlob(done, "image/jpeg", 0.92));
  if (!blob) return;
  const stem = photo.name.replace(/\.[^.]+$/, "");
  const name = `${stem}-${lutName}.jpg`;
  download(name, new Uint8Array(await blob.arrayBuffer()), "image/jpeg");
  say(`${name} saved, ${w} by ${h}, ${sizeText(blob.size)}.`, "good");
}

let preset: { all: PresetRow[]; groups: string[] } | null = null;

interface PresetRow {
  name: string;
  category: string;
  description: string;
  animators: number;
}

function listPresets(): void {
  if (!preset) return;
  const group = q<HTMLSelectElement>("[data-tpl-group]").value;
  const words = q<HTMLInputElement>("[data-tpl-query]").value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = preset.all.filter((p) => (group === "all" || p.category === group) && words.every((w) => `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(w)));
  const table = document.createElement("table");
  table.className = "demo-table";
  table.innerHTML = "<thead><tr><th>Preset</th><th>Group</th><th>What it does</th><th>Animators</th></tr></thead>";
  const body = document.createElement("tbody");
  for (const p of rows) {
    const tr = document.createElement("tr");
    for (const text of [p.name, p.category, p.description, String(p.animators)]) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.append(td);
    }
    body.append(tr);
  }
  table.append(body);
  q("[data-tpl-view]").replaceChildren(table);
  q("[data-tpl-count]").textContent = `${rows.length} of ${preset.all.length}`;
}

let templateFile: { name: string; data: Uint8Array; type: string } | null = null;

export async function openTemplate(item: MediaItem): Promise<void> {
  const dialog = q<HTMLDialogElement>("[data-tpl-dialog]");
  const data = await bytesOf(item);
  templateFile = { name: item.file, data, type: item.file.endsWith(".json") ? "application/json" : "text/plain" };
  q("[data-tpl-title]").textContent = item.title;
  const tools = q("[data-tpl-tools]");
  const view = q("[data-tpl-view]");
  if (item.file.endsWith(".json")) {
    const parsed = JSON.parse(decoder.decode(data)) as { categories: string[]; presets: { name: string; category: string; description: string; animators: unknown[] }[] };
    preset = { all: parsed.presets.map((p) => ({ name: p.name, category: p.category, description: p.description, animators: p.animators.length })), groups: parsed.categories };
    const group = q<HTMLSelectElement>("[data-tpl-group]");
    group.replaceChildren(new Option("All groups", "all"), ...parsed.categories.map((c) => new Option(c, c)));
    q<HTMLInputElement>("[data-tpl-query]").value = "";
    tools.hidden = false;
    q("[data-tpl-sub]").textContent = `The demo's viewer stands in for ${item.product === "formvfx" ? "FormVFX" : "the app"}: ${parsed.presets.length} presets in ${parsed.categories.length} groups, read from the file on this page.`;
    listPresets();
  } else {
    preset = null;
    tools.hidden = true;
    const pre = document.createElement("pre");
    pre.textContent = decoder.decode(data);
    view.replaceChildren(pre);
    q("[data-tpl-sub]").textContent = "The demo's viewer stands in for FormCut: this is the whole shader, which scales a clip's colour by a gain that pulses between 0.85 and 1.0.";
  }
  if (!dialog.open) dialog.showModal();
}

let familyKey = "";

function applyType(): void {
  const text = q<HTMLTextAreaElement>("[data-type-text]");
  const family = q<HTMLSelectElement>("[data-type-family]").value;
  const weight = q<HTMLSelectElement>("[data-type-weight]").value;
  const size = q<HTMLInputElement>("[data-type-size]").value;
  const italic = q<HTMLInputElement>("[data-type-italic]").checked;
  if (family) text.style.fontFamily = `"${family}", sans-serif`;
  text.style.fontWeight = weight;
  text.style.fontStyle = italic ? "italic" : "normal";
  text.style.fontSize = `${size}px`;
  q("[data-type-out]").textContent = `${size} px`;
  const row = usable().find((u) => u.family === family);
  q("[data-type-line]").textContent = row ? `${row.family} · ${row.licence} · ${row.source}` : "";
}

function refreshType(): void {
  const list = usable();
  const none = list.length === 0;
  const select = q<HTMLSelectElement>("[data-type-family]");
  const key = list.map((u) => u.family).join("|");
  if (key !== familyKey) {
    familyKey = key;
    const keep = select.value;
    select.replaceChildren(...list.map((u) => new Option(u.family, u.family)));
    if (list.some((u) => u.family === keep)) select.value = keep;
  }
  select.disabled = none;
  q<HTMLButtonElement>("[data-type-save]").hidden = none;
  q<HTMLButtonElement>("[data-type-fonts]").hidden = !none;
  q("[data-type-say]").textContent = none ? "No font is installed yet. Install a family in Fonts and it shows up here." : "";
  const row = list.find((u) => u.family === select.value);
  const weights = row ? (row.variable ? [300, 400, 500, 600, 700, 800] : Array.from(new Set([...row.weights, 400])).sort((a, b) => a - b)) : [400];
  const weight = q<HTMLSelectElement>("[data-type-weight]");
  const had = weight.value;
  weight.replaceChildren(...weights.map((w) => new Option(String(w), String(w))));
  weight.value = weights.map(String).includes(had) ? had : "400";
  const italic = q<HTMLInputElement>("[data-type-italic]");
  italic.disabled = !row?.italic;
  if (!row?.italic) italic.checked = false;
  applyType();
}

export function openTester(): void {
  const dialog = q<HTMLDialogElement>("[data-type-dialog]");
  refreshType();
  if (!dialog.open) dialog.showModal();
}

async function saveSpecimen(): Promise<void> {
  const family = q<HTMLSelectElement>("[data-type-family]").value;
  const weight = q<HTMLSelectElement>("[data-type-weight]").value;
  const italic = q<HTMLInputElement>("[data-type-italic]").checked;
  const size = Number(q<HTMLInputElement>("[data-type-size]").value) * 2;
  const text = q<HTMLTextAreaElement>("[data-type-text]").value || family;
  const font = (px: number, w = weight) => `${italic ? "italic " : ""}${w} ${px}px "${family}", sans-serif`;
  await document.fonts.load(font(size));
  const c = document.createElement("canvas");
  c.width = 1600;
  c.height = 1000;
  const g = c.getContext("2d");
  if (!g) return;
  g.fillStyle = "#0f0e13";
  g.fillRect(0, 0, 1600, 1000);
  g.fillStyle = "#f97316";
  g.fillRect(96, 96, 56, 6);
  g.fillStyle = "#a4a4a4";
  g.font = "500 26px system-ui, sans-serif";
  const row = usable().find((u) => u.family === family);
  g.fillText(`${family}, weight ${weight}${italic ? ", italic" : ""}  ·  ${row?.licence ?? ""}  ·  installed with FormPortal`, 96, 150);
  g.fillStyle = "#f7f7f7";
  g.font = font(size);
  g.textBaseline = "top";
  let y = 220;
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (g.measureText(next).width > 1400 && line) {
        g.fillText(line, 96, y);
        y += size * 1.2;
        line = word;
      } else line = next;
    }
    g.fillText(line, 96, y);
    y += size * 1.2;
  }
  g.font = font(40);
  g.fillStyle = "#c9c9d1";
  g.fillText("ABCDEFGHIJKLMNOPQRSTUVWXYZ", 96, 820);
  g.fillText("abcdefghijklmnopqrstuvwxyz 0123456789", 96, 880);
  const blob = await new Promise<Blob | null>((done) => c.toBlob(done, "image/png"));
  if (!blob) return;
  const name = `${family.toLowerCase().replace(/\s+/g, "-")}-specimen.png`;
  download(name, new Uint8Array(await blob.arrayBuffer()), "image/png");
  q("[data-type-say]").textContent = `${name} saved, 1600 by 1000, ${sizeText(blob.size)}.`;
}

export function wireViewers(goFonts: () => void): void {
  q<HTMLInputElement>("[data-look-amount]").addEventListener("input", (e) => {
    q("[data-look-out]").textContent = `${(e.target as HTMLInputElement).value}%`;
    queue();
  });
  q<HTMLSelectElement>("[data-look-pick]").addEventListener("change", (e) => void selectLook((e.target as HTMLSelectElement).value));
  q<HTMLInputElement>("[data-look-split]").addEventListener("input", (e) => q("[data-look-stage]").style.setProperty("--split", `${(e.target as HTMLInputElement).value}%`));
  q("[data-look-save]").addEventListener("click", () => void saveGraded());
  q("[data-look-close]").addEventListener("click", () => q<HTMLDialogElement>("[data-look-dialog]").close());
  const photoPick = q<HTMLInputElement>("[data-look-pick-photo]");
  q("[data-look-own]").addEventListener("click", () => photoPick.click());
  photoPick.addEventListener("change", () => {
    const f = photoPick.files?.[0];
    photoPick.value = "";
    if (f) void showFile(f, f.name);
  });
  const lutPick = q<HTMLInputElement>("[data-look-pick-lut]");
  q("[data-look-lut]").addEventListener("click", () => lutPick.click());
  lutPick.addEventListener("change", () => {
    const f = lutPick.files?.[0];
    lutPick.value = "";
    if (f) void openOwnLook(f);
  });
  q("[data-tpl-close]").addEventListener("click", () => q<HTMLDialogElement>("[data-tpl-dialog]").close());
  q("[data-tpl-download]").addEventListener("click", () => {
    if (templateFile) download(templateFile.name, templateFile.data, templateFile.type);
  });
  q("[data-tpl-group]").addEventListener("change", listPresets);
  q("[data-tpl-query]").addEventListener("input", listPresets);
  for (const sel of ["[data-type-weight]", "[data-type-size]", "[data-type-italic]"]) q(sel).addEventListener("input", applyType);
  q("[data-type-family]").addEventListener("change", refreshType);
  q("[data-type-text]").addEventListener("input", applyType);
  q("[data-type-save]").addEventListener("click", () => void saveSpecimen());
  q("[data-type-close]").addEventListener("click", () => q<HTMLDialogElement>("[data-type-dialog]").close());
  q("[data-type-fonts]").addEventListener("click", () => {
    q<HTMLDialogElement>("[data-type-dialog]").close();
    goFonts();
  });
}
