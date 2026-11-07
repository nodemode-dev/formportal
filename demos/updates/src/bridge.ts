import { fixtureBridge } from "../../../frontend/src/bridge/fixture.ts";
import { allowUnsigned } from "../../../frontend/src/bridge/tauri.ts";
import type { Bridge } from "../../../frontend/src/bridge/index.ts";
import { DEFAULT_PREFS, versionNewer } from "../../../frontend/src/engine/index.ts";
import type { Artifact, Catalog, Channel, InstallRecord, Preferences, PolicyView, Release, RepairFinding } from "../../../frontend/src/engine/types.ts";
import registry from "../../../catalog/products.json";
import { pause, sha256, sizeText } from "../../../demo/src/util.ts";
import { readPack } from "./pack.ts";
import { checkEntries } from "./unpack.ts";
import { begin, finish, note, stage } from "./trail.ts";
import { COMPILED_KEYS, keyName, initWorld, restore, sign, trustedKeys, verifyBody, world, type Signed } from "./world.ts";

export const flags = {
  armed: null as string | null,
  flip: false,
  restore: false,
  policy: false,
  evil: new Map<string, Uint8Array>(),
  changed: null as { before: string; after: string } | null,
};

export const running = new Map<string, number>([["formcut:stable", 4128]]);
export const hooks = { open: async (_product: string, _channel: Channel): Promise<void> => undefined, changed: (): void => undefined };

const KEEP = "formportal.updates.installs";
const PREFS = "formportal.updates.prefs";
const key = (product: string, channel: Channel) => `${product}:${channel}`;
const names = new Map(registry.products.map((p) => [p.id, p.id === "formai" ? "FormPortal" : p.name]));
const label = (id: string) => names.get(id) ?? id;
const suffix = (c: Channel) => (c === "stable" ? "" : ` (${c})`);
const base = "~/.local/share/formportal";

export interface Held extends InstallRecord {
  sha256: string;
  file: string;
  bytes: number;
  at: number;
  gone?: boolean;
}

export const installed = new Map<string, Held>();
let kept: Signed;
const later = new Set<string>();

function remember(): void {
  try {
    localStorage.setItem(KEEP, JSON.stringify(Array.from(installed.values())));
  } catch {
    return;
  }
}

export function forget(): void {
  try {
    localStorage.removeItem(KEEP);
    localStorage.removeItem(PREFS);
  } catch {
    return;
  }
}

function readPrefs(): Preferences {
  try {
    const text = localStorage.getItem(PREFS);
    if (text) return { ...DEFAULT_PREFS, ...(JSON.parse(text) as Partial<Preferences>) };
  } catch {
    return { ...DEFAULT_PREFS, auto_update: false };
  }
  return { ...DEFAULT_PREFS, auto_update: false };
}

let prefs: Preferences = readPrefs();

export function pickArtifact(artifacts: Artifact[], os: string, arch: string): Artifact | undefined {
  return artifacts.find((a) => a.platform === os && a.arch === arch) ?? artifacts.find((a) => a.platform === os) ?? artifacts[0];
}

export function releaseOf(c: Catalog, product: string, channel: Channel, version?: string): Release | undefined {
  const latest = c.products.find((p) => p.id === product)?.channels[channel];
  if (!latest) return undefined;
  return version ? [latest, ...(latest.history ?? [])].find((r) => r.version === version) : latest;
}

export async function seed(): Promise<void> {
  try {
    const text = localStorage.getItem(KEEP);
    if (text) {
      for (const h of JSON.parse(text) as Held[]) installed.set(key(h.product, h.channel), h);
      kept = world.clean;
      return;
    }
  } catch {
    installed.clear();
  }
  kept = world.clean;
  const platform = await fixtureBridge.platform();
  const wanted: [string, Channel, string][] = [
    ["formcut", "stable", "2.6.0"],
    ["formcut", "beta", "2.7.0-beta.1"],
    ["formvis", "stable", "1.99.5"],
    ["formlit", "stable", "0.47.8"],
    ["formskills", "stable", "0.7.5"],
    ["formwav", "stable", "2.22.3"],
    ["formpdf", "stable", "0.57.3"],
  ];
  const now = Math.floor(Date.now() / 1000);
  wanted.forEach(([product, channel, version], i) => {
    const release = releaseOf(world.catalogue, product, channel, version);
    const artifact = release ? pickArtifact(release.artifacts, platform.os, platform.arch) : undefined;
    if (release && artifact) installed.set(key(product, channel), { product, channel, version, previous: null, sha256: artifact.sha256, file: artifact.file, bytes: artifact.bytes, at: now - (i + 2) * 86400 });
  });
  remember();
}

export function adoptCurrent(): void {
  kept = world.current;
  flags.restore = true;
}

const plain = (h: Held): InstallRecord => ({ product: h.product, channel: h.channel, version: h.version, previous: h.previous });

function parse(signed: Signed): Catalog {
  return JSON.parse(signed.body) as Catalog;
}

const kb = (text: string) => sizeText(new TextEncoder().encode(text).length);

async function fetchCatalogue(): Promise<Catalog> {
  const run = begin("catalogue", "Reading the catalogue", "apps.json and apps.json.sig", [
    ["fetch", "Fetch the catalogue and its signature"],
    ["signature", "Check the signature"],
    ["structure", "Read its structure"],
    ["keep", "Keep a copy for when the network is down"],
  ]);
  const armed = flags.armed;
  flags.armed = null;
  flags.changed = null;
  let fresh = true;
  const got = await stage<{ body: string; signature: string | null }>(run, "fetch", () => {
    if (armed === "offline") {
      fresh = false;
      return { value: { body: kept.body, signature: kept.signature }, tone: "skip", short: "no network: the download did not complete; using the copy kept on this computer", full: "the download did not complete: no network (this demo is offline on purpose)\nFormPortal falls back to the kept apps.json and apps.json.sig. The kept copy goes through the same signature check below." };
    }
    let body = world.current.body;
    let signature: string | null = world.current.signature;
    if (armed === "altered") {
      const match = /"sha256":"([0-9a-f]{64})"/.exec(body);
      if (match) {
        const after = (match[1][0] === "a" ? "b" : "a") + match[1].slice(1);
        flags.changed = { before: match[1], after };
        body = body.replace(match[1], after);
      }
    }
    if (armed === "unsigned") signature = null;
    return {
      value: { body, signature },
      short: signature ? `apps.json ${kb(body)} and apps.json.sig` : `apps.json ${kb(body)}; no apps.json.sig`,
      full: `GET apps.json: ${new TextEncoder().encode(body).length} bytes\n${signature ? `GET apps.json.sig: ${signature.length} characters of base64` : "GET apps.json.sig: not found"}`,
    };
  });
  const body = armed === "stranger" ? world.current.body : got.body;
  const signature = armed === "stranger" ? await sign(body, world.stranger) : got.signature;
  await stage<void>(run, "signature", async () => {
    if (signature === null) {
      if (allowUnsigned()) return { value: undefined, tone: "skip", short: "not signed, accepted because Developer: accept a catalogue that is not signed is on", full: "No signature found. Preferences, Catalogue, Developer: accept a catalogue that is not signed is on, so FormPortal reads it anyway. Turn it off and the same catalogue is refused." };
      throw new Error("the catalogue was refused: it is not signed");
    }
    const verdict = await verifyBody(body, signature, trustedKeys());
    if (!verdict.ok) {
      const lines = [`Ed25519 over ${new TextEncoder().encode(body).length} bytes of apps.json, signature ${signature.slice(0, 22)}...`, `Keys this build trusts: ${COMPILED_KEYS.map((k) => `${keyName(k)} (compiled in)`).join(", ")}, ${keyName(world.demo.raw)} (this page's demo key).`, "None of them verifies this body."];
      if (flags.changed) lines.push(`The body is not what was signed: a SHA-256 in it reads ${flags.changed.after.slice(0, 16)}... where the signed text had ${flags.changed.before.slice(0, 16)}...`);
      if (armed === "stranger") lines.push(`The signature is valid for key ${keyName(world.stranger.raw)}, which this build does not trust.`);
      note(run, "signature", `the catalogue was refused: ${verdict.why}`, lines.join("\n"));
      throw new Error(`the catalogue was refused: ${verdict.why}`);
    }
    const compiled = COMPILED_KEYS.includes(verdict.by ?? "");
    return { value: undefined, short: `signature valid, key ${keyName(verdict.by ?? "")} ${compiled ? "(compiled in)" : "(this page's demo key)"}`, full: `Ed25519 over ${new TextEncoder().encode(body).length} bytes of apps.json.\nSignature ${signature.slice(0, 22)}... verifies with key ${verdict.by}.\nThe compiled-in key is ${COMPILED_KEYS.map(keyName).join(", ")}; this page signs with a key it made when it loaded, so the check is real but proves the check, not who published.` };
  });
  const catalogue = await stage<Catalog>(run, "structure", () => {
    let c: Catalog;
    try {
      c = JSON.parse(body) as Catalog;
    } catch (e) {
      throw new Error(`the catalogue is not valid: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (c.format !== "formai-catalog") throw new Error(`this is not a formai catalogue (format is ${JSON.stringify(c.format)})`);
    if (c.format_version !== 1) throw new Error(`catalogue format ${c.format_version} is newer than this build reads (1)`);
    return { value: c, short: `format "${c.format}" version ${c.format_version}, ${c.products.length} products`, full: `format "${c.format}", format_version ${c.format_version}\n${c.products.length} products, generated ${c.generated}\norigin: ${c.origin}` };
  });
  await stage<void>(run, "keep", () => {
    if (!fresh) return { value: undefined, tone: "skip", short: "already the kept copy", full: "Nothing is rewritten: this was the kept copy." };
    kept = { body, signature: signature ?? "" };
    return { value: undefined, short: "kept as apps.json and apps.json.sig", full: `${base}/catalog/apps.json and apps.json.sig are replaced only after the signature passed.` };
  });
  finish(run, armed === "offline" ? "The kept catalogue passed the same checks." : "The catalogue is signed and readable.");
  return catalogue;
}

async function keptCatalogue(): Promise<Catalog> {
  const verdict = await verifyBody(kept.body, kept.signature, trustedKeys());
  if (!verdict.ok) throw new Error(`the catalogue was refused: ${verdict.why}`);
  return parse(kept);
}

interface Options {
  repair: boolean;
}

async function doInstall(product: string, channel: Channel, progress: (fraction: number) => void, version: string | undefined, options: Options): Promise<InstallRecord> {
  const name = label(product);
  const platform = await fixtureBridge.platform();
  const run = begin(options.repair ? "repair" : "install", `${name}${suffix(channel)}${version ? ` ${version}` : ""}`, options.repair ? "Repair: the same version again" : version ? "Installing the version you chose" : "Installing the newest", [
    ["catalogue", "Check the kept catalogue's signature again"],
    ["choose", "Pick the file for this computer"],
    ["address", "Check the address"],
    ["download", "Download"],
    ["hash", "Compare the SHA-256 with the catalogue"],
    ["unpack", "Unpack into a staging folder"],
    ["place", "Move into place and keep the old one"],
  ]);
  const flip = flags.flip;
  flags.flip = false;
  try {
    const catalogue = await stage<Catalog>(run, "catalogue", async () => {
      const verdict = await verifyBody(kept.body, kept.signature, trustedKeys());
      if (!verdict.ok) throw new Error(`the catalogue was refused: ${verdict.why}`);
      progress(0.04);
      return { value: parse(kept), short: `kept catalogue, signature valid, key ${keyName(verdict.by ?? "")}`, full: `${base}/catalog/apps.json (${new TextEncoder().encode(kept.body).length} bytes) and apps.json.sig\nEd25519 verifies with key ${verdict.by}.\nNothing is read from a catalogue whose signature fails.` };
    });
    const chosen = await stage<{ release: Release; artifact: Artifact }>(run, "choose", () => {
      const release = releaseOf(catalogue, product, channel, version);
      const artifact = release ? pickArtifact(release.artifacts, platform.os, platform.arch) : undefined;
      if (!release || !artifact) throw new Error(`the catalogue offers this computer nothing for ${product}${version ? ` ${version}` : ""}`);
      run.title = `${name}${suffix(channel)} ${release.version}`;
      progress(0.08);
      return { value: { release, artifact }, short: `${artifact.file}, ${sizeText(artifact.bytes)}, needs ${artifact.minimum_os || "nothing special"}`, full: `${name} ${release.version} (${channel}), published ${release.published.slice(0, 10)}\nFor ${platform.os} ${platform.arch}: ${artifact.file}\n${artifact.bytes} bytes, minimum ${artifact.minimum_os || "none stated"}\nExpected SHA-256 ${artifact.sha256}` };
    });
    const { release, artifact } = chosen;
    await stage<void>(run, "address", () => {
      const ok = artifact.url.startsWith("https://") || ["http://127.0.0.1:", "http://127.0.0.1/", "http://localhost:", "http://localhost/"].some((p) => artifact.url.startsWith(p));
      if (!ok) throw new Error(`refused address ${JSON.stringify(artifact.url)}: only https, or http on this computer, is fetched`);
      progress(0.1);
      return { value: undefined, short: artifact.url, full: `${artifact.url}\nhttps is allowed; so is http on this computer. Any other address is refused before a byte is fetched.` };
    });
    let data = flags.evil.get(artifact.file) ?? world.packs.get(artifact.file);
    if (!data) throw new Error(`${artifact.file} is not in this demo's stand-in library`);
    const received = await stage<Uint8Array>(run, "download", async () => {
      const total = data?.length ?? 0;
      for (let step = 1; step <= 6; step += 1) {
        await pause(90);
        progress(0.1 + step * 0.1);
      }
      let out = data as Uint8Array;
      if (flip) {
        out = out.slice();
        out[out.length >> 1] ^= 1;
      }
      return { value: out, short: `${total} bytes saved as downloads/${artifact.file}.part`, full: `A stand-in package made inside this page is read instead of fetching ${artifact.url}.\n${total} bytes arrive in 64 KB chunks into downloads/${artifact.file}.part; a part left by an interrupted download resumes from its size with a Range request.${flip ? "\nOne byte of it was changed on the way (the case you chose)." : ""}` };
    });
    data = received;
    await stage<string>(run, "hash", async () => {
      const found = await sha256(received);
      progress(0.8);
      if (found !== artifact.sha256) {
        note(run, "hash", `${artifact.file} does not match the catalogue`, `expected SHA-256 ${artifact.sha256}\nfound    SHA-256 ${found}\nThe .part file is deleted and nothing is unpacked.`);
        throw new Error(`${artifact.file} does not match the catalogue: expected SHA-256 ${artifact.sha256}, found ${found}. It was not installed`);
      }
      return { value: found, short: `SHA-256 ${found.slice(0, 20)}... matches`, full: `expected ${artifact.sha256}\nfound    ${found}\nThe file is renamed from .part to its name only after they match.` };
    });
    const entries = await readPack(received);
    await stage<void>(run, "unpack", () => {
      const checked = checkEntries(entries);
      progress(0.9);
      return { value: undefined, short: `${checked.files} files, ${sizeText(checked.bytes)}, every path stays inside ${release.version}.tmp`, full: `${entries.map((e) => `${e.link ? "link " : "file "} ${e.name} (${e.size} bytes${e.crcOk ? ", CRC-32 ok" : ""})`).join("\n")}\nEach path must resolve inside the staging folder; links must too; no path may pass through a link.` };
    });
    const before = installed.get(key(product, channel));
    const held = await stage<Held>(run, "place", async () => {
      const open = running.get(key(product, channel));
      if (open && before && before.version === release.version && !options.repair) throw new Error(`${product} ${release.version} is open (process ${open}); close it first, then try again`);
      const previous = options.repair ? (before?.previous ?? null) : before && before.version !== release.version ? (prefs.keep_previous ? before.version : null) : (before?.previous ?? null);
      const next: Held = { product, channel, version: release.version, previous, sha256: artifact.sha256, file: artifact.file, bytes: received.length, at: Math.floor(Date.now() / 1000) };
      installed.set(key(product, channel), next);
      remember();
      progress(1);
      const stillOpen = open ? ` ${name} is still open (process ${open}); it keeps running untouched and ${release.version} opens next time.` : "";
      return { value: next, short: `${release.version} is current${previous ? `; ${previous} kept to go back to` : ""}`, full: `${release.version}.tmp is renamed to ${base}/apps/${product}/${channel}/${release.version}\nThe record of installed apps is written${previous ? `, with ${previous} kept as the version before` : ""}.${stillOpen}` };
    });
    finish(run, `${name}${suffix(channel)} ${release.version} is installed.`);
    return plain(held);
  } finally {
    if (flags.restore) {
      flags.restore = false;
      flags.evil.clear();
      kept = world.clean;
      restore();
    }
    hooks.changed();
  }
}

async function install(product: string, channel: Channel, progress: (fraction: number) => void, version?: string): Promise<InstallRecord> {
  const record = await doInstall(product, channel, progress, version, { repair: false });
  if (version) {
    const latest = releaseOf(await keptCatalogue(), product, channel);
    if (latest && versionNewer(latest.version, record.version) && prefs.per_app[product] !== false && (prefs.per_app[product] || prefs.auto_update)) prefs = { ...prefs, per_app: { ...prefs.per_app, [product]: false } };
    savePrefs();
  }
  return record;
}

function savePrefs(): void {
  try {
    localStorage.setItem(PREFS, JSON.stringify(prefs));
  } catch {
    return;
  }
}

const policyView = (): PolicyView => ({ managed_by: "Example IT", system: true, path: "/etc/formportal/policy.json", locked: ["auto_update_beta", "allow_unsigned"], catalog: null, apps: null, channels: ["stable"], extensions: true, sideload: false });

const own: Partial<Bridge> = {
  catalog: () => fetchCatalogue(),
  catalogKept: () => keptCatalogue(),
  installs: async () => Array.from(installed.values()).map(plain),
  install,
  open: (product, channel) => hooks.open(product, channel),
  rollback: async (product, channel) => {
    const held = installed.get(key(product, channel));
    if (!held || !held.previous) throw new Error(`an earlier version of ${product} is not installed`);
    const run = begin("rollback", `${label(product)}${suffix(channel)}`, `Back to ${held.previous}`, [
      ["previous", "Find the version kept before"],
      ["swap", "Swap it with the current one"],
      ["hold", "Hold automatic updates"],
    ]);
    const platform = await fixtureBridge.platform();
    const catalogue = await keptCatalogue();
    const earlier = held.previous;
    const next = await stage<Held>(run, "previous", () => {
      const release = releaseOf(catalogue, product, channel, earlier);
      const artifact = release ? pickArtifact(release.artifacts, platform.os, platform.arch) : undefined;
      if (!release || !artifact) throw new Error(`${product} ${earlier} is not installed`);
      return { value: { ...held, version: earlier, previous: held.version, sha256: artifact.sha256, file: artifact.file, bytes: artifact.bytes, at: Math.floor(Date.now() / 1000) }, short: `${earlier} is still in ${base}/apps/${product}/${channel}/${earlier}`, full: `The kept folder for ${earlier} exists, so nothing is downloaded and nothing is unpacked.` };
    });
    await stage<void>(run, "swap", () => {
      installed.set(key(product, channel), next);
      remember();
      return { value: undefined, short: `${earlier} is current; ${held.version} is kept to go forward again`, full: "The record of installed apps now lists the old version as current and the newer one as the version before, so Go back works again the other way." };
    });
    await stage<void>(run, "hold", () => {
      const older = versionNewer(held.version, earlier);
      const automatic = prefs.per_app[product] !== undefined ? prefs.per_app[product] : channel === "stable" ? prefs.auto_update : prefs.auto_update && prefs.auto_update_beta;
      later.delete(key(product, channel));
      if (older && automatic) {
        prefs = { ...prefs, per_app: { ...prefs.per_app, [product]: false } };
        savePrefs();
        return { value: undefined, short: `automatic updates for ${label(product)} are off so ${earlier} stays`, full: "Going back to an older version while automatic updates are on would be undone at the next check, so they are turned off for this app. Turn them back on under More." };
      }
      return { value: undefined, tone: "skip", short: "nothing to hold", full: "Automatic updates were already off for this app, or this was not a step back." };
    });
    finish(run, `${label(product)} is back to ${earlier}.`);
    return plain(next);
  },
  remove: async (product, channel) => {
    if (!installed.delete(key(product, channel))) throw new Error(`${product} is not installed`);
    later.delete(key(product, channel));
    remember();
    hooks.changed();
  },
  stillOpen: async (product, channel) => {
    const pid = running.get(key(product, channel));
    return pid ? [pid] : [];
  },
  laterList: async () => Array.from(later),
  updateLater: async (product, channel, on) => {
    if (on && !installed.has(key(product, channel))) throw new Error(`${product} is not installed`);
    if (on) later.add(key(product, channel));
    else later.delete(key(product, channel));
    return Array.from(later);
  },
  autoUpdate: async (progress) => {
    const catalogue = await keptCatalogue();
    const done = [];
    for (const record of Array.from(installed.values())) {
      const release = releaseOf(catalogue, record.product, record.channel);
      if (!release || !versionNewer(release.version, record.version)) continue;
      const k = key(record.product, record.channel);
      const own = prefs.per_app[record.product];
      const automatic = own !== undefined ? own && (record.channel === "stable" || prefs.auto_update_beta) : record.channel === "stable" ? prefs.auto_update : prefs.auto_update && prefs.auto_update_beta;
      if (!(automatic || later.has(k))) continue;
      if (flags.policy && record.channel !== "stable") continue;
      if ((prefs.only_when_closed || later.has(k)) && running.has(k)) continue;
      try {
        await doInstall(record.product, record.channel, (f) => progress(record.product, record.channel, f), undefined, { repair: false });
        later.delete(k);
        done.push({ product: record.product, channel: record.channel, from: record.version, to: release.version, error: null });
      } catch (e) {
        done.push({ product: record.product, channel: record.channel, from: record.version, to: release.version, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return done;
  },
  repair: async (fix) => {
    const catalogue = await keptCatalogue();
    const findings: RepairFinding[] = [];
    let fixed = 0;
    for (const held of Array.from(installed.values())) {
      if (!held.gone) continue;
      const path = `${base}/apps/${held.product}/${held.channel}/${held.version}`;
      const problem = `${held.product} ${held.version}${suffix(held.channel)} is recorded as installed but its folder is gone`;
      const finding: RepairFinding = { kind: "missing", product: held.product, channel: held.channel, path, bytes: 0, problem, fix: "install the same version again from the catalogue, checking its SHA-256", fixed: false, error: null };
      if (fix) {
        try {
          const platform = await fixtureBridge.platform();
          const release = releaseOf(catalogue, held.product, held.channel, held.version);
          if (!release || !pickArtifact(release.artifacts, platform.os, platform.arch)) throw new Error("the catalogue no longer offers this exact file");
          await doInstall(held.product, held.channel, () => undefined, held.version, { repair: true });
          const after = installed.get(key(held.product, held.channel));
          if (after) {
            delete after.gone;
            remember();
          }
          finding.fixed = true;
          fixed += 1;
        } catch (e) {
          finding.error = e instanceof Error ? e.message : String(e);
        }
      }
      findings.push(finding);
    }
    return { checked: installed.size, findings, fixed, freed: 0 };
  },
  storage: async () => {
    const apps = Array.from(installed.values()).reduce((n, h) => n + h.bytes, 0);
    return { formportal: [{ what: "Installed apps", path: `${base}/apps`, bytes: apps }, { what: "The kept catalogue", path: `${base}/catalog`, bytes: new TextEncoder().encode(kept.body).length }], formportal_bytes: apps, folders: [] };
  },
  preferences: async () => prefs,
  setPreferences: async (next) => {
    prefs = next;
    savePrefs();
  },
  policy: async () => (flags.policy ? policyView() : null),
  fonts: async () => ({ index: null, index_error: null, installed: [], folder: "" }),
  media: async () => ({ index: null, credits: [], index_error: null, saved: [], library: "" }),
};

export const ready: Promise<void> = initWorld().then(seed);

const waited: Record<string, unknown> = {};
for (const [name, fn] of Object.entries(own)) {
  waited[name] = async (...args: unknown[]) => {
    await ready;
    return (fn as (...a: unknown[]) => Promise<unknown>)(...args);
  };
}

export const demoBridge: Bridge = { ...fixtureBridge, source: "fixture", ...(waited as Partial<Bridge>) };

export function currentPrefs(): Preferences {
  return prefs;
}
