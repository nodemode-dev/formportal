import { pickBridge } from "../../bridge/index.ts";
import type { UpcomingDay, UpcomingView } from "../../engine/types.ts";
import { language, t } from "../../i18n/index.ts";

const KEY = "formportal.soon";
const HOUR = 3600 * 1000;
const POLL = 15 * 60 * 1000;
export const REQUEST = "https://github.com/orgs/nodemode-dev/discussions/new?category=replicate-app-request";

export function requestAddress(name: string, use: string, link: string): string {
  const said = use.trim().replace(/\r?\n/g, "\r\n");
  const body = link ? (said ? `${said}\r\n\r\nLink: ${link}` : `Link: ${link}`) : said;
  return `${REQUEST}&title=${encodeURIComponent(`Replicate: ${name.trim()}`)}&body=${encodeURIComponent(body)}`;
}

const linkOk = (text: string): boolean => {
  if (text === "") return true;
  if (!text.startsWith("https://") || text.length > 300 || /\s/.test(text)) return false;
  try {
    return new URL(text).hostname.includes(".");
  } catch {
    return false;
  }
};

export function onTheWay(bundled: number[]): void {
  const bridge = pickBridge();
  const root = document.documentElement;
  const list = document.querySelector<HTMLElement>("[data-soon] .waves");
  const askTile = document.querySelector<HTMLElement>("[data-soon-ask-tile]");
  const sealedAt = Array.from(document.querySelectorAll<HTMLElement>("[data-soon-sealed]")).map((el) => Date.parse(el.dataset.soonAt ?? ""));
  const shown = new Map<string, HTMLElement>();

  const flag = (name: string, on: boolean) => {
    if (root.hasAttribute(name) !== on) root.toggleAttribute(name, on);
  };
  const put = (node: Element | null, text: string) => {
    if (node && node.textContent !== text) node.textContent = text;
  };
  const apps = (n: number) => (n === 1 ? t("1 app") : t("{n} apps", { n }));
  const day = (at: string) => new Date(at).toLocaleDateString(language(), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

  const tile = (d: UpcomingDay): HTMLElement => {
    const li = document.createElement("li");
    const head = document.createElement("p");
    const date = document.createElement("b");
    head.className = "wave-head";
    date.className = "soon-date";
    head.append(date);
    li.append(head);
    if (d.sealed) {
      const seal = document.querySelector("[data-soon-sealed] .sealed-body");
      li.className = "wave-sealed";
      if (seal) li.append(seal.cloneNode(true));
    } else {
      const n = document.createElement("span");
      const tiles = document.createElement("ul");
      li.className = "wave-site";
      n.className = "wave-n";
      tiles.className = "wave-tiles soon-tiles";
      head.append(n);
      li.append(tiles);
    }
    return li;
  };

  const paintDay = (li: HTMLElement, d: UpcomingDay) => {
    put(li.querySelector(".soon-date"), day(d.at));
    if (d.sealed) return;
    put(li.querySelector(".wave-n"), apps(d.count));
    const tiles = li.querySelector(".wave-tiles");
    if (!tiles) return;
    const want = Math.min(d.count, 40);
    while (tiles.children.length > want) tiles.lastElementChild?.remove();
    while (tiles.children.length < want) {
      const seal = document.createElement("li");
      const mark = document.createElement("span");
      seal.className = "seal soon-tile";
      mark.className = "soon-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = "?";
      seal.append(mark);
      tiles.append(seal);
    }
  };

  const siteDays = (view: UpcomingView) => {
    const extra = view.dated.filter((d) => {
      const at = Date.parse(d.at);
      return d.sealed ? !sealedAt.includes(at) : !bundled.includes(at);
    });
    const keys = new Set(extra.map((d) => `${d.sealed ? "s" : "d"}${d.at}`));
    for (const [key, li] of shown) {
      if (!keys.has(key)) {
        li.remove();
        shown.delete(key);
      }
    }
    for (const d of extra) {
      const key = `${d.sealed ? "s" : "d"}${d.at}`;
      let li = shown.get(key);
      if (!li) {
        li = tile(d);
        shown.set(key, li);
        list?.insertBefore(li, askTile);
      }
      paintDay(li, d);
    }
    flag("data-soon-site", shown.size > 0);
  };

  let timer = 0;
  const apply = (view: UpcomingView) => {
    const unsealed = view.known && !view.dated.some((d) => d.sealed);
    const since = typeof view.launched === "number" ? view.launched * 1000 : null;
    const ask = since !== null && Date.now() >= since + HOUR;
    flag("data-soon-unsealed", unsealed);
    flag("data-soon-ask", ask);
    if (view.known) siteDays(view);
    window.clearTimeout(timer);
    if (since !== null && !ask) timer = window.setTimeout(() => void refresh(), Math.min(since + HOUR - Date.now() + 1000, POLL));
    try {
      localStorage.setItem(KEY, JSON.stringify({ unsealed, ask }));
    } catch {}
  };
  const refresh = async () => {
    try {
      apply(await bridge.siteUpcoming());
    } catch {}
  };
  void refresh();
  window.setInterval(() => void refresh(), POLL);

  const dialog = document.querySelector<HTMLDialogElement>("[data-request]");
  const opener = document.querySelector<HTMLButtonElement>("[data-soon-ask-open]");
  const nameIn = dialog?.querySelector<HTMLInputElement>("[data-request-name]") ?? null;
  const useIn = dialog?.querySelector<HTMLTextAreaElement>("[data-request-use]") ?? null;
  const linkIn = dialog?.querySelector<HTMLInputElement>("[data-request-link]") ?? null;
  const go = dialog?.querySelector<HTMLButtonElement>("[data-request-go]") ?? null;
  const say = dialog?.querySelector<HTMLElement>("[data-request-say]") ?? null;
  if (!dialog || !opener || !nameIn || !useIn || !linkIn || !go) return;

  const check = () => {
    const link = linkIn.value.trim();
    const good = linkOk(link);
    if (linkIn.getAttribute("aria-invalid") !== String(!good)) linkIn.setAttribute("aria-invalid", String(!good));
    put(say, good ? " " : t("Give the full address, starting with https://"));
    const off = nameIn.value.trim() === "" || !good;
    if (go.disabled !== off) go.disabled = off;
  };
  opener.addEventListener("click", () => {
    check();
    if (!dialog.open) dialog.showModal();
    nameIn.focus();
  });
  for (const field of [nameIn, useIn, linkIn]) field.addEventListener("input", check);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.querySelector("[data-request-cancel]")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => opener.focus());
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const stops = Array.from(dialog.querySelectorAll<HTMLElement>("input, textarea, button:not([disabled])"));
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  dialog.querySelector("form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    check();
    if (go.disabled) return;
    void bridge.openWeb(requestAddress(nameIn.value, useIn.value, linkIn.value.trim())).catch(() => undefined);
    dialog.close();
  });
}
