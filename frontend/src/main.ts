import { pickBridge } from "./bridge/index.ts";
import { Engine } from "./engine/index.ts";
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

engine.command("catalog.load", async () => {
  const [platform, catalog, extensions] = await Promise.all([bridge.platform(), bridge.catalog(), bridge.extensions()]);
  engine.setPlatform(platform);
  engine.setCatalog(catalog, bridge.source);
  engine.setExtensions(extensions);
});

void engine.dispatch("catalog.load");
