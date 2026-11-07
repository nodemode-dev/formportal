import { decoder, download, hex, sha256, sizeText } from "./util.ts";
import { readZip } from "./zip.ts";
import { readFont } from "./sfnt.ts";
import { extOf, current, keep, put, productFor, sidecar } from "./library.ts";
import { signedCatalogue, verify } from "./catalogue.ts";
import { trustedKeys } from "./store.ts";

type Kind = "image" | "audio" | "font" | "zip" | "catalogue" | "json" | "text" | "binary";

interface Subject {
  name: string;
  label: string;
  data: Uint8Array;
  type: string;
  path: string | null;
  product: string | null;
}

let subject: Subject | null = null;
let serial = 0;
let urls: string[] = [];
let engineName: (id: string) => string = (id) => id;

const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel) as T;

export function setNamer(fn: (id: string) => string): void {
  engineName = fn;
}

function kindOf(name: string, data: Uint8Array): Kind {
  const b = data;
  const ext = extOf(name);
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8) return "image";
  if (b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image";
  if (b.length > 12 && decoder.decode(b.subarray(0, 4)) === "RIFF") {
    const tag = decoder.decode(b.subarray(8, 12));
    if (tag === "WEBP") return "image";
    if (tag === "WAVE") return "audio";
  }
  if (b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4) return "zip";
  const head = (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3];
  if (head === 0x00010000 || head === 0x4f54544f || head === 0x74727565 || head === 0x774f4632) return "font";
  if (ext === "svg") return "image";
  const sample = b.subarray(0, 4096);
  if (sample.includes(0)) return "binary";
  if (ext === "json") {
    try {
      const parsed = JSON.parse(decoder.decode(b)) as { format?: string };
      return parsed && parsed.format === "formai-catalog" ? "catalogue" : "json";
    } catch {
      return "text";
    }
  }
  return "text";
}

function mimeOf(name: string, data: Uint8Array, kind: Kind): string {
  const ext = extOf(name);
  if (kind === "image") return ext === "svg" ? "image/svg+xml" : data[0] === 0x89 ? "image/png" : data[0] === 0xff ? "image/jpeg" : data[0] === 0x47 ? "image/gif" : "image/webp";
  if (kind === "audio") return "audio/wav";
  if (kind === "zip") return "application/zip";
  if (kind === "font") return "font/ttf";
  if (kind === "catalogue" || kind === "json") return "application/json";
  return kind === "text" ? "text/plain" : "application/octet-stream";
}

function say(text: string, tone = ""): void {
  const node = q("[data-inspect-say]");
  node.textContent = text;
  if (tone) node.dataset.tone = tone;
  else delete node.dataset.tone;
}

function facts(rows: [string, string][]): void {
  const host = q("[data-inspect-facts]");
  host.replaceChildren();
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    row.append(dt, dd);
    host.append(row);
  }
}

function table(head: string[], rows: (string | { text: string; tone: string })[][]): HTMLTableElement {
  const t = document.createElement("table");
  t.className = "demo-table";
  const h = t.createTHead().insertRow();
  for (const label of head) {
    const th = document.createElement("th");
    th.textContent = label;
    h.append(th);
  }
  const body = t.createTBody();
  for (const row of rows) {
    const tr = body.insertRow();
    for (const cell of row) {
      const td = tr.insertCell();
      if (typeof cell === "string") td.textContent = cell;
      else {
        td.textContent = cell.text;
        td.className = cell.tone;
      }
    }
  }
  return t;
}

function url(data: Uint8Array, type: string): string {
  const made = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  urls.push(made);
  return made;
}

async function viewImage(view: HTMLElement, s: Subject, type: string, extra: [string, string][]): Promise<void> {
  const img = document.createElement("img");
  img.alt = s.name;
  img.src = url(s.data, type);
  view.append(img);
  await img.decode().catch(() => undefined);
  extra.push(["Pixels", img.naturalWidth ? `${img.naturalWidth} by ${img.naturalHeight}` : "not decodable"]);
}

function viewAudio(view: HTMLElement, s: Subject, extra: [string, string][]): void {
  const dv = new DataView(s.data.buffer, s.data.byteOffset, s.data.byteLength);
  let at = 12;
  let rate = 0;
  let channels = 0;
  let bits = 0;
  let start = 0;
  let length = 0;
  while (at + 8 <= s.data.length) {
    const id = decoder.decode(s.data.subarray(at, at + 4));
    const size = dv.getUint32(at + 4, true);
    if (id === "fmt ") {
      channels = dv.getUint16(at + 10, true);
      rate = dv.getUint32(at + 12, true);
      bits = dv.getUint16(at + 22, true);
    } else if (id === "data") {
      start = at + 8;
      length = Math.min(size, s.data.length - start);
      break;
    }
    at += 8 + size + (size % 2);
  }
  const frames = channels && bits ? Math.floor(length / (channels * (bits / 8))) : 0;
  extra.push(["Audio", `${channels} ch, ${rate} Hz, ${bits} bit, ${(frames / (rate || 1)).toFixed(2)} s`]);
  const canvas = document.createElement("canvas");
  const width = 1200;
  canvas.width = width;
  canvas.height = 240;
  const g = canvas.getContext("2d");
  if (g && bits === 16 && frames) {
    g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent-color").trim() || "#ff7a1a";
    const per = Math.max(1, Math.floor(frames / width));
    for (let x = 0; x < width; x += 1) {
      let lo = 0;
      let hi = 0;
      for (let i = 0; i < per; i += 1) {
        const v = dv.getInt16(start + ((x * per + i) * channels) * 2, true) / 32768;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      g.fillRect(x, 120 - hi * 116, 1, Math.max(1, (hi - lo) * 116));
    }
  }
  const audio = document.createElement("audio");
  audio.controls = true;
  audio.src = url(s.data, "audio/wav");
  view.append(canvas, audio);
}

async function viewFont(view: HTMLElement, s: Subject, extra: [string, string][]): Promise<void> {
  const f = readFont(s.data);
  extra.push(["Family", `${f.family} ${f.style}`], ["Glyphs", `${f.glyphs} on ${f.unitsPerEm} units`], ["Format", f.flavour], ["Version", f.version || "none stated"]);
  const name = `demo-inspect-${(serial += 1)}`;
  const face = new FontFace(name, s.data.slice().buffer as ArrayBuffer);
  await face.load();
  document.fonts.add(face);
  const box = document.createElement("div");
  box.className = "demo-specimen";
  for (const [size, text] of [[40, "Sphinx of black quartz"], [24, "Judge my vow 0123456789"], [15, "The five boxing wizards jump quickly. Aa Bb Cc Dd Ee Ff Gg"]] as [number, string][]) {
    const line = document.createElement("div");
    line.textContent = text;
    line.style.fontFamily = `"${name}"`;
    line.style.fontSize = `${size}px`;
    box.append(line);
  }
  const rights = document.createElement("pre");
  rights.textContent = f.licence ? `Licence text in the file: ${f.licence}` : "The file states no licence.";
  view.append(box, rights);
}

async function viewZip(view: HTMLElement, s: Subject, extra: [string, string][]): Promise<void> {
  const list = await readZip(s.data);
  const rows = await Promise.all(list.map(async (e) => [e.name, sizeText(e.size), sizeText(e.packed), { text: e.crcOk ? `ok ${e.crc.toString(16).padStart(8, "0")}` : "mismatch", tone: e.crcOk ? "ok" : "bad" }, (await sha256(e.data)).slice(0, 16)]));
  extra.push(["Entries", `${list.length}, ${list.every((e) => e.crcOk) ? "every CRC-32 matches" : "a CRC-32 does not match"}`]);
  view.append(table(["Entry", "Size", "Packed", "CRC-32", "SHA-256"], rows));
  const manifest = list.find((e) => e.name === "manifest.json");
  if (manifest) {
    const pre = document.createElement("pre");
    pre.textContent = decoder.decode(manifest.data);
    view.append(pre);
  }
}

async function viewCatalogue(view: HTMLElement, s: Subject, extra: [string, string][]): Promise<void> {
  const body = decoder.decode(s.data);
  const parsed = JSON.parse(body) as { format_version?: number; generated?: string; products?: { id?: string; name?: string; state?: string; channels?: Record<string, { version?: string; artifacts?: unknown[] }> }[] };
  const problems: string[] = [];
  if (parsed.format_version !== 1) problems.push("format_version is not 1");
  if (!Array.isArray(parsed.products)) problems.push("products is missing");
  const products = parsed.products ?? [];
  for (const p of products) if (!p.id || !p.name || !p.channels) problems.push(`${p.id ?? "a product"} lacks id, name or channels`);
  extra.push(["Products", `${products.length}, ${products.filter((p) => p.channels && Object.keys(p.channels).length).length} with releases`], ["Structure", problems.length ? problems.slice(0, 3).join("; ") : "valid"]);
  let state = "Not signed: no .sig file beside it";
  const made = await signedCatalogue();
  const sig = s.path ? sidecar(s.path, ".sig") : null;
  if (sig) {
    const signature = decoder.decode(sig).trim();
    if (await verify(body, signature, [made.publicKey])) state = "Signed by this demo's own key (valid)";
    else if (await verify(body, signature, trustedKeys)) state = "Signed by the formai.studio catalogue key FormPortal trusts (valid)";
    else state = "Signature does not match any key this build trusts";
  }
  extra.push(["Signature", state]);
  view.append(
    table(
      ["App", "State", "Stable", "Beta"],
      products.map((p) => [p.name ?? p.id ?? "?", p.state ?? "", p.channels?.stable?.version ?? "none", p.channels?.beta?.version ?? "none"]),
    ),
  );
}

function viewText(view: HTMLElement, s: Subject, extra: [string, string][], pretty: boolean): void {
  let text = decoder.decode(s.data);
  if (pretty) {
    try {
      text = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      text = decoder.decode(s.data);
    }
  }
  const words = text.split(/\s+/).filter(Boolean).length;
  extra.push(["Text", `${text.split("\n").length} lines, ${words} words`]);
  const area = document.createElement("textarea");
  area.value = text.length > 200000 ? text.slice(0, 200000) : text;
  area.spellcheck = false;
  area.readOnly = !s.path || pretty;
  area.dataset.inspectText = "";
  view.append(area);
  if (s.path && !pretty) {
    const save = q<HTMLButtonElement>("[data-inspect-save]");
    save.hidden = false;
    save.disabled = false;
  }
}

function viewHex(view: HTMLElement, s: Subject): void {
  const lines: string[] = [];
  for (let at = 0; at < Math.min(s.data.length, 512); at += 16) {
    const row = s.data.subarray(at, at + 16);
    const ascii = Array.from(row, (c) => (c >= 32 && c < 127 ? String.fromCharCode(c) : ".")).join("");
    lines.push(`${at.toString(16).padStart(6, "0")}  ${Array.from(row, (c) => c.toString(16).padStart(2, "0")).join(" ").padEnd(47)}  ${ascii}`);
  }
  const pre = document.createElement("pre");
  pre.textContent = lines.join("\n");
  view.append(pre);
}

async function render(s: Subject): Promise<void> {
  subject = s;
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls = [];
  const dialog = q<HTMLDialogElement>("[data-inspect-dialog]");
  q("[data-inspect-title]").textContent = s.name;
  q("[data-inspect-path]").textContent = s.label;
  const save = q<HTMLButtonElement>("[data-inspect-save]");
  save.hidden = true;
  say("Reading");
  const view = q("[data-inspect-view]");
  view.replaceChildren();
  if (!dialog.open) dialog.showModal();
  const kind = kindOf(s.name, s.data);
  const hash = await sha256(s.data);
  const app = s.product ?? productFor(s.name);
  const extra: [string, string][] = [];
  const base: [string, string][] = [["Size", `${sizeText(s.data.length)} (${s.data.length} bytes)`], ["SHA-256", hash], ["Opens in", app ? engineName(app) : "No Form app yet"], ["Kind", kind]];
  try {
    const type = mimeOf(s.name, s.data, kind);
    if (kind === "image") await viewImage(view, s, type, extra);
    else if (kind === "audio") viewAudio(view, s, extra);
    else if (kind === "font") await viewFont(view, s, extra);
    else if (kind === "zip") await viewZip(view, s, extra);
    else if (kind === "catalogue") await viewCatalogue(view, s, extra);
    else if (kind === "json") viewText(view, s, extra, true);
    else if (kind === "text") viewText(view, s, extra, false);
    else viewHex(view, s);
    say("");
  } catch (e) {
    view.replaceChildren();
    viewHex(view, s);
    say(e instanceof Error ? e.message : String(e), "bad");
  }
  facts([...base, ...extra]);
}

export async function inspectPath(path: string): Promise<boolean> {
  const dialog = q<HTMLDialogElement>("[data-inspect-dialog]");
  if (dialog.open && subject?.path === path) return true;
  const found = current(path);
  if (!found) return false;
  await render({ name: found.name, label: path, data: found.data, type: found.type, path, product: found.product });
  return true;
}

export async function inspectFile(file: File): Promise<void> {
  await render({ name: file.name, label: `${file.name}, not added to Files`, data: new Uint8Array(await file.arrayBuffer()), type: file.type, path: null, product: productFor(file.name) });
}

export async function inspectBytes(name: string, label: string, data: Uint8Array): Promise<void> {
  await render({ name, label, data, type: "", path: null, product: null });
}

export function wireInspector(onKept: () => void): void {
  const dialog = q<HTMLDialogElement>("[data-inspect-dialog]");
  q("[data-inspect-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
    subject = null;
  });
  q("[data-inspect-download]").addEventListener("click", () => {
    if (subject) download(subject.name, subject.data, subject.type || "application/octet-stream");
  });
  q<HTMLButtonElement>("[data-inspect-save]").addEventListener("click", async () => {
    const area = dialog.querySelector<HTMLTextAreaElement>("[data-inspect-text]");
    if (!subject || !subject.path || !area) return;
    const folder = subject.path.slice(0, subject.path.lastIndexOf("/"));
    const data = new TextEncoder().encode(area.value);
    if (hex(data) === hex(subject.data)) {
      const list = await keep(subject.path, "kept by hand");
      say(`Nothing changed, so version ${list.length} is a copy of the last one.`, "good");
    } else {
      await put(folder, subject.name, data, subject.type, "edited in the inspector");
      const now = current(subject.path);
      if (now) subject = { ...subject, data: now.data };
      say("Kept as a new version. It is listed under Files, Versions.", "good");
    }
    onKept();
  });
}
