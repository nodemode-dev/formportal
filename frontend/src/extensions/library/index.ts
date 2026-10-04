import type { ExtensionEntry } from "../../engine/types.ts";
import type { Extension } from "../registry.ts";

const PERMISSIONS: Record<string, string> = {
  document: "the open document",
  "files-read": "reading files",
  "files-write": "writing files",
  network: "the network",
  models: "local models",
  "native-code": "native code",
};

function fill(row: HTMLElement, entry: ExtensionEntry): void {
  const set = (field: string, text: string) => {
    const node = row.querySelector<HTMLElement>(`[data-field='${field}']`);
    if (node && node.textContent !== text) node.textContent = text;
  };
  row.dataset.product = entry.product;
  row.dataset.trust = entry.signature ? "signed" : "unsigned";
  set("name", entry.name);
  set("meta", `${entry.product}, by ${entry.author}, version ${entry.version}`);
  set("description", entry.description);
  set("permissions", `Can use ${entry.permissions.map((p) => PERMISSIONS[p] ?? p).join(", ") || "nothing"}`);
  set("trust", entry.signature ? "Signed" : "Unsigned, for testing");
}

export const library: Extension = {
  id: "library",
  setup(engine) {
    const list = document.querySelector<HTMLElement>("[data-ext-list]");
    const template = document.querySelector<HTMLTemplateElement>("#ext-row");
    const empty = document.querySelector<HTMLElement>("[data-ext-empty]");
    if (!list || !template) return;
    const mounted = new Map<string, HTMLElement>();

    engine.on("extensions", () => {
      const entries = engine.state.extensions?.packages ?? [];
      const seen = new Set<string>();
      for (const entry of entries) {
        seen.add(entry.id);
        let row = mounted.get(entry.id);
        if (!row) {
          row = (template.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
          row.dataset.ext = entry.id;
          mounted.set(entry.id, row);
          fill(row, entry);
          list.appendChild(row);
        } else fill(row, entry);
      }
      for (const [id, row] of mounted) {
        if (seen.has(id)) continue;
        row.remove();
        mounted.delete(id);
      }
      if (empty) empty.hidden = entries.length > 0;
    });
  },
};
