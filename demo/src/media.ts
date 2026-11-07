import { fromBase64 } from "./util.ts";

export interface MediaFile {
  name: string;
  folder: "coast" | "reference";
  type: string;
  reason: string;
}

interface Packed {
  data: string;
  poster?: string;
}

declare global {
  interface Window {
    __FORMPORTAL_MEDIA__?: Record<string, Packed>;
  }
}

export const MEDIA: MediaFile[] = [
  { name: "hamnoy-village.jpg", folder: "coast", type: "image/jpeg", reason: "first seen" },
  { name: "mountain-lake-dawn.jpg", folder: "coast", type: "image/jpeg", reason: "first seen" },
  { name: "headland-aerial.jpg", folder: "coast", type: "image/jpeg", reason: "first seen" },
  { name: "lighthouse-dusk.jpg", folder: "coast", type: "image/jpeg", reason: "first seen" },
  { name: "golden-hour-surf.mp4", folder: "coast", type: "video/mp4", reason: "first seen" },
  { name: "gymnopedie-1.ogg", folder: "coast", type: "audio/ogg", reason: "first seen" },
  { name: "northern-coast-field-notes.pdf", folder: "coast", type: "application/pdf", reason: "first seen" },
  { name: "formvis-screenshot.webp", folder: "reference", type: "image/webp", reason: "first seen" },
  { name: "formcut-screenshot.webp", folder: "reference", type: "image/webp", reason: "first seen" },
  { name: "formlit-screenshot.webp", folder: "reference", type: "image/webp", reason: "first seen" },
  { name: "formwav-screenshot.webp", folder: "reference", type: "image/webp", reason: "first seen" },
];

const loading = new Map<string, Promise<{ data: Uint8Array; poster?: Uint8Array } | null>>();

function inject(name: string): Promise<boolean> {
  return new Promise((done) => {
    const script = document.createElement("script");
    script.src = `./assets/media/${name}.js`;
    script.addEventListener("load", () => {
      script.remove();
      done(true);
    });
    script.addEventListener("error", () => {
      script.remove();
      done(false);
    });
    document.head.append(script);
  });
}

export function loadMedia(name: string): Promise<{ data: Uint8Array; poster?: Uint8Array } | null> {
  let pending = loading.get(name);
  if (!pending) {
    pending = inject(name).then((ok) => {
      const packed = ok ? window.__FORMPORTAL_MEDIA__?.[name] : undefined;
      if (!packed) return null;
      const out = { data: fromBase64(packed.data), poster: packed.poster ? fromBase64(packed.poster) : undefined };
      delete window.__FORMPORTAL_MEDIA__?.[name];
      return out;
    });
    loading.set(name, pending);
  }
  return pending;
}
