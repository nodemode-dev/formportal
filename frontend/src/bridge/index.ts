import type { Catalog, Channel, ExtensionIndex, InstallRecord, Platform, Source } from "../engine/types.ts";
import { fixtureBridge } from "./fixture.ts";
import { tauriBridge } from "./tauri.ts";

export interface Bridge {
  source: Source;
  platform(): Promise<Platform>;
  catalog(): Promise<Catalog>;
  extensions(): Promise<ExtensionIndex>;
  installs(): Promise<InstallRecord[]>;
  install(product: string, channel: Channel, progress: (fraction: number) => void): Promise<InstallRecord>;
  open(product: string, channel: Channel): Promise<void>;
  rollback(product: string, channel: Channel): Promise<InstallRecord>;
  remove(product: string, channel: Channel): Promise<void>;
}

export function pickBridge(): Bridge {
  return "__TAURI__" in window ? tauriBridge : fixtureBridge;
}
