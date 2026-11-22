import type { Extension } from "../registry.ts";

const topLayer = "showPopover" in HTMLElement.prototype;

const px = (node: HTMLElement, name: string): number => Number.parseFloat(getComputedStyle(node).getPropertyValue(name)) || 0;

export function placeAt(anchor: DOMRect, width: number, height: number, viewWidth: number, viewHeight: number, edge: number, gap: number, lead = 0): { x: number; y: number } {
  const farX = Math.max(edge, viewWidth - edge - width);
  const farY = Math.max(edge, viewHeight - edge - height);
  const endAligned = anchor.right - width;
  const x = Math.min(farX, Math.max(edge, endAligned >= lead + edge ? endAligned : anchor.left));
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - height;
  const y = below <= farY ? below : above >= edge ? above : farY;
  return { x: Math.round(x), y: Math.round(y) };
}

export const popout: Extension = {
  id: "popout",
  setup() {
    const view = document.documentElement;
    const parts = (drop: HTMLDetailsElement) => ({
      summary: drop.querySelector<HTMLElement>(":scope > summary"),
      panel: drop.querySelector<HTMLElement>(":scope > .drop-panel"),
    });
    const opened = () => Array.from(document.querySelectorAll<HTMLDetailsElement>("details.drop[open]"));

    const place = (drop: HTMLDetailsElement) => {
      const { summary, panel } = parts(drop);
      if (!summary || !panel) return;
      if (topLayer && panel.getAttribute("popover") !== "manual") panel.setAttribute("popover", "manual");
      if (topLayer && !panel.matches(":popover-open")) panel.showPopover();
      const at = placeAt(summary.getBoundingClientRect(), panel.offsetWidth, panel.offsetHeight, view.clientWidth, view.clientHeight, px(panel, "--popout-edge"), px(panel, "--popout-gap"), drop.closest(".stage")?.getBoundingClientRect().left ?? 0);
      panel.style.setProperty("--popout-x", `${at.x}px`);
      panel.style.setProperty("--popout-y", `${at.y}px`);
      panel.setAttribute("data-at", "");
    };

    const release = (drop: HTMLDetailsElement) => {
      const { panel } = parts(drop);
      if (!panel) return;
      panel.removeAttribute("data-at");
      if (topLayer && panel.getAttribute("popover") === "manual" && panel.matches(":popover-open")) panel.hidePopover();
    };

    document.addEventListener(
      "toggle",
      (event) => {
        const drop = event.target;
        if (!(drop instanceof HTMLDetailsElement) || !drop.classList.contains("drop")) return;
        if (drop.open) place(drop);
        else release(drop);
      },
      true,
    );

    const closeAll = () => {
      for (const drop of opened()) drop.open = false;
    };
    document.addEventListener(
      "scroll",
      (event) => {
        const from = event.target;
        if (from instanceof Element && from.closest(".drop-panel")) return;
        closeAll();
      },
      true,
    );
    window.addEventListener("resize", closeAll);

    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Escape") return;
        for (const drop of opened()) if (drop.contains(document.activeElement)) parts(drop).summary?.focus();
      },
      true,
    );
    const stops = (panel: HTMLElement) =>
      Array.from(panel.querySelectorAll<HTMLElement>("button, select, input, a[href]")).filter((node) => !(node as HTMLButtonElement).disabled && node.getClientRects().length > 0);
    let byKey: HTMLDetailsElement | null = null;
    document.addEventListener(
      "keydown",
      (event) => {
        const at = event.target instanceof HTMLElement ? event.target : null;
        const drop = at?.closest<HTMLDetailsElement>("details.drop-more");
        const { summary, panel } = drop ? parts(drop) : { summary: null, panel: null };
        if (!drop || !summary || !panel || event.altKey || event.metaKey || event.ctrlKey) return;
        if (at === summary) {
          if (["Enter", " "].includes(event.key) && !drop.open) byKey = drop;
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          byKey = drop;
          if (!drop.open) drop.open = true;
          else stops(panel)[event.key === "ArrowUp" ? stops(panel).length - 1 : 0]?.focus();
          return;
        }
        if (!drop.open || !panel.contains(at)) return;
        if (event.key === "Enter" && at instanceof HTMLInputElement && at.type === "checkbox") {
          event.preventDefault();
          at.click();
          return;
        }
        const list = stops(panel);
        const now = list.indexOf(at as HTMLElement);
        const next = event.key === "ArrowDown" ? now + 1 : event.key === "ArrowUp" ? now - 1 : event.key === "Home" ? 0 : event.key === "End" ? list.length - 1 : null;
        if (next === null || list.length === 0) return;
        event.preventDefault();
        list[(next + list.length) % list.length]?.focus();
      },
      true,
    );
    document.addEventListener(
      "toggle",
      (event) => {
        const drop = event.target;
        if (!(drop instanceof HTMLDetailsElement) || drop !== byKey) return;
        byKey = null;
        const panel = parts(drop).panel;
        if (drop.open && panel) stops(panel)[0]?.focus({ preventScroll: true });
      },
      true,
    );
    document.addEventListener(
      "click",
      (event) => {
        const item = event.target instanceof Element ? event.target.closest(".drop-item") : null;
        const drop = item?.closest<HTMLDetailsElement>("details.drop[open]");
        if (!drop) return;
        window.setTimeout(() => {
          if (!drop.open && (document.activeElement === document.body || drop.contains(document.activeElement))) parts(drop).summary?.focus();
        }, 0);
      },
      true,
    );
  },
};
