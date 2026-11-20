import type { OwnAgent } from "../../engine/types.ts";
import { t } from "../../i18n/index.ts";
import { pickBridge } from "../../bridge/index.ts";
import type { Extension } from "../registry.ts";

const WORDS: Record<OwnAgent["state"], string> = {
  connected: "Connected",
  "not-connected": "Not connected",
  taken: "Another server has this name",
  "no-client": "Not found on this computer",
};
const ELSEWHERE = "Connected to another copy";
const BLANK = " ";

const sentence = (note: string) => {
  const text = t(note);
  const head = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(head) ? head : `${head}.`;
};

export const ownAgents: Extension = {
  id: "own-agents",
  setup(engine) {
    const dialog = document.querySelector<HTMLDialogElement>("[data-prefs]");
    const list = document.querySelector<HTMLElement>("[data-own-agents]");
    if (!dialog || !list) return;
    const rows = new Map(Array.from(list.querySelectorAll<HTMLElement>("[data-own-client]")).map((row) => [row.dataset.ownClient ?? "", row]));
    const bridge = pickBridge();
    let changes = 0;
    let reading = false;

    const show = (agent: OwnAgent) => {
      const row = rows.get(agent.client);
      if (!row) return;
      const state = row.querySelector<HTMLElement>("[data-own-state]");
      const note = row.querySelector<HTMLElement>("[data-own-note]");
      const act = row.querySelector<HTMLButtonElement>("[data-own-act]");
      const elsewhere = agent.state === "connected" && !agent.current;
      const can = agent.state === "not-connected" || elsewhere ? "connect" : agent.state === "connected" ? "disconnect" : "";
      const words = t(elsewhere ? ELSEWHERE : WORDS[agent.state]);
      const said = agent.note ? sentence(agent.note) : BLANK;
      const label = t(can === "disconnect" ? "Disconnect" : "Connect");
      if (row.dataset.state !== agent.state) row.dataset.state = agent.state;
      if (state && state.textContent !== words) state.textContent = words;
      if (note && note.textContent !== said) note.textContent = said;
      if (act && can && act.textContent !== label) act.textContent = label;
      if (act && act.disabled !== (can === "")) act.disabled = can === "";
      if (can && row.dataset.ownCan !== can) row.dataset.ownCan = can;
      if (!can && row.dataset.ownCan !== undefined) delete row.dataset.ownCan;
    };

    const read = () => {
      if (reading) return;
      reading = true;
      const seen = changes;
      bridge.ownAgents().then(
        (agents) => {
          reading = false;
          if (seen === changes) agents.forEach(show);
        },
        () => {
          reading = false;
        },
      );
    };

    for (const [client, row] of rows) {
      row.querySelector<HTMLButtonElement>("[data-own-act]")?.addEventListener("click", () => {
        const can = row.dataset.ownCan;
        if (!can || row.hasAttribute("data-busy")) return;
        row.toggleAttribute("data-busy", true);
        changes += 1;
        bridge.connectOwn(client, can === "disconnect").then(
          (agents) => {
            row.toggleAttribute("data-busy", false);
            agents.forEach(show);
          },
          (e) => {
            row.toggleAttribute("data-busy", false);
            engine.setNotice(e instanceof Error ? e.message : String(e), "fault", "agents");
          },
        );
      });
    }

    new MutationObserver(() => {
      if (dialog.open) read();
    }).observe(dialog, { attributes: true, attributeFilter: ["open"] });
    if (dialog.open) read();
  },
};
