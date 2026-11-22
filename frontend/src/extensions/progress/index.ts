import { t } from "../../i18n/index.ts";
import { sizeText } from "../versions/index.ts";
import type { Engine } from "../../engine/index.ts";
import type { Channel, JobEvent, JobStep } from "../../engine/types.ts";
import type { Extension } from "../registry.ts";

type Kind = "install" | "rollback";

const STEPS: Record<Kind, [JobStep, string][]> = {
  install: [
    ["signature", "Check the kept catalogue's signature again"],
    ["pick", "Pick the file for this computer"],
    ["address", "Check the address"],
    ["download", "Download"],
    ["sha256", "Compare the SHA-256 with the catalogue"],
    ["unpack", "Unpack into a staging folder"],
    ["place", "Move into place and keep the old one"],
  ],
  rollback: [
    ["find", "Find the version kept before"],
    ["swap", "Swap it with the current one"],
    ["hold", "Hold automatic updates"],
  ],
};

const NUMBERS: Record<Kind, [string, string][]> = {
  install: [
    ["file", "File"],
    ["size", "Size in the catalogue"],
    ["saved", "Downloaded"],
    ["url", "Address"],
    ["expected", "Expected SHA-256"],
    ["computed", "Computed SHA-256"],
    ["path", "Installed in"],
    ["took", "Took"],
  ],
  rollback: [
    ["kept", "Version kept before"],
    ["swapped", "Kept to go back to"],
    ["path", "Installed in"],
    ["took", "Took"],
  ],
};

interface Job {
  key: string;
  product: string;
  channel: Channel;
  kind: Kind;
  version: string;
  newest: boolean;
  done: Map<JobStep, string>;
  state: "running" | "passed" | "failed";
  error: string | null;
  started: number;
  ended: number | null;
}

const TICK = '<svg class="job-tick" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.6"/><path class="job-check" d="M5.2 8.2l1.9 1.9 3.7-3.9"/></svg>';
const CROSS = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>';

const write = (node: Element | null, text: string) => {
  if (!node || node.textContent === text) return;
  const only = node.childNodes.length === 1 ? node.firstChild : null;
  if (only && only.nodeType === Node.TEXT_NODE) only.nodeValue = text;
  else node.textContent = text;
};

const attr = (node: Element | null, name: string, value: string) => {
  if (node && node.getAttribute(name) !== value) node.setAttribute(name, value);
};

export const progress: Extension = {
  id: "progress",
  setup(engine: Engine) {
    const card = document.createElement("section");
    card.className = "job";
    card.hidden = true;
    card.setAttribute("aria-label", t("Steps"));
    const list = (kind: Kind) =>
      `<ol class="job-steps" data-kind="${kind}">${STEPS[kind]
        .map(([id, name]) => `<li class="job-step" data-step="${id}" data-state="wait">${TICK}<span class="job-name">${t(name)}</span><span class="job-detail mono"> </span></li>`)
        .join("")}</ol>`;
    const table = (kind: Kind) =>
      `<dl class="job-numbers" data-kind="${kind}">${NUMBERS[kind].map(([id, label]) => `<div><dt>${t(label)}</dt><dd class="mono" data-n="${id}"> </dd></div>`).join("")}</dl>`;
    card.innerHTML = `<header class="job-head"><span class="job-pill" data-job="pill"> </span><div class="job-titles"><p class="job-title" data-job="title"> </p><p class="job-sub" data-job="sub"> </p></div><button class="job-x" type="button" aria-label="${t("Close")}">${CROSS}</button></header>${list("install")}${list("rollback")}<p class="job-now" data-job="now" aria-live="polite"> </p><button class="btn btn-small job-more" type="button" aria-expanded="false">${t("All the numbers")}</button><div class="job-panel" hidden>${table("install")}${table("rollback")}</div>`;
    document.body.append(card);

    const jobs = new Map<string, Job>();
    let shown: string | null = null;
    const more = card.querySelector<HTMLButtonElement>(".job-more")!;
    const panel = card.querySelector<HTMLElement>(".job-panel")!;

    const release = (job: Job) => {
      const latest = engine.product(job.product)?.channels[job.channel];
      const found = latest ? [latest, ...(latest.history ?? [])].find((r) => r.version === job.version) : undefined;
      return found ? engine.artifactFor(found) : null;
    };

    const anchor = (job: Job): HTMLElement | null => {
      const sel = [".row", ".hero", ".beta-row"].map((c) => `${c}[data-product="${job.product}"][data-row="${job.channel}"]`).join(",");
      return Array.from(document.querySelectorAll<HTMLElement>(sel)).find((el) => el.getClientRects().length > 0) ?? null;
    };

    let framed = 0;
    const place = () => {
      framed = 0;
      const job = shown ? jobs.get(shown) : undefined;
      if (!job || card.hidden) return;
      const at = anchor(job)?.getBoundingClientRect();
      const height = card.offsetHeight;
      const width = card.offsetWidth;
      const room = window.innerHeight - 12;
      let top = at ? at.bottom + 6 : room - height;
      if (at && top + height > room) top = Math.max(12, at.top - height - 6);
      const left = at ? Math.max(12, at.right - width - 12) : window.innerWidth - width - 16;
      const tx = `${Math.round(left)}px`;
      const ty = `${Math.round(Math.max(12, Math.min(top, room - height)))}px`;
      if (card.style.left !== tx) card.style.left = tx;
      if (card.style.top !== ty) card.style.top = ty;
      fit();
    };
    const fit = () => {
      const most = `${Math.max(160, Math.round(window.innerHeight - 12 - card.getBoundingClientRect().top))}px`;
      if (card.style.maxBlockSize !== most) card.style.maxBlockSize = most;
    };
    const soon = () => {
      if (!framed) framed = requestAnimationFrame(place);
    };
    window.addEventListener("resize", soon);
    document.addEventListener("scroll", soon, true);
    engine.on("route", () => soon());

    const running = (job: Job): JobStep | null => STEPS[job.kind].find(([id]) => !job.done.has(id))?.[0] ?? null;

    const detail = (job: Job, id: JobStep, value: string): string => {
      const art = release(job);
      switch (id) {
        case "signature":
          return value === "signed" ? t("kept catalogue, signature valid") : t("kept catalogue, not signed, unsigned catalogues allowed");
        case "pick":
          return art?.bytes ? `${value} · ${sizeText(art.bytes)}` : value;
        case "download":
          return t("{n} bytes saved as {file}", { n: value, file: `downloads/${job.done.get("pick") ?? art?.file ?? ""}` });
        case "sha256":
          return t("SHA-256 {hash} matches", { hash: value });
        case "unpack":
          return value;
        case "place":
        case "swap":
          return value ? t("{version} is current; {previous} kept to go back to", { version: job.version, previous: value }) : t("{version} is current; no earlier version kept", { version: job.version });
        case "find":
          return value;
        case "hold":
          return t("automatic updates for it are off so it stays");
        default:
          return value;
      }
    };

    const numbers = (job: Job) => {
      if (panel.hidden) return;
      const art = release(job);
      const record = engine.installs.get(job.key);
      const none = t("not known yet");
      const took = job.ended !== null ? t("{s} s", { s: ((job.ended - job.started) / 1000).toFixed(1) }) : none;
      const values: Record<string, string> =
        job.kind === "install"
          ? {
              file: job.done.get("pick") ?? art?.file ?? none,
              size: art?.bytes ? t("{n} bytes", { n: art.bytes }) : none,
              saved: job.done.has("download") ? t("{n} bytes", { n: job.done.get("download") ?? "" }) : none,
              url: job.done.get("address") ?? art?.url ?? none,
              expected: art?.sha256 ?? none,
              computed: job.done.get("sha256") ?? none,
              path: job.state === "passed" && record?.version === job.version ? (record.path ?? none) : none,
              took,
            }
          : {
              kept: job.done.get("find") ?? none,
              swapped: job.done.get("swap") ?? none,
              path: job.state === "passed" && record?.version === job.version ? (record.path ?? none) : none,
              took,
            };
      card.querySelectorAll<HTMLElement>(`.job-numbers[data-kind="${job.kind}"] [data-n]`).forEach((dd) => write(dd, values[dd.dataset.n ?? ""] ?? none));
    };

    const paint = (job: Job) => {
      if (shown !== job.key) return;
      attr(card, "data-kind", job.kind);
      attr(card, "data-state", job.state);
      const name = engine.name(job.product);
      write(card.querySelector("[data-job='pill']"), job.state === "running" ? t("Checking") : job.state === "passed" ? t("Passed") : t("Failed"));
      write(card.querySelector("[data-job='title']"), job.kind === "install" ? `${name} ${job.version}` : name);
      write(card.querySelector("[data-job='sub']"), job.kind === "rollback" ? t("Back to {version}", { version: job.version }) : job.newest ? t("Installing the newest") : t("Installing {version}", { version: job.version }));
      const at = running(job);
      const pct = engine.progress.get(job.key);
      for (const li of card.querySelectorAll<HTMLElement>(`.job-steps[data-kind="${job.kind}"] .job-step`)) {
        const id = li.dataset.step as JobStep;
        const done = job.done.has(id);
        const state = done ? "done" : id === at ? (job.state === "failed" ? "fail" : job.state === "passed" ? "skip" : "run") : job.state === "passed" ? "skip" : "wait";
        attr(li, "data-state", state);
        const text = done
          ? detail(job, id, job.done.get(id) ?? "")
          : state === "run" && id === "download" && pct !== undefined
            ? `${Math.round(pct * 100)}%`
            : state === "skip" && id === "hold"
              ? t("Not needed: the version you went back to is the newer one")
              : " ";
        write(li.querySelector(".job-detail"), text);
      }
      const label = (id: JobStep | null) => t(STEPS[job.kind].find(([s]) => s === id)?.[1] ?? "");
      const now =
        job.state === "passed"
          ? job.kind === "install"
            ? t("{app} {version} is installed.", { app: name, version: job.version })
            : t("{app} is back to {version}.", { app: name, version: job.version })
          : job.state === "failed"
            ? at
              ? t("{step} did not pass: {why}", { step: label(at), why: job.error ?? "" })
              : (job.error ?? "")
            : label(at);
      write(card.querySelector("[data-job='now']"), now);
      numbers(job);
    };

    const show = (key: string) => {
      shown = key;
      const job = jobs.get(key);
      if (!job) return;
      panel.hidden = true;
      attr(more, "aria-expanded", "false");
      paint(job);
      if (card.hidden) card.hidden = false;
      place();
    };

    card.querySelector(".job-x")?.addEventListener("click", () => {
      card.hidden = true;
      shown = null;
    });
    more.addEventListener("click", () => {
      const job = shown ? jobs.get(shown) : undefined;
      panel.hidden = !panel.hidden;
      attr(more, "aria-expanded", String(!panel.hidden));
      if (job) numbers(job);
      place();
    });

    engine.on("job", (event: JobEvent) => {
      if (event.phase === "start") {
        jobs.set(event.key, {
          key: event.key,
          product: event.product,
          channel: event.channel,
          kind: event.kind ?? "install",
          version: event.version ?? "",
          newest: event.newest ?? false,
          done: new Map(),
          state: "running",
          error: null,
          started: performance.now(),
          ended: null,
        });
        show(event.key);
        return;
      }
      const job = jobs.get(event.key);
      if (!job) return;
      if (event.phase === "step" && event.step) job.done.set(event.step, event.detail ?? "");
      if (event.phase === "end") {
        if (job.state !== "running") return;
        job.state = event.error ? "failed" : "passed";
        job.error = event.error ?? null;
        job.ended = performance.now();
      }
      paint(job);
      if (event.phase === "end") fit();
    });

    engine.on("install", ({ key }) => {
      const job = jobs.get(key);
      if (job && shown === key) paint(job);
    });
  },
};
