import { pickBridge } from "./bridge/index.ts";
import { Engine, versionNewer } from "./engine/index.ts";
import type { Channel, Preferences } from "./engine/types.ts";
import pkg from "../package.json";
import { apps } from "./extensions/apps/index.ts";
import { library } from "./extensions/library/index.ts";
import { activateAll, register } from "./extensions/registry.ts";
import { route } from "./extensions/route/index.ts";
import { settings } from "./extensions/settings/index.ts";
import { stage } from "./extensions/stage/index.ts";
import { accordion } from "./extensions/accordion/index.ts";
import { theme } from "./extensions/theme/index.ts";

const engine = new Engine();
const bridge = pickBridge();

engine.state.light = document.documentElement.getAttribute("data-theme") === "light";
[route, theme, apps, stage, library, settings, accordion].forEach(register);
activateAll(engine);

interface Target {
  product: string;
  channel: Channel;
}

const refresh = async () => engine.setInstalls(await bridge.installs());

async function guard(work: () => Promise<void>): Promise<void> {
  try {
    engine.setNotice("");
    await work();
  } catch (e) {
    engine.setNotice(e instanceof Error ? e.message : String(e));
  }
}

engine.command("catalog.load", () =>
  guard(async () => {
    engine.setPlatform(await bridge.platform());
    await refresh();
    const [catalog, extensions] = await Promise.all([bridge.catalog(), bridge.extensions()]);
    engine.setCatalog(catalog, bridge.source);
    engine.setExtensions(extensions.index, extensions.installed);
    engine.setPrefs(await bridge.preferences());
    const done = await bridge.autoUpdate((product, channel, fraction) => engine.setProgress(product, channel, fraction));
    for (const d of done) engine.setProgress(d.product, d.channel, null);
    if (done.length) await refresh();
    const name = (id: string) => engine.product(id)?.name ?? id;
    const ok = done.filter((d) => !d.error).map((d) => `${name(d.product)} ${d.to}${d.channel === "stable" ? "" : ` (${d.channel})`}`);
    const failed = done.filter((d) => d.error).map((d) => `${name(d.product)}: ${d.error}`);
    const waiting = Array.from(engine.installs.values()).filter((r) => {
      const v = engine.view(r.product, r.channel);
      return v.availability === "available" && v.version !== null && versionNewer(v.version, r.version);
    }).length;
    const self = engine.view("formai", "stable");
    const parts = [
      ok.length ? `Updated ${ok.join(", ")}.` : "",
      failed.length ? `Could not update ${failed.join("; ")}.` : "",
      waiting ? `${waiting} ${waiting === 1 ? "update is" : "updates are"} waiting in Updates.` : "",
      self.version && versionNewer(self.version, pkg.version) ? `FormPortal ${self.version} is available at formai.dev/download.` : "",
    ].filter(Boolean);
    if (engine.state.prefs.notices || failed.length) engine.setNotice(parts.join(" "));
  }),
);

engine.command("prefs.set", (arg) =>
  guard(async () => {
    const next = { ...engine.state.prefs, ...(arg as Partial<Preferences>), per_app: { ...engine.state.prefs.per_app, ...((arg as Partial<Preferences>).per_app ?? {}) } };
    await bridge.setPreferences(next);
    engine.setPrefs(next);
  }),
);

engine.command("app.install", (arg) =>
  guard(async () => {
    const { product, channel, version } = arg as Target & { version?: string };
    engine.setProgress(product, channel, 0);
    try {
      await bridge.install(product, channel, (fraction) => engine.setProgress(product, channel, fraction), version);
    } finally {
      engine.setProgress(product, channel, null);
    }
    await refresh();
    if (version) {
      const held = engine.automatic(product, channel);
      engine.setPrefs(await bridge.preferences());
      if (held && !engine.automatic(product, channel)) {
        engine.setNotice(`${engine.product(product)?.name ?? product} ${version} is installed. Automatic updates for it are off so it stays; turn them back on under More.`);
      }
    }
  }),
);

engine.command("app.updateAll", async () => {
  for (const record of Array.from(engine.installs.values())) {
    const view = engine.view(record.product, record.channel);
    if (view.availability === "available" && view.version && versionNewer(view.version, record.version)) {
      await engine.dispatch("app.install", { product: record.product, channel: record.channel });
    }
  }
});

engine.command("app.open", (arg) => guard(() => bridge.open((arg as Target).product, (arg as Target).channel)));

engine.command("app.rollback", (arg) =>
  guard(async () => {
    await bridge.rollback((arg as Target).product, (arg as Target).channel);
    await refresh();
  }),
);

engine.command("app.remove", (arg) =>
  guard(async () => {
    await bridge.remove((arg as Target).product, (arg as Target).channel);
    await refresh();
  }),
);

engine.command("link.open", (arg) => {
  const [head, id] = String(arg).split("/");
  if (head === "app" && id) {
    void engine.dispatch("route.go", `app-${id}`);
    if (engine.state.route !== `app-${id}`) {
      void engine.dispatch("route.go", "apps");
      void engine.dispatch("app.show", id);
    }
  } else {
    void engine.dispatch("route.go", head);
  }
});

void engine.dispatch("catalog.load");
bridge.onLink((link) => void engine.dispatch("link.open", link));

const extRefresh = async () => {
  const view = await bridge.extensions();
  engine.setExtensions(view.index, view.installed);
};

engine.command("ext.install", (arg) =>
  guard(async () => {
    let done;
    try {
      done = await bridge.installExtension(arg as { id?: string; path?: string });
    } finally {
      await extRefresh();
    }
    const label = done.source === "sideload" ? " It was installed from a file, not the catalogue." : "";
    engine.setNotice(`${done.name} ${done.version} is installed; it is used the next time the app starts.${label}`);
  }),
);

engine.command("ext.remove", (arg) =>
  guard(async () => {
    const { product, id } = arg as { product: string; id: string };
    try {
      await bridge.removeExtension(product, id);
    } finally {
      await extRefresh();
    }
  }),
);

engine.command("ext.enable", (arg) =>
  guard(async () => {
    const { product, id, enabled } = arg as { product: string; id: string; enabled: boolean };
    await bridge.enableExtension(product, id, enabled);
    await extRefresh();
  }),
);

bridge.onPackage((path) => {
  void engine.dispatch("route.go", "extensions");
  void engine.dispatch("ext.install", { path });
});
