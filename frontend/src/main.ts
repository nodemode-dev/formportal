import { pickBridge } from "./bridge/index.ts";
import { Engine, versionNewer } from "./engine/index.ts";
import type { Channel, NoticeCategory, Preferences, SyncReport } from "./engine/types.ts";
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
import { goToLanguage, launch } from "./extensions/launch/index.ts";
import { repair } from "./extensions/repair/index.ts";
import { t } from "./i18n/index.ts";
import { account } from "./extensions/account/index.ts";
import { share } from "./extensions/share/index.ts";
import { supporter } from "./extensions/supporter/index.ts";
import { live, liveNow } from "./extensions/live/index.ts";
import { appIcon } from "./extensions/appicon/index.ts";
import { side } from "./extensions/side/index.ts";
import { home } from "./extensions/home/index.ts";
import { revealApp } from "./bridge/reveal.ts";

const revealLate = window.setTimeout(revealApp, 2400);

const engine = new Engine();
const bridge = pickBridge();
const shownName = (id: string) => (liveNow(id) ? engine.name(id) : t("a Form app"));

engine.state.light = document.documentElement.getAttribute("data-theme") === "light";
engine.setNames(Object.fromEntries(registry.products.map((p) => [p.id, p.id === "formai" ? "FormPortal" : p.name])));
[live, appIcon, side, route, theme, apps, home, library, settings, notices, prefs, search, agents, files, fonts, stock, learn, assistant, launch, repair, account, share, supporter].forEach(register);
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
    engine.setLater(await bridge.laterList());
    let catalog;
    try {
      catalog = await bridge.catalog();
    } catch (e) {
      root.setAttribute("data-offline", "");
      root.setAttribute("data-loaded", "");
      const why = e instanceof Error ? e.message : String(e);
      throw new Error(t("FormPortal could not read the catalogue, so installs and updates wait until it can. Installed apps still open. ({why})", { why }));
    }
    root.removeAttribute("data-offline");
    engine.setCatalog(catalog, bridge.source);
    const extensions = await bridge.extensions();
    engine.setExtensions(extensions.index, extensions.installed);
    root.setAttribute("data-loaded", "");
    void engine.dispatch("files.scan");
    void engine.dispatch("learn.load");
    void engine.dispatch("fonts.load");
    const done = await bridge.autoUpdate((product, channel, fraction) => engine.setProgress(product, channel, fraction));
    for (const d of done) engine.setProgress(d.product, d.channel, null);
    if (done.length) await refresh();
    engine.setLater(await bridge.laterList());
    const name = (id: string) => engine.name(id);
    const ok = done.filter((d) => !d.error).map((d) => `${name(d.product)} ${d.to}${d.channel === "stable" ? "" : ` (${d.channel})`}`);
    const failed = done.filter((d) => d.error).map((d) => `${name(d.product)}: ${d.error}`);
    const waiting = Array.from(engine.installs.values()).filter((r) => {
      const v = engine.view(r.product, r.channel);
      return v.availability === "available" && v.version !== null && versionNewer(v.version, r.version);
    }).length;
    const self = engine.view("formai", "stable");
    const parts = [
      ok.length ? t("Updated {list}.", { list: ok.join(", ") }) : "",
      failed.length ? t("Could not update {list}.", { list: failed.join("; ") }) : "",
      waiting ? (waiting === 1 ? t("1 update is waiting in Updates.") : t("{n} updates are waiting in Updates.", { n: waiting })) : "",
      self.version && versionNewer(self.version, pkg.version) ? t("FormPortal {version} is available at formai.studio/download.", { version: self.version }) : "",
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
      ? [t("An earlier copy of {app} is still open (process {pids}). It keeps running untouched, and {version} opens next time.", { app: label, pids: open.join(", "), version: installed })]
      : [];
    if (version) {
      const held = engine.automatic(product, channel);
      engine.setPrefs(await bridge.preferences());
      if (held && !engine.automatic(product, channel)) {
        notes.push(t("{app} {version} is installed. Automatic updates for it are off so it stays; turn them back on under More.", { app: label, version }));
      }
    }
    if (!notes.length) notes.push(t("{app} {version} is installed.", { app: `${label}${channel === "stable" ? "" : ` ${channel}`}`, version: installed }));
    const view = await bridge.appAgents(product, channel).catch(() => null);
    if (view?.surface && !view.clients.some((c) => c.state === "connected")) {
      notes.push(t("It has its own MCP server: connect it to Claude Code, Codex and Cursor from its page."));
    }
    engine.setNotice(notes.join(" "), "info", "installs");
  }, "installs"),
);

engine.command("language.set", (arg) =>
  guard(async () => {
    const language = String(arg) === "en" ? null : String(arg);
    const next = { ...engine.state.prefs, language };
    await bridge.setPreferences(next);
    engine.setPrefs(next);
    goToLanguage(String(arg));
  }),
);

engine.command("app.later", (arg) =>
  guard(async () => {
    const { product, channel, on } = arg as Target & { on: boolean };
    engine.setLater(await bridge.updateLater(product, channel, on));
    const to = engine.view(product, channel).version ?? "";
    engine.setNotice(
      on ? t("{app} updates to {version} when you close it. FormPortal checks every few minutes while it is open, and when it next opens.", { app: engine.name(product), version: to }) : t("{app} is no longer waiting to update later.", { app: engine.name(product) }),
      "info",
      "updates",
    );
  }, "updates"),
);

engine.command("later.check", () =>
  guard(async () => {
    if (!engine.later.size) return;
    const done = await bridge.autoUpdate((product, channel, fraction) => engine.setProgress(product, channel, fraction));
    for (const d of done) engine.setProgress(d.product, d.channel, null);
    if (done.length) await refresh();
    engine.setLater(await bridge.laterList());
    const ok = done.filter((d) => !d.error).map((d) => `${engine.name(d.product)} ${d.to}`);
    const failed = done.filter((d) => d.error).map((d) => `${engine.name(d.product)}: ${d.error}`);
    if (ok.length || failed.length) engine.setNotice([ok.length ? t("Updated {list} now that it is closed.", { list: ok.join(", ") }) : "", failed.length ? t("Could not update {list}.", { list: failed.join("; ") }) : ""].filter(Boolean).join(" "), failed.length ? "fault" : "info", "updates");
  }, "updates"),
);

window.setInterval(() => void engine.dispatch("later.check"), 5 * 60 * 1000);

engine.command("repair.run", (arg) =>
  guard(async () => {
    const fix = Boolean(arg);
    engine.emit("repair", { pending: true, report: null });
    let report;
    try {
      report = await bridge.repair(fix);
    } catch (e) {
      engine.emit("repair", { pending: false, report: null });
      throw e;
    }
    engine.emit("repair", { pending: false, report });
    if (fix) {
      await refresh();
      const mb = Math.round(report.freed / 1_000_000);
      engine.setNotice(mb ? t("Repaired {fixed} of {total}; {mb} MB freed.", { fixed: report.fixed, total: report.findings.length, mb }) : t("Repaired {fixed} of {total}.", { fixed: report.fixed, total: report.findings.length }), report.fixed === report.findings.length ? "info" : "fault", "system");
    }
  }),
);

engine.command("web.ask", (arg) =>
  guard(async () => {
    const plan = await bridge.webPlan(String(arg));
    await refresh();
    if (![...engine.installs.values()].some((r) => r.product === plan.product)) {
      void engine.dispatch("route.go", `app-${plan.product}`);
      engine.setNotice(t("A web page wants {app} to open {file}, but {app} is not installed. Install it here, then open the link again.", { app: shownName(plan.product), file: plan.name }), "fault", "library");
      return;
    }
    engine.emit("webfile", { plan });
  }, "library"),
);

engine.command("web.fetch", (arg) =>
  guard(async () => {
    const plan = arg as { url: string; name: string; product: string };
    const done = await bridge.webFetch(plan.url);
    engine.setNotice(
      done.opened_with ? t("{file} is saved in {folder} and opening in {app}.", { file: plan.name, folder: done.saved.replace(/[\\/][^\\/]*$/, ""), app: engine.name(done.opened_with) }) : t("{file} is saved in {folder}.", { file: plan.name, folder: done.saved.replace(/[\\/][^\\/]*$/, "") }),
      "info",
      "library",
    );
    void engine.dispatch("files.scan");
  }, "library"),
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
  const link = String(arg);
  if (link.startsWith("file/") || link.startsWith("file?")) {
    const url = new URLSearchParams(link.split("?")[1] ?? "").get("url") ?? "";
    void engine.dispatch("web.ask", url);
    return;
  }
  const [head, id] = link.split("/");
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
    const label = done.source === "sideload" ? ` ${t("It was installed from a file, not the catalogue.")}` : "";
    engine.setNotice(`${t("{name} {version} is installed; {app} uses it the next time it starts.", { name: done.name, version: done.version, app: engine.name(done.product) })}${label}`, "info", "installs");
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
  engine.setSelf(t("Checking..."), false);
  try {
    const s = await bridge.selfUpdateCheck();
    if (!s.configured) engine.setSelf(t("This build has no update key yet; new versions come from formai.studio/download."), false);
    else if (s.available) engine.setSelf(t("FormPortal {version} is available.", { version: s.available }), true);
    else engine.setSelf(t("FormPortal is up to date."), false);
  } catch (e) {
    engine.setSelf(e instanceof Error ? e.message : String(e), false);
  }
});

engine.command("self.install", async () => {
  engine.setSelf(t("Downloading and checking the signature..."), false);
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
    engine.setNotice(t("FormPortal now lists the Form projects in {folder} and keeps their versions.", { folder: chosen }), "info", "library");
    await engine.dispatch("files.scan");
  }, "library"),
);

engine.command("folder.remove", (arg) =>
  guard(async () => {
    await bridge.folderRemove(String(arg));
    engine.setNotice(t("FormPortal no longer lists {folder}. Its files are untouched.", { folder: String(arg) }), "info", "library");
    await engine.dispatch("files.scan");
  }, "library"),
);

engine.command("file.open", (arg) =>
  guard(async () => {
    const { path, product: owner } = arg as { path: string; product?: string };
    const name = path.split(/[\\/]/).pop();
    if (owner && ![...engine.installs.values()].some((r) => r.product === owner)) {
      engine.setNotice(t("{app} is not installed, so {file} cannot open yet. Install {app} from Apps.", { app: shownName(owner), file: name ?? "" }), "fault", "library");
      return;
    }
    const product = await bridge.fileOpen(path);
    engine.setNotice(t("Opening {file} in {app}.", { file: name ?? "", app: engine.name(product) }), "info", "library");
  }, "library"),
);

engine.command("file.versions", (arg) =>
  guard(async () => {
    const { path, action, version } = arg as { path: string; action?: "save" | "revert"; version?: string };
    const list = await bridge.fileVersions(path, action, version);
    engine.emit("versions", { path, list });
    const name = path.split(/[\\/]/).pop();
    if (action === "save") engine.setNotice(t("A version of {file} is kept.", { file: name ?? "" }), "info", "library");
    if (action === "revert") {
      engine.setNotice(t("{file} is back to the version you chose; the one before is kept too.", { file: name ?? "" }), "info", "library");
      await engine.dispatch("files.scan");
    }
  }, "library"),
);

engine.command("media.load", () =>
  guard(async () => {
    engine.emit("media", { view: await bridge.media() });
  }, "library"),
);

engine.command("file.preview", async (arg) => {
  const { path, into } = arg as { path: string; into: HTMLElement | null };
  try {
    const src = await bridge.filePreview(path);
    if (into) into.style.backgroundImage = `url("${src}")`;
    into?.toggleAttribute("data-has-shot", true);
  } catch {
    into?.toggleAttribute("data-has-shot", false);
  }
});

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
        done?.opened_with ? t("{title} is copied to {folder} and opening in {app}.", { title, folder: where, app: engine.name(done.opened_with) }) : t("{title} is copied to {folder}. Its app is not installed, so it did not open.", { title, folder: where }),
        "info",
        "library",
      );
    } else {
      engine.setNotice(t("{title} is saved in your Library with its credit line.", { title }), "info", "library");
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
    engine.setNotice(t("{title} is removed from your Library.", { title }), "info", "library");
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
    engine.setNotice(t("{font} is installed for you. Apps see it after they restart.", { font: `${family}${style ? ` ${style}` : ""}` }), "info", "library");
  }, "library"),
);

engine.command("font.update", (arg) =>
  guard(async () => {
    const { id, family, styles } = arg as { id: string; family: string; styles: string[] };
    try {
      for (const style of styles) await bridge.fontInstall(id, style);
    } finally {
      await engine.dispatch("fonts.load");
    }
    engine.setNotice(t("{font} is updated ({styles}). Apps see the new version after they restart.", { font: family, styles: styles.join(", ") }), "info", "updates");
  }, "updates"),
);

let fontNotice = "";
engine.on("fonts", ({ view }) => {
  const names = Array.from(new Set((view.updates ?? []).map((f) => f.family)));
  const key = names.join("|");
  if (!names.length || key === fontNotice) return;
  fontNotice = key;
  engine.setNotice(names.length === 1 ? t("A newer version of the font {fonts} is in the font library. Update it in Fonts.", { fonts: names[0] }) : t("Newer versions of the fonts {fonts} are in the font library. Update them in Fonts.", { fonts: names.join(", ") }), "info", "updates");
});

engine.command("font.remove", (arg) =>
  guard(async () => {
    const { family, style, label } = arg as { family: string; style?: string; label?: string };
    try {
      await bridge.fontRemove(family, style);
    } finally {
      await engine.dispatch("fonts.load");
    }
    engine.setNotice(t("{font} is removed.", { font: label ?? family }), "info", "library");
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
    engine.setNotice(t("{font} is added for you. Apps see it after they restart.", { font: path.split(/[\\/]/).pop() ?? path }), "info", "library");
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
          ? t("{app} was taken out of Claude Code, Codex and Cursor.", { app: engine.name(product) })
          : t("{app} is connected to {clients}. Restart the client, or reload its MCP servers, to see its tools.", { app: engine.name(product), clients: done.join(", ") || t("no client") }),
        "info",
        "agents",
      );
    } finally {
      await engine.dispatch("agents.check", product);
    }
  }, "agents"),
);

let accountRun = 0;
const accountFail = (e: unknown) => engine.emit("account", { status: null, code: null, busy: false, error: e instanceof Error ? e.message : String(e) });

engine.command("account.check", async () => {
  try {
    engine.emit("account", { status: await bridge.githubStatus(), code: null, busy: false, error: null });
  } catch (e) {
    accountFail(e);
  }
});

engine.command("account.start", async (arg) => {
  const run = ++accountRun;
  engine.emit("account", { status: null, code: null, busy: true, error: null });
  try {
    const code = await bridge.githubStart(Boolean(arg));
    if (run !== accountRun) return;
    engine.emit("account", { status: null, code, busy: false, error: null });
    const until = Date.now() + code.expires_in * 1000;
    let interval = Math.max(1, code.interval);
    while (run === accountRun) {
      await new Promise((done) => window.setTimeout(done, interval * 1000));
      if (run !== accountRun) return;
      if (Date.now() > until) throw new Error(t("The code expired before it was entered; start again."));
      const poll = await bridge.githubPoll(code.device_code, interval);
      if (run !== accountRun) return;
      if (poll.state === "waiting") interval = Math.max(1, poll.interval);
      else {
        accountRun += 1;
        engine.emit("account", { status: { configured: true, account: poll.account }, code: null, busy: false, error: null });
        engine.setNotice(t("Signed in to GitHub as {login}.", { login: poll.account.login }), "info", "system");
        return;
      }
    }
  } catch (e) {
    if (run === accountRun) accountFail(e);
  }
});

engine.command("account.cancel", () => {
  accountRun += 1;
  void engine.dispatch("account.check");
});

engine.command("account.signOut", async () => {
  accountRun += 1;
  try {
    await bridge.githubSignOut();
    await engine.dispatch("account.check");
  } catch (e) {
    accountFail(e);
  }
});

const sharesLoad = async () => engine.emit("shares", { view: await bridge.shares() });
const report = (r: SyncReport) =>
  [
    r.sent ? t("{n} files sent.", { n: r.sent }) : "",
    r.received ? t("{n} files received.", { n: r.received }) : "",
    r.unchanged && !r.sent && !r.received ? t("Nothing changed.") : "",
    r.skipped.length ? t("Skipped (over 100 MB or outside the folder): {list}.", { list: r.skipped.join(", ") }) : "",
    r.invited.length ? t("Invited: {list}. They accept in FormPortal, under Files, Shared with you.", { list: r.invited.join(", ") }) : "",
  ].filter(Boolean).join(" ");
const shareWork = (work: () => Promise<{ text: string; url: string }>) =>
  guard(async () => {
    engine.emit("shareResult", { busy: true, text: t("Working with GitHub..."), url: "" });
    try {
      const done = await work();
      engine.emit("shareResult", { busy: false, ...done });
    } catch (e) {
      engine.emit("shareResult", { busy: false, text: e instanceof Error ? e.message : String(e), url: "" });
      throw e;
    } finally {
      await sharesLoad().catch(() => undefined);
    }
  }, "library");

engine.command("shares.load", () => guard(sharesLoad, "library"));
engine.command("share.folder", (arg) =>
  shareWork(async () => {
    const { folder, invite } = arg as { folder: string; invite: string[] };
    const r = await bridge.shareFolder(folder, invite);
    return { text: `${t("Shared as a private repository in your GitHub account.")} ${report(r)}`, url: r.url };
  }),
);
engine.command("share.send", (arg) =>
  shareWork(async () => {
    const r = await bridge.shareSend(String(arg));
    return { text: report(r), url: r.url };
  }),
);
engine.command("share.accept", (arg) =>
  shareWork(async () => {
    const r = await bridge.shareAccept(Number(arg));
    engine.setNotice(t("{repo} is in {folder}. {report}", { repo: r.repo, folder: r.folder, report: report(r) }), "info", "library");
    void engine.dispatch("files.scan");
    return { text: "", url: r.url };
  }),
);
engine.command("share.pull", (arg) =>
  shareWork(async () => {
    const r = await bridge.sharePull(String(arg));
    engine.setNotice(t("{repo}: {report}", { repo: r.repo, report: report(r) }), "info", "library");
    void engine.dispatch("files.scan");
    return { text: "", url: r.url };
  }),
);
engine.command("share.publish", (arg) =>
  shareWork(async () => {
    const { file, remove } = arg as { file: string; remove: boolean };
    const p = await bridge.publishFile(file, remove);
    return remove ? { text: t("The public link is removed."), url: "" } : { text: t("Anyone with this link can open the file:"), url: p.url };
  }),
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
    if (reset) engine.setNotice(t("{title} starts again from the first step.", { title }), "info", "learn");
    else if (view?.finished && done !== false) engine.setNotice(t("You finished {title}.", { title }), "info", "learn");
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

let rescan = 0;
bridge.onVersionsKept((paths) => {
  window.clearTimeout(rescan);
  rescan = window.setTimeout(() => void engine.dispatch("files.scan"), 400);
  engine.emit("saved", { paths });
});

bridge.onFileDrop((paths, phase) => {
  if (phase === "drop" && paths.length === 1 && /\.formpkg$/i.test(paths[0]) && /[\\/]/.test(paths[0])) {
    void engine.dispatch("route.go", "extensions");
    void engine.dispatch("ext.install", { path: paths[0] });
    return;
  }
  engine.emit("filedrop", { paths, phase });
});

bridge.onPackage((path) => {
  void engine.dispatch("route.go", "extensions");
  void engine.dispatch("ext.install", { path });
});

void engine.dispatch("route.launch");
engine.on("source", () => {
  window.clearTimeout(revealLate);
  revealApp();
});
void engine.dispatch("catalog.load");
bridge.onLink((link) => void engine.dispatch("link.open", link));
