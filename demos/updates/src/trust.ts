import { fixtureBridge } from "../../../frontend/src/bridge/fixture.ts";
import type { Channel } from "../../../frontend/src/engine/types.ts";
import registry from "../../../catalog/products.json";
import { download, encoder, sha256, sizeText } from "../../../demo/src/util.ts";
import { CASES, tryCase } from "./cases.ts";
import { flags, forget, hooks, installed, pickArtifact, ready, releaseOf, running } from "./bridge.ts";
import { readPack } from "./pack.ts";
import { history, next, onTrail, settings, waiting, type Run, type Step } from "./trail.ts";
import { checkEntries } from "./unpack.ts";
import { COMPILED_KEYS, keyName, knownByFile, knownByHash, world } from "./world.ts";

const q = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const names = new Map(registry.products.map((p) => [p.id, p.id === "formai" ? "FormPortal" : p.name]));
const label = (id: string) => names.get(id) ?? id;

const MARKS =
  '<svg class="ic ic-s tr-m-ok" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg><svg class="ic ic-s tr-m-no" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/></svg><svg class="ic ic-s tr-m-skip" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7 12h10"/></svg>';

const BADGE: Record<string, string> = { run: "Checking", hold: "Paused", ok: "Passed", refused: "Refused", idle: "Waiting" };

function build(list: HTMLElement, run: Run): void {
  list.dataset.run = String(run.id);
  list.replaceChildren(
    ...run.steps.map((s) => {
      const li = document.createElement("li");
      li.className = "tr-step";
      li.dataset.step = s.id;
      li.dataset.tone = s.tone;
      const mark = document.createElement("span");
      mark.className = "tr-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.innerHTML = MARKS;
      const main = document.createElement("div");
      main.className = "tr-step-main";
      const name = document.createElement("span");
      name.className = "tr-step-label";
      name.textContent = s.label;
      const text = document.createElement("span");
      text.className = "tr-step-text";
      main.append(name, text);
      li.append(mark, main);
      return li;
    }),
  );
}

function patch(list: HTMLElement, run: Run, full: boolean): void {
  if (list.dataset.run !== String(run.id)) build(list, run);
  for (const step of run.steps as Step[]) {
    const li = list.querySelector<HTMLElement>(`[data-step="${step.id}"]`);
    if (!li) continue;
    if (li.dataset.tone !== step.tone) li.dataset.tone = step.tone;
    const text = li.querySelector<HTMLElement>(".tr-step-text");
    const want = full ? step.full : step.short;
    if (text && text.textContent !== want) text.textContent = want;
    if (!full && li.title !== step.full) li.title = step.full;
  }
}

function paintLast(run: Run): void {
  const box = q("[data-trust-last]");
  const outcome = waiting() ? "hold" : run.outcome;
  box.dataset.outcome = outcome;
  q("[data-trust-last-badge]").textContent = BADGE[outcome];
  q("[data-trust-last-title]").textContent = run.title;
  q("[data-trust-last-sub]").textContent = run.sub;
  q("[data-trust-last-say]").textContent = run.say;
  q("[data-trust-last-note]").textContent = new Date(run.at).toLocaleTimeString();
  patch(q("[data-trust-last-steps]"), run, true);
  q<HTMLButtonElement>("[data-trust-next]").hidden = !waiting();
}

let hideTimer = 0;
let quiet = true;

function paintCard(run: Run, fresh: boolean): void {
  const card = q("[data-trail]");
  if (fresh) {
    window.clearTimeout(hideTimer);
    const opening = quiet && run.kind === "catalogue";
    quiet = false;
    card.hidden = opening;
    if (settings.pausing && document.documentElement.dataset.route !== "trust") q("[data-route-to='trust']").click();
  }
  const outcome = waiting() ? "hold" : run.outcome;
  card.dataset.outcome = outcome;
  q("[data-trail-badge]").textContent = BADGE[outcome];
  q("[data-trail-title]").textContent = run.title;
  q("[data-trail-sub]").textContent = run.sub;
  q("[data-trail-say]").textContent = run.say;
  q<HTMLButtonElement>("[data-trail-next]").hidden = !waiting();
  patch(q("[data-trail-steps]"), run, false);
  if (run.outcome !== "run" && !waiting() && !card.hidden) {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(
      () => {
        card.hidden = true;
      },
      run.outcome === "ok" ? 7000 : 15000,
    );
  }
}

function paintCatalogueState(run: Run): void {
  if (run.kind !== "catalogue" || run.outcome === "run") return;
  const out = q("[data-trust-sigstate]");
  out.textContent = run.outcome === "ok" ? "Signature valid" : "Refused";
  out.dataset.tone = run.outcome === "ok" ? "good" : "bad";
}

function renderCases(): void {
  const list = q("[data-trust-cases]");
  list.replaceChildren(
    ...CASES.map((c) => {
      const li = document.createElement("li");
      li.className = "tr-case";
      li.dataset.case = c.id;
      li.innerHTML = '<div class="tr-case-main"><h3 class="tr-case-title"></h3><p class="fine tr-case-what"></p><p class="tr-case-meta"><span class="chip"></span><span class="fine tr-case-say" aria-live="polite"></span></p></div><button class="btn btn-small" type="button">Try it</button>';
      (li.querySelector(".tr-case-title") as HTMLElement).textContent = c.title;
      (li.querySelector(".tr-case-what") as HTMLElement).textContent = c.what;
      (li.querySelector(".chip") as HTMLElement).textContent = `Stopped by: ${c.caught}`;
      li.querySelector("button")?.addEventListener("click", async () => {
        const [product, channel] = q<HTMLSelectElement>("[data-trust-target]").value.split(":");
        const say = await tryCase(c.id, { product, channel: channel as Channel });
        (li.querySelector(".tr-case-say") as HTMLElement).textContent = say;
        paintOpen();
      });
      return li;
    }),
  );
}

function renderTarget(): void {
  const select = q<HTMLSelectElement>("[data-trust-target]");
  const wanted = select.value || "formvis:stable";
  const options = Array.from(installed.values()).map((h) => {
    const o = new Option(`${label(h.product)}${h.channel === "stable" ? "" : ` (${h.channel})`}, now ${h.version}`, `${h.product}:${h.channel}`);
    return o;
  });
  select.replaceChildren(...options);
  if (options.some((o) => o.value === wanted)) select.value = wanted;
}

function paintOpen(): void {
  const list = q("[data-trust-open]");
  const rows = Array.from(running.entries()).map(([k, pid]) => {
    const held = installed.get(k);
    const li = document.createElement("li");
    li.className = "tr-open-row";
    const text = document.createElement("div");
    const name = document.createElement("span");
    name.className = "tr-open-name";
    name.textContent = `${label(k.split(":")[0])} ${held?.version ?? ""}`;
    const sub = document.createElement("p");
    sub.className = "fine mono";
    sub.textContent = `process ${pid}`;
    text.append(name, sub);
    const btn = document.createElement("button");
    btn.className = "btn btn-small";
    btn.type = "button";
    btn.textContent = "Close it";
    btn.addEventListener("click", () => {
      running.delete(k);
      paintOpen();
    });
    li.append(text, btn);
    return li;
  });
  if (!rows.length) {
    const li = document.createElement("li");
    li.className = "tr-open-row";
    li.innerHTML = '<p class="fine">Nothing is open, so every update can be applied now.</p>';
    rows.push(li);
  }
  list.replaceChildren(...rows);
}

async function verdictFor(file: File): Promise<void> {
  const out = q("[data-trust-verdict]");
  if (file.size > 64_000_000) {
    out.textContent = "That file is over 64 MB; this page reads smaller ones.";
    out.dataset.tone = "bad";
    return;
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const found = await sha256(bytes);
  const byHash = knownByHash(world.catalogue);
  const hit = byHash.get(found);
  const lines: string[] = [];
  let tone = "good";
  if (hit) {
    lines.push(`${file.name} is exactly ${hit.artifact.file}: ${label(hit.product)} ${hit.version}${hit.channel === "stable" ? "" : ` (${hit.channel})`}. Its SHA-256 ${found.slice(0, 20)}... is the catalogue's. FormPortal would accept it.`);
  } else {
    const clean = file.name.replace(/(-edited| \(\d+\))(\.zip)$/i, "$2");
    const named = knownByFile(world.catalogue).get(clean);
    tone = "bad";
    lines.push(named ? `${clean} does not match the catalogue: expected SHA-256 ${named.artifact.sha256}, found ${found}. It was not installed` : `No file in the catalogue has the SHA-256 ${found}. FormPortal installs only a file the signed catalogue names and whose hash matches, so it would not install this.`);
  }
  if (/\.zip$/i.test(file.name)) {
    try {
      const entries = await readPack(bytes);
      const checked = checkEntries(entries);
      lines.push(`Inside: ${checked.files} files, every path and link stays inside its folder.`);
    } catch (e) {
      tone = "bad";
      lines.push(`Inside: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  out.textContent = lines.join(" ");
  out.dataset.tone = tone;
}

async function targetPackage(): Promise<{ file: string; data: Uint8Array } | null> {
  const [product, channel] = q<HTMLSelectElement>("[data-trust-target]").value.split(":");
  const platform = await fixtureBridge.platform();
  const release = releaseOf(world.catalogue, product, channel as Channel);
  const artifact = release ? pickArtifact(release.artifacts, platform.os, platform.arch) : undefined;
  const data = artifact ? world.packs.get(artifact.file) : undefined;
  return artifact && data ? { file: artifact.file, data } : null;
}

async function openDialog(product: string, channel: Channel): Promise<void> {
  const held = installed.get(`${product}:${channel}`);
  if (!held) throw new Error(`${product} is not installed`);
  const dialog = q<HTMLDialogElement>("[data-open-dialog]");
  q("[data-open-title]").textContent = `${label(product)} ${held.version}${channel === "stable" ? "" : ` (${channel})`}`;
  q("[data-open-sub]").textContent = `~/.local/share/formportal/apps/${product}/${channel}/${held.version}`;
  const list = q("[data-open-list]");
  const say = q("[data-open-say]");
  if (held.gone) {
    list.replaceChildren();
    say.textContent = "The folder is gone. Preferences, About, Check now finds this, and Repair installs it again with the SHA-256 checked.";
    say.dataset.tone = "bad";
    dialog.showModal();
    return;
  }
  const data = world.packs.get(held.file) as Uint8Array;
  const entries = await readPack(data);
  const table = document.createElement("table");
  table.className = "demo-table";
  table.innerHTML = "<thead><tr><th>File</th><th>Size</th><th>CRC-32</th><th>Check</th></tr></thead>";
  const body = document.createElement("tbody");
  for (const e of entries) {
    const tr = document.createElement("tr");
    for (const text of [e.name, sizeText(e.size), e.crc.toString(16).padStart(8, "0"), e.crcOk ? "ok" : "differs"]) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.append(td);
    }
    body.append(tr);
  }
  table.append(body);
  list.replaceChildren(table);
  const expected = releaseOf(world.catalogue, product, channel, held.version)?.artifacts.find((a) => a.file === held.file)?.sha256;
  const now = await sha256(data);
  say.textContent = now === expected ? `The package's SHA-256 ${now.slice(0, 20)}... still matches the catalogue.` : "The package no longer matches the catalogue.";
  say.dataset.tone = now === expected ? "good" : "bad";
  dialog.showModal();
}

export async function wireTrust(): Promise<void> {
  await ready;
  hooks.open = openDialog;
  hooks.changed = () => {
    renderTarget();
    paintOpen();
  };
  q("[data-trust-generated]").textContent = world.generated.replace("T", " ").replace("Z", " UTC");
  q("[data-trust-products]").textContent = String(world.catalogue.products.length);
  q("[data-trust-realkey]").textContent = `${COMPILED_KEYS[0]} (${keyName(COMPILED_KEYS[0])})`;
  q("[data-trust-demokey]").textContent = `${world.demo.raw} (${keyName(world.demo.raw)})`;
  renderCases();
  renderTarget();
  paintOpen();

  onTrail((run, fresh) => {
    paintLast(run);
    paintCard(run, fresh);
    paintCatalogueState(run);
  });
  const last = history()[0];
  if (last) paintLast(last);

  const push = () => next();
  q("[data-trust-next]").addEventListener("click", push);
  q("[data-trail-next]").addEventListener("click", push);
  q("[data-trail-close]").addEventListener("click", () => {
    q("[data-trail]").hidden = true;
  });
  q("[data-trail-more]").addEventListener("click", () => q("[data-route-to='trust']").click());
  q<HTMLInputElement>("[data-trust-pause]").addEventListener("change", (e) => {
    settings.pausing = (e.target as HTMLInputElement).checked;
    if (!settings.pausing && waiting()) next();
  });
  q("[data-trust-check]").addEventListener("click", () => document.querySelector<HTMLButtonElement>("[data-retry]")?.click());
  q<HTMLInputElement>("[data-trust-policy]").addEventListener("change", (e) => {
    flags.policy = (e.target as HTMLInputElement).checked;
    document.querySelector<HTMLButtonElement>("[data-retry]")?.click();
  });
  q("[data-trust-reset]").addEventListener("click", () => {
    forget();
    window.location.reload();
  });
  q("[data-open-close]").addEventListener("click", () => q<HTMLDialogElement>("[data-open-dialog]").close());

  for (const b of Array.from(document.querySelectorAll<HTMLElement>("[data-trust-save]"))) {
    b.addEventListener("click", () => {
      const what = b.dataset.trustSave;
      if (what === "catalogue") download("apps.json", encoder.encode(world.clean.body), "application/json");
      if (what === "signature") download("apps.json.sig", encoder.encode(world.clean.signature), "text/plain");
      if (what === "key") download("demo-key.pem", encoder.encode(world.demo.pem), "application/x-pem-file");
    });
  }
  for (const b of Array.from(document.querySelectorAll<HTMLElement>("[data-trust-package]"))) {
    b.addEventListener("click", async () => {
      const pack = await targetPackage();
      if (!pack) return;
      if (b.dataset.trustPackage === "flip") {
        const copy = pack.data.slice();
        copy[copy.length >> 1] ^= 1;
        download(pack.file.replace(/\.zip$/, "-edited.zip"), copy, "application/zip");
      } else download(pack.file, pack.data, "application/zip");
    });
  }
  const input = q<HTMLInputElement>("[data-trust-file]");
  const drop = q("[data-trust-drop]");
  q("[data-trust-choose]").addEventListener("click", () => input.click());
  drop.addEventListener("click", () => input.click());
  drop.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") input.click();
  });
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    input.value = "";
    if (file) void verdictFor(file);
  });
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.dataset.over = "";
  });
  drop.addEventListener("dragleave", () => drop.removeAttribute("data-over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.removeAttribute("data-over");
    const file = (e as DragEvent).dataTransfer?.files[0];
    if (file) void verdictFor(file);
  });
}
