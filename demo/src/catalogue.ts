import apps from "../../catalog/fixtures/apps.json";
import type { Catalog, Os, Arch, Artifact } from "../../frontend/src/engine/types.ts";
import { crc32, encoder, fromBase64, hex, seeded, sha256, toBase64 } from "./util.ts";
import { readZip, writeZip } from "./zip.ts";

export interface Signed {
  body: string;
  signature: string;
  publicKey: string;
}

let keys: CryptoKeyPair | null = null;
let signed: Signed | null = null;

export function packageBytes(product: string, version: string, file: string): Uint8Array {
  const next = seeded(`${product}@${version}:${file}`);
  const payload = new Uint8Array(24576);
  for (let i = 0; i < payload.length; i += 1) payload[i] = Math.floor(next() * 256);
  const manifest = JSON.stringify({ product, version, file, entries: ["manifest.json", "README.txt", "payload.bin"], payload_crc32: crc32(payload) }, null, 2);
  const readme = `${product} ${version}\nA procedurally generated stand-in package made inside this page by the FormPortal demo.\nIt is real zip data with a real CRC-32 per entry; it is not the app.\n`;
  return writeZip([
    { name: "manifest.json", data: encoder.encode(manifest) },
    { name: "README.txt", data: encoder.encode(readme) },
    { name: "payload.bin", data: payload },
  ]);
}

async function rewrite(catalog: Catalog): Promise<Catalog> {
  const copy = structuredClone(catalog);
  for (const product of copy.products) {
    for (const release of Object.values(product.channels)) {
      for (const r of [release, ...(release.history ?? [])]) {
        for (const artifact of r.artifacts) {
          const data = packageBytes(product.id, r.version, artifact.file);
          artifact.bytes = data.length;
          artifact.sha256 = await sha256(data);
          artifact.url = `demo://packages/${artifact.file}`;
        }
      }
    }
  }
  copy.origin = "FormPortal demo (signed in this page)";
  return copy;
}

export async function signedCatalogue(): Promise<Signed> {
  if (signed) return signed;
  keys = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const body = JSON.stringify(await rewrite(apps as unknown as Catalog));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, keys.privateKey, encoder.encode(body)));
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
  signed = { body, signature: toBase64(signature), publicKey: toBase64(publicKey) };
  return signed;
}

export async function verify(body: string, signature: string, publicKeys: string[]): Promise<boolean> {
  const sig = fromBase64(signature.trim());
  for (const key of publicKeys) {
    try {
      const imported = await crypto.subtle.importKey("raw", fromBase64(key) as BufferSource, { name: "Ed25519" }, false, ["verify"]);
      if (await crypto.subtle.verify({ name: "Ed25519" }, imported, sig as BufferSource, encoder.encode(body))) return true;
    } catch {
      continue;
    }
  }
  return false;
}

export async function trustedCatalogue(tamper: boolean): Promise<Catalog> {
  const made = await signedCatalogue();
  const body = tamper ? made.body.replace(/"version":"/, '"version":"9') : made.body;
  if (!(await verify(body, made.signature, [made.publicKey]))) {
    throw new Error("the catalogue's signature does not match a key this build trusts; nothing was read from it");
  }
  return JSON.parse(body) as Catalog;
}

export async function fingerprint(): Promise<string> {
  const made = await signedCatalogue();
  return hex(await crypto.subtle.digest("SHA-256", fromBase64(made.publicKey) as BufferSource)).slice(0, 16);
}

export function pickArtifact(artifacts: Artifact[], os: Os, arch: Arch): Artifact | undefined {
  return artifacts.find((a) => a.platform === os && a.arch === arch) ?? artifacts.find((a) => a.platform === os) ?? artifacts[0];
}

export async function unpack(data: Uint8Array) {
  return readZip(data);
}
