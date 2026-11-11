import { versionNewer } from "../../engine/index.ts";
import { EXT_PRODUCTS, catalogueId, contractId } from "../../engine/hosts.ts";
import { t } from "../../i18n/index.ts";
import type { ExtensionEntry, InstalledExtension } from "../../engine/types.ts";
import type { Extension } from "../registry.ts";

const PERMISSIONS: Record<string, string> = {
  document: "the open document",
  "files-read": "reading files",
  "files-write": "writing files",
  network: "the network",
  models: "local models",
  "native-code": "native code",
};

function fill(row: HTMLElement, entry: ExtensionEntry | null, have: InstalledExtension | null, label: (id: string) => string): void {
  const set = (field: string, text: string) => {
    const node = row.querySelector<HTMLElement>(`[data-field='${field}']`);
    if (node && node.textContent !== text) node.textContent = text;
  };
  const attr = (name: string, value: string | null) => {
    if (value === null) {
      if (row.hasAttribute(name)) row.removeAttribute(name);
    } else if (row.getAttribute(name) !== value) row.setAttribute(name, value);
  };
  const product = entry?.product ?? have?.product ?? "";
  const permissions = entry?.permissions ?? have?.permissions ?? [];
  attr("data-product", catalogueId(product));
  const known = EXT_PRODUCTS.includes(product);
  for (const img of Array.from(row.querySelectorAll<HTMLImageElement>("[data-ext-icon]"))) {
    const src = known ? `/apps/${product}${img.dataset.extIcon === "light" ? "-light" : ""}.webp` : null;
    if (src === null) {
      if (img.hasAttribute("src")) img.removeAttribute("src");
    } else if (img.getAttribute("src") !== src) img.setAttribute("src", src);
  }
  row.querySelector(".app-ic")?.classList.toggle("app-ic-none", !known);
  attr("data-listed", entry ? "" : null);
  attr("data-ext-state", !have ? "none" : entry && versionNewer(entry.version, have.version) ? "update" : "installed");
  attr("data-trust", have?.source === "sideload" ? "sideload" : entry?.signature || have?.signed_by ? "signed" : "unsigned");
  set("name", entry?.name ?? have?.name ?? "");
  const version = have && entry && have.version !== entry.version ? `version ${have.version} installed, ${entry.version} available` : `version ${have?.version ?? entry?.version ?? ""}`;
  const app = label(catalogueId(product));
  set("meta", `For ${app}${entry ? `, by ${entry.author}` : ""}, ${version}`);
  set("description", entry?.description ?? have?.description ?? "Installed from a file; not in the catalogue.");
  set("app", app);
  const adds = have?.contributes;
  const later = t("Shown once it is installed");
  set("panels", adds ? adds.panels.map((p) => `${p.title} (${p.location === "dialog" ? t("dialog") : t("docked")})`).join(", ") || t("none") : later);
  set("commands", adds ? adds.commands.map((c) => c.title).join(", ") || t("none") : later);
  set("api", have?.api ?? entry?.api ?? t("before API 1"));
  set("permissions", permissions.map((p) => PERMISSIONS[p] ?? p).join(", ") || "nothing");
  set("kind", (entry?.kind ?? have?.kind ?? "").replace(/-/g, " "));
  set("licence", entry?.licence ?? "");
  set("needs", entry?.minimum_app ? `${app} ${entry.minimum_app} or newer` : `any ${app}`);
  set("sha256", have?.sha256 || entry?.sha256 || "");
  const support = row.querySelector<HTMLElement>("[data-ext-support]");
  const supportLink = support?.querySelector<HTMLAnchorElement>("a");
  const supportUrl = entry?.support?.startsWith("https://") ? entry.support : "";
  if (support && supportLink) {
    if (supportUrl && supportLink.getAttribute("href") !== supportUrl) supportLink.setAttribute("href", supportUrl);
    if (support.hidden !== !supportUrl) support.hidden = !supportUrl;
  }
  const source = row.querySelector<HTMLElement>("[data-ext-source]");
  const sourceLink = source?.querySelector<HTMLAnchorElement>("a");
  const sourceUrl = entry?.source?.startsWith("https://") ? entry.source : "";
  if (source && sourceLink) {
    if (sourceUrl && sourceLink.getAttribute("href") !== sourceUrl) sourceLink.setAttribute("href", sourceUrl);
    if (source.hidden !== !sourceUrl) source.hidden = !sourceUrl;
  }
  const verified = row.querySelector<HTMLElement>("[data-ext-verified]");
  const isVerified = Boolean(entry?.verified) && have?.source !== "sideload";
  if (verified && verified.hidden !== !isVerified) verified.hidden = !isVerified;
  const blocked = have?.blocked ?? entry?.blocked ?? null;
  attr("data-blocked", blocked === null ? null : "");
  set(
    "trust",
    blocked !== null
      ? t("Blocked by the registry: {reason}", { reason: blocked })
      : have?.source === "sideload"
        ? "Sideloaded from a file, not reviewed"
        : have?.signed_by || entry?.signature
          ? `Signed by ${have?.signed_by ?? entry?.signature?.publisher}`
          : (entry?.native ?? have?.native) ? "Runs native code, unsigned" : "Unsigned",
  );
  const box = row.querySelector<HTMLInputElement>("[data-ext-enabled]");
  if (box && have && box.checked !== have.enabled) box.checked = have.enabled;
  if (box && box.disabled !== Boolean(have?.blocked)) box.disabled = Boolean(have?.blocked);
  const install = row.querySelector<HTMLElement>("[data-ext-act='install']");
  const word = t(have ? "Update" : "Install");
  if (install && install.textContent !== word) install.textContent = word;
}

export const library: Extension = {
  id: "library",
  setup(engine) {
    const list = document.querySelector<HTMLElement>("[data-ext-list]");
    const template = document.querySelector<HTMLTemplateElement>("#ext-row");
    const empty = document.querySelector<HTMLElement>("[data-ext-empty]");
    if (!list || !template) return;
    const mounted = new Map<string, HTMLElement>();
    const pane = list.closest<HTMLElement>("[data-pane]");
    const filters = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-ext-filter]"));
    for (const button of filters) {
      button.addEventListener("click", () => {
        pane?.setAttribute("data-filter", button.dataset.extFilter ?? "all");
        for (const other of filters) other.setAttribute("aria-pressed", String(other === button));
      });
    }
    engine.command("ext.filter", (arg) => {
      const want = catalogueId(String(arg ?? "all"));
      const button = filters.find((b) => b.dataset.extFilter === want) ?? filters.find((b) => b.dataset.extFilter === "all");
      if (!button) return;
      if (pane?.getAttribute("data-filter") !== button.dataset.extFilter) pane?.setAttribute("data-filter", button.dataset.extFilter ?? "all");
      for (const other of filters) {
        const pressed = String(other === button);
        if (other.getAttribute("aria-pressed") !== pressed) other.setAttribute("aria-pressed", pressed);
      }
    });
    document.querySelector("[data-ext-make]")?.addEventListener("click", () => void engine.dispatch("ext.make"));

    const wire = (row: HTMLElement) => {
      const target = () => ({ product: contractId(row.dataset.product ?? ""), id: row.dataset.ext ?? "" });
      row.querySelector("[data-ext-act='install']")?.addEventListener("click", () => {
        row.setAttribute("data-ext-state", "busy");
        void engine.dispatch("ext.install", { id: target().id });
      });
      row.querySelector("[data-ext-act='remove']")?.addEventListener("click", () => {
        row.setAttribute("data-ext-state", "busy");
        void engine.dispatch("ext.remove", target());
      });
      const box = row.querySelector<HTMLInputElement>("[data-ext-enabled]");
      box?.addEventListener("change", () => void engine.dispatch("ext.enable", { ...target(), enabled: box.checked }));
    };

    engine.on("extensions", () => {
      const entries = engine.state.extensions?.packages ?? [];
      const installed = engine.state.installedExtensions;
      const keys = new Map<string, [ExtensionEntry | null, InstalledExtension | null]>();
      for (const entry of entries) keys.set(`${entry.product}:${entry.id}`, [entry, null]);
      for (const have of installed) {
        const key = `${have.product}:${have.id}`;
        keys.set(key, [keys.get(key)?.[0] ?? null, have]);
      }
      for (const [key, [entry, have]] of keys) {
        let row = mounted.get(key);
        if (!row) {
          row = (template.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
          row.dataset.ext = entry?.id ?? have?.id ?? "";
          mounted.set(key, row);
          fill(row, entry, have, (id) => engine.name(id));
          wire(row);
          list.appendChild(row);
        } else fill(row, entry, have, (id) => engine.name(id));
      }
      for (const [key, row] of mounted) {
        if (keys.has(key)) continue;
        row.remove();
        mounted.delete(key);
      }
      if (empty && empty.hidden !== keys.size > 0) empty.hidden = keys.size > 0;
      const note = pane?.querySelector<HTMLElement>("[data-store-note]");
      if (note) {
        const why = engine.state.extensionsError;
        const text = why ? t("The registry's extensions could not be listed: {why}", { why }) : t("Extensions from form.ext-registry: reviewed, signed by their publisher and checked against the block list.");
        const state = why ? "starter" : "live";
        if (note.textContent !== text) note.textContent = text;
        if (note.dataset.store !== state) note.dataset.store = state;
        if (note.hidden) note.hidden = false;
      }
    });
    engine.on("route", ({ route }) => {
      if (route === "extensions") void engine.dispatch("ext.load");
    });  },
};
