import type { AgentClient, AgentsView, FontsView, FilesScan, FileVersion, StorageView, Catalog, Channel, ExtensionsView, InstalledExtension, InstallRecord, Platform, PolicyView, Preferences, SelfUpdate, Source, UpdateOutcome } from "../engine/types.ts";
import { fixtureBridge } from "./fixture.ts";
import { tauriBridge } from "./tauri.ts";

export interface Bridge {
  source: Source;
  platform(): Promise<Platform>;
  catalog(): Promise<Catalog>;
  extensions(): Promise<ExtensionsView>;
  installExtension(target: { id?: string; path?: string }): Promise<InstalledExtension>;
  removeExtension(product: string, id: string): Promise<void>;
  enableExtension(product: string, id: string, enabled: boolean): Promise<void>;
  onPackage(handler: (path: string) => void): void;
  selfUpdateCheck(): Promise<SelfUpdate>;
  selfUpdateInstall(): Promise<void>;
  installs(): Promise<InstallRecord[]>;
  install(product: string, channel: Channel, progress: (fraction: number) => void, version?: string): Promise<InstallRecord>;
  open(product: string, channel: Channel): Promise<void>;
  rollback(product: string, channel: Channel): Promise<InstallRecord>;
  remove(product: string, channel: Channel): Promise<void>;
  onLink(handler: (target: string) => void): void;
  stillOpen(product: string, channel: Channel): Promise<number[]>;
  openWeb(url: string): Promise<void>;
  policy(): Promise<PolicyView | null>;
  filesScan(query?: string): Promise<FilesScan>;
  folderPick(): Promise<string | null>;
  folderAdd(path: string, keepVersions: boolean, create: boolean): Promise<void>;
  folderRemove(path: string): Promise<void>;
  fileOpen(path: string): Promise<string>;
  fileVersions(path: string, action?: "save" | "revert", version?: string): Promise<FileVersion[]>;
  storage(): Promise<StorageView>;
  fonts(): Promise<FontsView>;
  fontInstall(id: string, style?: string): Promise<void>;
  fontPick(): Promise<string | null>;
  fontAdd(path: string, rightsConfirmed: boolean): Promise<void>;
  fontRemove(family: string, style?: string): Promise<void>;
  appAgents(product: string, channel: Channel): Promise<AgentsView>;
  connectAgents(product: string, channel: Channel, disconnect: boolean): Promise<AgentClient[]>;
  preferences(): Promise<Preferences>;
  setPreferences(prefs: Preferences): Promise<void>;
  autoUpdate(progress: (product: string, channel: Channel, fraction: number) => void): Promise<UpdateOutcome[]>;
}

export function pickBridge(): Bridge {
  return "__TAURI__" in window ? tauriBridge : fixtureBridge;
}
