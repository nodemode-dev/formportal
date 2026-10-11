import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type IconDef = { viewBox?: string; fill?: boolean; paths: string[] };
export type IconSet = Record<string, IconDef>;
export type Facts = Record<string, string | number>;

export interface MarkerContext {
  icons: IconSet;
  facts: Facts;
  chromeDir: string;
  origin: string;
  rel: string;
}

const STROKE = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';

export function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

export function iconSvg(icons: IconSet, name: string, cls = ""): string {
  const def = icons[name];
  if (!def) throw new Error(`unknown icon: ${name}`);
  const paint = def.fill ? 'fill="currentColor"' : STROKE;
  const paths = def.paths.map((d) => `<path d="${d}"/>`).join("");
  return `<svg class="ic${cls ? ` ${cls}` : ""}" viewBox="${def.viewBox ?? "0 0 24 24"}" ${paint} aria-hidden="true" focusable="false">${paths}</svg>`;
}

export function fact(facts: Facts, key: string): string {
  if (!(key in facts)) throw new Error(`unknown fact: ${key}`);
  return String(facts[key]);
}

export function renderMarkers(html: string, ctx: MarkerContext): string {
  const path = `/${ctx.rel ? `${ctx.rel}/` : ""}`;
  const include = /<!--\s*@include\s+([\w./-]+)\s*-->/g;
  let expanded = html;
  for (let pass = 0; pass < 4 && expanded.search(include) !== -1; pass += 1) {
    expanded = expanded.replace(include, (_, file: string) => readFileSync(resolve(ctx.chromeDir, file), "utf-8"));
  }
  const out = expanded
    .replace(/%icon:([\w-]+)(?::([\w -]+))?%/g, (_, name: string, cls?: string) => iconSvg(ctx.icons, name, cls ?? ""))
    .replace(/%fact:([\w.-]+)%/g, (_, key: string) => fact(ctx.facts, key))
    .replace(/__CANONICAL__/g, `${ctx.origin}${path}`)
    .replace('<html lang="en"', `<html lang="en" data-page="${ctx.rel || "home"}"`)
    .replace(/\sdata-nav-exact="([^"]+)"/g, (_, target: string) => (target === path ? ' aria-current="page"' : ""))
    .replace(/\sdata-nav="([^"]+)"/g, (_, target: string) => (path === target || (target !== "/" && path.startsWith(target)) ? ' aria-current="page"' : ""));
  const left = out.match(/%(?:fact|icon):[\w.:-]+%|<!--\s*@include/);
  if (left) throw new Error(`unresolved marker ${left[0]} in ${ctx.rel || "home"}`);
  return out;
}
