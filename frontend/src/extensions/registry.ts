import type { Engine } from "../engine/index.ts";

export interface Extension {
  id: string;
  setup(engine: Engine): void;
}

const registry = new Map<string, Extension>();

export function register(ext: Extension): void {
  if (registry.has(ext.id)) throw new Error(`duplicate extension: ${ext.id}`);
  registry.set(ext.id, ext);
}

export function activateAll(engine: Engine): void {
  for (const ext of registry.values()) ext.setup(engine);
}
