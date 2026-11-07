import type { MediaItem, SavedMedia, MediaView } from "../../../frontend/src/engine/types.ts";
import storeMedia from "../../../core/data/store-media.json";
import extra from "../media-src/templates.json";
import { hasMedia, mediaBytes } from "../../../demo/src/store.ts";
import { download, encoder, sha256 } from "../../../demo/src/util.ts";
import { writeZip } from "../../../demo/src/zip.ts";
import { kept, remember } from "./state.ts";

const all = [...(extra as unknown as { items: MediaItem[] }).items, ...(storeMedia as unknown as { items: MediaItem[] }).items];

export const items: MediaItem[] = all
  .filter((m) => hasMedia(m.file))
  .map((m) => ({ ...m, product: m.product ?? null, thumbnail: m.thumbnail ? m.thumbnail.replace(/^\//, "") : null }));

export const library = "~/Documents/Form/Library";

export function creditOf(m: MediaItem): string {
  const lic = m.licence === "CC0-1.0" ? "public domain (CC0 1.0)" : `licensed ${m.licence}`;
  return `${m.title} by ${m.creator}, ${lic}, ${m.source_url}`;
}

export function find(id: string): MediaItem | undefined {
  return items.find((m) => m.id === id);
}

export async function bytesOf(m: MediaItem): Promise<Uint8Array> {
  const data = mediaBytes(m.file);
  if (!data) throw new Error(`${m.file} is not bundled in the demo`);
  if ((await sha256(data)) !== (m as MediaItem & { sha256: string }).sha256) throw new Error(`${m.file} does not match its SHA-256 in the media index; it was not saved`);
  return data;
}

function savedOf(m: MediaItem): SavedMedia {
  return { id: m.id, title: m.title, kind: m.kind, creator: m.creator, licence: m.licence, source_url: m.source_url, file: `${library}/${m.kind}/${m.file}`, credit: creditOf(m) };
}

export function mediaView(): MediaView {
  const saved = kept().saved.flatMap((id) => {
    const m = find(id);
    return m ? [savedOf(m)] : [];
  });
  return { index: { items }, credits: items.map(creditOf), index_error: null, saved, library };
}

export async function save(id: string): Promise<MediaItem> {
  const m = find(id);
  if (!m) throw new Error(`${id} is not in the media index`);
  await bytesOf(m);
  if (!kept().saved.includes(id)) kept().saved.push(id);
  remember();
  return m;
}

export function unsave(id: string): void {
  kept().saved = kept().saved.filter((x) => x !== id);
  remember();
}

export async function downloadLibrary(): Promise<number> {
  const list = kept().saved.flatMap((id) => {
    const m = find(id);
    return m ? [m] : [];
  });
  if (!list.length) return 0;
  const files = await Promise.all(list.map(async (m) => ({ name: `${m.kind}/${m.file}`, data: await bytesOf(m) })));
  const credits = `${list.map(creditOf).join("\n")}\n`;
  download("formportal-library.zip", writeZip([...files, { name: "CREDITS.txt", data: encoder.encode(credits) }]), "application/zip");
  return list.length;
}
