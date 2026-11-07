import { concat, crc32, encoder, inflate } from "../../../demo/src/util.ts";

export interface PackEntry {
  name: string;
  data: Uint8Array;
  link?: boolean;
}

export interface PackRead {
  name: string;
  size: number;
  crc: number;
  crcOk: boolean;
  link: boolean;
  data: Uint8Array;
}

const u16 = (n: number) => new Uint8Array([n & 255, (n >> 8) & 255]);
const u32 = (n: number) => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);

const FILE_MODE = 0o100644;
const LINK_MODE = 0o120777;
const UNIX = 3 << 8;

export function writePack(entries: PackEntry[]): Uint8Array {
  const body: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const attr = ((entry.link ? LINK_MODE : FILE_MODE) << 16) >>> 0;
    const local = concat([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(entry.data.length), u32(entry.data.length), u16(name.length), u16(0), name, entry.data]);
    central.push(concat([u32(0x02014b50), u16(UNIX | 20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(entry.data.length), u32(entry.data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(attr), u32(offset), name]));
    body.push(local);
    offset += local.length;
  }
  const directory = concat(central);
  const end = concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(directory.length), u32(offset), u16(0)]);
  return concat([...body, directory, end]);
}

export async function readPack(bytes: Uint8Array): Promise<PackRead[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("the archive could not be unpacked: invalid Zip archive: Could not find central directory end");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const out: PackRead[] = [];
  for (let n = 0; n < count; n += 1) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error("the archive could not be unpacked: invalid Zip archive: Invalid central directory header");
    const made = view.getUint16(at + 4, true);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const packed = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    const attr = view.getUint32(at + 38, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen));
    const dataAt = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(dataAt, dataAt + packed);
    let data: Uint8Array;
    if (method === 0) data = raw;
    else if (method === 8) data = await inflate(raw, "deflate-raw");
    else throw new Error(`the archive could not be unpacked: ${name} uses compression method ${method}, which this build does not read`);
    const link = made >> 8 === 3 && ((attr >>> 16) & 0o170000) === 0o120000;
    out.push({ name, size, crc, crcOk: crc32(data) === crc, link, data });
    at += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
