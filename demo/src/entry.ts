import "./demo.css";
import registry from "../../catalog/products.json";
import "./store.ts";
import { addFiles, forget, isInstalled, notifyKept, state } from "./bridge.ts";
import { fingerprint, trustedCatalogue } from "./catalogue.ts";
import { inspectFile, inspectPath, setNamer, wireInspector } from "./inspect.ts";
import "../../frontend/src/main.ts";

const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel) as T;

const names = new Map(registry.products.map((p) => [p.id, p.id === "formai" ? "FormPortal" : p.name]));
setNamer((id) => names.get(id) ?? id);

async function status(): Promise<void> {
  const sig = q("[data-demo-sig]");
  try {
    await trustedCatalogue(state.tamper);
    sig.textContent = "Signature valid";
    sig.dataset.tone = "good";
  } catch (e) {
    sig.textContent = e instanceof Error ? e.message : String(e);
    sig.dataset.tone = "bad";
  }
  q("[data-demo-key]").textContent = await fingerprint();
}

function wireBench(): void {
  const dialog = q<HTMLDialogElement>("[data-demo-dialog]");
  const say = q("[data-demo-say]");
  q("[data-demo-open]").addEventListener("click", () => {
    say.textContent = "";
    dialog.showModal();
    void status();
  });
  q("[data-demo-close]").addEventListener("click", () => dialog.close());
  q<HTMLInputElement>("[data-demo-corrupt]").addEventListener("change", (e) => {
    state.corrupt = (e.target as HTMLInputElement).checked;
    say.textContent = state.corrupt ? "The next install or update downloads one flipped byte. Try it from Apps." : "";
  });
  q<HTMLInputElement>("[data-demo-tamper]").addEventListener("change", (e) => {
    state.tamper = (e.target as HTMLInputElement).checked;
    say.textContent = state.tamper ? "The next catalogue read is altered after signing. Reload the list from Apps to see it refused." : "";
    void status();
  });
  const inspectPick = q<HTMLInputElement>("[data-demo-pick-inspect]");
  q("[data-demo-inspect]").addEventListener("click", () => inspectPick.click());
  inspectPick.addEventListener("change", () => {
    const file = inspectPick.files?.[0];
    inspectPick.value = "";
    if (file) void inspectFile(file);
  });
  const addPick = q<HTMLInputElement>("[data-demo-pick-add]");
  q("[data-demo-add]").addEventListener("click", () => addPick.click());
  addPick.addEventListener("change", async () => {
    const files = Array.from(addPick.files ?? []);
    addPick.value = "";
    const paths = await addFiles(files);
    say.textContent = paths.length ? `${paths.length} added under Files, in Your files.` : "Nothing was added.";
  });
  q("[data-demo-reset]").addEventListener("click", () => {
    forget();
    window.location.reload();
  });
}

document.addEventListener(
  "click",
  (event) => {
    const button = (event.target as Element).closest<HTMLElement>("[data-file-act='open']");
    const row = button?.closest<HTMLElement>("[data-path]");
    const path = row?.dataset.path;
    if (!path) return;
    void inspectPath(path);
    if (!isInstalled(row?.dataset.product ?? "")) event.stopImmediatePropagation();
  },
  true,
);

wireInspector(() => notifyKept());
wireBench();
