export type ProductState = "prelaunch" | "public" | "live";
export type ProductKind = string;
export type Channel = "stable" | "beta" | "nightly";
export type Os = "macos" | "windows" | "linux" | "other";
export type Arch = "arm64" | "x86_64";
export type Route = string;
export type Source = "none" | "fixture" | "live";
export type Availability = "unreleased" | "no-release" | "available" | "other-platform";

export interface Artifact {
  platform: string;
  arch: string;
  kind: string;
  file: string;
  url: string;
  bytes: number;
  sha256: string;
  minimum_os: string;
  signature?: string;
}

export interface Release {
  version: string;
  published: string;
  notes: string;
  commit?: string;
  artifacts: Artifact[];
  history?: Release[];
}

export interface Product {
  id: string;
  name: string;
  kind: ProductKind;
  summary: string;
  identifier: string;
  repository: string;
  licence: string;
  project_extensions?: string[];
  state: ProductState;
  channels: Partial<Record<Channel, Release>>;
}

export interface Catalog {
  format: "formai-catalog";
  format_version: 1;
  generated: string;
  origin: string;
  fixture?: boolean;
  products: Product[];
}

export interface ExtensionSignature {
  publisher: string;
  algorithm: "ed25519";
  value: string;
}

export interface ExtensionEntry {
  id: string;
  name: string;
  product: string;
  kind: string;
  author: string;
  description: string;
  version: string;
  url: string;
  sha256: string;
  bytes?: number;
  licence: string;
  minimum_app?: string;
  native: boolean;
  permissions: string[];
  signature?: ExtensionSignature;
}

export interface SelfUpdate {
  configured: boolean;
  current: string;
  available: string | null;
  notes: string | null;
}

export interface MediaItem {
  id: string;
  title: string;
  kind: "image" | "video" | "audio" | "template";
  product: string | null;
  creator: string;
  licence: string;
  source_url: string;
  file: string;
  bytes: number;
  thumbnail: string | null;
  tags: string[];
}

export interface SavedMedia {
  id: string;
  title: string;
  kind: string;
  creator: string;
  licence: string;
  source_url: string;
  file: string;
  credit: string;
}

export interface MediaView {
  index: { items: MediaItem[] } | null;
  credits: string[];
  index_error: string | null;
  saved: SavedMedia[];
  library: string;
}

export interface FontStyleEntry {
  style: string;
  weight: number;
  italic: boolean;
  file: string;
  url: string;
  bytes: number;
  sha256: string;
}

export interface FontFamilyEntry {
  id: string;
  family: string;
  foundry: string;
  licence: string;
  category: string;
  styles: FontStyleEntry[];
}

export interface InstalledFont {
  family: string;
  style: string;
  family_id: string | null;
  file: string;
  sha256: string;
  source: "index" | "own";
  licence: string | null;
}

export interface FontsView {
  index: { families: FontFamilyEntry[] } | null;
  index_error: string | null;
  installed: InstalledFont[];
  updates?: InstalledFont[];
  folder: string;
}

export interface ProjectFile {
  path: string;
  name: string;
  folder: string;
  product: string;
  bytes: number;
  modified: number;
  versions: number;
  preview?: string | null;
}

export interface FolderView {
  path: string;
  keep_versions: boolean;
  exists: boolean;
  files: number;
  bytes: number;
}

export interface FilesScan {
  scan: { folders: FolderView[]; files: ProjectFile[]; truncated: boolean; new_versions: number };
  suggested: string;
}

export interface FileVersion {
  id: string;
  at: number;
  size: number;
  sha256: string;
  reason: string;
}

export interface StorageView {
  formportal: { what: string; path: string; bytes: number }[];
  formportal_bytes: number;
  folders: FolderView[];
}

export interface AgentClient {
  client: "claude" | "codex" | "cursor";
  label: string;
  state: "connected" | "not-connected" | "taken" | "no-client";
  note: string | null;
}

export interface AgentsView {
  surface: boolean;
  server_name: string;
  clients: AgentClient[];
}

export interface PolicyView {
  managed_by: string | null;
  system: boolean;
  path: string;
  locked: string[];
  catalog: string | null;
  apps: string[] | null;
  channels: Channel[] | null;
  extensions: boolean;
  sideload: boolean;
}

export interface InstalledExtension {
  id: string;
  name: string;
  product: string;
  kind: string;
  version: string;
  sha256: string;
  source: "catalogue" | "sideload";
  signed_by: string | null;
  native: boolean;
  permissions: string[];
  enabled: boolean;
}

export interface ExtensionsView {
  index: ExtensionIndex | null;
  index_error: string | null;
  installed: InstalledExtension[];
}

export interface ExtensionIndex {
  format: "formai-extensions";
  format_version: 1;
  name: string;
  description?: string;
  fixture?: boolean;
  publishers: { id: string; name: string; public_key: string; url?: string }[];
  packages: ExtensionEntry[];
}

export interface Platform {
  os: Os;
  arch: Arch;
}

export interface Preferences {
  auto_update: boolean;
  auto_update_beta: boolean;
  only_when_closed: boolean;
  notices: boolean;
  per_app: Record<string, boolean>;
  keep_previous: boolean;
  quiet: NoticeCategory[];
  language: string | null;
  open_at_login: boolean;
}

export type NoticeCategory = "updates" | "installs" | "library" | "agents" | "learn" | "system";

export interface TutorialStep {
  title: string;
  body: string;
  route: string | null;
  url: string | null;
}

export interface Tutorial {
  id: string;
  product: string;
  title: string;
  summary: string;
  minutes: number;
  level: string;
  steps: TutorialStep[];
  done_steps: number[];
  finished: boolean;
}

export interface LearnView {
  index_error: string | null;
  tutorials: Tutorial[];
}

export interface RepairFinding {
  kind: "missing" | "broken" | "previous" | "leftover" | "staging" | "download";
  product: string | null;
  channel: Channel | null;
  path: string;
  bytes: number;
  problem: string;
  fix: string;
  fixed: boolean;
  error: string | null;
}

export interface RepairReport {
  checked: number;
  findings: RepairFinding[];
  fixed: number;
  freed: number;
}

export interface WebPlan {
  url: string;
  host: string;
  name: string;
  product: string;
  folder: string;
}

export interface AssistantAgent {
  client: "claude" | "codex";
  label: string;
  path: string | null;
}

export interface UpdateOutcome {
  product: string;
  channel: Channel;
  from: string;
  to: string;
  error: string | null;
}

export interface InstallRecord {
  product: string;
  channel: Channel;
  version: string;
  previous: string | null;
}

export interface ChannelView {
  product: string;
  channel: Channel;
  availability: Availability;
  version: string | null;
  artifact: Artifact | null;
}
