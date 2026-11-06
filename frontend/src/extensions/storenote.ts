import { t } from "../i18n/index.ts";

export const storeNote = (pane: HTMLElement | null, store: string | null | undefined, what: string) => {
  const note = pane?.querySelector<HTMLElement>("[data-store-note]");
  if (!note) return;
  const live = Boolean(store);
  const text = live
    ? t("{what} from the formai.studio store, with the starter library that ships in FormPortal.", { what })
    : t("{what} from the starter library that ships in FormPortal. The formai.studio store adds more here when it is reachable.", { what });
  const state = live ? "live" : "starter";
  if (note.textContent !== text) note.textContent = text;
  if (note.dataset.store !== state) note.dataset.store = state;
  if (note.hidden) note.hidden = false;
};
