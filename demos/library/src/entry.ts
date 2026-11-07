import "../../../demo/src/demo.css";
import "./library.css";
import registry from "../../../catalog/products.json";
import { bundledFamilies } from "../../../demo/src/store.ts";
import { forget, isInstalled, notifyKept } from "../../../demo/src/bridge.ts";
import { inspectFile, setNamer, wireInspector } from "../../../demo/src/inspect.ts";
import { openFromFiles } from "./bridge.ts";
import { forgetLibrary } from "./state.ts";
import { downloadLibrary, items } from "./stock.ts";
import { openLook, openTester, wireViewers } from "./viewer.ts";
import "../../../frontend/src/main.ts";

const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel) as T;

setNamer((id) => new Map(registry.products.map((p) => [p.id, p.id === "formai" ? "FormPortal" : p.name])).get(id) ?? id);
wireInspector(() => notifyKept());
wireViewers(() => q("[data-route-to='fonts']").click());

const bench = q<HTMLDialogElement>("[data-demo-dialog]");
const say = q("[data-demo-say]");

async function download(): Promise<void> {
  const n = await downloadLibrary();
  say.textContent = n ? `${n} saved ${n === 1 ? "item" : "items"} downloaded as formportal-library.zip, with a CREDITS.txt.` : "Nothing is saved in the Library yet. Choose Save on a card in Stock & templates.";
}

q("[data-demo-open]").addEventListener("click", () => {
  say.textContent = "";
  q("[data-lib-count-fonts]").textContent = `${bundledFamilies.size} open-licensed families`;
  q("[data-lib-count-media]").textContent = `${items.filter((m) => m.kind === "image").length} photographs and ${items.filter((m) => m.kind === "template").length} templates`;
  bench.showModal();
});
q("[data-demo-close]").addEventListener("click", () => bench.close());
q("[data-lib-look]").addEventListener("click", () => {
  bench.close();
  void openLook();
});
q("[data-lib-tester-open]").addEventListener("click", () => {
  bench.close();
  openTester();
});
q("[data-lib-download-open]").addEventListener("click", () => void download());
q("[data-lib-tester]").addEventListener("click", openTester);
q("[data-lib-download]").addEventListener("click", () => void download());

const pick = q<HTMLInputElement>("[data-demo-pick-inspect]");
q("[data-demo-inspect]").addEventListener("click", () => pick.click());
pick.addEventListener("change", () => {
  const file = pick.files?.[0];
  pick.value = "";
  if (file) void inspectFile(file);
});
q("[data-demo-reset]").addEventListener("click", () => {
  forget();
  forgetLibrary();
  window.location.reload();
});

document.addEventListener(
  "click",
  (event) => {
    const button = (event.target as Element).closest<HTMLElement>("[data-file-act='open']");
    const row = button?.closest<HTMLElement>("[data-path]");
    const path = row?.dataset.path;
    if (!path) return;
    void openFromFiles(path);
    if (!isInstalled(row?.dataset.product ?? "")) event.stopImmediatePropagation();
  },
  true,
);
