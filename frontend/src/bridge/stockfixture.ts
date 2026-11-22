import type { SavedMedia, StockItem, StockKind, StockPage, StockSource } from "../engine/types.ts";

const SOURCES: Omit<StockSource, "on">[] = [
  { id: "pexels", name: "Pexels", kinds: ["image", "video"], needs_key: true, key_page: "https://www.pexels.com/api/", home: "https://www.pexels.com/" },
  { id: "pixabay", name: "Pixabay", kinds: ["image", "video"], needs_key: true, key_page: "https://pixabay.com/api/docs/", home: "https://pixabay.com/" },
  { id: "openverse", name: "Openverse", kinds: ["image", "audio"], needs_key: false, key_page: null, home: "https://openverse.org/" },
  { id: "freesound", name: "Freesound", kinds: ["audio"], needs_key: true, key_page: "https://freesound.org/apiv2/apply/", home: "https://freesound.org/" },
  { id: "ccmixter", name: "ccMixter", kinds: ["audio"], needs_key: false, key_page: null, home: "https://ccmixter.org/" },
];

const AUTHORS = ["Ines Varga", "Tomas Reyes", "Mira Okafor", "Lena Brandt", "Kenji Arai", "Sofia Marin", "Dev Patel", "Ana Costa", "Jonas Lind", "Rhea Moss"];
const WORDS: Record<StockKind, string[]> = {
  image: ["at dawn", "close up", "from above", "in soft light", "on a quiet street", "by the window", "in the rain", "at night", "with long shadows", "in winter"],
  video: ["slow pan", "time lapse", "aerial pass", "handheld walk", "steady close up", "drift at dusk"],
  audio: ["ambience", "loop", "field recording", "piano theme", "soft pad", "footsteps", "rain on glass", "city hum"],
};
const CC = [
  { licence: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/", nc: false, nd: false },
  { licence: "CC0 1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/", nc: false, nd: false },
  { licence: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/", nc: false, nd: false },
  { licence: "CC BY-NC 4.0", url: "https://creativecommons.org/licenses/by-nc/4.0/", nc: true, nd: false },
  { licence: "CC BY-ND 4.0", url: "https://creativecommons.org/licenses/by-nd/4.0/", nc: false, nd: true },
];
const MIXTER = [
  { licence: "CC BY-NC 3.0", url: "https://creativecommons.org/licenses/by-nc/3.0/", nc: true, nd: false },
  { licence: "CC BY 3.0", url: "https://creativecommons.org/licenses/by/3.0/", nc: false, nd: false },
];
const PER: Record<string, number> = { pexels: 24, pixabay: 24, openverse: 20, freesound: 24, ccmixter: 24 };
const held = new Map<string, StockItem>();
const pause = (ms: number) => new Promise<void>((done) => window.setTimeout(done, ms));

const hash = (text: string) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const enc = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function picture(item: StockItem, w: number, h: number): string {
  const seed = hash(item.id);
  const hue = seed % 360;
  const hue2 = (hue + 40 + (seed % 70)) % 360;
  if (item.kind === "audio") {
    const bars = Array.from({ length: 64 }, (_, i) => {
      const v = 0.15 + 0.8 * Math.abs(Math.sin((i + 1) * (0.3 + (seed % 7) / 10)) * Math.cos(i / (3 + (seed % 5))));
      const bh = Math.round(v * h * 0.7);
      return `<rect x="${(i * w) / 64 + 1}" y="${(h - bh) / 2}" width="${w / 64 - 2}" height="${bh}" rx="1"/>`;
    }).join("");
    return enc(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="hsl(${hue} 22% 16%)"/><g fill="hsl(${hue} 60% 66%)">${bars}</g></svg>`);
  }
  const cx = 20 + (seed % 60);
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 100 ${(100 * h) / w}" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 45% 42%)"/><stop offset="1" stop-color="hsl(${hue2} 40% 18%)"/></linearGradient></defs><rect width="100" height="200" fill="url(#g)"/><circle cx="${cx}" cy="22" r="9" fill="hsl(${hue2} 70% 80% / .55)"/><path d="M0 70 L30 44 L52 62 L72 40 L100 66 L100 100 L0 100 Z" fill="hsl(${hue} 30% 12% / .7)"/></svg>`);
}

function tone(seconds: number, freq: number): string {
  const rate = 8000;
  const n = Math.floor(rate * seconds);
  const buf = new DataView(new ArrayBuffer(44 + n * 2));
  const str = (at: number, s: string) => [...s].forEach((c, i) => buf.setUint8(at + i, c.charCodeAt(0)));
  str(0, "RIFF");
  buf.setUint32(4, 36 + n * 2, true);
  str(8, "WAVEfmt ");
  buf.setUint32(16, 16, true);
  buf.setUint16(20, 1, true);
  buf.setUint16(22, 1, true);
  buf.setUint32(24, rate, true);
  buf.setUint32(28, rate * 2, true);
  buf.setUint16(32, 2, true);
  buf.setUint16(34, 16, true);
  str(36, "data");
  buf.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i += 1) {
    const env = Math.min(1, i / 800, (n - i) / 800);
    buf.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 5000 * env), true);
  }
  let bin = "";
  const bytes = new Uint8Array(buf.buffer);
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(bin)}`;
}

async function clip(item: StockItem): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const g = canvas.getContext("2d");
  if (!g || typeof MediaRecorder === "undefined" || !("captureStream" in canvas)) return "";
  const hue = hash(item.id) % 360;
  const stream = canvas.captureStream(24);
  const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "" });
  const parts: Blob[] = [];
  rec.ondataavailable = (e) => parts.push(e.data);
  const done = new Promise<void>((ok) => (rec.onstop = () => ok()));
  rec.start();
  const start = performance.now();
  await new Promise<void>((ok) => {
    const frame = () => {
      const t = (performance.now() - start) / 1000;
      g.fillStyle = `hsl(${hue} 35% 20%)`;
      g.fillRect(0, 0, 640, 360);
      g.fillStyle = `hsl(${(hue + 50) % 360} 60% 60%)`;
      g.fillRect(40 + ((t * 160) % 520), 140, 80, 80);
      if (t < 2) requestAnimationFrame(frame);
      else ok();
    };
    frame();
  });
  rec.stop();
  await done;
  return new Promise<string>((ok) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.readAsDataURL(new Blob(parts, { type: "video/webm" }));
  });
}

export const stockFixture = {
  sources(kept: Set<string>): StockSource[] {
    return SOURCES.map((s) => ({ ...s, on: !s.needs_key || kept.has(s.id) }));
  },
  async search(kept: Set<string>, source: string, kind: StockKind, query: string, page: number): Promise<StockPage> {
    const s = SOURCES.find((x) => x.id === source);
    if (!s) throw new Error(`${source} is not a stock source FormPortal searches`);
    if (!s.kinds.includes(kind)) throw new Error(`${s.name} offers no ${kind} through its API`);
    if (s.needs_key && !kept.has(s.id)) throw new Error(`${s.name} needs your own API key; add it in Preferences, Keys`);
    const q = query.trim();
    if (!q) throw new Error("type what to look for first");
    await pause(350 + (hash(source + q) % 700));
    const per = PER[source];
    const count = page < 3 ? per : Math.floor(per / 2);
    const items: StockItem[] = Array.from({ length: count }, (_, i) => {
      const n = (page - 1) * per + i;
      const num = 100000 + (hash(`${source}${kind}${q}${n}`) % 899999);
      const author = AUTHORS[(hash(source) + n) % AUTHORS.length];
      const slugAuthor = author.toLowerCase().replace(/\s+/g, "-");
      const word = WORDS[kind][n % WORDS[kind].length];
      const title = `${q.charAt(0).toUpperCase()}${q.slice(1)} ${word}`;
      const lic = source === "pexels" ? { licence: "Pexels License", url: "https://www.pexels.com/license/", nc: false, nd: false } : source === "pixabay" ? { licence: "Pixabay Content License", url: "https://pixabay.com/service/license-summary/", nc: false, nd: false } : source === "ccmixter" ? MIXTER[n % MIXTER.length] : CC[n % CC.length];
      const wide = n % 3 !== 1;
      const width = kind === "audio" ? null : wide ? 4000 : 2667;
      const height = kind === "audio" ? null : wide ? 2667 : 4000;
      const seconds = kind === "image" ? null : kind === "video" ? 8 + (n % 20) : 20 + (num % 200);
      const page_url =
        source === "pexels" ? `https://www.pexels.com/${kind === "video" ? "video" : "photo"}/${title.toLowerCase().replace(/\s+/g, "-")}-${num}/`
        : source === "pixabay" ? `https://pixabay.com/${kind === "video" ? "videos" : "photos"}/${q.toLowerCase().replace(/\s+/g, "-")}-${num}/`
        : source === "openverse" ? `https://openverse.org/${kind}/${num.toString(16)}-0000-4000-8000-${num}`
        : source === "freesound" ? `https://freesound.org/people/${slugAuthor}/sounds/${num}/`
        : `https://ccmixter.org/files/${slugAuthor}/${num}`;
      const author_url = source === "pexels" ? `https://www.pexels.com/@${slugAuthor}` : source === "pixabay" ? `https://pixabay.com/users/${slugAuthor}-${num % 9999}/` : source === "freesound" ? `https://freesound.org/people/${slugAuthor}/` : source === "ccmixter" ? `https://ccmixter.org/people/${slugAuthor}` : null;
      const what = kind === "video" ? "Video" : kind === "audio" ? "Sound" : "Photo";
      const credit = source === "pexels" ? `${what} by ${author} on Pexels, ${page_url}` : source === "pixabay" ? `${what} by ${author} from Pixabay, ${page_url}` : `"${title}" by ${author}, ${lic.licence} (${lic.url}), via ${s.name}, ${page_url}`;
      const file_note = source === "freesound" ? "MP3 preview, about 128 kbps (the original file needs a Freesound sign-in)" : source === "ccmixter" ? "MP3, as the artist uploaded it" : kind === "video" ? "MP4, 3840 x 2160" : source === "pixabay" ? "Large, up to 1280 wide" : source === "openverse" ? "Original file, from flickr" : `Original, ${width} x ${height}`;
      const item: StockItem = { id: `${source}:${kind}:${num}`, source, source_name: s.name, kind, title, author, author_url, page_url, licence: lic.licence, licence_url: lic.url, nc: lic.nc, nd: lic.nd, width, height, seconds, thumb: source !== "ccmixter", credit, file_note };
      held.set(item.id, item);
      return item;
    });
    return { source, kind, query: q, page, more: page < 3, items };
  },
  async preview(id: string, which: "thumb" | "view"): Promise<string> {
    const item = held.get(id);
    if (!item) throw new Error("that result is no longer at hand; search again");
    await pause(which === "thumb" ? 150 + (hash(id) % 900) : 300);
    if (which === "thumb") return item.kind === "audio" ? picture(item, 480, 160) : picture(item, 480, item.width && item.height && item.height > item.width ? 720 : 320);
    if (item.kind === "image") return picture(item, 1600, item.width && item.height && item.height > item.width ? 2400 : 1066);
    if (item.kind === "audio") return tone(6, 220 + (hash(id) % 400));
    return clip(item);
  },
  async save(id: string, saved: SavedMedia[], progress: (fraction: number) => void): Promise<SavedMedia> {
    const item = held.get(id);
    if (!item) throw new Error("that result is no longer at hand; search again");
    for (let i = 1; i <= 10; i += 1) {
      await pause(120);
      progress(i / 10);
    }
    const ext = item.kind === "image" ? "jpg" : item.kind === "video" ? "mp4" : "mp3";
    const name = `${item.title.replace(/[^A-Za-z0-9]+/g, "-")}-${item.source}-${id.split(":").pop()}.${ext}`;
    const entry: SavedMedia = { id, title: item.title, kind: item.kind, creator: item.author, licence: item.licence, source_url: item.page_url, file: `/home/you/Documents/Form/Library/${item.kind}/${name}`, credit: item.credit };
    const at = saved.findIndex((x) => x.id === id);
    if (at >= 0) saved.splice(at, 1, entry);
    else saved.push(entry);
    return { ...entry };
  },
};
