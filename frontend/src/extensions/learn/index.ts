import type { Tutorial } from "../../engine/types.ts";
import { t as tr } from "../../i18n/index.ts";
import registry from "../../../../catalog/products.json";
import type { Extension } from "../registry.ts";
import { liveNow } from "../live/index.ts";

const LEVEL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

const setText = (node: Element | null, text: string) => {
  if (node && node.textContent !== text) node.textContent = text;
};

export const learn: Extension = {
  id: "learn",
  setup(engine) {
    const pane = document.querySelector<HTMLElement>("[data-pane='learn']");
    const list = document.querySelector<HTMLElement>("[data-tutorials]");
    const count = document.querySelector<HTMLElement>("[data-learn-count]");
    const error = document.querySelector<HTMLElement>("[data-learn-error]");
    const suggest = document.querySelector<HTMLElement>("[data-suggest]");
    const suggestList = document.querySelector<HTMLElement>("[data-suggest-list]");
    if (!pane || !list) return;
    const rows = new Map<string, HTMLElement>();
    let show = "all";
    let folders: number | null = null;
    let lastKey = "";

    const row = (t: Tutorial) => {
      let r = rows.get(t.id);
      if (!r) {
        r = el("li", "tutorial");
        r.dataset.tutorial = t.id;
        const head = el("button", "tutorial-head");
        head.type = "button";
        head.setAttribute("aria-expanded", "false");
        const main = el("span", "tutorial-main");
        main.append(el("span", "tutorial-app"), el("span", "tutorial-title"), el("span", "tutorial-sum"), el("span", "tutorial-meta"));
        const meter = el("span", "tutorial-meter");
        const bar = el("span", "tutorial-bar");
        bar.append(el("span", "tutorial-fill"));
        meter.append(bar, el("span", "tutorial-of"));
        head.append(main, meter);
        const body = el("div", "tutorial-body");
        body.hidden = true;
        const steps = el("ol", "tutorial-steps");
        const again = el("button", "link-btn tutorial-again", tr("Start again"));
        again.type = "button";
        again.addEventListener("click", () => void engine.dispatch("learn.mark", { id: t.id, reset: true, title: t.title }));
        body.append(steps, again);
        head.addEventListener("click", () => {
          const open = body.hidden;
          body.hidden = !open;
          head.setAttribute("aria-expanded", String(open));
        });
        r.append(head, body);
        rows.set(t.id, r);
        list.append(r);
      }
      const name = t.product === "formportal" ? "FormPortal" : engine.name(t.product);
      const listed = t.product === "formportal" || t.product === "formai" || liveNow(t.product);
      if (r.hidden === listed) r.hidden = !listed;
      setText(r.querySelector(".tutorial-app"), name);
      setText(r.querySelector(".tutorial-title"), t.title);
      setText(r.querySelector(".tutorial-sum"), t.summary);
      setText(r.querySelector(".tutorial-meta"), tr("{steps} steps · {minutes} min · {level}", { steps: t.steps.length, minutes: t.minutes, level: tr(LEVEL[t.level] ?? t.level) }));
      const done = t.done_steps.length;
      setText(r.querySelector(".tutorial-of"), t.finished ? tr("Finished") : tr("{done} of {steps}", { done, steps: t.steps.length }));
      const fill = r.querySelector<HTMLElement>(".tutorial-fill");
      const width = `${Math.round((done / Math.max(1, t.steps.length)) * 100)}%`;
      if (fill && fill.style.inlineSize !== width) fill.style.inlineSize = width;
      r.dataset.state = t.finished ? "finished" : done ? "started" : "new";
      const steps = r.querySelector<HTMLOListElement>(".tutorial-steps");
      if (steps && steps.children.length !== t.steps.length) {
        steps.replaceChildren(
          ...t.steps.map((s, i) => {
            const li = el("li", "tstep");
            const box = el("input", "tstep-box");
            box.type = "checkbox";
            box.setAttribute("aria-label", `Step ${i + 1} done`);
            box.addEventListener("change", () => void engine.dispatch("learn.mark", { id: t.id, step: i + 1, done: box.checked, title: t.title }));
            const text = el("div", "tstep-text");
            text.append(el("p", "tstep-title", `${i + 1}. ${s.title}`), el("p", "tstep-body", s.body));
            const acts = el("p", "tstep-acts");
            if (s.route) {
              const go = el("button", "btn btn-small", tr("Go there"));
              go.type = "button";
              go.addEventListener("click", () => void engine.dispatch("route.go", s.route));
              acts.append(go);
            }
            if (s.url) {
              const a = el("a", "link", tr("Read more"));
              a.href = s.url;
              a.dataset.web = "";
              acts.append(a);
            }
            text.append(acts);
            li.append(box, text);
            return li;
          }),
        );
      }
      steps?.querySelectorAll<HTMLInputElement>(".tstep-box").forEach((box, i) => {
        const on = t.done_steps.includes(i + 1);
        if (box.checked !== on) box.checked = on;
        box.closest(".tstep")?.toggleAttribute("data-done", on);
      });
    };

    const filter = () => {
      for (const r of rows.values()) {
        const hide = show !== "all" && r.dataset.state !== show;
        if (r.hidden !== hide) r.hidden = hide;
      }
    };

    const suggestion = (title: string, text: string, action: string, run: () => void) => {
      const li = el("li", "suggest-item");
      const body = el("div", "suggest-text");
      body.append(el("p", "suggest-title", title), el("p", "suggest-sub", text));
      const b = el("button", "btn btn-small", action);
      b.type = "button";
      b.addEventListener("click", run);
      li.append(body, b);
      return li;
    };

    const openTutorial = (id: string) => {
      void engine.dispatch("route.go", "learn");
      const r = rows.get(id);
      const head = r?.querySelector<HTMLButtonElement>(".tutorial-head");
      if (r && head && head.getAttribute("aria-expanded") !== "true") head.click();
      r?.scrollIntoView({ block: "nearest" });
    };

    const suggestions = () => {
      if (!suggest || !suggestList) return;
      const tutorials = engine.lastLearn?.tutorials ?? [];
      const installed = new Set(Array.from(engine.installs.values()).map((r) => r.product));
      const items: HTMLElement[] = [];
      const started = tutorials.find((t) => t.done_steps.length > 0 && !t.finished);
      if (started) {
        const next = started.steps.findIndex((_, i) => !started.done_steps.includes(i + 1));
        items.push(suggestion(tr("Continue {title}", { title: started.title }), tr("Next: step {n} of {steps}, {step}.", { n: next + 1, steps: started.steps.length, step: started.steps[next]?.title ?? "" }), tr("Continue"), () => openTutorial(started.id)));
      } else {
        const own = (t: Tutorial) => t.product === "formportal" && (installed.size === 0 ? t.id === "portal-first-app" : t.id !== "portal-first-app");
        const fresh = tutorials.find((t) => !t.done_steps.length && installed.has(t.product)) ?? tutorials.find((t) => !t.done_steps.length && own(t));
        if (fresh) items.push(suggestion(fresh.title, `${fresh.summary} ${fresh.minutes} min.`, tr("Start"), () => openTutorial(fresh.id)));
      }
      if (folders === 0) items.push(suggestion(tr("Choose where your projects live"), tr("FormPortal lists your Form projects, opens each in its app and keeps earlier versions."), tr("Go to Files"), () => void engine.dispatch("route.go", "files")));
      const groups = new Set(registry.products.filter((p) => installed.has(p.id)).map((p) => p.group));
      const pair = registry.products.find((p) => p.status === "available" && p.id !== "formai" && !installed.has(p.id) && groups.has(p.group) && engine.view(p.id, "stable").availability === "available");
      if (pair) items.push(suggestion(pair.alt_of ? tr("{name}, in place of {other}", { name: pair.name, other: pair.alt_of }) : pair.name, tr(pair.summary), tr("See the app"), () => void engine.dispatch("route.go", `app-${pair.id}`)));
      const shown = items.slice(0, 3);
      const key = shown.map((s) => s.textContent).join("|");
      if (key === lastKey) return;
      lastKey = key;
      suggestList.replaceChildren(...shown);
      if (suggest.hidden !== (shown.length === 0)) suggest.hidden = shown.length === 0;
    };

    engine.on("learn", ({ view }) => {
      engine.lastLearn = view;
      for (const t of view.tutorials) row(t);
      const finished = view.tutorials.filter((t) => t.finished).length;
      setText(count, tr("{done} of {all} finished", { done: finished, all: view.tutorials.length }));
      if (error) {
        const refused = Boolean(view.index_error && /refused|not valid|not a tutorial index/.test(view.index_error));
        const text = !view.index_error ? "" : refused ? tr("The Form apps' tutorials were refused, so only FormPortal's own are listed: {why}", { why: view.index_error }) : tr("Each Form app's own tutorials appear here as they are published.");
        error.classList.toggle("learn-quiet", !refused);
        setText(error, text);
        if (error.hidden === Boolean(text)) error.hidden = !text;
      }
      filter();
      pane.toggleAttribute("data-ready", true);
      suggestions();
    });
    engine.on("install", () => suggestions());
    engine.on("files", ({ result }) => {
      folders = result.scan.folders.length;
      suggestions();
    });

    const kinds = Array.from(pane.querySelectorAll<HTMLButtonElement>("[data-learn-show]"));
    for (const b of kinds) {
      b.addEventListener("click", () => {
        show = b.dataset.learnShow ?? "all";
        for (const o of kinds) o.setAttribute("aria-pressed", String(o === b));
        filter();
      });
    }
    engine.on("route", ({ route }) => {
      if (route === "learn" && !pane.hasAttribute("data-ready")) void engine.dispatch("learn.load");
    });
  },
};
