import apps from "../../../catalog/fixtures/apps.json";
import keysText from "../../../core/catalog_keys.txt?raw";
import type { Artifact, Catalog, Release } from "../../../frontend/src/engine/types.ts";
import { crc32, encoder, fromBase64, seeded, sha256, toBase64 } from "../../../demo/src/util.ts";
import { writePack } from "./pack.ts";
import { CUT_NOTE, RELEASES } from "./releases.ts";

export interface Signed {
  body: string;
  signature: string;
}

export const COMPILED_KEYS: string[] = keysText
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

const PLATFORMS: [string, string][] = [
  ["macos", "arm64"],
  ["windows", "x86_64"],
  ["linux", "x86_64"],
];

interface Keys {
  pair: CryptoKeyPair;
  raw: string;
  pem: string;
}

export const world = {
  clean: null as unknown as Signed,
  current: null as unknown as Signed,
  catalogue: null as unknown as Catalog,
  packs: new Map<string, Uint8Array>(),
  demo: null as unknown as Keys,
  stranger: null as unknown as Keys,
  generated: "",
};

async function makeKeys(): Promise<Keys> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const raw = toBase64(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));
  const spki = toBase64(new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey)));
  const pem = `-----BEGIN PUBLIC KEY-----\n${spki.match(/.{1,64}/g)?.join("\n") ?? spki}\n-----END PUBLIC KEY-----\n`;
  return { pair, raw, pem };
}

export function keyName(raw: string): string {
  return `${raw.slice(0, 8)}...`;
}

export async function sign(body: string, keys: Keys): Promise<string> {
  return toBase64(new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, keys.pair.privateKey, encoder.encode(body))));
}

export interface Verdict {
  ok: boolean;
  by: string | null;
  why: string;
}

export async function verifyBody(body: string, signature: string, keys: string[]): Promise<Verdict> {
  let raw: Uint8Array;
  try {
    raw = fromBase64(signature.trim());
  } catch {
    return { ok: false, by: null, why: "its signature is not valid base64" };
  }
  if (raw.length !== 64) return { ok: false, by: null, why: "its signature is not 64 bytes" };
  for (const key of keys) {
    try {
      const imported = await crypto.subtle.importKey("raw", fromBase64(key) as BufferSource, { name: "Ed25519" }, false, ["verify"]);
      if (await crypto.subtle.verify({ name: "Ed25519" }, imported, raw as BufferSource, encoder.encode(body))) return { ok: true, by: key, why: "" };
    } catch {
      continue;
    }
  }
  return { ok: false, by: null, why: "its signature does not match a key this build trusts" };
}

export function trustedKeys(): string[] {
  return [...COMPILED_KEYS, world.demo.raw];
}

function notesOf(id: string, version: string, fallback: string): string {
  const line = RELEASES[id]?.stable.find((r) => r.version === version);
  if (line) return line.notes;
  if (id === "formcut" && version === "2.6.2") return CUT_NOTE;
  return fallback;
}

export function packageFor(id: string, version: string, file: string, notes: string): Uint8Array {
  const next = seeded(`${id}@${version}:${file}`);
  const payload = new Uint8Array(16384 + Math.floor(next() * 24576));
  for (let i = 0; i < payload.length; i += 1) payload[i] = Math.floor(next() * 256);
  const app = JSON.stringify({ id, version, file, payload_crc32: crc32(payload), note: "stand-in package made inside the page by the FormPortal updates demo" }, null, 2);
  const readme = `${id} ${version}\nA stand-in package made inside this page. It is real zip data with a real CRC-32 per entry; it is not the app.\n`;
  return writePack([
    { name: "form-app.json", data: encoder.encode(app) },
    { name: "README.txt", data: encoder.encode(readme) },
    { name: "CHANGES.txt", data: encoder.encode(`${notes}\n`) },
    { name: "payload.bin", data: payload },
  ]);
}

async function rebuild(id: string, release: Release, minimums: Record<string, string>, base: string): Promise<Release> {
  const artifacts: Artifact[] = [];
  for (const [platform, arch] of PLATFORMS) {
    const file = `${id}-${release.version}-${platform}-${arch}.zip`;
    const data = packageFor(id, release.version, file, release.notes);
    world.packs.set(file, data);
    artifacts.push({ platform, arch, kind: "zip", file, url: `${base}v${release.version}/${file}`, bytes: data.length, sha256: await sha256(data), minimum_os: minimums[platform] ?? "" });
  }
  return { ...release, artifacts };
}

async function build(): Promise<Catalog> {
  const catalogue = structuredClone(apps) as unknown as Catalog;
  for (const product of catalogue.products) {
    const stable = product.channels.stable;
    const mins: Record<string, string> = {};
    for (const a of (stable ?? product.channels.beta)?.artifacts ?? []) mins[a.platform] = a.minimum_os;
    const sample = (stable ?? product.channels.beta)?.artifacts[0]?.url ?? "";
    const base = sample.replace(/\/v[^/]+\/[^/]+$/, "/");
    const overlay = RELEASES[product.id];
    if (overlay && stable) {
      const [latest, ...older] = overlay.stable;
      const made: Release[] = [];
      for (const n of [latest, ...older]) made.push(await rebuild(product.id, { version: n.version, published: n.published, notes: n.notes, artifacts: [] }, mins, base));
      const [first, ...rest] = made;
      product.channels.stable = { ...first, history: rest };
      continue;
    }
    for (const channel of ["stable", "beta"] as const) {
      const release = product.channels[channel];
      if (!release) continue;
      const history: Release[] = [];
      for (const old of release.history ?? []) history.push(await rebuild(product.id, { ...old, notes: notesOf(product.id, old.version, old.notes), artifacts: [] }, mins, base));
      const head = await rebuild(product.id, { ...release, notes: notesOf(product.id, release.version, release.notes), artifacts: [], history: undefined }, mins, base);
      product.channels[channel] = history.length ? { ...head, history } : head;
    }
  }
  catalogue.origin = "FormPortal updates demo (signed in this page)";
  catalogue.fixture = false;
  catalogue.generated = new Date().toISOString().slice(0, 19) + "Z";
  return catalogue;
}

export async function initWorld(): Promise<void> {
  world.demo = await makeKeys();
  world.stranger = await makeKeys();
  world.catalogue = await build();
  world.generated = world.catalogue.generated;
  const body = JSON.stringify(world.catalogue);
  world.clean = { body, signature: await sign(body, world.demo) };
  world.current = world.clean;
}

export async function publish(mutate: (c: Catalog) => void): Promise<void> {
  const next = JSON.parse(world.clean.body) as Catalog;
  mutate(next);
  const body = JSON.stringify(next);
  world.current = { body, signature: await sign(body, world.demo) };
}

export function restore(): void {
  world.current = world.clean;
}

export function findArtifact(c: Catalog, file: string): Artifact | undefined {
  for (const p of c.products) {
    for (const r of Object.values(p.channels)) {
      for (const x of [r, ...(r.history ?? [])]) {
        const a = x.artifacts.find((y) => y.file === file);
        if (a) return a;
      }
    }
  }
  return undefined;
}

export interface Known {
  product: string;
  channel: string;
  version: string;
  artifact: Artifact;
}

export function knownByHash(c: Catalog): Map<string, Known> {
  const out = new Map<string, Known>();
  for (const p of c.products) {
    for (const [channel, r] of Object.entries(p.channels)) {
      for (const x of [r, ...(r.history ?? [])]) for (const a of x.artifacts) out.set(a.sha256, { product: p.id, channel, version: x.version, artifact: a });
    }
  }
  return out;
}

export function knownByFile(c: Catalog): Map<string, Known> {
  const out = new Map<string, Known>();
  for (const k of knownByHash(c).values()) out.set(k.artifact.file, k);
  return out;
}

