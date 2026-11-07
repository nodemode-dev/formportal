import { fromBase64, inflate } from "./util.ts";

interface Payload {
  fonts: Record<string, string>;
  media: Record<string, string>;
  keys: string[];
}

declare global {
  interface Window {
    __FORMPORTAL_STORE__: Payload;
  }
}

const payload = window.__FORMPORTAL_STORE__;
const bytes = new Map<string, Uint8Array>();
const urls = new Map<string, string>();

export const trustedKeys = payload.keys;
export const bundledFamilies = new Set(Object.keys(payload.fonts).map((rel) => rel.split("/")[1]));

async function prepareFonts(): Promise<void> {
  await Promise.all(
    Object.entries(payload.fonts).map(async ([rel, packed]) => {
      const raw = await inflate(fromBase64(packed), "gzip");
      bytes.set(rel, raw);
      urls.set(rel, URL.createObjectURL(new Blob([raw as BlobPart], { type: "font/ttf" })));
    }),
  );
}

export function fontBytes(rel: string): Uint8Array | undefined {
  return bytes.get(rel);
}

export function mediaBytes(file: string): Uint8Array | undefined {
  const packed = payload.media[file];
  return packed ? fromBase64(packed) : undefined;
}

export function hasMedia(file: string): boolean {
  return file in payload.media;
}

export function mapFontFaces(): void {
  const Native = window.FontFace;
  class Mapped extends Native {
    constructor(family: string, source: string | BufferSource, descriptors?: FontFaceDescriptors) {
      let next = source;
      if (typeof source === "string") {
        const found = /url\("\.\/store\/(fonts\/[^"]+)"\)/.exec(source);
        const blob = found ? urls.get(found[1]) : undefined;
        if (blob) next = `url("${blob}")`;
      }
      super(family, next, descriptors);
    }
  }
  window.FontFace = Mapped as typeof FontFace;
}

mapFontFaces();
export const fontsReady = prepareFonts();
