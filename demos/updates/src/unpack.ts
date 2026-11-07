import type { PackRead } from "./pack.ts";

export function enclosedName(name: string): string | null {
  if (name.includes("\0") || name.startsWith("/") || /^[A-Za-z]:/.test(name) || name.startsWith("\\")) return null;
  let depth = 0;
  for (const part of name.split(/[\\/]/)) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (depth === 0) return null;
      depth -= 1;
    } else depth += 1;
  }
  return name;
}

export function linkStaysInside(relative: string, target: string): boolean {
  if (target.startsWith("/") || target.startsWith("\\") || /^[A-Za-z]:/.test(target)) return false;
  const parent = relative.split("/").slice(0, -1).filter((p) => p !== "" && p !== ".");
  let depth = parent.length;
  for (const part of target.split(/[\\/]/)) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (depth === 0) return false;
      depth -= 1;
    } else depth += 1;
  }
  return true;
}

export interface Checked {
  files: number;
  folders: number;
  bytes: number;
}

export function checkEntries(entries: PackRead[]): Checked {
  let files = 0;
  let folders = 0;
  let bytes = 0;
  for (const entry of entries) {
    if (enclosedName(entry.name) === null) throw new Error(`the archive could not be unpacked: a path in it leaves the folder: ${entry.name}`);
    if (entry.name.endsWith("/")) {
      folders += 1;
      continue;
    }
    if (entry.link) {
      const target = new TextDecoder().decode(entry.data);
      if (!linkStaysInside(entry.name, target)) throw new Error(`the archive could not be unpacked: a link in it points outside the folder: ${target}`);
      files += 1;
      continue;
    }
    if (!entry.crcOk) throw new Error(`a file could not be read or written: Invalid checksum (${entry.name})`);
    files += 1;
    bytes += entry.size;
  }
  return { files, folders, bytes };
}
