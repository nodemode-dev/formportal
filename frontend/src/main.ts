import { pickBridge } from "./bridge/index.ts";
import { Engine, versionNewer } from "./engine/index.ts";
import type { Channel, NoticeCategory, Preferences } from "./engine/types.ts";
import pkg from "../package.json";
import registry from "../../catalog/products.json";
import { apps } from "./extensions/apps/index.ts";
import { library } from "./extensions/library/index.ts";
import { activateAll, register } from "./extensions/registry.ts";
import { route } from "./extensions/route/index.ts";
import { settings } from "./extensions/settings/index.ts";
import { notices } from "./extensions/notices/index.ts";
import { prefs } from "./extensions/prefs/index.ts";
import { search } from "./extensions/search/index.ts";
import { theme } from "./extensions/theme/index.ts";
import { agents } from "./extensions/agents/index.ts";
import { files } from "./extensions/files/index.ts";
import { fonts } from "./extensions/fonts/index.ts";
import { stock } from "./extensions/stock/index.ts";
import { learn } from "./extensions/learn/index.ts";
import { assistant } from "./extensions/assistant/index.ts";

const engine = new Engine();
const bridge = pickBridge();

engine.state.light = document.documentElement.getAttribute("data-theme") === "light";
engine.setNames(Object.fromEntries(registry.products.map((p) => [p.id, p.id === "formai" ? "FormPortal" : p.name])));
[route, theme, apps, library, settings, notices, prefs, search, agents, files, fonts, stock, learn, assistant].forEach(register);
activateAll(engine);

interface Target {
  product: string;
  channel: Channel;
}

const refresh = async () => engine.setInstalls(await bridge.installs());

async function guard(work: () => Promise<void>, category: NoticeCategory = "system"): Promise<void> {
  try {
    engine.setNotice("");
    await work();
  } catch (e) {
    engine.setNotice(e instanceof Error ? e.message : String(e), "fault", category);
  }
}

engine.command("catalog.load", () =>
  guard(async () => {
    const root = document.documentElement;
    engine.setPlatform(await bridge.platform());
    engine.setPolicy(await bridge.policy());
    await refresh();
    engine.setPrefs(await bridge.preferences());
    let catalog;
    try {
      catalog = await bridge.catalog();
    } catch (e) {
      root.setAttribute("data-offline", "");
      root.setAttribute("data-loaded", "");
      const why = e instanceof Error ? e.message : String(e);
      throw new Error(`FormPortal could not read the catalogue, so installs and updates wait until it can. Installed apps still open. (${why})`);
    }
    root.removeAttribute("data-offline");
    engine.setCatalog(catalog, bridge.source);
    const extensions = await bridge.extensions();
    engine.setExtensions(extensions.index, extensions.installed);
    root.setAttribute("data-loaded", "");
    void engine.dispatch("files.scan");
    void engine.dispatch("learn.load");
    const done = await bridge.autoUpdate((product, channel, fraction) => engine.setProgress(product, channel, fraction));
    for (const d of done) engine.setProgress(d.product, d.channel, null);
    if (done.length) await refresh();
    const name = (id: string) => engine.name(id);
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
    if (engine.state.prefs.notices || failed.length) engine.setNotice(parts.join(" "), failed.length ? "fault" : "info", "updates");
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
    const label = engine.name(product);
    const open = await bridge.stillOpen(product, channel);
    const installed = engine.installs.get(engine.key(product, channel))?.version ?? version ?? "";
    const notes = open.length
      ? [`An earlier copy of ${label} is still open (process ${open.join(", ")}). It keeps running untouched, and ${installed} opens next time.`]
      : [];
    if (version) {
      const held = engine.automatic(product, channel);
      engine.setPrefs(await bridge.preferences());
      if (held && !engine.automatic(product, channel)) {
        notes.push(`${label} ${version} is installed. Automatic updates for it are off so it stays; turn them back on under More.`);
      }
    }
    if (!notes.length) notes.push(`${label}${channel === "stable" ? "" : ` ${channel}`} ${installed} is installed.`);
    const view = await bridge.appAgents(product, channel).catch(() => null);
    if (view?.surface && !view.clients.some((c) => c.state === "connected")) {
      notes.push(`It has its own MCP server: connect it to Claude Code, Codex and Cursor from its page.`);
    }
    engine.setNotice(notes.join(" "), "info", "installs");
  }, "installs"),
);

engine.command("app.updateAll", async () => {
  for (const record of Array.from(engine.installs.values())) {
    const view = engine.view(record.product, record.channel);
    if (view.availability === "available" && view.version && versionNewer(view.version, record.version)) {
      await engine.dispatch("app.install", { product: record.product, channel: record.channel });
    }
  }
});

engine.command("app.open", (arg) => guard(() => bridge.open((arg as Target).product, (arg as Target).channel), "installs"));

engine.command("app.rollback", (arg) =>
  guard(async () => {
    await bridge.rollback((arg as Target).product, (arg as Target).channel);
    await refresh();
  }, "installs"),
);

engine.command("app.remove", (arg) =>
  guard(async () => {
    await bridge.remove((arg as Target).product, (arg as Target).channel);
    await refresh();
  }, "installs"),
);

engine.command("link.open", (arg) => {
  const [head, id] = String(arg).split("/");
  if (head === "app" && id) {
    void engine.dispatch("route.go", `app-${id}`);
    if (engine.state.route !== `app-${id}`) void engine.dispatch("route.go", "apps");
  } else if (head === "settings" || head === "preferences") {
    void engine.dispatch("prefs.open", id);
  } else {
    void engine.dispatch("route.go", head);
  }
});

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
    engine.setNotice(`${done.name} ${done.version} is installed; ${engine.name(done.product)} uses it the next time it starts.${label}`, "info", "installs");
  }, "installs"),
);

engine.command("ext.remove", (arg) =>
  guard(async () => {
    const { product, id } = arg as { product: string; id: string };
    try {
      await bridge.removeExtension(product, id);
    } finally {
      await extRefresh();
    }
  }, "installs"),
);

engine.command("ext.enable", (arg) =>
  guard(async () => {
    const { product, id, enabled } = arg as { product: string; id: string; enabled: boolean };
    await bridge.enableExtension(product, id, enabled);
    await extRefresh();
  }, "installs"),
);

engine.command("self.check", async () => {
  engine.setSelf("Checking...", false);
  try {
    const s = await bridge.selfUpdateCheck();
    if (!s.configured) engine.setSelf("This build has no update key yet; new versions come from formai.dev/download.", false);
    else if (s.available) engine.setSelf(`FormPortal ${s.available} is available.`, true);
    else engine.setSelf("FormPortal is up to date.", false);
  } catch (e) {
    engine.setSelf(e instanceof Error ? e.message : String(e), false);
  }
});

engine.command("self.install", async () => {
  engine.setSelf("Downloading and checking the signature...", false);
  try {
    await bridge.selfUpdateInstall();
  } catch (e) {
    engine.setSelf(e instanceof Error ? e.message : String(e), false);
  }
});

engine.command("web.open", (arg) => guard(() => bridge.openWeb(String(arg))));

let lastQuery = "";
engine.command("files.scan", (arg) =>
  guard(async () => {
    if (typeof arg === "string") lastQuery = arg;
    engine.emit("files", { result: await bridge.filesScan(lastQuery || undefined) });
    engine.emit("storage", { view: await bridge.storage() });
  }, "library"),
);

engine.command("folder.add", (arg) =>
  guard(async () => {
    const { path, create } = (arg ?? {}) as { path?: string; create?: boolean };
    const chosen = path ?? (await bridge.folderPick());
    if (!chosen) return;
    await bridge.folderAdd(chosen, true, Boolean(create));
    engine.setNotice(`FormPortal now lists the Form projects in ${chosen} and keeps their versions.`, "info", "library");
    await engine.dispatch("files.scan");
  }, "library"),
);

engine.command("folder.remove", (arg) =>
  guard(async () => {
    await bridge.folderRemove(String(arg));
    engine.setNotice(`FormPortal no longer lists ${String(arg)}. Its files are untouched.`, "info", "library");
    await engine.dispatch("files.scan");
  }, "library"),
);

engine.command("file.open", (arg) =>
  guard(async () => {
    const { path, product: owner } = arg as { path: string; product?: string };
    const name = path.split(/[\\/]/).pop();
    if (owner && ![...engine.installs.values()].some((r) => r.product === owner)) {
      engine.setNotice(`${engine.name(owner)} is not installed, so ${name} cannot open yet. Install ${engine.name(owner)} from Apps.`, "fault", "library");
      return;
    }
    const product = await bridge.fileOpen(path);
    engine.setNotice(`Opening ${name} in ${engine.name(product)}.`, "info", "library");
  }, "library"),
);

engine.command("file.versions", (arg) =>
  guard(async () => {
    const { path, action, version } = arg as { path: string; action?: "save" | "revert"; version?: string };
    const list = await bridge.fileVersions(path, action, version);
    engine.emit("versions", { path, list });
    const name = path.split(/[\\/]/).pop();
    if (action === "save") engine.setNotice(`A version of ${name} is kept.`, "info", "library");
    if (action === "revert") {
      engine.setNotice(`${name} is back to the version you chose; the one before is kept too.`, "info", "library");
      await engine.dispatch("files.scan");
    }
  }, "library"),
);

engine.command("media.load", () =>
  guard(async () => {
    engine.emit("media", { view: await bridge.media() });
  }, "library"),
);

engine.command("media.thumb", async (arg) => {
  const { url, into } = arg as { url: string; into: HTMLElement | null };
  try {
    const src = await bridge.mediaThumb(url);
    if (into) into.style.backgroundImage = `url("${src}")`;
    into?.toggleAttribute("data-has-shot", true);
  } catch {
    into?.toggleAttribute("data-no-shot", true);
  }
});

engine.command("media.save", (arg) =>
  guard(async () => {
    const { id, title, use } = arg as { id: string; title: string; use?: boolean };
    let done;
    try {
      done = await bridge.mediaSave(id, Boolean(use));
    } finally {
      await engine.dispatch("media.load");
    }
    if (use) {
      const where = done?.copied_to ?? "";
      engine.setNotice(
        done?.opened_with ? `${title} is copied to ${where} and opening in ${engine.name(done.opened_with)}.` : `${title} is copied to ${where}. Its app is not installed, so it did not open.`,
        "info",
        "library",
      );
    } else {
      engine.setNotice(`${title} is saved in your Library with its credit line.`, "info", "library");
    }
  }, "library"),
);

engine.command("media.remove", (arg) =>
  guard(async () => {
    const { id, title } = arg as { id: string; title: string };
    try {
      await bridge.mediaRemove(id);
    } finally {
      await engine.dispatch("media.load");
    }
    engine.setNotice(`${title} is removed from your Library.`, "info", "library");
  }, "library"),
);

engine.command("fonts.load", () =>
  guard(async () => {
    engine.emit("fonts", { view: await bridge.fonts() });
  }, "library"),
);

engine.command("font.install", (arg) =>
  guard(async () => {
    const { id, style } = arg as { id: string; style?: string };
    try {
      await bridge.fontInstall(id, style);
    } finally {
      await engine.dispatch("fonts.load");
    }
    const family = engine.lastFonts?.index?.families.find((f) => f.id === id)?.family ?? id;
    engine.setNotice(`${family}${style ? ` ${style}` : ""} is installed for you. Apps see it after they restart.`, "info", "library");
  }, "library"),
);

engine.command("font.remove", (arg) =>
  guard(async () => {
    const { family, style, label } = arg as { family: string; style?: string; label?: string };
    try {
      await bridge.fontRemove(family, style);
    } finally {
      await engine.dispatch("fonts.load");
    }
    engine.setNotice(`${label ?? family} is removed.`, "info", "library");
  }, "library"),
);

engine.command("font.pick", () =>
  guard(async () => {
    const path = await bridge.fontPick();
    if (path) await engine.dispatch("font.ownConfirm", path);
  }, "library"),
);

engine.command("font.add", (arg) =>
  guard(async () => {
    const { path, rights } = arg as { path: string; rights: boolean };
    try {
      await bridge.fontAdd(path, rights);
    } finally {
      await engine.dispatch("fonts.load");
    }
    engine.setNotice(`${path.split(/[\\/]/).pop()} is added for you. Apps see it after they restart.`, "info", "library");
  }, "library"),
);

engine.on("fonts", ({ view }) => {
  engine.lastFonts = view;
});

engine.command("agents.check", async (arg) => {
  const product = String(arg);
  try {
    engine.emit("agents", { product, view: await bridge.appAgents(product, "stable") });
  } catch (e) {
    engine.setNotice(e instanceof Error ? e.message : String(e), "fault", "agents");
  }
});

engine.command("agents.connect", (arg) =>
  guard(async () => {
    const { product, disconnect } = arg as { product: string; disconnect: boolean };
    try {
      const clients = await bridge.connectAgents(product, "stable", disconnect);
      engine.emit("agents", { product, view: { surface: true, server_name: product, clients } });
      const done = clients.filter((c) => c.state === "connected").map((c) => c.label);
      engine.setNotice(
        disconnect
          ? `${engine.name(product)} was taken out of Claude Code, Codex and Cursor.`
          : `${engine.name(product)} is connected to ${done.join(", ") || "no client"}. Restart the client, or reload its MCP servers, to see its tools.`,
        "info",
        "agents",
      );
    } finally {
      await engine.dispatch("agents.check", product);
    }
  }, "agents"),
);

engine.command("learn.load", () =>
  guard(async () => {
    engine.emit("learn", { view: await bridge.learn() });
  }, "learn"),
);

engine.command("learn.mark", (arg) =>
  guard(async () => {
    const { id, step, done, reset, title } = arg as { id: string; step?: number; done?: boolean; reset?: boolean; title: string };
    try {
      await bridge.learnMark(id, step ?? null, done ?? true, Boolean(reset));
    } finally {
      await engine.dispatch("learn.load");
    }
    const view = engine.lastLearn?.tutorials.find((t) => t.id === id);
    if (reset) engine.setNotice(`${title} starts again from the first step.`, "info", "learn");
    else if (view?.finished && done !== false) engine.setNotice(`You finished ${title}.`, "info", "learn");
  }, "learn"),
);

engine.command("assistant.agents", () =>
  guard(async () => {
    engine.emit("assistant", { agents: await bridge.assistantAgents() });
  }, "agents"),
);

engine.command("assistant.ask", async (arg) => {
  const { client, question } = arg as { client: string; question: string };
  engine.emit("answer", { pending: true, answer: null, error: null });
  try {
    const done = await bridge.assistantAsk(client, question);
    engine.emit("answer", { pending: false, answer: done.answer, error: null });
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    engine.emit("answer", { pending: false, answer: null, error: why });
    engine.setNotice(why, "fault", "agents");
  }
});

document.querySelectorAll<HTMLButtonElement>("[data-retry]").forEach((button) => button.addEventListener("click", () => void engine.dispatch("catalog.load")));

bridge.onPackage((path) => {
  void engine.dispatch("route.go", "extensions");
  void engine.dispatch("ext.install", { path });
});

void engine.dispatch("catalog.load");
bridge.onLink((link) => void engine.dispatch("link.open", link));
