import { pickBridge } from "./bridge/index.ts";
import { Engine } from "./engine/index.ts";
import type { Channel } from "./engine/types.ts";
import { apps } from "./extensions/apps/index.ts";
import { library } from "./extensions/library/index.ts";
import { activateAll, register } from "./extensions/registry.ts";
import { route } from "./extensions/route/index.ts";
import { settings } from "./extensions/settings/index.ts";
import { theme } from "./extensions/theme/index.ts";

const engine = new Engine();
const bridge = pickBridge();

engine.state.light = document.documentElement.getAttribute("data-theme") === "light";
[route, theme, apps, library, settings].forEach(register);
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
    engine.setExtensions(extensions);
  }),
);

engine.command("app.install", (arg) =>
  guard(async () => {
    const { product, channel } = arg as Target;
    engine.setProgress(product, channel, 0);
    try {
      await bridge.install(product, channel, (fraction) => engine.setProgress(product, channel, fraction));
    } finally {
      engine.setProgress(product, channel, null);
    }
    await refresh();
  }),
);

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

void engine.dispatch("catalog.load");
