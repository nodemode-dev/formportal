import apps from "../../../../catalog/fixtures/apps.json";
import extensions from "../../../../catalog/fixtures/extensions.json";
import type { Catalog, ExtensionIndex, Os, Platform } from "../engine/types.ts";
import type { Bridge } from "./index.ts";

function browserPlatform(): Platform {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const name = nav.userAgentData?.platform || nav.platform || "";
  let os: Os = "other";
  if (/Mac/i.test(name)) os = "macos";
  else if (/Win/i.test(name)) os = "windows";
  else if (/Linux|X11/i.test(name)) os = "linux";
  return { os, arch: os === "macos" ? "arm64" : "x86_64" };
}

export const fixtureBridge: Bridge = {
  source: "fixture",
  platform: async () => browserPlatform(),
  catalog: async () => apps as unknown as Catalog,
  extensions: async () => extensions as unknown as ExtensionIndex,
};
