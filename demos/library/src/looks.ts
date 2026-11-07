export interface Lut {
  title: string;
  size: number;
  min: [number, number, number];
  max: [number, number, number];
  table: Float32Array;
}

export function parseCube(text: string): Lut {
  let size = 0;
  let title = "";
  let min: [number, number, number] = [0, 0, 0];
  let max: [number, number, number] = [1, 1, 1];
  const values: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    if (parts[0] === "TITLE") title = line.slice(5).trim().replace(/^"|"$/g, "");
    else if (parts[0] === "LUT_3D_SIZE") size = Number(parts[1]);
    else if (parts[0] === "DOMAIN_MIN") min = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
    else if (parts[0] === "DOMAIN_MAX") max = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
    else if (/^[-+.\d]/.test(parts[0]) && parts.length >= 3) values.push(Number(parts[0]), Number(parts[1]), Number(parts[2]));
  }
  if (!size) throw new Error("this .cube file has no LUT_3D_SIZE, so it is not a 3D look");
  if (values.length !== size * size * size * 3) throw new Error(`this .cube file lists ${values.length / 3} colours but ${size} points per side needs ${size ** 3}`);
  return { title, size, min, max, table: Float32Array.from(values) };
}

export function applyLut(source: ImageData, lut: Lut, amount: number, into?: ImageData): ImageData {
  const out = into ?? new ImageData(source.width, source.height);
  const src = source.data;
  const dst = out.data;
  const n = lut.size;
  const top = n - 1;
  const t = lut.table;
  const rr = 1 / (lut.max[0] - lut.min[0]);
  const rg = 1 / (lut.max[1] - lut.min[1]);
  const rb = 1 / (lut.max[2] - lut.min[2]);
  const stepG = n * 3;
  const stepB = n * n * 3;
  for (let i = 0; i < src.length; i += 4) {
    const r = Math.min(1, Math.max(0, (src[i] / 255 - lut.min[0]) * rr)) * top;
    const g = Math.min(1, Math.max(0, (src[i + 1] / 255 - lut.min[1]) * rg)) * top;
    const b = Math.min(1, Math.max(0, (src[i + 2] / 255 - lut.min[2]) * rb)) * top;
    const r0 = Math.min(top - 1, Math.floor(r));
    const g0 = Math.min(top - 1, Math.floor(g));
    const b0 = Math.min(top - 1, Math.floor(b));
    const fr = r - r0;
    const fg = g - g0;
    const fb = b - b0;
    const base = r0 * 3 + g0 * stepG + b0 * stepB;
    for (let c = 0; c < 3; c += 1) {
      const c000 = t[base + c];
      const c100 = t[base + 3 + c];
      const c010 = t[base + stepG + c];
      const c110 = t[base + stepG + 3 + c];
      const c001 = t[base + stepB + c];
      const c101 = t[base + stepB + 3 + c];
      const c011 = t[base + stepB + stepG + c];
      const c111 = t[base + stepB + stepG + 3 + c];
      const x00 = c000 + (c100 - c000) * fr;
      const x10 = c010 + (c110 - c010) * fr;
      const x01 = c001 + (c101 - c001) * fr;
      const x11 = c011 + (c111 - c011) * fr;
      const y0 = x00 + (x10 - x00) * fg;
      const y1 = x01 + (x11 - x01) * fg;
      const graded = (y0 + (y1 - y0) * fb) * 255;
      const original = src[i + c];
      dst[i + c] = Math.min(255, Math.max(0, original + (graded - original) * amount + 0.5));
    }
    dst[i + 3] = src[i + 3];
  }
  return out;
}
