import { versionNewer } from "../../engine/index.ts";
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

function fill(row: HTMLElement, entry: ExtensionEntry | null, have: InstalledExtension | null): void {
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
  attr("data-product", product);
  attr("data-listed", entry ? "" : null);
  attr("data-ext-state", !have ? "none" : entry && versionNewer(entry.version, have.version) ? "update" : "installed");
  attr("data-trust", have?.source === "sideload" ? "sideload" : entry?.signature || have?.signed_by ? "signed" : "unsigned");
  set("name", entry?.name ?? have?.name ?? "");
  const version = have && entry && have.version !== entry.version ? `version ${have.version} installed, ${entry.version} available` : `version ${have?.version ?? entry?.version ?? ""}`;
  set("meta", `For ${product}${entry ? `, by ${entry.author}` : ""}, ${version}`);
  set("description", entry?.description ?? "Installed from a file; not in the catalogue.");
  set("permissions", permissions.map((p) => PERMISSIONS[p] ?? p).join(", ") || "nothing");
  set("kind", (entry?.kind ?? have?.kind ?? "").replace(/-/g, " "));
  set("licence", entry?.licence ?? "");
  set("needs", entry?.minimum_app ? `${product} ${entry.minimum_app} or newer` : `any ${product}`);
  set("sha256", have?.sha256 || entry?.sha256 || "");
  set(
    "trust",
    have?.source === "sideload"
      ? "Sideloaded from a file, not reviewed"
      : have?.signed_by || entry?.signature
        ? `Signed by ${have?.signed_by ?? entry?.signature?.publisher}`
        : (entry?.native ?? have?.native) ? "Runs native code, unsigned" : "Unsigned",
  );
  const box = row.querySelector<HTMLInputElement>("[data-ext-enabled]");
  if (box && have && box.checked !== have.enabled) box.checked = have.enabled;
  const install = row.querySelector<HTMLElement>("[data-ext-act='install']");
  const word = have ? "Update" : "Install";
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

    const wire = (row: HTMLElement) => {
      const target = () => ({ product: row.dataset.product ?? "", id: row.dataset.ext ?? "" });
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
          fill(row, entry, have);
          wire(row);
          list.appendChild(row);
        } else fill(row, entry, have);
      }
      for (const [key, row] of mounted) {
        if (keys.has(key)) continue;
        row.remove();
        mounted.delete(key);
      }
      if (empty) empty.hidden = keys.size > 0;
    });  },
};
