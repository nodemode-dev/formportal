import es from "./es.json";
import { fill, lookup, type Table } from "./translate.ts";

const TABLES: Record<string, Table> = { es: es as unknown as Table };

export const LANGUAGES: { code: string; name: string; reviewed: boolean }[] = [
  { code: "en", name: "English", reviewed: true },
  ...Object.values(TABLES).map((t) => ({ code: t.language, name: t.name, reviewed: t.reviewed })),
];

export function language(): string {
  return document.documentElement.lang || "en";
}

export function t(source: string, vars?: Record<string, string | number>): string {
  return fill(lookup(TABLES[language()] ?? null, source) ?? source, vars);
}

export function pageFor(code: string): string {
  return code in TABLES ? `/${code}/index.html` : "/index.html";
}
