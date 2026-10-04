import type { Catalog, ExtensionIndex, Platform, Source } from "../engine/types.ts";
import { fixtureBridge } from "./fixture.ts";

export interface Bridge {
  source: Source;
  platform(): Promise<Platform>;
  catalog(): Promise<Catalog>;
  extensions(): Promise<ExtensionIndex>;
}

export function pickBridge(): Bridge {
  return fixtureBridge;
}
