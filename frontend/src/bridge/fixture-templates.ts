import type { TemplateApp, TemplateDownload, TemplateItem, TemplatesView } from "../engine/types.ts";
import type { Bridge } from "./index.ts";

const pause = (ms: number) => new Promise<void>((done) => window.setTimeout(done, ms));
const FOLDER = "/home/you/Documents/Form/Templates";
const sum = (n: number) => n.toString(16).padStart(64, "0");

const item = (app: string, kind: "template" | "demo", slug: string, name: string, file: string, bytes: number, extra: Partial<TemplateItem> = {}): TemplateItem => ({
  id: `${app}/${kind}s/${slug}`,
  kind,
  name,
  description: "",
  path: `apps/${app}/${kind}s/${file}`,
  bytes,
  sha256: sum(bytes),
  licence: "Apache-2.0",
  credit: "",
  ...extra,
});

const CUT_SHAPES = ["Vertical short", "Wide trailer", "Interview", "Music video", "Lower third", "Title card", "Slideshow", "Split screen", "Countdown", "Recap"];
const cutItems: TemplateItem[] = Array.from({ length: 300 }, (_, i) => {
  const shape = CUT_SHAPES[i % CUT_SHAPES.length];
  const n = Math.floor(i / CUT_SHAPES.length) + 1;
  const demo = i % 6 === 5;
  const slug = `${shape.toLowerCase().replace(/\s+/g, "-")}-${n}`;
  return item("formcut", demo ? "demo" : "template", slug, `${shape} ${n}`, `${slug}.fc`, 180_000 + i * 7_919, {
    description: demo ? "A finished edit to take apart." : i % 3 === 0 ? "Timeline, titles and markers set up; drop your clips in." : "",
    credit: i % 4 === 0 ? "nodemode.ai" : "",
    preview: i % 5 === 0 ? `apps/formcut/previews/${slug}.webp` : undefined,
  });
});

const APPS: TemplateApp[] = [
  {
    id: "formvis",
    name: "FormVis",
    licence: "Apache-2.0",
    version: "1.53.9",
    items: [
      item("formvis", "template", "poster-a3", "Poster, A3", "poster-a3.fmv", 2_412_000, { description: "Portrait poster with bleed and guides.", preview: "apps/formvis/previews/poster-a3.webp", credit: "nodemode.ai" }),
      item("formvis", "template", "social-square", "Social, square", "social-square.fmv", 960_000, { preview: "apps/formvis/previews/social-square.webp" }),
      item("formvis", "demo", "retouch-walkthrough", "Retouch walkthrough", "retouch-walkthrough.zip", 14_800_000, { description: "A layered retouch with every step kept.", licence: "CC-BY-4.0", credit: "Photo by the FormVis team" }),
      item("formvis", "template", "hash-mismatch", "Sample whose checksum does not match", "hash-mismatch.fmv", 120_000, { description: "Shows what happens when a file differs from the list." }),
    ],
  },
  { id: "formcut", name: "FormCut", licence: "Apache-2.0", version: "0.62.0", items: cutItems },
  {
    id: "formdeck",
    name: "FormDeck",
    licence: "Apache-2.0",
    version: "0.46.3",
    items: [
      item("formdeck", "template", "pitch-basic", "Pitch, basic", "pitch-basic.fdeck", 48_213, { description: "Ten slides: problem, answer, numbers, ask." }),
      item("formdeck", "template", "lecture", "Lecture", "lecture.fdeck", 61_400),
      item("formdeck", "demo", "launch-keynote", "Launch keynote", "launch-keynote.fdeck", 3_200_000, { description: "The deck from a product launch, with speaker notes." }),
    ],
  },
  {
    id: "formexample",
    name: "FormExample",
    licence: "MIT",
    version: "0.1.0",
    items: [
      item("formexample", "template", "starter", "Starter", "starter.zip", 22_000, { licence: "MIT", description: "An app the catalogue does not list yet still shows by its own name." }),
      item("formexample", "demo", "tour", "Tour", "tour.zip", 31_000, { licence: "MIT" }),
    ],
  },
];

let kept: TemplatesView | null = new URLSearchParams(window.location.search).has("templates")
  ? { index: { format: "formai-templates", format_version: 1, generated: "2026-11-22T02:00:00Z", apps: APPS }, fetched: Math.floor(Date.parse("2026-11-21T23:40:00Z") / 1000), folder: FOLDER, downloaded: {} }
  : null;
const SHOTS: Record<string, string> = { formvis: "/media/formvis.webp", formcut: "/media/formcut.webp" };

export const templatesFixture: Pick<Bridge, "templatesKept" | "templatesFetch" | "templatesDownload" | "templatesPreview" | "templatesReveal"> = {
  templatesKept: async () => (kept ? { ...kept, downloaded: { ...kept.downloaded } } : null),
  templatesFetch: async () => {
    await pause(500);
    kept = { index: { format: "formai-templates", format_version: 1, generated: "2026-11-22T02:00:00Z", apps: APPS }, fetched: Math.floor(Date.now() / 1000), folder: FOLDER, downloaded: kept?.downloaded ?? {} };
    return { ...kept, downloaded: { ...kept.downloaded } };
  },
  templatesDownload: async (id) => {
    await pause(400);
    const app = APPS.find((a) => a.items.some((i) => i.id === id));
    const found = app?.items.find((i) => i.id === id);
    if (!app || !found || !kept) throw new Error(`${id} is not in the templates list`);
    if (found.id.endsWith("hash-mismatch")) throw new Error(`${found.name} does not match the templates list, so nothing was kept (expected SHA-256 ${found.sha256}, found ${"f".repeat(64)})`);
    const file = found.path.split("/").pop() ?? "";
    const unpacked = file.endsWith(".zip");
    const path = `${FOLDER}/${app.id}/${unpacked ? file.slice(0, -4) : file}`;
    kept.downloaded[id] = path;
    const done: TemplateDownload = { id, app: app.id, path, unpacked };
    return done;
  },
  templatesPreview: async (path) => {
    await pause(150);
    return SHOTS[path.split("/")[1] ?? ""] ?? "/media/formwav.webp";
  },
  templatesReveal: async () => {},
};
