import { t } from "../../i18n/index.ts";
import { localDay, sizeText } from "../versions/index.ts";
import { versionNewer } from "../../engine/index.ts";
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
    document.addEventListener(
      "scroll",
      (event) => {
        if (event.target instanceof Node && card.contains(event.target)) return;
        soon();
      },
      true,
    );
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

    const releasesOf = (key: string) => {
      const { product, channel } = split(key);
      const latest = engine.product(product)?.channels[channel];
      return latest ? [latest, ...(latest.history ?? [])] : [];
    };

    const idle = (key: string) => {
      const { product, channel } = split(key);
      const record = engine.installs.get(key) ?? null;
      const view = engine.view(product, channel);
      const name = engine.name(product);
      const own = record ? releasesOf(key).find((r) => r.version === record.version) : undefined;
      const art = own ? engine.artifactFor(own) : null;
      const matches = Boolean(record?.sha256 && art?.sha256 && record.sha256 === art.sha256);
      const differs = Boolean(record?.sha256 && art?.sha256 && record.sha256 !== art.sha256);
      const notKept = t("not kept");
      attr(card, "data-kind", "install");
      if (record) attr(card, "data-state", differs ? "failed" : "passed");
      else card.removeAttribute("data-state");
      write(card.querySelector("[data-job='pill']"), differs ? t("Failed") : t("Passed"));
      write(card.querySelector("[data-job='title']"), record ? `${name} ${record.version}` : name);
      const when = record?.installed_at ? new Date(record.installed_at * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
      write(card.querySelector("[data-job='sub']"), record ? (when ? t("Installed {when}", { when }) : t("{version} installed", { version: record.version })) : view.version ? t("{version} available", { version: view.version }) : " ");
      const kept = record?.previous ? t("{version} is current; {previous} kept to go back to", { version: record.version, previous: record.previous }) : record ? t("{version} is current; no earlier version kept", { version: record.version }) : "";
      const facts: Record<string, [string, string]> = record
        ? {
            signature: ["wait", notKept],
            pick: matches && art ? ["done", art.bytes ? `${art.file} · ${sizeText(art.bytes)}` : art.file] : ["wait", notKept],
            address: ["wait", notKept],
            download: ["wait", notKept],
            sha256: matches ? ["done", t("SHA-256 {hash} matches", { hash: record.sha256 ?? "" })] : differs ? ["fail", t("SHA-256 {hash} does not match the catalogue", { hash: record.sha256 ?? "" })] : ["wait", record.sha256 ?? notKept],
            unpack: ["wait", notKept],
            place: record.path ? ["done", kept] : ["wait", notKept],
          }
        : {};
      for (const li of card.querySelectorAll<HTMLElement>(`.job-steps[data-kind="install"] .job-step`)) {
        const [state, text] = facts[li.dataset.step ?? ""] ?? ["wait", " "];
        attr(li, "data-state", state);
        write(li.querySelector(".job-detail"), text);
      }
      write(card.querySelector("[data-job='now']"), record ? (differs ? t("The installed file does not match the catalogue.") : t("{app} {version} is installed.", { app: name, version: record.version })) : t("Not installed"));
      const values: Record<string, string> = {
        file: matches && art ? art.file : notKept,
        size: art?.bytes ? t("{n} bytes", { n: art.bytes }) : notKept,
        saved: notKept,
        url: notKept,
        expected: art?.sha256 ?? notKept,
        computed: record?.sha256 ?? notKept,
        path: record?.path ?? notKept,
        took: notKept,
      };
      card.querySelectorAll<HTMLElement>(`.job-numbers[data-kind="install"] [data-n]`).forEach((dd) => write(dd, values[dd.dataset.n ?? ""] ?? notKept));
    };

    const backs = card.querySelector<HTMLElement>("[data-appwin-backs]");
    const backCard = (version: string): HTMLLIElement => {
      const li = document.createElement("li");
      li.className = "bcard";
      li.dataset.version = version;
      const room = [t("Installed"), t("Kept"), t("Available"), t("Not kept")].map((word) => `<span class="pill-room" aria-hidden="true">${word}</span>`).join("");
      li.innerHTML = `<div class="bcard-head"><span class="job-pill pill-stack"><span class="bcard-pill"> </span>${room}</span><div class="job-titles"><p class="job-title bcard-title"> </p><p class="job-sub bcard-meta mono"> </p></div><button class="btn btn-small bcard-go" type="button"> </button></div><button class="fold-head bcard-fold" type="button" aria-expanded="false"> </button><div class="bcard-notes"><div class="bcard-notes-in"></div></div>`;
      return li;
    };
    const paintBacks = (key: string) => {
      if (!backs) return;
      const record = engine.installs.get(key) ?? null;
      const busy = engine.progress.has(key);
      const { product, channel } = split(key);
      const blocked = engine.blocked(product, channel);
      const list = releasesOf(key).filter((r) => engine.artifactFor(r) !== null);
      const versions = list.map((r) => r.version);
      if (record?.previous && !versions.includes(record.previous)) versions.push(record.previous);
      const have = new Map(Array.from(backs.children).map((node) => [(node as HTMLElement).dataset.version ?? "", node as HTMLLIElement]));
      versions.forEach((version, i) => {
        const li = have.get(version) ?? backCard(version);
        have.delete(version);
        const release = list.find((r) => r.version === version);
        const art = release ? engine.artifactFor(release) : null;
        const here = version === record?.version;
        const kept = version === record?.previous;
        const older = Boolean(record && !here && versionNewer(record.version, version));
        attr(li, "data-kind", here ? "here" : kept ? "kept" : "other");
        write(li.querySelector(".bcard-pill"), here ? t("Installed") : kept ? t("Kept") : t("Available"));
        write(li.querySelector(".bcard-title"), here ? version : kept || older ? t("Back to {version}", { version }) : version);
        write(li.querySelector(".bcard-meta"), [release ? localDay(release.published) : t("kept on this computer"), art?.bytes ? sizeText(art.bytes) : ""].filter(Boolean).join(" · "));
        const go = li.querySelector<HTMLButtonElement>(".bcard-go");
        write(go, kept ? t("Go back") : t("Install"));
        if (go) {
          const off = busy || (blocked && !kept);
          if (go.disabled !== off) go.disabled = off;
          attr(go, "aria-label", kept ? t("Back to {version}", { version }) : t("Install {version}", { version }));
        }
        write(li.querySelector(".bcard-fold"), t("What changed"));
        li.toggleAttribute("data-notes", Boolean(release?.notes));
        write(li.querySelector(".bcard-notes-in"), release?.notes ?? "");
        if (backs.children[i] !== li) backs.insertBefore(li, backs.children[i] ?? null);
      });
      for (const gone of have.values()) {
        attr(gone, "data-kind", "gone");
        write(gone.querySelector(".bcard-pill"), t("Not kept"));
        write(gone.querySelector(".bcard-title"), gone.dataset.version ?? "");
      }
    };
    backs?.addEventListener("click", (event) => {
      const at = event.target instanceof Element ? event.target : null;
      const li = at?.closest<HTMLElement>(".bcard");
      if (!li || !shown || card.dataset.mode !== "app") return;
      if (at?.closest(".bcard-fold")) {
        const open = li.toggleAttribute("data-open");
        li.querySelector(".bcard-fold")?.setAttribute("aria-expanded", String(open));
        return;
      }
      if (!at?.closest(".bcard-go")) return;
      const target = split(shown);
      if (li.dataset.kind === "kept") void engine.dispatch("app.rollback", target);
      else void engine.dispatch("app.install", { ...target, version: li.dataset.version });
    });

    const appSection = card.querySelector<HTMLElement>(".appwin-set");
    const lock = () => {
      const on = card.dataset.install === "ready" || card.dataset.install === "update";
      appSection?.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button, input").forEach((control) => {
        if (control.disabled !== !on) control.disabled = !on;
      });
      appSection?.querySelectorAll<HTMLElement>(".menu-check").forEach((label) => {
        if (label.hasAttribute("data-off") === on) label.toggleAttribute("data-off", !on);
      });
      if (!on) appSection?.removeAttribute("data-asking");
    };
    new MutationObserver(lock).observe(card, { attributes: true, attributeFilter: ["data-install"] });
    lock();

    const panelBox = card.querySelector<HTMLElement>("[data-appwin-panel]");
    const panelActs = card.querySelector<HTMLElement>("[data-appwin-panel-acts]");
    const twins = new Map<Element, Element>();
    let panelFrom: { row: HTMLElement; hold: HTMLElement; acts: HTMLElement[] } | null = null;
    const pair = (from: Node, to: Node) => {
      if (from instanceof Element && to instanceof Element) twins.set(to, from);
      from.childNodes.forEach((child, i) => {
        const other = to.childNodes[i];
        if (other) pair(child, other);
      });
    };
    const copy = (from: Node, to: Node): boolean => {
      if (from.nodeType !== to.nodeType || from.childNodes.length !== to.childNodes.length) return false;
      if (from.nodeType === Node.TEXT_NODE) {
        if (to.nodeValue !== from.nodeValue) to.nodeValue = from.nodeValue;
        return true;
      }
      if (from instanceof Element && to instanceof Element) {
        for (const { name, value } of Array.from(from.attributes)) if (to.getAttribute(name) !== value) to.setAttribute(name, value);
        for (const { name } of Array.from(to.attributes)) if (!from.hasAttribute(name) && name !== "hidden") to.removeAttribute(name);
        if (from instanceof HTMLInputElement && to instanceof HTMLInputElement && to.checked !== from.checked) to.checked = from.checked;
        if ((from instanceof HTMLButtonElement || from instanceof HTMLInputElement) && (to as HTMLButtonElement).disabled !== from.disabled) (to as HTMLButtonElement).disabled = from.disabled;
      }
      return Array.from(from.childNodes).every((child, i) => copy(child, to.childNodes[i]));
    };
    const fillPanel = () => {
      if (!panelFrom || !panelBox || !panelActs) return;
      const { hold, acts } = panelFrom;
      const same = panelBox.childNodes.length === hold.childNodes.length && Array.from(hold.childNodes).every((n, i) => copy(n, panelBox.childNodes[i])) && panelActs.children.length === acts.length && acts.every((n, i) => copy(n, panelActs.children[i]));
      if (!same) {
        twins.clear();
        panelBox.replaceChildren(...Array.from(hold.childNodes).map((n) => n.cloneNode(true)));
        panelActs.replaceChildren(...acts.map((n) => n.cloneNode(true)));
        pair(hold, panelBox);
        acts.forEach((n, i) => pair(n, panelActs.children[i]));
      }
      acts.forEach((n, i) => {
        const twin = panelActs.children[i] as HTMLElement | undefined;
        const gone = n.getClientRects().length === 0;
        if (twin && twin.hidden !== gone) twin.hidden = gone;
      });
      write(card.querySelector("[data-job='title']"), panelFrom.row.querySelector(".row-name-text")?.textContent ?? "");
      write(card.querySelector("[data-job='sub']"), panelFrom.row.querySelector(".row-sub")?.textContent ?? " ");
    };
    const watch = new MutationObserver(() => fillPanel());
    const stopPanel = () => {
      watch.disconnect();
      panelFrom = null;
    };
    const openPanel = (button: HTMLElement) => {
      const row = button.closest<HTMLElement>(".row");
      const hold = button.parentElement?.querySelector<HTMLElement>(".more-hold");
      if (!row || !hold) return;
      const acts = Array.from(row.querySelectorAll<HTMLElement>(":scope > .acts > *")).filter((n) => !n.contains(button));
      stopPanel();
      panelFrom = { row, hold, acts };
      shown = `panel:${row.dataset.ext ?? row.dataset.font ?? ""}`;
      card.dataset.mode = "panel";
      card.removeAttribute("data-kind");
      card.removeAttribute("data-state");
      card.removeAttribute("data-job-on");
      write(card.querySelector("[data-appwin-panel-title]"), button.getAttribute("aria-label") ?? "");
      fillPanel();
      watch.observe(row, { subtree: true, attributes: true, characterData: true, childList: true });
      if (card.hidden) card.hidden = false;
      place();
    };
    card.addEventListener("click", (event) => {
      const at = event.target instanceof Element ? event.target : null;
      if (!at || !panelFrom || !(panelBox?.contains(at) || panelActs?.contains(at))) return;
      const control = at.closest("button, a, input");
      const twin = control ? twins.get(control) : undefined;
      if (!control || control instanceof HTMLAnchorElement || !(twin instanceof HTMLElement)) return;
      if (control instanceof HTMLInputElement && twin instanceof HTMLInputElement) {
        twin.checked = control.checked;
        twin.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      event.preventDefault();
      twin.click();
    });

    const buttons = () => Array.from(document.querySelectorAll<HTMLButtonElement>("[data-more], [data-more-panel]"));
    const mark = (key: string | null) => {
      for (const button of buttons()) {
        if (button.hasAttribute("data-more-panel")) {
          attr(button, "aria-expanded", String(key !== null && button === opener));
          continue;
        }
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
        backs?.replaceChildren();
        card.querySelector(".menu")?.removeAttribute("data-asking");
        panel.hidden = true;
        attr(more, "aria-expanded", "false");
        engine.emit("product", { id: product });
      }
      if (card.dataset.mode !== "app") {
        stopPanel();
        card.dataset.mode = "app";
      }
      const job = jobs.get(key);
      card.toggleAttribute("data-job-on", Boolean(job));
      if (job) paint(job);
      else idle(key);
      paintBacks(key);
      if (card.hidden) card.hidden = false;
      mark(key);
      place();
    };

    const stops = () => Array.from(card.querySelectorAll<HTMLElement>("button, select, input, a[href]")).filter((node) => !(node as HTMLButtonElement).disabled && node.getClientRects().length > 0);

    const close = (refocus: boolean) => {
      if (card.hidden) return;
      const back = opener;
      card.hidden = true;
      stopPanel();
      card.querySelector(".menu")?.removeAttribute("data-asking");
      for (const [key, job] of jobs) if (job.state !== "running" && key === shown) jobs.delete(key);
      shown = null;
      opener = null;
      mark(null);
      if (refocus && back && back.getClientRects().length > 0) back.focus({ preventScroll: true });
    };

    card.querySelector("[data-appwin-close]")?.addEventListener("click", () => close(true));

    document.addEventListener("click", (event) => {
      const side = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-more-panel]") : null;
      if (side) {
        if (!card.hidden && opener === side) {
          close(true);
          return;
        }
        opener = side;
        openPanel(side);
        mark(shown);
        if (event.detail === 0) (stops().find((node) => !node.matches("[data-appwin-close]")) ?? stops()[0])?.focus({ preventScroll: true });
        return;
      }
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
        if (card.hidden || !event.isTrusted) return;
        const at = event.target instanceof Element ? event.target : null;
        if (!at || card.contains(at) || at.closest("[data-more], [data-more-panel]") || !at.isConnected) return;
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
      if (shown !== key || card.dataset.mode !== "app") return;
      if (!jobs.has(key)) idle(key);
      paintBacks(key);
    });
    engine.on("product", ({ id }) => {
      if (!shown || card.dataset.mode !== "app" || split(shown).product !== id) return;
      if (!jobs.has(shown)) idle(shown);
      paintBacks(shown);
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
