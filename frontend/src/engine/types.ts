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
