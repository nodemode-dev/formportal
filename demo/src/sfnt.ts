export interface FontFacts {
  family: string;
  style: string;
  full: string;
  version: string;
  licence: string;
  glyphs: number;
  unitsPerEm: number;
  flavour: string;
}

function text(view: DataView, at: number, length: number, utf16: boolean): string {
  let out = "";
  if (utf16) for (let i = 0; i + 1 < length; i += 2) out += String.fromCharCode(view.getUint16(at + i));
  else for (let i = 0; i < length; i += 1) out += String.fromCharCode(view.getUint8(at + i));
  return out;
}

export function readFont(bytes: Uint8Array): FontFacts {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = view.getUint32(0);
  if (tag === 0x774f4632) throw new Error("this is a WOFF2 font; the demo reads TTF and OTF files");
  if (tag !== 0x00010000 && tag !== 0x4f54544f && tag !== 0x74727565) throw new Error("this is not a TrueType or OpenType font");
  const tables = new Map<string, { at: number; length: number }>();
  for (let i = 0; i < view.getUint16(4); i += 1) {
    const at = 12 + i * 16;
    tables.set(text(view, at, 4, false), { at: view.getUint32(at + 8), length: view.getUint32(at + 12) });
  }
  const names = new Map<number, string>();
  const name = tables.get("name");
  if (name) {
    const count = view.getUint16(name.at + 2);
    const store = name.at + view.getUint16(name.at + 4);
    for (let i = 0; i < count; i += 1) {
      const rec = name.at + 6 + i * 12;
      const platform = view.getUint16(rec);
      const id = view.getUint16(rec + 6);
      if (names.has(id) && platform !== 3) continue;
      const length = view.getUint16(rec + 8);
      const offset = view.getUint16(rec + 10);
      names.set(id, text(view, store + offset, length, platform === 3 || platform === 0));
    }
  }
  const maxp = tables.get("maxp");
  const head = tables.get("head");
  return {
    family: names.get(16) ?? names.get(1) ?? "Unnamed",
    style: names.get(17) ?? names.get(2) ?? "Regular",
    full: names.get(4) ?? "",
    version: names.get(5) ?? "",
    licence: (names.get(13) ?? "").slice(0, 160),
    glyphs: maxp ? view.getUint16(maxp.at + 4) : 0,
    unitsPerEm: head ? view.getUint16(head.at + 18) : 0,
    flavour: tag === 0x4f54544f ? "OpenType (CFF)" : "TrueType",
  };
}
