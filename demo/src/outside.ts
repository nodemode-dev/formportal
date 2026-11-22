import { fixtureBridge } from "../../frontend/src/bridge/fixture.ts";
import type { Bridge } from "../../frontend/src/bridge/index.ts";
import type { KeyState } from "../../frontend/src/engine/types.ts";

const inPage = (list: KeyState[]): KeyState[] => list.map((k) => ({ ...k, kept: k.present ? "page" : null }));

const SOURCE_NAMES: Record<string, string> = { pexels: "Pexels", pixabay: "Pixabay", openverse: "Openverse", freesound: "Freesound", ccmixter: "ccMixter" };

export const offline = (service: string) => new Error(`this demo does not connect to ${service}, so nothing was sent from this page`);

export const outside: Partial<Bridge> = {
  providerKeys: async () => inPage(await fixtureBridge.providerKeys()),
  setProviderKey: async (provider, key) => inPage(await fixtureBridge.setProviderKey(provider, key)),
  clearProviderKey: async (provider) => inPage(await fixtureBridge.clearProviderKey(provider)),
  siteUpcoming: async () => ({ known: false, dated: [], undated: 0, supporters: 0, checked: 0, stale: false, launched: null }),
  supporterCheck: async (code) => {
    if (code === "" || code === null) return { state: "none", supporter: false, until: null, upcoming: [], checked: 0, stale: false };
    throw offline("formai.studio");
  },
  extensions: async () => ({ index: null, index_error: offline("form.ext-registry").message, store: null, installed: [] }),
  githubStart: async () => {
    throw offline("GitHub");
  },
  githubStartFork: async () => {
    throw offline("GitHub");
  },
  fontWeb: async (source) => {
    throw offline(source === "fontsource" ? "Fontsource" : "Google Fonts");
  },
  stockSearch: async (source) => {
    throw offline(SOURCE_NAMES[source] ?? source);
  },
  templatesKept: async () => null,
  templatesFetch: async () => {
    throw offline("GitHub (nodemode-dev/formai-templates)");
  },
  webFetch: async () => {
    throw offline("the web");
  },
};
