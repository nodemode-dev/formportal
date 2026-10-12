export interface Table {
  language: string;
  name: string;
  reviewed: boolean;
  strings: Record<string, string>;
  patterns: [string, string][];
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Compiled {
  exact: Map<string, string>;
  patterns: { test: RegExp; names: string[]; to: string }[];
}

const cache = new WeakMap<Table, Compiled>();

function compile(table: Table): Compiled {
  let done = cache.get(table);
  if (done) return done;
  const patterns = table.patterns.map(([from, to]) => {
    const names: string[] = [];
    const source = from
      .split(/(\{\w+\})/)
      .map((part) => {
        const m = /^\{(\w+)\}$/.exec(part);
        if (!m) return escape(part);
        names.push(m[1]);
        return "(.+?)";
      })
      .join("");
    return { test: new RegExp(`^${source}$`), names, to };
  });
  done = { exact: new Map(Object.entries(table.strings)), patterns };
  cache.set(table, done);
  return done;
}

export function fill(text: string, vars: Record<string, string | number> = {}): string {
  return text.replace(/\{(\w+)\}/g, (all, name: string) => (name in vars ? String(vars[name]) : all));
}

export function lookup(table: Table | null, source: string): string | null {
  if (!table) return null;
  const c = compile(table);
  const hit = c.exact.get(source);
  if (hit !== undefined) return hit;
  for (const p of c.patterns) {
    const m = p.test.exec(source);
    if (m) {
      const vars: Record<string, string> = {};
      p.names.forEach((n, i) => (vars[n] = m[i + 1]));
      return fill(p.to, vars);
    }
  }
  return null;
}

export function translateHtml(html: string, table: Table): string {
  const swap = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return raw;
    const to = lookup(table, trimmed);
    return to === null ? raw : raw.replace(trimmed, to);
  };
  const parts = html.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>)/);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part
        .replace(/>([^<>]+)</g, (_all, text: string) => `>${swap(text)}<`)
        .replace(/(\s(?:aria-label|placeholder|title|data-title)=")([^"]*)"/g, (_all, head: string, value: string) => `${head}${swap(value)}"`);
    })
    .join("")
    .replace(/<html lang="en"/, `<html lang="${table.language}"`);
}
