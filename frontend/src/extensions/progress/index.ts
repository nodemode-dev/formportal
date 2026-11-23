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
    const card = document.querySelector<HTMLElement>("[data-app-window]");
    const run = card?.querySelector<HTMLElement>("[data-job-run]");
    if (!card || !run) return;
    const list = (kind: Kind) =>
      `<ol class="job-steps" data-kind="${kind}">${STEPS[kind]
        .map(([id, name]) => `<li class="job-step" data-step="${id}" data-state="wait">${TICK}<span class="job-name">${t(name)}</span><span class="job-detail mono"> </span></li>`)
        .join("")}</ol>`;
    const table = (kind: Kind) =>
      `<dl class="job-numbers" data-kind="${kind}">${NUMBERS[kind].map(([id, label]) => `<div><dt>${t(label)}</dt><dd class="mono" data-n="${id}"> </dd></div>`).join("")}</dl>`;
    run.innerHTML = `${list("install")}${list("rollback")}<p class="job-now" data-job="now" aria-live="polite"> </p><button class="btn btn-small job-more" type="button" aria-expanded="false">${t("All the numbers")}</button><div class="job-panel" hidden>${table("install")}${table("rollback")}</div>`;

    const jobs = new Map<string, Job>();
    let shown: string | null = null;
    let opener: HTMLElement | null = null;
    const more = card.querySelector<HTMLButtonElement>(".job-more")!;
    const panel = card.querySelector<HTMLElement>(".job-panel")!;

    const release = (job: Job) => {
      const latest = engine.product(job.product)?.channels[job.channel];
      const found = latest ? [latest, ...(latest.history ?? [])].find((r) => r.version === job.version) : undefined;
      return found ? engine.artifactFor(found) : null;
    };

    const split = (key: string) => {
      const [product = "", channel = "stable"] = key.split(":");
      return { product, channel: channel as Channel };
    };

    const anchor = (key: string): HTMLElement | null => {
      if (opener && opener.getClientRects().length > 0) return opener.closest<HTMLElement>(".row, .hero, .beta-row") ?? opener;
      const { product, channel } = split(key);
      const sel = [".row", ".hero", ".beta-row"].map((c) => `${c}[data-product="${product}"][data-row="${channel}"]`).join(",");
      return Array.from(document.querySelectorAll<HTMLElement>(sel)).find((el) => el.getClientRects().length > 0) ?? null;
    };

    const style = (name: "left" | "top" | "width" | "maxHeight", value: string) => {
      if (card.style[name] !== value) card.style[name] = value;
    };

    let framed = 0;
    const place = () => {
      framed = 0;
      if (!shown || card.hidden) return;
      const edge = 12;
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      const width = Math.min(360, viewW - 2 * edge);
      style("width", `${width}px`);
      style("maxHeight", `${viewH - 2 * edge}px`);
      const at = anchor(shown)?.getBoundingClientRect();
      const body = card.querySelector<HTMLElement>(".appwin-body");
      const height = body ? card.offsetHeight - body.clientHeight + body.scrollHeight : card.offsetHeight;
      const room = viewH - edge;
      const below = at ? room - (at.bottom + 6) : 0;
      const above = at ? at.top - 6 - edge : 0;
      let top: number;
      let most: number;
      if (!at) {
        most = room - edge;
        top = Math.max(edge, room - Math.min(height, most));
      } else if (height <= below || below >= above) {
        top = at.bottom + 6;
        most = below;
      } else {
        most = above;
        top = Math.max(edge, at.top - 6 - Math.min(height, most));
      }
      const left = at ? Math.max(edge, Math.min(at.right - width - edge, viewW - width - edge)) : viewW - width - 16;
      style("maxHeight", `${Math.max(160, Math.round(most))}px`);
      style("left", `${Math.round(left)}px`);
      style("top", `${Math.round(Math.min(top, room - 160))}px`);
    };
    const fit = place;
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

    const idle = (key: string) => {
      const { product, channel } = split(key);
      const record = engine.installs.get(key);
      const view = engine.view(product, channel);
      card.removeAttribute("data-kind");
      card.removeAttribute("data-state");
      write(card.querySelector("[data-job='title']"), engine.name(product));
      write(card.querySelector("[data-job='sub']"), record ? t("{version} installed", { version: record.version }) : view.version ? t("{version} available", { version: view.version }) : " ");
    };

    const buttons = () => Array.from(document.querySelectorAll<HTMLButtonElement>("[data-more]"));
    const mark = (key: string | null) => {
      for (const button of buttons()) {
        const row = button.closest<HTMLElement>("[data-row]");
        const on = key !== null && row !== null && engine.key(row.dataset.product ?? "", (row.dataset.row ?? "stable") as Channel) === key;
        attr(button, "aria-expanded", String(on && button === opener));
      }
    };

    const show = (key: string) => {
      const { product, channel } = split(key);
      const switched = shown !== key;
      shown = key;
      if (switched) {
        attr(card, "data-product", product);
        attr(card, "data-row", channel);
        card.querySelector(".menu")?.removeAttribute("data-asking");
        panel.hidden = true;
        attr(more, "aria-expanded", "false");
        engine.emit("product", { id: product });
      }
      const job = jobs.get(key);
      card.toggleAttribute("data-job-on", Boolean(job));
      if (job) paint(job);
      else idle(key);
      if (card.hidden) card.hidden = false;
      mark(key);
      place();
    };

    const stops = () => Array.from(card.querySelectorAll<HTMLElement>("button, select, input, a[href]")).filter((node) => !(node as HTMLButtonElement).disabled && node.getClientRects().length > 0);

    const close = (refocus: boolean) => {
      if (card.hidden) return;
      const back = opener;
      card.hidden = true;
      card.querySelector(".menu")?.removeAttribute("data-asking");
      for (const [key, job] of jobs) if (job.state !== "running" && key === shown) jobs.delete(key);
      shown = null;
      opener = null;
      mark(null);
      if (refocus && back && back.getClientRects().length > 0) back.focus({ preventScroll: true });
    };

    card.querySelector("[data-appwin-close]")?.addEventListener("click", () => close(true));

    document.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-more]") : null;
      if (!button) return;
      const row = button.closest<HTMLElement>("[data-row]");
      if (!row) return;
      const key = engine.key(row.dataset.product ?? "", (row.dataset.row ?? "stable") as Channel);
      if (!card.hidden && shown === key && opener === button) {
        close(true);
        return;
      }
      opener = button;
      show(key);
      if (event.detail === 0) (stops().find((node) => !node.matches("[data-appwin-close]")) ?? stops()[0])?.focus({ preventScroll: true });
    });

    document.addEventListener(
      "click",
      (event) => {
        if (card.hidden) return;
        const at = event.target instanceof Element ? event.target : null;
        if (!at || card.contains(at) || at.closest("[data-more]") || !at.isConnected) return;
        close(!at.closest("button, a, input, select, textarea, [tabindex]"));
      },
      true,
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (card.hidden) return;
        const at = document.activeElement;
        if (event.key === "Escape") {
          if (document.querySelector("dialog[open]")) return;
          event.preventDefault();
          event.stopPropagation();
          close(true);
          return;
        }
        if (!(at instanceof HTMLElement) || !card.contains(at) || event.altKey || event.metaKey || event.ctrlKey) return;
        if (at instanceof HTMLSelectElement) return;
        const list = stops();
        const now = list.indexOf(at);
        const next = event.key === "ArrowDown" ? now + 1 : event.key === "ArrowUp" ? now - 1 : event.key === "Home" ? 0 : event.key === "End" ? list.length - 1 : null;
        if (next === null || list.length === 0) return;
        event.preventDefault();
        list[(next + list.length) % list.length]?.focus();
      },
      true,
    );

    engine.on("install", ({ key }) => {
      if (shown === key && !jobs.has(key)) idle(key);
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
